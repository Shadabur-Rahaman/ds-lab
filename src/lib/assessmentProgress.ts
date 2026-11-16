import {assessmentItems,attemptKey,type AssessmentItem,type Course} from '../assessmentCatalog';
import {readLearnerText,writeLearnerText} from './learnerData';

const bank=new Map(assessmentItems.map(item=>[item.id,item]));
export type Submission={correct:boolean;option?:number;detail?:string;at?:number};
export type Attempt={id:string;mode:'practice'|'course';items:string[];answers:Record<string,Submission>;position:number;updated:number};
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function parseAttempts(raw:string|null,course:Course):Attempt[] {
  try{
    const stored:unknown=JSON.parse(raw??'[]');
    if(!Array.isArray(stored))return [];
    return stored.flatMap(value=>{
      if(!isObject(value)||typeof value.id!=='string'||value.id.length>60||
        (value.mode!=='practice'&&value.mode!=='course')||!Array.isArray(value.items)||!isObject(value.answers))return [];
      const items=[...new Set(value.items.filter((id):id is string=>typeof id==='string'&&bank.get(id)?.course===course))];
      if(!items.length)return [];
      const answers:Record<string,Submission>={};
      for(const id of items){
        const item=bank.get(id)!;
        const answer=value.answers[id];
        if(!isObject(answer))continue;
        const at=typeof answer.at==='number'&&Number.isSafeInteger(answer.at)&&answer.at>=0 ? answer.at : undefined;
        if(item.kind==='choice'){
          const option=answer.option;
          if(typeof option==='number'&&Number.isInteger(option)&&option>=0&&option<item.options.length)answers[id]={option,correct:option===item.answer,at};
        }else if(typeof answer.correct==='boolean')answers[id]={correct:answer.correct,at,detail:typeof answer.detail==='string'?answer.detail.slice(0,400):undefined};
      }
      const position=typeof value.position==='number'&&Number.isInteger(value.position)?Math.max(0,Math.min(items.length-1,value.position)):0;
      const updated=typeof value.updated==='number'&&Number.isSafeInteger(value.updated)&&value.updated>=0&&value.updated<=8640000000000000?value.updated:0;
      return [{id:value.id,mode:value.mode,items,answers,position,updated} satisfies Attempt];
    }).slice(0,24);
  }catch{return [];}
}
export function readAttempts(course:Course){return parseAttempts(readLearnerText(attemptKey(course)),course);}
export function saveAttempt(course:Course,attempt:Attempt){
  const rest=readAttempts(course).filter(item=>item.id!==attempt.id);
  return writeLearnerText(attemptKey(course),JSON.stringify([attempt,...rest.slice(0,23)]));
}
export function scoreAttempt(attempt:Attempt){
  const graded=attempt.items.flatMap(id=>attempt.answers[id]?[attempt.answers[id]]:[]);
  return {answered:graded.length,correct:graded.filter(answer=>answer.correct).length,total:attempt.items.length,complete:graded.length===attempt.items.length};
}
export function missedItems(attempt:Attempt){return attempt.items.filter(id=>attempt.answers[id]?.correct===false);}
export function submitAnswer(attempt:Attempt,item:AssessmentItem,submission:Submission):Attempt {
  if(!attempt.items.includes(item.id)||attempt.answers[item.id])return attempt;
  const at=Date.now();
  return {...attempt,updated:at,answers:{...attempt.answers,[item.id]:{...submission,at}}};
}
export function topicPerformance(course:Course,attempts:Attempt[]){
  const recent=[...attempts].sort((a,b)=>b.updated-a.updated);
  const items=assessmentItems.filter(item=>item.course===course);
  return [...new Set(items.map(item=>item.topic))].map(topic=>{
    const questions=items.filter(item=>item.topic===topic);
    const answered=questions.flatMap(item=>{
      const last=recent.flatMap(attempt=>attempt.answers[item.id]?[attempt.answers[item.id]]:[]).sort((a,b)=>(b.at??0)-(a.at??0))[0];
      return last?[{id:item.id,correct:last.correct}]:[];
    });
    return {topic,items:questions.length,answered:answered.length,correct:answered.filter(item=>item.correct).length};
  });
}
export function practiceItem(id:string){return bank.get(id);}
