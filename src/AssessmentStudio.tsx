import {useEffect,useRef,useState} from 'react';
import {Check,ArrowRight} from 'lucide-react';
import {assessmentCourses,assessmentItems,attemptKey,codingDraft,type AssessmentItem,type Course,type Difficulty} from './assessmentCatalog';
import {readAttempts,saveAttempt,scoreAttempt,missedItems,submitAnswer,topicPerformance,practiceItem,type Attempt,type Submission} from './lib/assessmentProgress';
import {watchLearnerText} from './lib/learnerData';
import {CodeEditor} from './components';
import {SqlStudio} from './SqlStudio';
import {appUrl} from './lib/urls';
import './assessment.css';

const allAttempts=()=>Object.fromEntries(assessmentCourses.map(course=>[course,readAttempts(course)])) as Record<Course,Attempt[]>;
function comparableAttempts(course:Course,attempts:Attempt[]){
  const items=assessmentItems.filter(item=>item.course===course).map(item=>item.id).join(',');
  return attempts.filter(attempt=>attempt.mode==='course'&&attempt.items.join(',')===items&&scoreAttempt(attempt).complete)
    .sort((a,b)=>b.updated-a.updated);
}

function useAttempts(){
  const [all,setAll]=useState(allAttempts);
  useEffect(()=>{
    const subscriptions=assessmentCourses.map(course=>watchLearnerText(attemptKey(course),()=>setAll(prev=>({...prev,[course]:readAttempts(course)}))));
    return ()=>subscriptions.forEach(stop=>stop());
  },[]);
  return all;
}

export function SkillDashboard(){
  const all=useAttempts();
  const entries=assessmentCourses.flatMap(course=>all[course].map(attempt=>({course,attempt})));
  const exams=entries.filter(({attempt})=>attempt.mode==='course');
  const finished=exams.filter(({attempt})=>scoreAttempt(attempt).complete);
  const solved=new Set(entries.flatMap(({attempt})=>attempt.items.filter(id=>attempt.answers[id]?.correct&&practiceItem(id)?.kind!=='choice')));
  const topics=assessmentCourses.flatMap(course=>topicPerformance(course,all[course]).map(topic=>({...topic,course})));
  const attempted=topics.filter(topic=>topic.answered>0);
  const weak=attempted.filter(topic=>topic.correct<topic.answered).sort((a,b)=>a.correct/a.answered-b.correct/b.answered)[0];
  const suggested=weak??topics.find(topic=>topic.answered<topic.items);
  const recent=entries.filter(({attempt})=>scoreAttempt(attempt).answered>0).sort((a,b)=>b.attempt.updated-a.attempt.updated).slice(0,5);
  const comparison=assessmentCourses.flatMap(course=>{
    const [latest,previous]=comparableAttempts(course,all[course]);
    return latest&&previous?[{course,latest:scoreAttempt(latest),previous:scoreAttempt(previous)}]:[];
  });
  return <section className="experiment assessment-performance" aria-labelledby="assessment-performance">
    <h2 id="assessment-performance">Assessment performance</h2>
    <div className="assessment-metrics">
      <p><strong>{exams.length}</strong> Course attempts</p><p><strong>{finished.length}</strong> Course assessments finished</p>
      <p><strong>{solved.size}</strong> Unique coding challenges solved</p>
    </div>
    {attempted.length>0?<><h3>Topic performance</h3>
      <ul className="assessment-topic-list">{attempted.map(topic=><li key={topic.course+topic.topic}>
        <span>{topic.course} · {topic.topic}</span><span>{topic.correct}/{topic.answered} correct · {topic.answered}/{topic.items} tried</span>
      </li>)}</ul>
      <p className="muted">Based on the latest submission for each question. A small sample gives limited evidence of skill.</p>
    </>:<p>Your topic performance will appear after your first submission.</p>}
    {suggested&&<p><strong>{weak?'Topic to revisit':'Suggested next practice'}</strong> · {suggested.course} / {suggested.topic}</p>}
    {recent.length>0&&<><h3>Recent practice activity</h3><ul className="assessment-topic-list">{recent.map(({course,attempt})=>{
      const score=scoreAttempt(attempt);
      return <li key={course+attempt.id}><span>{course} · {attempt.mode==='course'?'Course assessment':'Practice'}</span>
        <span>{score.correct}/{score.answered} submitted correct · <time dateTime={new Date(attempt.updated).toISOString()}>{new Date(attempt.updated).toLocaleDateString()}</time></span></li>;
    })}</ul></>}
    {comparison.length>0&&<><h3>Score changes on repeat assessments</h3>
      <ul className="assessment-topic-list">{comparison.map(({course,latest,previous})=><li key={course}>
        <span>{course}</span><span>Previous {previous.correct}/{previous.total} → Latest {latest.correct}/{latest.total}</span>
      </li>)}</ul></>}
    <a className="button small" href={appUrl('/assessments/')+(suggested?'?course='+encodeURIComponent(suggested.course)+'&topic='+encodeURIComponent(suggested.topic):'')}>{suggested?'Open Assessment Studio':'Review assessments'} <ArrowRight size={15}/></a>
  </section>;
}

const idle=()=>{};
function ItemExercise({item,grade,independent}:{item:AssessmentItem;grade:(answer:Submission)=>void;independent:boolean}){
  const [choice,setChoice]=useState<number>();
  if(item.kind==='python')return <>
    <p className="callout">Example · {item.example}</p>
    <CodeEditor lesson={{challenge:item.prompt,starter:item.starter,hint:item.hint,tests:item.tests}}
      draftId={codingDraft(item)} onPass={idle} onGrade={(correct,detail)=>grade({correct,detail})} independent={independent}/>
  </>;
  if(item.kind==='sql')return <SqlStudio
    lesson={{id:`assessment-${item.id}`,title:'SQL challenge',concept:'Use the synthetic retail database.',analogy:'',
      starter:item.starter,challenge:item.prompt,answer:item.answerQuery,ordered:item.ordered,hint:item.hint,
      memory:'',mistake:'Return only the requested columns and include an explicit order when required.',
      example:'SELECT name, price FROM Products LIMIT 3;'}}
    project={{seed:'',independent}} completed={()=>false} onSelect={idle} onStart={idle} onPass={idle} onGrade={(correct,detail)=>grade({correct,detail})}/>;
  return <form onSubmit={event=>{event.preventDefault();if(choice!==undefined)grade({option:choice,correct:choice===item.answer});}}>
    <fieldset className="assessment-choices"><legend className="sr-only">Choose an answer</legend>
      {item.options.map((option,index)=><label className="quiz-option" key={option}>
        <input name={'answer-'+item.id} type="radio" checked={choice===index} onChange={()=>setChoice(index)}/>{option}
      </label>)}
    </fieldset>
    <button className="button primary" disabled={choice===undefined}>Submit answer</button>
  </form>;
}

export function AssessmentStudio(){
  const all=useAttempts();
  const requested=new URLSearchParams(location.search);
  const [course,setCourse]=useState<Course>(()=>{
    const requestedCourse=assessmentCourses.find(name=>name===requested.get('course'));
    if(requestedCourse)return requestedCourse;
    const latest=assessmentCourses.flatMap(name=>readAttempts(name).map(attempt=>({name,updated:attempt.updated}))).sort((a,b)=>b.updated-a.updated)[0];
    return latest?.name??'Foundations';
  });
  const [topic,setTopic]=useState(()=>assessmentItems.find(item=>item.course===course&&item.topic===requested.get('topic'))?.topic??'');
  const [difficulty,setDifficulty]=useState<Difficulty|''>('');
  const [activeId,setActiveId]=useState('');
  const [notice,setNotice]=useState('');
  const prompt=useRef<HTMLHeadingElement>(null);
  const entries=all[course];
  const questions=assessmentItems.filter(item=>item.course===course);
  const filtered=questions.filter(item=>(!topic||item.topic===topic)&&(!difficulty||item.difficulty===difficulty));
  const active=entries.find(attempt=>attempt.id===activeId);
  const item=active?practiceItem(active.items[active.position]):undefined;
  const answer=item&&active?.answers[item.id];
  const score=active?scoreAttempt(active):undefined;
  const comparable=comparableAttempts(course,entries);
  function save(attempt:Attempt){
    setNotice(saveAttempt(course,attempt)?'':'Browser storage is unavailable. Keep this page open to retain this session.');
  }
  function start(ids:string[],mode:Attempt['mode']){
    if(!ids.length)return;
    const next:Attempt={id:crypto.randomUUID(),mode,items:ids,answers:{},position:0,updated:Date.now()};
    save(next);
    setActiveId(next.id);
  }
  function open(attempt:Attempt){
    if(scoreAttempt(attempt).complete){setActiveId(attempt.id);return;}
    const position=attempt.items.findIndex(id=>!attempt.answers[id]);
    if(attempt.answers[attempt.items[attempt.position]]&&position>=0)save({...attempt,position});
    setActiveId(attempt.id);
  }
  useEffect(()=>{if(activeId)prompt.current?.focus();},[activeId,active?.position]);
  return <div className="assessment-studio">
    <div className="page-heading"><h1>Assessment Studio</h1><p>Practice by topic or take a course-end assessment. Each graded response earns one point when correct. Running code alone earns no points.</p></div>
    <section className="experiment" aria-label="Assessment setup">
      <div className="assessment-filters">
        <label>Course <select value={course} onChange={event=>{setCourse(event.target.value as Course);setTopic('');setDifficulty('');setActiveId('');}}>{assessmentCourses.map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Topic <select value={topic} onChange={event=>setTopic(event.target.value)}><option value="">All topics</option>{[...new Set(questions.map(item=>item.topic))].map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Difficulty <select value={difficulty} onChange={event=>setDifficulty(event.target.value as Difficulty|'')}><option value="">All difficulties</option><option>Introductory</option><option>Applied</option></select></label>
      </div>
      <div className="lab-actions assessment-actions">
        <button className="button primary" disabled={!filtered.length} onClick={()=>start(filtered.map(item=>item.id),'practice')}>Start practice ({filtered.length})</button>
        <button className="button" onClick={()=>start(questions.map(item=>item.id),'course')}>Start course assessment ({questions.length})</button>
      </div>
      {!filtered.length&&<p>No questions match both filters.</p>}
      <p className="muted">Course assessments cover all topics in the selected course. These untimed exercises are for learning and use browser-local grading.</p>
      {notice&&<p role="status">{notice}</p>}
    </section>
    {active&&item&&score&&<section className="experiment" aria-label="Current assessment">
      <header className="section-heading"><div><span className="eyebrow">{active.mode==='course'?'Course assessment':'Topic practice'}</span>
        <h2 tabIndex={-1} ref={prompt}>Question {active.position+1} of {score.total}</h2></div>
        <span className="chip neutral">{item.difficulty}</span></header>
      <p role="status">{score.complete?'Assessment complete':''}{score.complete?' · ':''}{score.answered}/{score.total} answered · {score.correct} correct</p>
      <progress aria-label="Assessment questions answered" max={score.total} value={score.answered}/>
      <nav className="lab-picker assessment-questions" aria-label="Questions">
        {active.items.map((id,index)=><button key={id} aria-current={index===active.position?'step':undefined}
          aria-label={`Question ${index+1}${active.answers[id]?', answered':''}`} onClick={()=>save({...active,position:index})}>
          {index+1}{active.answers[id]&&<Check size={13} aria-hidden="true"/>}
        </button>)}
      </nav>
      <p className="muted">{item.topic} · {item.objective}</p>
      <h3>{item.prompt}</h3>
      {answer?<div className="callout">
        <strong>{answer.correct?'Correct':'Needs practice'}</strong>
        {item.kind==='choice'&&<p>Your answer: {item.options[answer.option!]} · Correct answer: {item.options[item.answer]}</p>}
        {answer.detail&&<p>{answer.detail}</p>}
        <p>{item.explanation}</p>
      </div>:<ItemExercise key={active.id+item.id} item={item} independent={active.mode==='course'} grade={submission=>save(submitAnswer(active,item,submission))}/>}
      <div className="lab-actions assessment-actions">
        <button className="button" disabled={active.position===0} onClick={()=>save({...active,position:active.position-1})}>Previous question</button>
        <button className="button" disabled={active.position===score.total-1} onClick={()=>save({...active,position:active.position+1})}>Next question</button>
        {score.complete&&missedItems(active).length>0&&<button className="button primary" onClick={()=>start(missedItems(active),'practice')}>Retry missed questions</button>}
      </div>
      {score.complete&&missedItems(active).length>0&&<div><h3>Review incorrect answers</h3><ul className="assessment-topic-list">
        {missedItems(active).map(id=><li key={id}><button className="text-link" onClick={()=>save({...active,position:active.items.indexOf(id)})}>{practiceItem(id)?.prompt}</button></li>)}
      </ul></div>}
    </section>}
    <section className="experiment" aria-label="Assessment history"><h2>{course} attempt history</h2>
      {comparable.length>1&&<p>Latest completed score: {scoreAttempt(comparable[0]).correct}/{questions.length} · Previous: {scoreAttempt(comparable[1]).correct}/{questions.length}</p>}
      {!entries.length?<p>No saved attempts for this course.</p>:<ul className="assessment-topic-list">
        {entries.map(attempt=>{const entry=scoreAttempt(attempt);return <li key={attempt.id}>
          <span>{attempt.mode==='course'?'Course assessment':'Practice'} · {entry.correct}/{entry.total} correct · {entry.answered}/{entry.total} answered</span>
          <button className="button small" onClick={()=>open(attempt)}>{entry.complete?'Review attempt':'Resume attempt'}</button>
        </li>;})}
      </ul>}
      <p className="muted">Up to 24 recent attempts are kept per course.</p>
    </section>
    <SkillDashboard/>
  </div>;
}
