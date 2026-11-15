import {createClient} from '@supabase/supabase-js';
import type {LessonId} from '../data';
export type Progress = Partial<Record<LessonId,{quiz:boolean;code:boolean}>>;
const key='learning-ecosystem:ds:progress:v1';
export const supabase=import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
export function readProgress():Progress {try {const p=JSON.parse(localStorage.getItem(key)||'{}');const valid:Progress={};for(const id of ['introduction','statistics','pandas'] as LessonId[]) if(p?.[id]) valid[id]={quiz:p[id].quiz===true,code:p[id].code===true};return valid;} catch{return {};}}
export function saveProgress(p:Progress){try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}}
export function mergeProgress(a:Progress,b:Progress):Progress {const out={...a};for(const id of ['introduction','statistics','pandas'] as LessonId[])out[id]={quiz:!!(a[id]?.quiz||b[id]?.quiz),code:!!(a[id]?.code||b[id]?.code)};return out;}
