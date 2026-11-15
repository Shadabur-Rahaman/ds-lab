import {useEffect,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {learningItems,lessonState,projects,stages,track} from './curriculum';
import {projectNotes,readLearnerText,watchLearnerText,parseBackup,snapshot,type Backup} from './lib/learnerData';
import type {Progress} from './lib/progress';
import type {LearningId} from './data';
import {appUrl} from './lib/urls';
import {allProjectBits,projectCatalog,projectReportKey,projectSteps,type ProjectId} from './projectCatalog';
import {downloadText} from './lib/downloadText';

export function Portfolio({progress}:{progress:Progress}) {
  const [notes,setNotes]=useState(()=>Object.fromEntries(Object.values(projectNotes).map(key=>[key,readLearnerText(key)])));
  const [reports,setReports]=useState(()=>Object.fromEntries(projects.map(({id})=>[id,readLearnerText(projectReportKey(id))])));
  useEffect(()=>{
    const stop=Object.values(projectNotes).map(key=>watchLearnerText(key,value=>setNotes(current=>({...current,[key]:value}))));
    stop.push(...projects.map(({id})=>watchLearnerText(projectReportKey(id),report=>setReports(current=>({...current,[id]:report})))));
    return ()=>stop.forEach(unsubscribe=>unsubscribe());
  },[]);
  const completed=projects.filter(({id})=>lessonState(progress,id)==='Completed');
  const started=projects.filter(({id})=>!!(progress[id]?.viewedAt||progress[id]?.quiz||progress[id]?.code));
  const skills=[...new Set(completed.flatMap(({id})=>[...projectCatalog[id].skills]))];
  function exportPortfolio(id:ProjectId, format:'md'|'json') {
    const report=reports[id];
    if(!report)return;
    const project=projectCatalog[id];
    const title=projects.find(item=>item.id===id)!.title;
    const milestones=projectSteps.filter((_,index)=>(progress[id]?.studio??0)&(1<<index)).map(([step,objective])=>({step,objective}));
    const data={title,problem:project.problem,dataset:project.dataset,skills:project.skills,milestones,
      visualization:project.analysis,limitations:project.limitation,learningOutcome:project.outcome,report};
    if(format==='json') {
      downloadText(id+'-portfolio.json',JSON.stringify(data,null,2),'application/json');
    }else{
      const text=[`# ${title}`,'','## Problem',data.problem,'','## Dataset',data.dataset,'','## Tools and techniques',data.skills.join(', '),'',
        '## Implementation milestones',...milestones.map(({step,objective})=>`- **${step}** · ${objective}`),'','## Visualization and interpretation',
        data.visualization,'','## Limitations',data.limitations,'','## Learning outcome',data.learningOutcome,'',
        '## Computed results and learner findings','',report.replace(/^# .+\r?\n/,'')].join('\n');
      downloadText(id+'-portfolio.md',text,'text/markdown;charset=utf-8');
    }
  }
  return <section className="section" id="project-portfolio" aria-labelledby="portfolio-heading">
    <h2 id="portfolio-heading">Project portfolio</h2>
    <p>{started.length} started · {completed.length} completed · {projects.filter(({id})=>progress[id]?.code).length} reports generated</p>
    {!!skills.length&&<p><strong>Skills demonstrated</strong> {skills.join(' · ')}</p>}
    <div className="course-grid v5-course-grid">{projects.map(project=>{
      const entry=progress[project.id];
      const details=projectCatalog[project.id];
      const note=notes[projectNotes[project.id]];
      const report=reports[project.id];
      const state=lessonState(progress,project.id);
      const studio=entry?.studio??0;
      return <article className="course-card" key={project.id}>
        <span className="chip neutral">{state}</span><h3>{project.title}</h3>
        <p>{details.problem}</p><p>{details.level} · {details.minutes} min estimated · {details.skills.join(' · ')}</p>
        <ul className="portfolio-milestones"><li>{entry?.quiz?'Knowledge check passed':'Knowledge check pending'}</li>
          <li>{entry?.code?'Report generated':'Report pending'}</li><li>{note?.trim()?'Notes saved in this browser':'No saved notes yet'}</li>
          <li>{projectSteps.filter((_,index)=>studio&(1<<index)).length} of 6 Studio milestones</li></ul>
        {note?.trim() && <details><summary>Saved notes</summary><p className="portfolio-notes">{note}</p></details>}
        {report&&<div className="project-export-actions">
          <button className="button small" onClick={()=>downloadText(project.id+'-report.md',report,'text/markdown;charset=utf-8')}>Download saved report</button>
          {(studio&allProjectBits)===allProjectBits&&<>
            <button className="button small" onClick={()=>exportPortfolio(project.id,'md')}>Export portfolio Markdown</button>
            <button className="button small" onClick={()=>exportPortfolio(project.id,'json')}>Export portfolio JSON</button>
          </>}
        </div>}
        <a className="button small" href={appUrl(project.path)}>{state==='Ready to start'?'Open project':'Resume project'} <ArrowRight size={14}/></a>
      </article>;
    })}</div>
    <p className="muted">Reports are saved on this browser. Review your findings before sharing an export.</p>
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
