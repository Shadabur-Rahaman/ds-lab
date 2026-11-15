import {appUrl} from './lib/urls';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,BarChart3,BrainCircuit,Check,Code2,Database,FolderKanban,Grid2X2,Layers,Play,RotateCcw,Search,Sparkles,Square,Table2} from 'lucide-react';
import type {lessons,LessonId} from './data';
export function Glyph({name,size=22}:{name:string;size?:number}) {const C=({spark:Sparkles,chart:BarChart3,code:Code2,database:Database,grid:Grid2X2,table:Table2,search:Search,brain:BrainCircuit,layers:Layers,folder:FolderKanban} as Record<string,typeof Sparkles>)[name]||Sparkles;return <C size={size} strokeWidth={1.7}/>;}
export function CafeChart({compact=false}:{compact?:boolean}){const [metric,setMetric]=useState<'orders'|'revenue'>('orders');const values=metric==='orders'?[42,58,51,67,80,95,72]:[4200,4640,5100,6030,5600,7600,7200];return <div className={'chart-card '+(compact?'compact':'')}><div className="chart-heading"><div><span className="eyebrow">A WEEK AT THE CAFÉ</span><h3>{metric==='orders'?'Small data. Big discoveries.':'Busy ≠ most valuable.'}</h3></div><span className="chip green">Live experiment</span></div><div className="segmented" aria-label="Chart metric"><button aria-pressed={metric==='orders'} onClick={()=>setMetric('orders')}>Orders</button><button aria-pressed={metric==='revenue'} onClick={()=>setMetric('revenue')}>Revenue</button></div><div className="bars" role="img" aria-label={values.map((v,i)=>`${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}: ${v}${metric==='revenue'?' rupees':' orders'}`).join(', ')}>{values.map((v,i)=><div className="bar-column" key={i}><span className="bar-value">{metric==='revenue'?'₹'+(v/1000).toFixed(1)+'k':v}</span><div className={'bar '+(i===5?'highlight':'')} style={{height: `${v/Math.max(...values)*100}%`}}/><span className="bar-label">{['M','T','W','T','F','S','S'][i]}</span></div>)}</div><div className="chart-insight"><span className="insight-icon"><Sparkles size={17}/></span><p>{metric==='orders'?<>Saturday leads with <strong>95 orders.</strong><br/>What changes when you look at revenue?</>:<>Sunday earns <strong>₹100 per order.</strong><br/>Saturday earns ₹80. Volume is only part of the story.</>}</p><ArrowUpRight size={18}/></div><small className="source">Synthetic teaching data · 7 observations</small></div>;}
export function CleaningDemo(){const [clean,setClean]=useState(false);const raw=[['101',' Mysuru','120'],['102','BENGALURU','180'],['102','BENGALURU','180'],['103','Mysuru ','—'],['104','SHIMOGA','240'],['105','Shimoga','160']];const result=[['101','Mysuru','120'],['102','Bengaluru','180'],['103','Mysuru','170'],['104','Shimoga','240'],['105','Shimoga','160']];return <div className="experiment"><div className="section-heading"><div><span className="eyebrow">EXPERIMENT 03 / DATA QUALITY</span><h3>A little cleanup goes a long way.</h3></div><button className="button small" onClick={()=>setClean(!clean)}>{clean?<RotateCcw size={15}/>:<Sparkles size={15}/>} {clean?'Restore raw data':'Preview cleaning'}</button></div><div className="table-wrap" role="region" aria-label="Café order table" tabIndex={0}><table><caption className="sr-only">Synthetic café orders, {clean?'cleaned':'raw'}</caption><thead><tr><th>order</th><th>city</th><th>amount (₹)</th></tr></thead><tbody>{(clean?result:raw).map((r,i)=><tr key={i} className={!clean&&(i===2||i===3)?'flagged':''}>{r.map((v,j)=><td key={j}>{v==='—'?<span className="chip orange">missing</span>:v}</td>)}</tr>)}</tbody></table></div><div className="quality"><span><Check size={14}/> {clean?'5 unique rows':'6 rows · 1 duplicate'}</span><span>{clean?'0 missing amounts':'1 missing amount'}</span><span>{clean?'Consistent labels':'Inconsistent labels'}</span></div><p className="callout">{clean?'After deduplication: median(120, 160, 180, 240) = ₹170. Next, reproduce this transformation in Python.':'Inspect first: the repeated order 102 is an exact duplicate. Order 103 has a missing amount.'}</p><a className="text-link" href={appUrl("/datasets/cafe-orders.csv")} download>Download the practice CSV <ArrowUpRight size={14}/></a></div>;}
type Lesson = typeof lessons[number];
type CodingChallenge = {challenge: string; starter: string; tests: string; hint: string; retailCsv?: string; example?: string};
export function CodeEditor({lesson,draftId,onPass}:{lesson:CodingChallenge;draftId:string;onPass:()=>void}){const key='learning-ecosystem:ds:draft:'+draftId;const [code,setCode]=useState(()=>{try{return localStorage.getItem(key)??lesson.starter}catch{return lesson.starter}});const [output,setOutput]=useState('');const [status,setStatus]=useState('Ready to explore');const [busy,setBusy]=useState(false);const [hint,setHint]=useState(false);const [storageError,setStorageError]=useState(false);const worker=useRef<Worker|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const active=useRef(false);const gutter=useRef<HTMLPreElement>(null);
 function clearTimer() {
  if (timer.current !== null) clearTimeout(timer.current);
  timer.current = null;
 }
 function finish(message: string) {
  clearTimer();
  active.current = false;
  setBusy(false);
  setStatus(message);
 }
 function stop(message: string) {
  worker.current?.terminate();
  worker.current = null;
  finish(message);
 }
 useEffect(() => () => {
  worker.current?.terminate();
  clearTimer();
 }, []);
 function update(text: string) {
  setCode(text);
  try {
   localStorage.setItem(key, text);
   setStorageError(false);
  } catch {
   setStorageError(true);
  }
 }
 function run(check = false) {
  if (active.current) return;
  active.current = true;
  setBusy(true);
  setOutput('');
  setStatus('Starting Python...');
  try {
   const current = worker.current ?? new Worker(appUrl('/python-worker.js'));
   worker.current = current;
   timer.current = setTimeout(() => stop('Download timed out. Check your connection and retry.'), 90_000);
   current.onerror = () => stop('Python worker failed. Select Run code to retry.');
   current.onmessage = ({data}) => {
    if (data.kind === 'status') {
     setStatus(data.text);
     if (data.phase === 'execution') {
      clearTimer();
      timer.current = setTimeout(() => stop('Stopped after 12 seconds. Check for an infinite loop.'), 12_000);
     }
    } else if (data.kind === 'stdout' || data.kind === 'stderr') {
     setOutput(output => (output + data.text).slice(-60_000));
    } else if (data.kind === 'startup-error') {
     setOutput(data.text);
     stop('Python unavailable');
    } else if (data.kind === 'error') {
     setOutput(output => (output + '\n' + data.text).slice(-60_000));
     finish('Fix the error and try again');
    } else if (data.kind === 'done') {
     if (!check) {
      finish('Finished - try checking your answer');
      return;
     }
     const passed = data.cases?.length === 1 && data.cases[0].passed;
     finish(passed ? 'Challenge passed — nice work!' : 'Not quite yet — check the hint');
     if (passed) onPass();
     else setOutput(output => output + '\n' + (data.cases?.[0]?.detail || 'Check your result.'));
    }
   };
   current.postMessage({code, tests: check ? lesson.tests : undefined, retailCsv: lesson.retailCsv});
  } catch {
   stop('Unable to start Python. Select Run code to retry.');
  }
 }
 return <section className="code-panel"><div className="editor-heading"><span><span className="file-dot"/> experiment.py</span><span>Python 3 · Pyodide</span></div><div className="challenge"><strong>Your challenge</strong><p>{lesson.challenge}</p></div><div className="editor-area"><pre aria-hidden="true" ref={gutter} className="line-numbers">{code.split('\n').map((_,i)=>i+1).join('\n')}</pre><textarea aria-label="Python code" spellCheck={false} autoCapitalize="off" wrap="off" onScroll={event=>{if(gutter.current)gutter.current.scrollTop=event.currentTarget.scrollTop}} value={code} onChange={e=>update(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run()}}}/></div><div className="editor-buttons"><button className="button primary small" disabled={busy} onClick={()=>run()}><Play size={14}/> Run code</button><button className="button small" disabled={busy} onClick={()=>run(true)}>Check answer</button>{lesson.example && <button className="button small" disabled={busy} onClick={()=>{if(code===lesson.starter||code===lesson.example||confirm('Replace your current draft with the worked example?')){update(lesson.example!);setOutput('');setStatus('Example loaded. Select Run code.')}}}>Load example</button>}{busy&&<button className="button small" onClick={()=>stop('Stopped. Ready to restart.')}><Square size={13}/> Stop</button>}<button className="icon-button" aria-label="Reset code" onClick={()=>{if(code===lesson.starter||confirm('Replace your saved code with the starter?')){stop('Ready to explore');update(lesson.starter);setOutput('')}}}><RotateCcw size={16}/></button></div><div className="console"><div className="console-heading"><span>CONSOLE</span><span role="status">{status}</span></div><pre aria-label="Python output" tabIndex={0}>{output||'Your output will appear here.\nMake a change. Run it. See what happens.'}</pre></div><div className="editor-footer"><button className="text-link" aria-expanded={hint} onClick={()=>setHint(!hint)}>✧ {hint?'Hide hint':'Need a hint?'}</button><small>{storageError?'Draft not saved — copy your code.':'Draft saved on this browser'}</small></div>{hint&&<pre className="hint">{lesson.hint}</pre>}<p className="runtime-note">Python downloads on first run. Internet required. Runs stop after 12 seconds. Ctrl / ⌘ + Enter to run.</p></section>;
}
export function Quiz({lesson,onPass,passed}:{lesson:Lesson;onPass:()=>void;passed:boolean}){const [choice,setChoice]=useState<number|null>(null);const [checked,setChecked]=useState(false);return <section className="quiz"><span className="eyebrow">QUICK KNOWLEDGE CHECK</span><h3>{lesson.question}</h3><div role="radiogroup" aria-label={lesson.question}>{lesson.options.map((o,i)=><label className={'quiz-option '+(choice===i?'selected':'')} key={o}><input type="radio" name={'quiz-'+lesson.id} checked={choice===i} onChange={()=>{setChoice(i);setChecked(false)}}/><span>{o}</span></label>)}</div><button className="button small" disabled={choice===null} onClick={()=>{setChecked(true);if(choice===lesson.answer)onPass()}}>Check understanding</button>{checked&&<p role="status" className="callout">{choice===lesson.answer?'Correct. ': 'Try again. '}{lesson.explanation}</p>}{passed&&<p className="success"><Check size={15}/> Knowledge check complete</p>}</section>}
