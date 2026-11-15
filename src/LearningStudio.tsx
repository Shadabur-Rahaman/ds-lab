import {ArrowDown, ArrowRight, ArrowUpRight, Check, Circle, FlaskConical, Map} from 'lucide-react';
import {CafeChart, Glyph} from './components';
import {type LearningId} from './data';
import {AnalysisLinks, MlFeature, SqlFeature, StatisticsFeature} from './StudioLinks';
import {learningItems, lessonState, resumeItem, stages} from './curriculum';
import {mlLessons, irisClassificationId} from './mlLessons';
import {sqlLessons} from './sqlLessons';
import type {Progress} from './lib/progress';
import {appUrl} from './lib/urls';

export function Home({progress, next, openLesson, openPage}: {
  progress: Progress;
  next: (typeof learningItems)[number];
  openLesson: (id: LearningId) => void;
  openPage: (path: string) => void;
}) {
  return <div className="learning-home">
    <section className="studio-hero" aria-labelledby="studio-title">
      <div className="studio-copy">
        <span className="studio-label"><FlaskConical size={15}/> The data science lab</span>
        <h1 id="studio-title">Make sense<br/>of <em>real data.</em></h1>
        <p>Ask better questions, test your ideas in Python, and turn real datasets into findings you can explain.</p>
        <div className="studio-actions">
          <button className="studio-start" onClick={() => openLesson(next.id)}>
            {lessonState(progress, next.id) === 'In progress' ? 'Resume lesson' : lessonState(progress, next.id) === 'Completed' ? 'Review lessons' : 'Start learning'} <ArrowRight size={18}/>
          </button>
          <button className="studio-path" onClick={() => openLesson('statistics')}>Try the Statistics Studio <ArrowUpRight size={16}/></button>
        </div>
      </div>
      <div className="studio-preview">
        <p><span>Try an experiment</span><span>Café orders</span></p>
        <CafeChart compact/>
      </div>
    </section>
    <StatisticsFeature onOpen={() => openLesson("statistics")}/>
    <SqlFeature onOpen={() => openLesson(sqlLessons.find(item => !progress[item.id]?.code)?.id ?? sqlLessons[0].id)}/>
    <AnalysisLinks open={openLesson}/>
    <MlFeature onOpen={() => openLesson(mlLessons.find(item => lessonState(progress,item.id) === 'In progress')?.id
      ?? mlLessons.find(item => lessonState(progress,item.id) === 'Ready to start')?.id ?? mlLessons[0].id)}/>
    <section className="practice-section" aria-labelledby="practice-title">
      <header className="practice-header">
        <div><h2 id="practice-title">Your learning path</h2><p>Follow the recommended order or open any stage.</p></div>
        <button className="text-link" onClick={() => openPage('/courses')}>Explore all courses <ArrowRight size={16}/></button>
      </header>
      <LearningPath progress={progress} openLesson={openLesson}/>
    </section>
    <a className="studio-project" href={appUrl('/roadmap')}><span className="value-icon purple"><Map size={22}/></span><span><strong>See the learning roadmap</strong><small>See the stages and their recommended order.</small></span><ArrowRight size={19}/></a>
    <a className="studio-project" href={appUrl('/projects/iris')}>
      <span className="value-icon green"><Glyph name="folder"/></span>
      <span><strong>Investigate the Iris dataset</strong><small>Compare flower measurements, test a rule, and export your findings.</small></span>
      <ArrowRight size={19}/>
    </a>
    <a className="studio-project" href={appUrl('/projects/retail')}>
      <span className="value-icon green"><Glyph name="table"/></span>
      <span><strong>Clean a retail sales dataset</strong><small>Inspect order quality, visualize the results, and export your report.</small></span>
      <ArrowRight size={19}/>
    </a>
  </div>;
}

export function LearningPath({progress, openLesson}: {
  progress: Progress; openLesson: (id: LearningId) => void;
}) {
  return <ol className="learning-path" aria-label="Recommended learning path">
    {stages.map(stage => {
      const completed = stage.items.filter(item => lessonState(progress, item.id) === 'Completed').length;
      const next = resumeItem(progress, stage.items);
      return <li key={stage.title}>
        <button className="practice-link" onClick={() => openLesson(next.id)}>
          <span className={'value-icon ' + next.color}><Glyph name={next.icon}/></span>
          <span className="practice-copy"><strong>{stage.title}</strong><span>{stage.outcome}</span></span>
          <span className="path-progress">{completed} / {stage.items.length} complete</span>
          <ArrowRight className="practice-arrow" size={16}/>
        </button>
      </li>;
    })}
  </ol>;
}

export function LessonJourney({id, progress, onOpen}: {id: LearningId; progress: Progress; onOpen: (id: LearningId) => void}) {
  const stageIndex = stages.findIndex(stage => stage.items.some(item => item.id === id));
  if (stageIndex < 0) return null;
  const stage = stages[stageIndex];
  const index = stage.items.findIndex(item => item.id === id);
  const previous = stage.items[index - 1] ?? stages[stageIndex - 1]?.items.at(-1);
  const next = stage.items[index + 1] ?? stages[stageIndex + 1]?.items[0];
  return <nav className="lesson-journey" aria-label="Lesson progression">
    <div><strong>{stage.title}</strong><span>{index + 1} of {stage.items.length} · {lessonState(progress, id)}</span></div>
    {previous && <button className="button small" onClick={() => onOpen(previous.id)}>Previous: {previous.title}</button>}
    {next && <button className="button primary small" onClick={() => onOpen(next.id)}>Next: {next.title} <ArrowRight size={14}/></button>}
    {!next && <a className="button primary small" href={appUrl('/projects/neural-classification')}>Try Neural Network Classification <ArrowRight size={14}/></a>}
  </nav>;
}

export function ProgressCheck({done, children}: {done: boolean; children: string}) {
  const Icon = done ? Check : Circle;
  return <span className={'progress-check ' + (done ? 'is-done' : '')}>
    <Icon size={14} aria-hidden="true"/>{children}<span className="sr-only">{done ? ' complete' : ' pending'}</span>
  </span>;
}

export function LessonSections() {
  return <nav className="lesson-sections" aria-label="On this page">
    <a href="#concept">Concept</a><a href="#experiment">Experiment</a><a href="#knowledge-check">Quiz</a><a href="#python-practice">Python practice <ArrowDown size={14}/></a>
  </nav>;
}
