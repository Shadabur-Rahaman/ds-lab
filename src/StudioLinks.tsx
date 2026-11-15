import {ArrowRight, ArrowUpRight, BarChart3, BrainCircuit, ChartNoAxesCombined, Database, Grid2X2, Table2} from 'lucide-react';
import {chartLessonId, type AnalysisLessonId} from './analysisLessons';
import {appUrl} from './lib/urls';

export function StatisticsFeature({onOpen}: {onOpen: () => void}) {
  return <button className="statistics-feature" onClick={onOpen}>
    <span className="value-icon purple"><ChartNoAxesCombined size={24}/></span>
    <span><strong>Statistics Learning Studio</strong><small>Five interactive labs for exploring data and uncertainty</small></span>
    <ArrowUpRight size={20}/>
  </button>;
}

export function SqlFeature({onOpen}: {onOpen: () => void}) {
  return <button className="statistics-feature sql-feature" onClick={onOpen}>
    <span className="value-icon blue"><Database size={24}/></span>
    <span><strong>SQL Learning Studio</strong><small>Query a retail database in five beginner lessons</small></span>
    <ArrowUpRight size={20}/>
  </button>;
}

export function AnalysisLinks({open}: {open: (id: AnalysisLessonId | typeof chartLessonId) => void}) {
  return <div className="analysis-links">
    {([['NumPy Learning Studio', 'numpy-arrays', Grid2X2], ['Pandas Learning Studio', 'pandas-frames', Table2],
      ['Data Visualization Lab', chartLessonId, BarChart3]] as const).map(([label, id, Icon]) =>
      <button key={id} className="button" onClick={() => open(id)}><Icon size={19}/> {label} <ArrowRight size={15}/></button>)}
  </div>;
}

export function MlFeature({onOpen}: {onOpen: () => void}) {
  return <div className="analysis-links">
    <button className="button" onClick={onOpen}><BrainCircuit size={19}/> Machine Learning Studio <ArrowRight size={15}/></button>
    <a className="button" href={appUrl('/projects/iris-classification')}>Iris Classification project <ArrowRight size={15}/></a>
  </div>;
}
