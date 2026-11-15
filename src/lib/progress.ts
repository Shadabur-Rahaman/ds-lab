import {createClient} from '@supabase/supabase-js';
import {lessons, type LearningId} from '../data';
import {sqlLessons} from '../sqlLessons';
import {analysisLessons, chartLessonId, retailProjectId} from '../analysisLessons';
import {mlLessons, irisClassificationId} from '../mlLessons';
export type Progress = Partial<Record<LearningId,{quiz:boolean;code:boolean;started?:boolean}>>;
const ids: LearningId[] = [...[...lessons, ...sqlLessons, ...analysisLessons, ...mlLessons].map(lesson => lesson.id), chartLessonId, retailProjectId, irisClassificationId];
const key='learning-ecosystem:ds:progress:v1';
export const supabase=import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export function readProgress():Progress {try {const p=JSON.parse(localStorage.getItem(key)||'{}');const valid:Progress={};for(const id of ids) if(p?.[id]) valid[id]={quiz:p[id].quiz===true,code:p[id].code===true,started:p[id].started===true};return valid;} catch{return {};}}
export function saveProgress(p:Progress){try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}}
export function mergeProgress(a:Progress,b:Progress):Progress {const out={...a};for(const {id} of lessons)out[id]={quiz:!!(a[id]?.quiz||b[id]?.quiz),code:!!(a[id]?.code||b[id]?.code)};return out;}
