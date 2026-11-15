import {mergeBackup, parseBackup, type Backup} from './learnerData';

export type Remote = {
  read: () => Promise<{revision:number;payload:unknown} | null>;
  write: (expected:number, payload:Backup) => Promise<boolean>;
};

export async function reconcile(remote:Remote, local:()=>Backup, cancelled=()=>false) {
  for (let attempt=0;attempt<4 && !cancelled();attempt++) {
    const current=await remote.read();
    if (cancelled()) return;
    const incoming=current ? parseBackup(current.payload) : null;
    const saved=local();
    const merged=incoming ? mergeBackup(saved,incoming) : saved;
    if (current && incoming && sameSnapshot(incoming,merged)) return merged;
    if (await remote.write(current?.revision??0,merged)) return mergeBackup(merged,local());
  }
  if (!cancelled()) throw new Error('Concurrent changes prevented sync. Try again.');
}

function sameSnapshot(a:Backup,b:Backup) {
  const canonical=(value:object)=>JSON.stringify(Object.entries(value).sort(([left],[right])=>left.localeCompare(right)));
  return canonical(a.progress)===canonical(b.progress) && canonical(a.drafts)===canonical(b.drafts);
}
