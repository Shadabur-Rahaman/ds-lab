import {ArrowRight} from 'lucide-react';
import {CodeEditor} from './components';
import {LessonObjective, PracticeQuestion} from './StudioControls';
import {MlExperiment} from './MlExperiments';
import {mlExamples, mlLessons, type MlLesson, type MlLessonId} from './mlLessons';
import {appUrl} from './lib/urls';
import './ml-studio.css';

const commonMistakes: Record<MlLessonId, string> = {
  'ml-intro': 'Keep the target separate from the features. A value that is only known after the outcome cannot be used for a real prediction.',
  'ml-regression': 'A good fit on training points does not establish accuracy on new observations. Predictions far beyond the observed x values are especially uncertain.',
  'ml-knn': 'Features measured on different scales can dominate Euclidean distance. If you scale features, fit the scaling on training rows only.',
  'ml-split': 'Changing the seed until the test score looks good makes that test split part of model selection.',
  'ml-metrics': 'A classifier can achieve high accuracy while missing the minority class. Inspect false negatives and false positives separately.',
  'ml-overfit': 'Choosing polynomial degree on the final test set can make the reported score optimistic. Compare degrees on validation data.',
};

export function MlStudio({lesson, progress, onOpen, onQuiz, onCode}: {
  lesson: MlLesson; progress?: {quiz: boolean; code: boolean}; onOpen: (id: MlLessonId) => void;
  onQuiz: () => void; onCode: () => void;
}) {
  const [prompt, options, answer, explanation] = lesson.quiz;
  const next = mlLessons[mlLessons.findIndex(item => item.id === lesson.id) + 1];
  return <div className="analysis-studio ml-studio">
    <div className="lesson-heading v5-heading"><div><h1>Machine Learning Studio</h1><p>{lesson.title}</p></div></div>
    <nav className="lab-picker analysis-lessons" aria-label="Machine Learning lessons">
      {mlLessons.map(item => <button key={item.id} aria-current={item.id === lesson.id ? 'page' : undefined}
        aria-pressed={item.id === lesson.id} onClick={() => onOpen(item.id)}>{item.title}</button>)}
    </nav>
    <div className="analysis-grid">
      <div className="analysis-column">
        <article className="experiment analysis-panel">
          <h2>{lesson.title}</h2><p>{lesson.concept}</p><LessonObjective>{lesson.task}</LessonObjective>
          <details className="lab-hint"><summary>Common mistake</summary><p>{commonMistakes[lesson.id]}</p></details>
          <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{lesson.hint}</p></details>
        </article>
        <MlExperiment id={lesson.id}/>
      </div>
      <div className="analysis-column">
        <CodeEditor draftId={lesson.id} lesson={{challenge: lesson.task, starter: lesson.starter, tests: lesson.tests, hint: lesson.hint, example: mlExamples[lesson.id]}} onPass={onCode}/>
        <PracticeQuestion prompt={prompt} options={options} answer={answer} explanation={explanation} onPass={onQuiz}/>
        <p className="callout">{progress?.code && progress.quiz ? 'Lesson complete.' : 'Pass the Python challenge and knowledge check to complete this lesson.'}</p>
        {next ? <button className="button" onClick={() => onOpen(next.id)}>Next lesson <ArrowRight size={15}/></button> :
          <a className="button" href={appUrl('/projects/iris-classification')}>Start Iris Classification <ArrowRight size={15}/></a>}
      </div>
    </div>
  </div>;
}
