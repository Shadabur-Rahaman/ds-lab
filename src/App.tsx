import {appPath, appUrl} from './lib/urls';
import IrisProject from './IrisProject';
import {IrisClassification} from './IrisClassification';
import {MlFeature, MlStudio} from './MlStudio';
import {irisClassificationId, mlLessons} from './mlLessons';
import {AnalysisLinks, AnalysisStudio} from './AnalysisStudio';
import {RetailProject, VisualizationLab} from './VisualizationLab';
import {analysisLessons, chartLessonId, retailProjectId} from './analysisLessons';
import {Home, LessonSections, ProgressCheck, learningItems, lessonState} from './LearningStudio';
import {useEffect,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,Check,ChevronRight,Clock,Compass,GraduationCap,LayoutDashboard,Map,Menu,Moon,Search,Sun,X} from 'lucide-react';
import {courses,ecosystem,lessons,type LessonId,type LearningId} from './data';
import {CafeChart,CleaningDemo,CodeEditor,Glyph,Quiz} from './components';
import Intro from './content/introduction.mdx?raw';
import Stats from './content/statistics.mdx?raw';
import Pandas from './content/pandas.mdx?raw';
import {StatisticsExperiment, StatisticsFeature, StatisticsPicker, StatisticsQuestion, statisticsTopics, type StatisticsTopic} from './StatisticsStudio';
import {LessonContent} from './LessonContent';
import {SqlFeature, SqlStudio} from './SqlStudio';
import {sqlLessons, type SqlLessonId} from './sqlLessons';
import {mergeProgress,readProgress,saveProgress,supabase,type Progress} from './lib/progress';
const content={introduction:Intro,statistics:Stats,pandas:Pandas};
export default function App(){const [path,setPath]=useState(appPath());const [mobile,setMobile]=useState(false);const [dark,setDark]=useState(()=>{try{return localStorage.getItem('ds-theme')==='dark'}catch{return false}});const [progress,setProgress]=useState<Progress>(readProgress);const [saveMessage,setSaveMessage]=useState('Progress saved on this browser');const [query,setQuery]=useState('');const [filter,setFilter]=useState('All courses');const [expanded,setExpanded]=useState<number|null>(null);const [account,setAccount]=useState(false);const [email,setEmail]=useState('');const [authMessage,setAuthMessage]=useState('');const [user,setUser]=useState<{id:string;email?:string}|null>(null);
 const [topic, setTopic] = useState<StatisticsTopic>(statisticsTopics[0]);
 const [practicePassed, setPracticePassed] = useState<Partial<Record<StatisticsTopic['id'], boolean>>>({});
 function navigate(to:string){history.pushState({},'',appUrl(to));setPath(to);setTopic(statisticsTopics[0]);setMobile(false);window.scrollTo({top:0,behavior:'instant'})}
 useEffect(()=>{const pop=()=>{setPath(appPath());setTopic(statisticsTopics[0]);setMobile(false)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('ds-theme',dark?'dark':'light')}catch{}},[dark]);
 useEffect(()=>{if(!supabase)return;const {data}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));supabase.auth.getSession().then(({data})=>setUser(data.session?.user??null));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!user||!supabase)return;let cancelled=false;supabase.from('learning_progress').select('lesson_id,quiz,code').eq('user_id',user.id).then(async ({data,error})=>{if(cancelled)return;if(error){setSaveMessage('Cloud unavailable; progress stays on this browser');return}const remote:Progress={};for(const r of data??[])if(['introduction','statistics','pandas'].includes(r.lesson_id))remote[r.lesson_id as LessonId]={quiz:r.quiz,code:r.code};const merged=mergeProgress(readProgress(),remote);setProgress(merged);saveProgress(merged);const result=await supabase!.from('learning_progress').upsert(lessons.map(({id:lesson_id})=>({user_id:user.id,lesson_id,quiz:!!merged[lesson_id]?.quiz,code:!!merged[lesson_id]?.code})));if(!cancelled)setSaveMessage(result.error?'Cloud sync failed; progress saved locally':'Progress synced to your account')});return()=>{cancelled=true}},[user?.id]);
 async function mark(id:LessonId,kind:'quiz'|'code'){const next={...progress,[id]:{quiz:!!progress[id]?.quiz,code:!!progress[id]?.code,[kind]:true}};setProgress(next);setSaveMessage(saveProgress(next)?'Progress saved on this browser':'Storage unavailable — progress lasts this session');if(user&&supabase){const {error}=await supabase.from('learning_progress').upsert({user_id:user.id,lesson_id:id,...next[id]});setSaveMessage(error?'Cloud sync failed; progress saved locally':'Progress synced to your account')}}
 const quizCount=lessons.filter(l=>progress[l.id]?.quiz).length;
 const codeCount=lessons.filter(l=>progress[l.id]?.code).length;
 const sqlCompleted = sqlLessons.filter(item => progress[item.id]?.code).length;
 const completed = learningItems.filter(item => lessonState(progress, item.id) === 'Completed').length;
 const nextLesson = learningItems.find(item => lessonState(progress, item.id) === 'In progress')
   ?? learningItems.find(item => lessonState(progress, item.id) === 'Ready to start') ?? learningItems[0];
 const lessonId = path.startsWith('/learn/') ? path.split('/')[2] : undefined;
 const lesson = lessons.find(item => item.id === lessonId);
 const sqlLesson = sqlLessons.find(item => item.id === lessonId);
 const analysisLesson = analysisLessons.find(item => item.id === lessonId);
 const mlLesson = mlLessons.find(item => item.id === lessonId);
 const isVisualization = lessonId === chartLessonId;
 const active = lesson || sqlLesson || analysisLesson || mlLesson || isVisualization ? 'Courses' : ({'/':'Overview','/dashboard':'My learning','/roadmap':'Learning roadmap','/courses':'Courses','/projects/iris':'Iris EDA project','/projects/retail':'Retail analysis project','/projects/iris-classification':'Iris Classification'} as Record<string,string>)[path];
 function goLesson(id:LearningId){navigate(id === retailProjectId ? '/projects/retail' : id === irisClassificationId ? '/projects/iris-classification' : '/learn/'+id)}
 function openSql() { goLesson(sqlLessons.find(item => progress[item.id]?.started && !progress[item.id]?.code)?.id
   ?? sqlLessons.find(item => !progress[item.id]?.code)?.id ?? sqlLessons[0].id); }
 function openCourse(id: LearningId) {
   if (id === 'sql-foundations') {openSql(); return;}
   const course = analysisLessons.find(item => item.id === id)?.course;
   const chapters = mlLessons.some(item => item.id === id) ? mlLessons : analysisLessons.filter(item => item.course === course);
   goLesson(chapters.find(item => lessonState(progress, item.id) === 'In progress')?.id
     ?? chapters.find(item => lessonState(progress, item.id) === 'Ready to start')?.id ?? id);
 }
 function markAnalysis(id: LearningId, kind: 'quiz' | 'code') {
   setProgress(previous => {
     const next = {...previous, [id]: {quiz: !!previous[id]?.quiz, code: !!previous[id]?.code, [kind]: true}};
     saveProgress(next);
     return next;
   });
 }
 function markSql(id: SqlLessonId, passed: boolean) {
   setProgress(previous => {
     if (previous[id]?.code || (!passed && previous[id]?.started)) return previous;
     const next = {...previous, [id]: {quiz: false, code: passed, started: true}};
     saveProgress(next);
     return next;
   });
 }
 const link=(to:string,label:string,icon:React.ReactNode)=><a href={appUrl(to)} className={'nav-item '+(active===label?'active':'')} aria-current={active===label?'page':undefined} onClick={e=>{e.preventDefault();navigate(to)}}>{icon}<span>{label}</span>{label==='Courses'&&<small>12</small>}</a>;
 return <><a className="skip-link" href="#main">Skip to content</a>{mobile&&<button className="scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}<aside className={'sidebar '+(mobile?'open':'')}><a className="brand" href={appUrl("/")} onClick={e=>{e.preventDefault();navigate('/')}}><span className="brand-mark"><span/><span/><span/></span><strong>DS LAB<span className="brand-period">.</span></strong></a><nav aria-label="Main navigation">{link('/','Overview',<Compass size={19}/>)}{link('/dashboard','My learning',<LayoutDashboard size={18}/>)}{link('/courses','Courses',<BookOpen size={18}/>)}{link('/roadmap','Learning roadmap',<Map size={18}/>)}</nav><div className="sidebar-section">YOUR LEARNING ECOSYSTEM</div><div className="ecosystem">{ecosystem.map((e,i)=>e.url?<a href={e.url} key={e.name} target="_blank" rel="noreferrer"><span className={'lab-icon lab-'+i}>{['Py','<>','JS'][i]}</span><span>{e.name}<small>{e.status}</small></span><ArrowUpRight size={14}/></a>:<div key={e.name}><span className={'lab-icon lab-'+i}>{['Py','<>','JS'][i]}</span><span>{e.name}<small>{e.status}</small></span></div>)}</div><div className="sidebar-bottom"><button className="profile" onClick={()=>setAccount(true)}><span className="avatar">{user?'L':'G'}</span><span>{user?'Your learning account':'Guest learner'}<small>{user?'Cloud progress enabled':'Learning at your own pace'}</small></span><ChevronRight size={16}/></button></div></aside><div className="app-shell"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}><Menu size={21}/></button><div className="breadcrumbs">Workspace <ChevronRight size={13}/><span>{lesson||sqlLesson||analysisLesson||mlLesson||isVisualization?'Lesson workspace':active||'Page not found'}</span></div><div className="top-actions"><form className="global-search" onSubmit={e=>{e.preventDefault();setFilter('All courses');navigate('/courses')}}><Search size={16}/><input aria-label="Search courses" placeholder="What do you want to learn?" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>↵</kbd></form><button className="icon-button" aria-label={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>setDark(!dark)}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><button className="avatar mini" aria-label="Open learner account" onClick={()=>setAccount(true)}>{user?'L':'G'}</button></div></header><main id="main" tabIndex={-1}>
 {path==='/'&&<Home progress={progress} next={nextLesson} openLesson={goLesson} openPage={navigate}/>}
 {path==='/dashboard'&&<><div className="page-heading learning-heading v5-heading"><h1>My learning</h1><p>See what you have finished and pick up your next lesson.</p></div><section className="learning-summary" aria-label="Learning progress"><div><h2>{completed} of {learningItems.length} lessons complete</h2><progress aria-label="Lessons completed" max={learningItems.length} value={completed}/></div><div><strong>{quizCount} / {lessons.length}</strong><span>Knowledge checks passed</span></div><div><strong>{codeCount} / {lessons.length}</strong><span>Python challenges passed</span></div><div><strong>{sqlCompleted} / {sqlLessons.length}</strong><span>SQL challenges passed</span></div></section><section className="continue-card"><span className="value-icon purple"><Glyph name={nextLesson.icon} size={30}/></span><div><span className="eyebrow">{completed===learningItems.length?'REVIEW A LESSON':'YOUR NEXT STEP'}</span><h2>{nextLesson.title}</h2><p>{nextLesson.description}</p></div><button className="button primary" onClick={()=>goLesson(nextLesson.id)}>{completed===learningItems.length?'Review lesson':'Continue learning'} <ArrowRight size={16}/></button></section><StatisticsFeature onOpen={()=>goLesson("statistics")}/><SqlFeature onOpen={openSql}/><AnalysisLinks open={openCourse}/><MlFeature onOpen={()=>openCourse('ml-intro')}/><section className="section"><h2>Your practice journal</h2><p className="muted">{saveMessage}. Pass both checks in Python lessons, the query challenge in SQL, or the knowledge check in Data Visualization.</p>{learningItems.map(l=><button className="progress-row" key={l.id} onClick={()=>goLesson(l.id)}><span className={'value-icon '+l.color}><Glyph name={l.icon}/></span><span><strong>{l.title}</strong><small>{l.course}</small></span><span className="progress-checks">{l.course === "SQL" ? <ProgressCheck done={!!progress[l.id]?.code}>SQL</ProgressCheck> : <><ProgressCheck done={!!progress[l.id]?.quiz}>Quiz</ProgressCheck>{l.id !== chartLessonId && <ProgressCheck done={!!progress[l.id]?.code}>{(l.id === retailProjectId || l.id === irisClassificationId) ? "Report" : "Python"}</ProgressCheck>}</>}</span><ArrowRight size={18}/></button>)}</section><section className="continue-card"><span className="value-icon green"><Glyph name="folder" size={26}/></span><div><span className="eyebrow">GUIDED PROJECT</span><h2>Iris exploratory data analysis</h2><p>Compare real flower measurements and export a short report.</p></div><a className="button" href={appUrl('/projects/iris')}>Open project <ArrowRight size={16}/></a></section></>}
 {path==='/courses'&&<><div className="page-heading v5-heading"><h1>Course explorer</h1><p>Find a topic, open a lesson, or explore the full data science curriculum.</p></div><div className="course-controls"><div className="search-field"><Search size={18}/><input aria-label="Filter course catalog" placeholder="Search courses or chapters…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={16}/></button>}</div><div className="filters">{['All courses','Foundations','Data analysis','AI & deployment','Projects'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>{!query && filter==="All courses" && <><StatisticsFeature onOpen={()=>goLesson("statistics")}/><SqlFeature onOpen={openSql}/><AnalysisLinks open={openCourse}/><MlFeature onOpen={()=>openCourse('ml-intro')}/></>}<div className="course-grid v5-course-grid">{courses.map((c,i)=>({c,i})).filter(({c})=>(filter==='All courses'||c.category===filter)&&[c.title,...c.chapters].join(' ').toLowerCase().includes(query.toLowerCase())).map(({c,i})=><article className="course-card" key={c.title}><div className="section-heading"><span className={'value-icon '+c.color}><Glyph name={c.icon}/></span><span className={'chip '+(c.lesson?'green':'neutral')}>{c.title==='SQL'?'5 interactive lessons':c.lesson==='statistics'?'5 interactive labs':c.lesson?'Lesson available':c.external?'Python Lab':c.category==='Projects'?'Project available':'Planned'}</span></div><h3>{c.title}</h3><p>{c.level} · {c.chapters.length} chapters mapped</p><button className="text-link" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)}>View chapters <ArrowDown size={14}/></button>{expanded===i&&<ol className="chapter-list">{c.chapters.map(ch=><li key={ch}>{ch}</li>)}</ol>}<div className="course-bottom">{c.lesson?<button className="button small" onClick={()=>openCourse(c.lesson!)}>{["SQL","NumPy","Pandas","Data Visualization","Machine Learning"].includes(c.title) || c.lesson==="statistics"?"Open studio":"Open lesson"} <ArrowRight size={14}/></button>:c.external?<a className="button small" href={c.external} target="_blank" rel="noreferrer">Continue in Python Lab <ArrowUpRight size={14}/></a>:c.category==='Projects'?<><a className="button small" href={appUrl("/projects/iris")}>Open Iris EDA project <ArrowRight size={14}/></a><a className="button small" href={appUrl("/projects/retail")}>Open retail project <ArrowRight size={14}/></a></>:<span className="muted">Curriculum preview · lessons coming later</span>}</div></article>)}</div>{!courses.some(c=>(filter==='All courses'||c.category===filter)&&[c.title,...c.chapters].join(' ').toLowerCase().includes(query.toLowerCase()))&&<div className="empty-state"><Search size={32}/><h2>No matching courses yet</h2><p>Try “statistics”, “Python” or “data”.</p><button className="button" onClick={()=>{setQuery('');setFilter('All courses')}}>Reset filters</button></div>}</>}
 {path==='/roadmap'&&<><div className="page-heading"><h1>Data science roadmap</h1><p>Start with a question, learn to analyze the evidence, and build toward a guided project.</p></div><div className="roadmap-intro"><span className="value-icon purple"><Map/></span><p><strong>Your path, your pace.</strong> Start at the beginning or choose a topic. Practice with Statistics, SQL, NumPy, Pandas, Data Visualization, and Machine Learning. Python continues in Python Lab.</p><span className="chip purple">12 courses · 4 stages</span></div><nav className="lesson-sections roadmap-index" aria-label="Roadmap stages">{['Foundations','Data analysis','AI & deployment','Projects'].map((group, stage)=><a key={group} href={'#stage-'+(stage+1)}>{group}</a>)}</nav><div className="roadmap">{['Foundations','Data analysis','AI & deployment','Projects'].map((group,stage)=><section className="roadmap-stage" id={'stage-'+(stage+1)} key={group}><div className="stage-number">0{stage+1}</div><div className="stage-body"><h2>{['Find your footing','Make data make sense','Build something intelligent','Bring it all together'][stage]}</h2><p>{['Learn to ask good questions, write Python, and reason with uncertainty.','Query, clean, explore and communicate the story in a dataset.','Train, evaluate and responsibly deploy models that solve useful problems.','Combine your skills in an end-to-end portfolio project.'][stage]}</p><div className="roadmap-courses">{courses.filter(c=>c.category===group).map(c=><div className="roadmap-course" key={c.title}><span className={'value-icon '+c.color}><Glyph name={c.icon}/></span><div><strong>{c.title}</strong><small>{c.chapters.join(' · ')}</small></div>{c.lesson?<button className="button small" onClick={()=>openCourse(c.lesson!)}>{c.title === "SQL" ? "Open SQL Studio" : lessonState(progress,c.lesson)==='Completed'?'Review lesson':lessonState(progress,c.lesson)==='In progress'?'Resume lesson':'Try lesson'} <ArrowRight size={14}/></button>:c.external?<a href={c.external} className="button small" target="_blank" rel="noreferrer">Python Lab <ArrowUpRight size={14}/></a>:c.category==='Projects'?<><a className="button small" href={appUrl("/projects/iris")}>Try Iris project <ArrowRight size={14}/></a><a className="button small" href={appUrl("/projects/retail")}>Try retail project <ArrowRight size={14}/></a></>:<span className="chip neutral">Planned</span>}</div>)}</div></div></section>)}</div></>}
 {lesson && (() => {
   const isStatistics = lesson.id === 'statistics';
   const practice = isStatistics && topic.id !== 'center' ? topic : null;
   const draftId = practice ? 'statistics-' + practice.id : lesson.id;
   const codePassed = practice ? !!practicePassed[practice.id] : !!progress[lesson.id]?.code;
   return <>
     <div className="lesson-top">
       <button className="text-link" onClick={() => navigate('/courses')}><ArrowLeft size={15}/> All courses</button>
       <span className="muted">{lesson.course}</span>
     </div>
     <div className="lesson-heading v5-heading">
       <div><h1>{isStatistics ? 'Statistics Learning Studio' : lesson.title}</h1><p>{lesson.description}</p></div>
       <span className="chip neutral">{isStatistics ? '5 interactive labs' : <><Clock size={14}/> {lesson.time} min</>}</span>
     </div>
     <nav className="lesson-switcher" aria-label="Sample lessons">
       {lessons.map((item, index) => <button key={item.id} aria-current={item.id === lesson.id ? 'page' : undefined}
         onClick={() => goLesson(item.id)}>
         <span>{index + 1}</span>{item.title}{progress[item.id]?.code && progress[item.id]?.quiz && <Check size={14}/>}
       </button>)}
     </nav>
     {isStatistics && <StatisticsPicker topic={topic} onSelect={setTopic}/>}
     <LessonSections/>
     <div className="lesson-layout v5-lesson-layout">
       <div className="lesson-reading">
         <article className="prose" id="concept">{practice ?
           <><h2>How it works</h2><p>{practice.concept}</p></> :
           <LessonContent source={content[lesson.id]}/>}</article>
         <div id="experiment">{isStatistics ? <StatisticsExperiment key={topic.id} topic={topic}/> :
           lesson.id === 'introduction' ? <CafeChart/> : <CleaningDemo/>}</div>
         <div id="knowledge-check">{practice ? <StatisticsQuestion key={draftId} topic={practice}/> :
           <Quiz key={lesson.id} lesson={lesson} passed={!!progress[lesson.id]?.quiz} onPass={() => mark(lesson.id, 'quiz')}/>}</div>
       </div>
       <div className="coding-column" id="python-practice">
         <CodeEditor key={draftId} draftId={draftId} lesson={practice?.code ?? lesson} onPass={() => {
           if (!practice) void mark(lesson.id, 'code');
           else setPracticePassed(previous => ({...previous, [practice.id]: true}));
         }}/>
         <div className="completion-panel">
           <div>
             {!practice && <ProgressCheck done={!!progress[lesson.id]?.quiz}>Knowledge check</ProgressCheck>}
             <ProgressCheck done={codePassed}>Python challenge</ProgressCheck>
           </div>
           {practice ? <small>Extra practice · Check status is kept for this session.</small> : <>
             <p role="status">{progress[lesson.id]?.quiz && codePassed ?
               'Lesson complete.' : 'Complete both checks to finish this lesson.'}</p>
             <small>{saveMessage}</small>
           </>}
         </div>
       </div>
     </div>
   </>;
 })()}
 {sqlLesson && <>
   <div className="lesson-top"><button className="text-link" onClick={() => navigate('/courses')}><ArrowLeft size={15}/> All courses</button><span className="muted">SQL</span></div>
   <SqlStudio key={sqlLesson.id} lesson={sqlLesson} completed={id => !!progress[id]?.code}
     onSelect={goLesson} onStart={() => markSql(sqlLesson.id, false)} onPass={() => markSql(sqlLesson.id, true)}/>
 </>}
 {mlLesson && <MlStudio key={mlLesson.id} lesson={mlLesson} onOpen={goLesson} progress={progress[mlLesson.id]}
   onQuiz={() => markAnalysis(mlLesson.id, 'quiz')} onCode={() => markAnalysis(mlLesson.id, 'code')}/>}
 {path==='/projects/iris-classification' && <IrisClassification passed={!!progress[irisClassificationId]?.quiz} exported={!!progress[irisClassificationId]?.code}
   onPass={() => markAnalysis(irisClassificationId, 'quiz')} onExport={() => markAnalysis(irisClassificationId, 'code')}/>}
 {analysisLesson && <AnalysisStudio key={analysisLesson.id} lesson={analysisLesson} onOpen={goLesson}
   progress={progress[analysisLesson.id]} onQuiz={() => markAnalysis(analysisLesson.id, 'quiz')}
   onCode={() => markAnalysis(analysisLesson.id, 'code')}/>}
 {isVisualization && <VisualizationLab passed={!!progress[chartLessonId]?.quiz} onPass={() => markAnalysis(chartLessonId, 'quiz')}/>}
 {path==='/projects/retail' && <RetailProject passed={!!progress[retailProjectId]?.quiz}
   onPass={() => markAnalysis(retailProjectId, 'quiz')} onExport={() => markAnalysis(retailProjectId, 'code')}/>}
 {path==='/projects/iris'&&<IrisProject/>}
 {!['/','/dashboard','/courses','/roadmap','/projects/iris','/projects/retail','/projects/iris-classification'].includes(path)&&!lesson&&!sqlLesson&&!analysisLesson&&!mlLesson&&!isVisualization&&<div className="empty-state"><h1>This page hasn’t been mapped yet.</h1><button className="button primary" onClick={()=>navigate('/')}>Back to your workspace</button></div>}
 <footer><span><strong>DS LAB.</strong> Built for the joy of figuring things out.</span><button className="text-link" onClick={()=>navigate('/roadmap')}>Part of your learning ecosystem <ArrowUpRight size={13}/></button></footer></main></div>{account&&<div className="modal-backdrop" onClick={()=>setAccount(false)}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setAccount(false);if(e.key==='Tab'){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,input,a'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}><button className="icon-button modal-close" aria-label="Close account" autoFocus onClick={()=>setAccount(false)}><X/></button><span className="value-icon purple"><GraduationCap size={28}/></span><h2 id="account-title">Your learning, all together.</h2>{user?<><p>Signed in as {user.email}</p><p>{saveMessage}</p><button className="button" onClick={async()=>{await supabase?.auth.signOut();setAuthMessage('Signed out. Browser progress is retained.')}}>Sign out</button></>:supabase?<form onSubmit={async e=>{e.preventDefault();setAuthMessage('Sending your sign-in link…');const {error}=await supabase!.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+appUrl('/dashboard')}});setAuthMessage(error?error.message:'Check your email for your sign-in link.')}}><p>Sign in with an email link to sync your progress.</p><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="button primary">Send sign-in link</button></form>:<><p>You’re learning as a guest. Your completed checks and code drafts stay on this browser.</p><div className="callout">Account sync is not configured in this local preview. You can explore every sample lesson without signing in.</div><button className="button primary" onClick={()=>setAccount(false)}>Keep exploring <ArrowRight size={16}/></button></>}<p role="status">{authMessage}</p></section></div>}</>;
}
