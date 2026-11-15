import {createClient} from '@supabase/supabase-js';
import {lessons, statisticsPracticeIds, type LearningId} from '../data';
import {sqlLessons} from '../sqlLessons';
import {analysisLessons, chartLessonId, retailProjectId} from '../analysisLessons';
import {mlLessons, irisClassificationId} from '../mlLessons';
import {deepLessons, neuralProjectId} from '../deepLessons';
export type Progress = Partial<Record<LearningId,{quiz:boolean;code:boolean;started?:boolean;updatedAt?:number}>>;
const ids: LearningId[] = [...[...lessons, ...sqlLessons, ...analysisLessons, ...mlLessons, ...deepLessons].map(lesson => lesson.id), chartLessonId, retailProjectId, irisClassificationId, neuralProjectId, ...statisticsPracticeIds];
export const progressKey='learning-ecosystem:ds:progress:v1';
export const supabase=import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export function readProgress():Progress {
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey) || '{}');
    const valid: Progress = {};
    for (const id of ids) if (stored?.[id]) {
      const entry = stored[id];
      valid[id] = {quiz: entry.quiz === true, code: entry.code === true, started: entry.started === true,
        updatedAt: Number.isFinite(entry.updatedAt) && entry.updatedAt > 0 ? entry.updatedAt : undefined};
    }
    return valid;
  } catch {return {};}
}
export function saveProgress(p:Progress){try{localStorage.setItem(progressKey,JSON.stringify(p));return true;}catch{return false;}}
export function mergeProgress(a:Progress,b:Progress):Progress {
  const out: Progress = {};
  for (const id of ids) {
    const left = a[id], right = b[id];
    if (!left || !right) {
      if (left || right) out[id] = left ?? right;
      continue;
    }
    out[id] = {quiz: left.quiz || right.quiz, code: left.code || right.code, started: left.started || right.started,
      updatedAt: Math.max(left.updatedAt ?? 0, right.updatedAt ?? 0) || undefined};
  }
  return out;
}
