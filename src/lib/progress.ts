import {lessons, statisticsPracticeIds, type LearningId} from '../data';
import {sqlLessons} from '../sqlLessons';
import {analysisLessons, chartLessonId, retailProjectId} from '../analysisLessons';
import {mlLessons, irisClassificationId} from '../mlLessons';
import {deepLessons, neuralProjectId} from '../deepLessons';
export type Progress = Partial<Record<LearningId,{quiz:boolean;code:boolean;started?:boolean;updatedAt?:number;viewedAt?:number}>>;
export const lessonIds: LearningId[] = [...[...lessons, ...sqlLessons, ...analysisLessons, ...mlLessons, ...deepLessons].map(lesson => lesson.id), chartLessonId, retailProjectId, irisClassificationId, neuralProjectId, 'iris-eda', ...statisticsPracticeIds];
export const progressKey='learning-ecosystem:ds:progress:v1';
const time = (value:unknown) => typeof value==='number' && Number.isSafeInteger(value) && value>0 ? value : undefined;
export function parseProgress(stored:unknown):Progress {
  if (!stored || typeof stored!=='object') return {};
  const valid: Progress = {};
  for (const id of lessonIds) {
    const entry = (stored as Progress)[id];
    if (!entry || typeof entry!=='object') continue;
    valid[id] = {quiz: entry.quiz === true, code: entry.code === true, started: entry.started === true,
      updatedAt:time(entry.updatedAt), viewedAt:time(entry.viewedAt)};
  }
  return valid;
}
export function readProgress():Progress {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(progressKey) || '{}'));
  } catch {return {};}
}
export function saveProgress(p:Progress){try{localStorage.setItem(progressKey,JSON.stringify(p));return true;}catch{return false;}}
export function mergeProgress(a:Progress,b:Progress):Progress {
  const out: Progress = {};
  for (const id of lessonIds) {
    const left = a[id], right = b[id];
    if (!left || !right) {
      if (left || right) out[id] = left ?? right;
      continue;
    }
    out[id] = {quiz: left.quiz || right.quiz, code: left.code || right.code, started: left.started || right.started,
      updatedAt: Math.max(left.updatedAt ?? 0, right.updatedAt ?? 0) || undefined,
      viewedAt: Math.max(left.viewedAt ?? 0, right.viewedAt ?? 0) || undefined};
  }
  return out;
}
