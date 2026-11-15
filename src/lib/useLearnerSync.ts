import {useEffect,useRef,useState} from 'react';
import {learnerEvent, mergeBackup, snapshot, type Backup} from './learnerData';
import {parseProgress,type Progress} from './progress';
import {supabase} from './authClient';
import {reconcile} from './learnerSync';

export const syncOwnerKey='ds-lab:sync-owner';
export const syncPauseKey='ds-lab:sync-paused';
const readOwner=()=>{try{return localStorage.getItem(syncOwnerKey);}catch{return null;}};
const isPaused=()=>{try{return localStorage.getItem(syncPauseKey)==='1';}catch{return true;}};

export function useLearnerSync(userId:string|undefined, progress:Progress, accept:(backup:Backup)=>boolean) {
  const [owner,setOwner]=useState(readOwner);
  const [paused,setPaused]=useState(isPaused);
  const [status,setStatus]=useState('');
  const progressRef=useRef(progress);
  const acceptRef=useRef(accept);
  progressRef.current=progress;
  acceptRef.current=accept;
  const request=useRef<()=>void>(()=>{});
  const enabled=!!userId&&owner===userId&&!paused;
  useEffect(()=>{
    const listener=(event:StorageEvent)=>{
      if(event.key===syncOwnerKey||event.key===syncPauseKey){setOwner(readOwner());setPaused(isPaused());}
    };
    window.addEventListener('storage',listener);
    return ()=>window.removeEventListener('storage',listener);
  },[]);
  useEffect(()=>{request.current();},[progress]);

  useEffect(()=>{
    const client=supabase;
    if (!enabled||!client||!userId) {request.current=()=>{};setStatus('');return;}
    const controller=new AbortController();
    let stopped=false,running=false,queued=false;
    const cancelled=()=>stopped||isPaused()||readOwner()!==userId;
    let timer:ReturnType<typeof setTimeout>;
    async function run() {
      if(cancelled())return;
      if(!navigator.onLine){setStatus('Offline. Changes stay in this browser and will sync when online.');return;}
      if(running){queued=true;return;}
      running=true;
      setStatus('Syncing learning data…');
      try {
        const {data:legacy,error:legacyError}=await client!.from('learning_progress').select('lesson_id,quiz,code')
          .eq('user_id',userId!).abortSignal(controller.signal);
        if(legacyError)throw legacyError;
        const old=parseProgress(Object.fromEntries((legacy??[]).map(row=>[row.lesson_id,{quiz:row.quiz,code:row.code}])));
        const result=await reconcile({
          async read(){
            const {data,error}=await client!.from('learner_snapshots').select('revision,payload').eq('user_id',userId!)
              .abortSignal(controller.signal).maybeSingle();
            if(error)throw error;
            return data;
          },
          async write(expected,payload){
            if(cancelled())return false;
            if(expected===0){
              const {error}=await client!.from('learner_snapshots').insert({user_id:userId,revision:1,payload}).abortSignal(controller.signal);
              if(error&&error.code!=='23505')throw error;
              return !error;
            }
            const {data,error}=await client!.from('learner_snapshots').update({revision:expected+1,payload})
              .eq('user_id',userId!).eq('revision',expected).select('revision').abortSignal(controller.signal).maybeSingle();
            if(error)throw error;
            return !!data;
          },
        },()=>mergeBackup(snapshot(progressRef.current),{format:'ds-lab-learner-v1',progress:old,drafts:{}}),cancelled);
        if(!cancelled()&&result){
          setStatus(acceptRef.current(result) ? 'Learning data synced. Newer draft edits take precedence.' : 'Account updated. Browser storage could not save all merged work.');
        }
      }catch {
        if(!stopped)setStatus('Sync unavailable. Your work stays in this browser. Retry when the connection or account setup is ready.');
      }finally{
        running=false;
        if(queued&&!stopped){queued=false;schedule();}
      }
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>void run(),900);}
    request.current=schedule;
    window.addEventListener(learnerEvent,schedule);
    window.addEventListener('online',schedule);
    window.addEventListener('offline',schedule);
    const interval=setInterval(schedule,30000);
    schedule();
    return ()=>{stopped=true;controller.abort();request.current=()=>{};clearInterval(interval);clearTimeout(timer);
      window.removeEventListener(learnerEvent,schedule);window.removeEventListener('online',schedule);window.removeEventListener('offline',schedule);};
  },[enabled,userId]);

  return {enabled, status, blocked:!!owner&&!!userId&&owner!==userId,
    enable(){
      if(!userId || (owner&&owner!==userId))return;
      try{localStorage.setItem(syncOwnerKey,userId);localStorage.removeItem(syncPauseKey);setOwner(userId);setPaused(false);}
      catch{setStatus('Browser storage is unavailable. Sync could not be enabled.');}
    },
    retry:()=>request.current(),
  };
}
