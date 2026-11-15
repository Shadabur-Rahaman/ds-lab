import {ArrowDown, ArrowRight, ArrowUpRight, Check, Circle, Clock, FlaskConical, Map} from 'lucide-react';
import {CafeChart, Glyph} from './components';
import {lessons, type LearningId} from './data';
import {SqlFeature} from './SqlStudio';
import {sqlLessons} from './sqlLessons';
import type {Progress} from './lib/progress';
import {StatisticsFeature} from './StatisticsStudio';
import {appUrl} from './lib/urls';

export const learningItems = [...lessons, ...sqlLessons.map(lesson => ({
  id: lesson.id, title: lesson.title, description: lesson.challenge, course: 'SQL', color: 'blue', icon: 'database',
}))];

export function lessonState(progress: Progress, id: LearningId) {
  const entry = progress[id];
  if (entry?.code && (entry.quiz || id.startsWith('sql-'))) return 'Completed';
  if (entry?.quiz || entry?.code || entry?.started) return 'In progress';
  return 'Ready to start';
}

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
    <section className="practice-section" aria-labelledby="practice-title">
      <header className="practice-header">
        <div><h2 id="practice-title">Start with a question</h2><p>Three lessons you can open and try today.</p></div>
        <button className="text-link" onClick={() => openPage('/courses')}>Explore all courses <ArrowRight size={16}/></button>
      </header>
      <div className="practice-list">
        {lessons.map(lesson => <button key={lesson.id} className="practice-link" onClick={() => openLesson(lesson.id)}>
          <span className={'value-icon ' + lesson.color}><Glyph name={lesson.icon}/></span>
          <span className="practice-copy"><small>{lesson.course}</small><strong>{lesson.short}</strong><span>{lesson.description}</span></span>
          <span className="practice-meta"><span><Clock size={14}/> {lesson.time} min</span><span>{lessonState(progress, lesson.id)}</span></span>
          <ArrowUpRight className="practice-arrow" size={19}/>
        </button>)}
      </div>
    </section>
    <a className="studio-project" href={appUrl('/roadmap')}><span className="value-icon purple"><Map size={22}/></span><span><strong>See the learning roadmap</strong><small>Explore all four stages of the curriculum.</small></span><ArrowRight size={19}/></a>
    <a className="studio-project" href={appUrl('/projects/iris')}>
      <span className="value-icon green"><Glyph name="folder"/></span>
      <span><strong>Investigate the Iris dataset</strong><small>Compare flower measurements, test a rule, and export your findings.</small></span>
      <ArrowRight size={19}/>
    </a>
  </div>;
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
