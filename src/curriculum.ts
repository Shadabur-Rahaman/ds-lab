import {lessons, type LearningId} from './data';
import {analysisLessons, chartLessonId, retailProjectId} from './analysisLessons';
import {advancedLessons} from './advancedLessons';
import {irisClassificationId, mlLessons} from './mlLessons';
import {deepLessons, neuralProjectId} from './deepLessons';
import {sqlLessons} from './sqlLessons';
import type {Progress} from './lib/progress';
import {allProjectBits,isNewCapstone,isProject,legacyProjectBit} from './projectCatalog';

type LearningItem = {id: LearningId; title: string; description: string; course: string; color: string; icon: string};
const fromAnalysis = (course: 'NumPy' | 'Pandas') => analysisLessons.filter(lesson => lesson.course === course).map(lesson => ({
  id: lesson.id, title: lesson.title, description: lesson.challenge, course,
  color: course === 'NumPy' ? 'purple' : 'green', icon: course === 'NumPy' ? 'grid' : 'table',
}));

export const stages: {title: string; outcome: string; items: LearningItem[]}[] = [
  {title: 'Data Science Foundations', outcome: 'Turn a question into a measurable investigation.', items: [lessons[0]]},
  {title: 'Statistics', outcome: 'Describe data and reason about uncertainty.', items: [lessons[1]]},
  {title: 'SQL', outcome: 'Query, combine, and summarize relational data.', items: sqlLessons.map(lesson => ({
    id: lesson.id, title: lesson.title, description: lesson.challenge, course: 'SQL', color: 'blue', icon: 'database',
  }))},
  {title: 'NumPy', outcome: 'Work with arrays, shapes, and numerical operations.', items: fromAnalysis('NumPy')},
  {title: 'Pandas', outcome: 'Inspect, clean, and reshape tables in Python.', items: [...fromAnalysis('Pandas'), lessons[2]]},
  {title: 'Visualization', outcome: 'Choose a chart, test its interpretation, and explain what it shows.', items: [
    {id: chartLessonId, title: 'Data Visualization Lab', description: 'Choose a chart and interpret the results.',
      course: 'Data Visualization', color: 'pink', icon: 'chart'},
  ]},
  {title: 'Machine Learning', outcome: 'Train simple models and evaluate them on held-out data. Compare ensembles and explore unsupervised learning.', items: [...mlLessons,...advancedLessons].map(lesson => ({
    id: lesson.id, title: lesson.title, description: lesson.task, course: 'Machine Learning', color: 'purple', icon: 'brain',
  }))},
  {title:'Deep Learning', outcome:'Trace, train, and evaluate a neural network.', items:deepLessons.map(item=>({
    id:item.id,title:item.title,description:item.task,course:'Deep Learning',color:'purple',icon:'layers',
  }))},
];

export const track = stages.flatMap(stage => stage.items);
export const projects = [
  {id: 'iris-eda', title: 'Iris exploratory data analysis', path: '/projects/iris', preparation: 'Visualization'},
  {id: retailProjectId, title: 'Retail Sales Data Cleaning & Exploratory Analysis', path: '/projects/retail', preparation: 'Pandas and Visualization'},
  {id: irisClassificationId, title: 'Iris Classification', path: '/projects/iris-classification', preparation: 'Machine Learning'},
  {id:neuralProjectId,title:'Neural Network Classification',path:'/projects/neural-classification',preparation:'Deep Learning'},
  {id:'customer-purchases',title:'Customer Purchase Analytics',path:'/projects/customer-purchases',preparation:'SQL and Pandas'},
  {id:'student-performance',title:'Student Performance Prediction',path:'/projects/student-performance',preparation:'Machine Learning'},
  {id:'compare-models',title:'Compare Machine Learning Models on Iris',path:'/projects/compare-models',preparation:'Decision Trees and Random Forests'},
] as const;

export const learningItems: LearningItem[] = [...track,
  {id:'iris-eda',title:projects[0].title,description:'Compare flower measurements and explain what they show.',course:'Guided projects',color:'green',icon:'folder'},
  {id: retailProjectId, title: projects[1].title, description: 'Audit a retail ledger and export your findings.',
    course: 'Guided projects', color: 'green', icon: 'folder'},
  {id: irisClassificationId, title: projects[2].title, description: 'Train a classifier and report held-out results.',
    course: 'Guided projects', color: 'green', icon: 'folder'},
  {id:neuralProjectId,title:projects[3].title,description:'Train a neural network and explain its held-out predictions.',course:'Guided projects',color:'green',icon:'folder'},
  ...projects.slice(4).map(project=>({id:project.id,title:project.title,description:project.preparation,course:'Guided projects',color:'green',icon:'folder'})),
];

export function lessonState(progress: Progress, id: LearningId) {
  const entry = progress[id];
  if(isProject(id) && entry?.studio!==undefined) {
    if((entry.studio&allProjectBits)===allProjectBits || (entry.studio&legacyProjectBit)) return 'Completed';
    return 'In progress';
  }
  if(isNewCapstone(id)) return entry ? 'In progress' : 'Ready to start';
  if (id === chartLessonId && entry?.quiz) return 'Completed';
  if (entry?.code && (entry.quiz || id.startsWith('sql-'))) return 'Completed';
  if (entry?.quiz || entry?.code || entry?.started) return 'In progress';
  return 'Ready to start';
}

export function resumeItem(progress: Progress, items: LearningItem[] = learningItems) {
  const inProgress = items.filter(item => lessonState(progress, item.id) === 'In progress');
  return inProgress.reduce<LearningItem | undefined>((latest, item) =>
    !latest || (progress[item.id]?.updatedAt ?? 0) > (progress[latest.id]?.updatedAt ?? 0) ? item : latest, undefined)
    ?? items.find(item => lessonState(progress, item.id) === 'Ready to start') ?? items[0];
}
