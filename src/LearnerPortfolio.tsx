import {useEffect,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {learningItems,lessonState,projects,stages,track} from './curriculum';
import {projectNotes,readLearnerText,watchLearnerText,parseBackup,snapshot,type Backup} from './lib/learnerData';
import type {Progress} from './lib/progress';
import type {LearningId} from './data';
import {appUrl} from './lib/urls';

const details={
  'iris-eda':['Explore three Iris species through measurements and a simple decision rule.','Exploration · interpretation'],
  'retail-project':['Clean retail records, check quality and explain the patterns.','Data cleaning · visualization'],
  'iris-classification':['Train a classifier and inspect its held-out results.','Classification · model evaluation'],
  'neural-classification':['Train a neural network and compare training and held-out results.','Neural networks · error analysis'],
} as const;

export function Portfolio({progress}:{progress:Progress}) {
  const [notes,setNotes]=useState(()=>Object.fromEntries(Object.values(projectNotes).map(key=>[key,readLearnerText(key)])));
  useEffect(()=>{
    const stop=Object.values(projectNotes).map(key=>watchLearnerText(key,value=>setNotes(current=>({...current,[key]:value}))));
    return ()=>stop.forEach(unsubscribe=>unsubscribe());
  },[]);
  return <section className="section" id="project-portfolio" aria-labelledby="portfolio-heading">
    <h2 id="portfolio-heading">Project portfolio</h2>
    <div className="course-grid v5-course-grid">{projects.map(project=>{
      const entry=progress[project.id];
      const [description,skills]=details[project.id];
      const note=notes[projectNotes[project.id]];
      const state=lessonState(progress,project.id);
      return <article className="course-card" key={project.id}>
        <span className="chip neutral">{state}</span><h3>{project.title}</h3>
        <p>{description}</p><p>{skills}</p>
        <ul className="portfolio-milestones"><li>{entry?.quiz?'Knowledge check passed':'Knowledge check pending'}</li>
          <li>{entry?.code?'Report generated':'Report pending'}</li><li>{note?.trim()?'Notes saved in this browser':'No saved notes yet'}</li></ul>
        {note?.trim() && <details><summary>Saved notes</summary><p className="portfolio-notes">{note}</p></details>}
        <a className="button small" href={appUrl(project.path)}>{state==='Ready to start'?'Open project':'Resume project'} <ArrowRight size={14}/></a>
      </article>;
    })}</div>
    <p className="muted">Open a project to review notes and generate its report with the project’s own data and controls.</p>
  </section>;
}

export function ActivitySummary({progress,nextId}:{progress:Progress;nextId:LearningId}) {
  const current=stages.find(stage=>stage.items.some(item=>item.id===nextId))?.title ?? 'Guided projects';
  const remaining=track.filter(item=>lessonState(progress,item.id)!=='Completed').length;
  const recent=learningItems.filter(item=>progress[item.id]?.viewedAt)
    .sort((a,b)=>progress[b.id]!.viewedAt!-progress[a.id]!.viewedAt!).slice(0,5);
  const coursesDone=stages.filter(stage=>stage.items.every(item=>lessonState(progress,item.id)==='Completed')).length;
  return <section className="experiment analysis-panel learner-summary" aria-label="Learning activity">
    <div><h2>Current stage</h2><p>{current}</p><p>{track.length-remaining} lessons complete · {remaining} remaining</p>
      <p>{coursesDone} of {stages.length} course stages complete</p></div>
    <div><h2>Recently visited</h2>{recent.length ? <ul>{recent.map(item=><li key={item.id}>
      <a className="text-link" href={appUrl(projects.find(project=>project.id===item.id)?.path ?? '/learn/'+item.id)}>{item.title} <ArrowRight size={14}/></a></li>)}</ul> :
      <p>Open a lesson or project to start your history.</p>}</div>
  </section>;
}

export function LearnerControls({progress,accept,reset}:{progress:Progress;accept:(backup:Backup)=>boolean;reset:(id:LearningId|'all')=>void}) {
  const [message,setMessage]=useState('');
  const [selection,setSelection]=useState<LearningId>(track[0].id);
  function exportBackup() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(progress),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='ds-lab-progress.json';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Backup exported.');
  }
  async function importBackup(file:File) {
    try {
      if(file.size>32_000_000)throw new Error('This backup exceeds 32 MB.');
      const backup=parseBackup(JSON.parse(await file.text()));
      setMessage(accept(backup)?'Backup merged with your current progress.':'Backup merged for this session. Browser storage could not save all changes.');
    }catch(error){setMessage(error instanceof SyntaxError?'This file is not valid JSON.':error instanceof Error?error.message:'Could not read this backup.');}
  }
  function confirmReset(id:LearningId|'all') {
    const confirmed=window.confirm(id==='all'?'Clear all DS LAB progress, drafts, and project notes from this browser? Account data is unaffected.' :
      'Clear the selected lesson’s progress on this browser? Drafts and account data are kept. Sync will pause until you enable it again.');
    if(confirmed)reset(id);
  }
  return <section className="experiment analysis-panel learner-controls" aria-labelledby="data-controls">
    <h2 id="data-controls">Your learning data</h2>
    <p>Backups include progress, supported code drafts, and project notes. Import keeps completed checks and uses the newer draft when edits differ.</p>
    <button className="button" onClick={exportBackup}>Export progress backup</button>
    <label>Import progress backup <input type="file" accept=".json,application/json" onChange={event=>{
      const file=event.target.files?.[0];event.target.value='';if(file)void importBackup(file);
    }}/></label>
    <label>Lesson to clear <select value={selection} onChange={event=>setSelection(event.target.value as LearningId)}>
      {track.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
    </select></label>
    <div className="lab-actions"><button className="button" onClick={()=>confirmReset(selection)}>Clear selected lesson checks</button>
      <button className="button" onClick={()=>confirmReset('all')}>Clear all local learning data</button></div>
    <p role="status">{message}</p>
  </section>;
}
