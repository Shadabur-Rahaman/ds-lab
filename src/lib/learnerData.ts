import {lessonIds, mergeProgress, parseProgress, readProgress, validStudio, type Progress} from './progress';
import {projectCatalog,projectDraftId,projectReportKey,projectModeKey,isProject,type ProjectId} from '../projectCatalog';
import {sqlLessons} from '../sqlLessons';

export const projectNotes = {
  'iris-eda':'ds-lab:iris:report',
  'retail-project':'ds-lab:retail-findings',
  'iris-classification':'ds-lab:iris-classification-conclusion',
  'neural-classification':'ds-lab:neural-report',
  'customer-purchases':'ds-lab:purchase-findings',
  'student-performance':'ds-lab:student-findings',
} as const;

const sqlIds = new Set<string>(sqlLessons.map(item=>item.id));
const keys = new Set([...Object.values(projectNotes), ...lessonIds.filter(id=>!Object.hasOwn(projectNotes,id))
  .map(id=>sqlIds.has(id) ? 'ds-lab:sql-draft:'+id : 'learning-ecosystem:ds:draft:'+id)]);
keys.add('ds-lab:sql-draft:customer-purchases');
for(const id of Object.keys(projectCatalog) as ProjectId[]) {
  keys.add('learning-ecosystem:ds:draft:'+projectDraftId(id));
  keys.add(projectReportKey(id));
  keys.add(projectModeKey(id));
}
const versionKey = (key:string) => 'ds-lab:learner-version:'+key;
export const learnerEvent = 'ds-lab:learning-changed';
const mergedEvent = 'ds-lab:learner-work-merged';
export function watchLearnerText(key:string, update:(value:string)=>void) {
  const refresh=()=>{const value=readLearnerText(key);if(value!==null)update(value);};
  const storage=(event:StorageEvent)=>{if(event.key===versionKey(key)||event.key===key)refresh();};
  window.addEventListener(mergedEvent,refresh);
  const changed=(event:Event)=>{if((event as CustomEvent<string>).detail===key)refresh();};
  window.addEventListener(learnerEvent,changed);
  window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener(mergedEvent,refresh);window.removeEventListener(learnerEvent,changed);window.removeEventListener('storage',storage);};
}
export type Draft = {text:string; updatedAt:number};
export type Backup = {format:'ds-lab-learner-v1'; progress:Progress; drafts:Record<string,Draft>};
const object = (value:unknown):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
const validTime = (value:unknown):value is number => typeof value==='number' && Number.isSafeInteger(value) && value>=0;
const memory: Record<string,Draft> = {};

function parseDrafts(value:unknown, strict=false) {
  const result: Record<string,Draft> = {};
  if (!object(value)) throw new Error('Drafts must be an object.');
  for (const [key,entry] of Object.entries(value)) {
    if (!keys.has(key) || !object(entry) || typeof entry.text!=='string' || entry.text.length>60000 || !validTime(entry.updatedAt)) {
      if (strict) throw new Error('Backup contains an unsupported draft.');
      continue;
    }
    result[key]={text:entry.text,updatedAt:entry.updatedAt};
  }
  return result;
}

function readDraft(key:string):Draft|undefined {
  const pending=memory[key];
  try {
    const text=localStorage.getItem(key);
    const raw=localStorage.getItem(versionKey(key));
    let metadata:unknown;
    try{metadata=JSON.parse(raw??'null');}catch{metadata=null;}
    const saved=object(metadata)&&typeof metadata.text==='string'&&metadata.text.length<=60000&&validTime(metadata.updatedAt)
      ? {text:metadata.text,updatedAt:metadata.updatedAt} : undefined;
    const legacy=text!==null&&text.length<=60000 ? {text,updatedAt:0} : undefined;
    const current=saved??legacy;
    if (!pending||!current) return pending??current;
    return mergeDrafts({[key]:current},{[key]:pending})[key];
  }catch{return pending;}
}
function readDrafts() {
  const result: Record<string,Draft> = {};
  for (const key of keys) {
    const entry=readDraft(key);
    if(entry)result[key]=entry;
  }
  return result;
}
export function readLearnerText(key:string) {
  return keys.has(key) ? readDraft(key)?.text ?? null : null;
}

export function writeLearnerText(key:string,text:string) {
  if (!keys.has(key) || text.length>60000) return false;
  const current=readDraft(key);
  const record = {text,updatedAt:Math.max(Date.now(),(current?.updatedAt??0)+1)};
  memory[key]=record;
  let ok=true;
  try {
    localStorage.setItem(key,text);
    localStorage.setItem(versionKey(key),JSON.stringify(record));
    delete memory[key];
  } catch {ok=false;}
  window.dispatchEvent(new CustomEvent(learnerEvent,{detail:key}));
  return ok;
}

export function snapshot(progress=readProgress()):Backup {
  return {format:'ds-lab-learner-v1',progress,drafts:readDrafts()};
}
export function parseBackup(value:unknown):Backup {
  if (!object(value) || value.format!=='ds-lab-learner-v1' || !object(value.progress) || !object(value.drafts)) {
    throw new Error('Choose a compatible DS LAB JSON backup.');
  }
  for (const [id,entry] of Object.entries(value.progress)) {
    if (!lessonIds.includes(id as typeof lessonIds[number]) || !object(entry) ||
        ['quiz','code','started'].some(key=>entry[key]!==undefined && typeof entry[key]!=='boolean') ||
        (entry.studio!==undefined && (!isProject(id)||!validStudio(entry.studio))) ||
        ['updatedAt','viewedAt'].some(key=>entry[key]!==undefined && !validTime(entry[key]))) throw new Error('Backup contains invalid progress.');
  }
  return {format:value.format,progress:parseProgress(value.progress),drafts:parseDrafts(value.drafts,true)};
}
function mergeDrafts(a:Backup['drafts'],b:Backup['drafts']) {
  const result={...a};
  for (const [key,other] of Object.entries(b)) {
    const existing=result[key];
    if (!existing || other.updatedAt>existing.updatedAt ||
        (other.updatedAt===existing.updatedAt && other.text>existing.text)) result[key]=other;
  }
  return result;
}
export function mergeBackup(a:Backup,b:Backup):Backup {
  return {format:a.format,progress:mergeProgress(a.progress,b.progress),drafts:mergeDrafts(a.drafts,b.drafts)};
}
export function applyDrafts(drafts:Backup['drafts']) {
  const current=readDrafts();
  const next=mergeDrafts(current,drafts);
  let saved=true,changed=false;
  for (const [key,entry] of Object.entries(next)) {
    if (!memory[key] && current[key]?.text===entry.text && current[key]?.updatedAt===entry.updatedAt) continue;
    changed=true;
    try {
      localStorage.setItem(key,entry.text);
      localStorage.setItem(versionKey(key),JSON.stringify(entry));
      delete memory[key];
    } catch {memory[key]=entry;saved=false;}
  }
  if(changed)window.dispatchEvent(new Event(mergedEvent));
  return saved;
}
export function clearDrafts() {
  for (const key of keys) {localStorage.removeItem(key);localStorage.removeItem(versionKey(key));}
  for (const key of Object.keys(memory)) delete memory[key];
}
