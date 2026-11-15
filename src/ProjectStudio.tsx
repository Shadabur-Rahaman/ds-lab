import {useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft,Check,Download} from 'lucide-react';
import {CodeEditor} from './components';
import {datasetProfile,projectExercises} from './projectExercises';
import {allProjectBits,projectBits,projectCatalog,projectDraftId,projectModeKey,projectReportKey,projectSteps,type ProjectId} from './projectCatalog';
import {readLearnerText,watchLearnerText,writeLearnerText} from './lib/learnerData';
import {downloadText} from './lib/downloadText';
import {appUrl} from './lib/urls';
import './project-studio.css';

export function ProjectStudio({id,studio,legacyComplete,mark,children}:{
  id:ProjectId; studio?:number; legacyComplete:boolean; mark:(bit:number)=>void; children:ReactNode;
}) {
  const project=projectCatalog[id];
  const exercise=projectExercises[id];
  const [mode,setMode]=useState(()=>readLearnerText(projectModeKey(id))==='independent'?'independent':'guided');
  const [modeNotice,setModeNotice]=useState('');
  const [report,setReport]=useState(()=>readLearnerText(projectReportKey(id)));
  const [choice,setChoice]=useState('');
  const [feedback,setFeedback]=useState('');
  const [column,setColumn]=useState(0);
  const [profile,setProfile]=useState<ReturnType<typeof datasetProfile>>(null);
  const [header,...rows]=exercise.file.csv.trimEnd().split(/\r?\n/);
  const columns=header.split(',');
  const bits=(studio??0)&allProjectBits;
  const complete=bits===allProjectBits;
  useEffect(()=>watchLearnerText(projectReportKey(id),setReport),[id]);
  function changeMode(next:'guided'|'independent') {
    setMode(next);
    setModeNotice(writeLearnerText(projectModeKey(id),next)?'':'This browser could not save the mode preference.');
  }
  function checkFraming() {
    const correct=Number(choice)===project.answer;
    if(correct)mark(projectBits.understand);
    setFeedback(correct?'Correct. Use this framing when interpreting the results.':'Try again. Compare the project objective with the dataset description.');
  }
  return <div className="project-studio">
    <a className="text-link" href={appUrl('/projects/')}><ArrowLeft size={15}/> Project portfolio</a>
    <section className="experiment project-brief" aria-labelledby="studio-brief">
      <div className="section-heading"><div><span className="eyebrow">Project Studio</span><h2 id="studio-brief">Project brief</h2></div>
        <span className="chip neutral">{project.level} · {project.minutes} min estimated</span></div>
      <p className="project-question">{project.problem}</p>
      <p>{project.goal}</p>
      <div className="project-facts"><div><strong>Dataset</strong><p>{project.dataset}</p></div>
        <div><strong>Prerequisites</strong><p>{project.prerequisite}</p><strong>Skills</strong><p>{project.skills.join(' · ')}</p></div></div>
      <label>Workspace mode <select value={mode} onChange={event=>changeMode(event.target.value==='independent'?'independent':'guided')}>
        <option value="guided">Guided mode</option><option value="independent">Independent mode</option>
      </select></label>
      {modeNotice&&<p role="status">{modeNotice}</p>}
    </section>
    <nav className="lesson-sections" aria-label="Project workspace">
      <a href="#studio-milestones">Milestones</a><a href="#studio-dataset">Dataset</a>
      <a href="#studio-practice">Python</a><a href="#studio-results">Results and report</a>
    </nav>
    <section className="experiment project-milestones" aria-labelledby="studio-milestones">
      <h2 id="studio-milestones">Milestones</h2>
      <ol>{projectSteps.map(([name,objective],index)=>{
        const done=Boolean(bits & (1<<index));
        return <li key={name}><strong>{done&&<Check size={16} aria-hidden="true"/>}{name}</strong>
          <small>{done?'Verified':objective}</small></li>;
      })}</ol>
      <p role="status">{complete?'All six Project Studio milestones complete.':legacyComplete?'Your earlier project completion is preserved. Complete these steps to add new Studio evidence.':`${projectSteps.filter((_,index)=>bits & (1<<index)).length} of 6 milestones verified.`}</p>
      {mode==='guided'&&<p className="muted">Keep one computed value and one limitation in your findings. {project.analysis}</p>}
      {report&&<button className="button small" onClick={()=>downloadText(id+'-report.md',report,'text/markdown;charset=utf-8')}><Download size={15}/> Download saved report</button>}
    </section>
    <section className="experiment project-profile" aria-labelledby="studio-dataset">
      <h2 id="studio-dataset">Explore the dataset</h2>
      <div className="project-form">
        <label>{project.question}<select value={choice} onChange={event=>{setChoice(event.target.value);setFeedback('');}}>
          <option value="">Choose an answer</option>{project.options.map((option,index)=><option key={option} value={index}>{option}</option>)}
        </select></label>
        <button className="button small" disabled={!choice} onClick={checkFraming}>Check project framing</button>
      </div>{feedback&&<p role="status">{feedback}</p>}
      <div className="table-wrap" role="region" aria-label="Project data preview" tabIndex={0}>
        <table><caption>First four rows of {exercise.file.name}</caption><thead><tr>{columns.map(name=><th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{rows.slice(0,4).map((row,index)=><tr key={index}>{row.split(',').map((value,j)=><td key={j}>{value===''?'Missing':Number.isFinite(Number(value))?Number(Number(value).toFixed(4)):value}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="project-form">
        <label>Profile column <select value={column} onChange={event=>{setColumn(Number(event.target.value));setProfile(null);}}>
          {columns.map((name,index)=><option key={name} value={index}>{name}</option>)}
        </select></label>
        <button className="button small" onClick={()=>{
          const next=datasetProfile(exercise.file.csv,column);
          setProfile(next);
          if(next?.rows)mark(projectBits.explore);
        }}>Compute column profile</button>
      </div>
      {profile&&<p role="status"><strong>{profile.column}</strong> · {profile.rows} rows · {profile.missing} missing · {profile.distinct} distinct nonblank values</p>}
      <button className="button small" onClick={()=>downloadText(exercise.file.name,exercise.file.csv,'text/csv;charset=utf-8')}><Download size={15}/> Download exercise data</button>
    </section>
    <section aria-labelledby="studio-practice"><h2 id="studio-practice">Python workspace</h2>
      <CodeEditor lesson={exercise} draftId={projectDraftId(id)} onPass={()=>mark(projectBits.implement)} independent={mode==='independent'}/>
    </section>
    <div id="studio-results" className="project-workbench">{children}</div>
  </div>;
}
