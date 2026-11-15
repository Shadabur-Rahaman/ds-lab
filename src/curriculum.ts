import {lessons, type LearningId} from './data';
import {analysisLessons, chartLessonId, retailProjectId} from './analysisLessons';
import {irisClassificationId, mlLessons} from './mlLessons';
import {sqlLessons} from './sqlLessons';
import type {Progress} from './lib/progress';

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
  {title: 'Machine Learning', outcome: 'Train simple models and evaluate them on held-out data.', items: mlLessons.map(lesson => ({
    id: lesson.id, title: lesson.title, description: lesson.task, course: 'Machine Learning', color: 'purple', icon: 'brain',
  }))},
];

export const track = stages.flatMap(stage => stage.items);
export const projects = [
  {id: 'iris-eda', title: 'Iris exploratory data analysis', path: '/projects/iris', preparation: 'Visualization'},
  {id: retailProjectId, title: 'Retail Sales Data Cleaning & Exploratory Analysis', path: '/projects/retail', preparation: 'Pandas and Visualization'},
  {id: irisClassificationId, title: 'Iris Classification', path: '/projects/iris-classification', preparation: 'Machine Learning'},
] as const;

export const learningItems: LearningItem[] = [...track,
  {id: retailProjectId, title: projects[1].title, description: 'Audit a retail ledger and export your findings.',
    course: 'Guided projects', color: 'green', icon: 'folder'},
  {id: irisClassificationId, title: projects[2].title, description: 'Train a classifier and report held-out results.',
    course: 'Guided projects', color: 'green', icon: 'folder'},
];

export function lessonState(progress: Progress, id: LearningId) {
  const entry = progress[id];
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
