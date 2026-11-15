import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
import {SqlStudio} from './SqlStudio';
import {DataTable} from './AnalysisStudio';
import {Metrics,PracticeQuestion} from './StudioControls';
import {projectNotes,readLearnerText,watchLearnerText,writeLearnerText} from './lib/learnerData';
import {downloadText} from './lib/downloadText';
import {purchaseSummary,purchaseSQL,purchaseSeed,studentDefaultSeed,studentExperiment,studentFeatures,studentRows,type StudentFeature} from './lib/capstoneData';
import type {ProjectActions} from './projectCatalog';

const purchaseLesson={id:'customer-purchases',...purchaseSQL} as const;
export function PurchaseSql({independent,done,onPass}:{independent:boolean;done:boolean;onPass:()=>void}) {
  return <section aria-label="Purchase SQL workspace"><SqlStudio lesson={purchaseLesson} project={{seed:purchaseSeed,independent}}
    completed={()=>done} onSelect={()=>{}} onStart={()=>{}} onPass={onPass}/>{done&&<p className="success">Purchase SQL check verified.</p>}</section>;
}

const currency=(amount:number)=>'₹'+amount.toLocaleString('en-IN');
const number=(value:number|null)=>value===null?'Undefined':value.toFixed(2);
type CapstoneActions=ProjectActions & {onEvaluate:()=>void};

function Findings({id,results,exportReport}:{id:'customer-purchases'|'student-performance';results:string|null;exportReport:(report:string)=>void}) {
  const key=projectNotes[id];
  const [notes,setNotes]=useState(()=>readLearnerText(key)??'');
  const [saved,setSaved]=useState(true);
  useEffect(()=>watchLearnerText(key,setNotes),[key]);
  return <section className="experiment analysis-panel">
    <h2>Findings and report preview</h2>
    <label>Findings and limitations<textarea rows={5} maxLength={6000} value={notes} onChange={event=>{
      setNotes(event.target.value);setSaved(writeLearnerText(key,event.target.value));
    }}/></label>
    <p className="muted">Cite a computed result, explain a decision and state one limitation. Compare your conclusion with the evidence above.</p>
    {!saved&&<p role="status">This browser could not save the draft. Download a copy before leaving.</p>}
    {results&&<details><summary>Preview report</summary><pre className="capstone-preview">{results+'\n\n## Learner findings\n'+notes.trim()}</pre></details>}
    <button className="button primary" disabled={!results || !notes.trim()} onClick={()=>{
      if(!results || !notes.trim())return;
      const report=results+'\n\n## Learner findings\n'+notes.trim()+'\n';
      downloadText(id+'-report.md',report,'text/markdown;charset=utf-8');
      exportReport(report);
    }}><Download size={16}/> Export capstone report</button>
  </section>;
}

const purchaseViews={categories:'Category',products:'Product',customers:'Customer',months:'Month',orders:'Order'};
type PurchaseView=keyof typeof purchaseViews;

function HorizontalBars({values,label}:{values:[string,number][];label:string}) {
  const max=Math.max(1,...values.map(([,amount])=>amount));
  return <ul className="capstone-bars" aria-label={label}>
    {values.map(([name,amount])=><li key={name}><span>{name}</span><span className="capstone-bar-track" aria-hidden="true">
      <span style={{width:(amount/max*100)+'%'}}/></span><strong>{amount.toLocaleString('en-IN')}</strong></li>)}
  </ul>;
}

export function CustomerPurchases({onAnalyze,onEvaluate,onExport}:CapstoneActions) {
  const [summary,setSummary]=useState<ReturnType<typeof purchaseSummary>>();
  const [view,setView]=useState<PurchaseView>('categories');
  const report=summary?[
    '# Customer Purchase Analytics','',
    'Synthetic January–March 2026 sales ledger. Revenue is measured in rupees and does not measure profit.','',
    '## Cleaning audit',
    `- ${summary.rows} raw lines, ${summary.duplicates} exact duplicates removed, ${summary.excluded} further invalid lines excluded, ${summary.retained} retained.`,
    '- Excluded lines with missing price or quantity, nonpositive quantity or negative price. Kept blank categories as Unknown.','',
    '## Results', '- Recorded revenue: '+currency(summary.total),
    ...Object.entries(purchaseViews).flatMap(([kind,title])=>['','### '+title+' revenue',...summary[kind as PurchaseView].slice(0,10).map(([name,amount])=>'- '+name+': '+currency(amount))]),
    '', '## Limitations','Reported revenue covers valid retained lines. Excluded purchases have unknown or invalid revenue. Synthetic records cannot establish future demand.',
  ].join('\n'):null;
  const amounts=summary?.orders.map(([,amount])=>amount)??[];
  const orderBins=Array.from({length:5},(_,i)=>{
    const upper=i===4?'and above':'–'+((i+1)*1000-1);
    return [i*1000+' '+upper,amounts.filter(value=>Math.min(4,Math.floor(value/1000))===i).length] as [string,number];
  });
  return <div className="analysis-studio capstone-workbench">
    <div className="page-heading"><h1>Customer Purchase Analytics</h1><p>Use the same synthetic line items in SQLite, Pandas and this revenue workbench.</p></div>
    <section className="experiment analysis-panel">
      <h2>Purchase revenue workbench</h2>
      <p>Remove exact duplicates. Keep records with known positive quantity and a known nonnegative price. Treat blank categories as Unknown.</p>
      <button className="button primary" onClick={()=>{setSummary(purchaseSummary());onAnalyze();}}>Compute purchase summary</button>
      {summary&&<>
        <Metrics values={[[ 'Raw lines',String(summary.rows)],['Duplicates',String(summary.duplicates)],['Invalid lines',String(summary.excluded)],
          ['Retained lines',String(summary.retained)],['Recorded revenue',currency(summary.total)],['Orders with valid lines',String(summary.orders.length)]]}/>
        <label>Group revenue by <select value={view} onChange={event=>setView(event.target.value as PurchaseView)}>
          {Object.entries(purchaseViews).map(([key,title])=><option key={key} value={key}>{title}</option>)}
        </select></label>
        <figure><figcaption>{purchaseViews[view]} revenue (₹){view==='orders'?' · top 10':''}</figcaption>
          <HorizontalBars values={summary[view].slice(0,10)} label={purchaseViews[view]+' revenue'}/></figure>
        <figure><figcaption>Order-value distribution · counts by revenue band (₹)</figcaption>
          <HorizontalBars values={orderBins} label="Order-value distribution"/></figure>
      </>}
    </section>
    <PracticeQuestion prompt="What can you conclude about records without a unit price?" options={['Their revenue is unknown.', 'They generated zero revenue.']} answer={0}
      explanation="Keep known zero prices distinct from missing prices. Report how many records you excluded and avoid inferring profit from revenue." onPass={onEvaluate}/>
    <Findings id="customer-purchases" results={report} exportReport={onExport}/>
  </div>;
}

export function StudentPerformance({onAnalyze,onEvaluate,onExport}:CapstoneActions) {
  const [feature,setFeature]=useState<StudentFeature>('study_hours');
  const [seed,setSeed]=useState(studentDefaultSeed);
  const [run,setRun]=useState<{feature:StudentFeature;seed:number;result:ReturnType<typeof studentExperiment>}>();
  const active=run?.feature===feature&&run.seed===seed?run.result:null;
  const values=studentRows.flatMap(row=>row[feature]===null?[]:[row[feature]!]);
  const low=Math.min(...values);
  const width=Math.max(1,Math.ceil((Math.max(...values)-low+1)/6));
  const bins=Array.from({length:6},(_,i)=>{
    const start=low+i*width;
    return [start+'–'+(start+width-1),values.filter(value=>value>=start&&value<start+width).length] as [string,number];
  });
  const describe=(metric:NonNullable<typeof active>['model'])=>[
    number(metric.mae),number(metric.mse===null?null:Math.sqrt(metric.mse)),number(metric.r2)];
  const comparison=active&&active.model.mae!==null&&active.reference.mae!==null ?
    active.model.mae<active.reference.mae?'Regression had lower MAE than the training-mean baseline on this split.':
    active.model.mae>active.reference.mae?'The training-mean baseline had lower MAE than regression on this split.':
      'Regression and the training-mean baseline tied on MAE on this split.' : '';
  const report=active?[
    '# Student Performance Prediction','',
    'Synthetic educational records. The target is final_score. A post-exam pass indicator was excluded as leakage.','',
    '## Preparation and fitting',
    `- Feature: ${studentFeatures[feature]}. Seed ${seed}; ${active.train.length} training rows and ${active.test.length} held-out rows.`,
    `- Excluded ${active.excluded} rows with this feature missing. Fit least squares only on training rows.`,
    '- Baseline training target mean: '+number(active.baseline),
    '- Regression slope: '+number(active.fit.slope)+'; intercept: '+number(active.fit.intercept),'',
    '## Held-out metrics','| Predictor | MAE | RMSE | R² |','| --- | ---: | ---: | ---: |',
    '| Training mean | '+describe(active.reference).join(' | ')+' |','| Regression | '+describe(active.model).join(' | ')+' |','',comparison,'',
    '## Held-out predictions','| Student | Feature | Actual | Prediction | Actual − predicted |','| --- | ---: | ---: | ---: | ---: |',
    ...active.predictions.map(row=>'| '+[row.id,row.x,row.y,number(row.prediction),number(row.error)].join(' | ')+' |'),
    '', '## Limitations','Synthetic associations are illustrative. A single split, missing features and a one-feature model limit interpretation. Results do not describe real students.',
  ].join('\n'):null;
  const boundLow=Math.min(0,...(active?.predictions.map(row=>row.prediction)??[]));
  const boundHigh=Math.max(100,...(active?.predictions.map(row=>row.prediction)??[]));
  const scale=(value:number)=>(value-boundLow)/(boundHigh-boundLow)*240;
  return <div className="analysis-studio capstone-workbench">
    <div className="page-heading"><h1>Student Performance Prediction</h1><p>Compare one-feature ordinary least squares and a mean baseline on the same unseen rows.</p></div>
    <section className="experiment analysis-panel"><h2>Feature distribution and model controls</h2>
      <div className="project-form">
        <label>Model feature <select value={feature} onChange={event=>setFeature(event.target.value as StudentFeature)}>
          {Object.entries(studentFeatures).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Split seed <input type="number" min={1} max={9999} value={seed} onChange={event=>setSeed(Math.max(1,Math.min(9999,Math.trunc(Number(event.target.value)||1))))}/></label>
        <button className="button primary" onClick={()=>{setRun({feature,seed,result:studentExperiment(feature,seed)});onAnalyze();}}>Fit and evaluate</button>
      </div>
      <p>{studentRows.length-values.length} rows are missing the selected feature. The split holds out 25% after dropping these rows. The post-exam pass indicator is derived from the target and is excluded.</p>
      <figure><figcaption>{studentFeatures[feature]} distribution · counts</figcaption><HorizontalBars values={bins} label="Feature distribution"/></figure>
      {run&&!active&&<p role="status">Settings changed. Fit again to see results for the current configuration.</p>}
    </section>
    {active&&<section className="experiment analysis-panel" aria-label="Held-out evaluation">
      <h2>Held-out evaluation</h2>
      <p role="status">{active.train.length} training rows · {active.test.length} held-out rows. Baseline predicts the training mean of {number(active.baseline)}.</p>
      <DataTable title="Held-out regression metrics" columns={['Predictor','MAE','RMSE','R²']} rows={[
        ['Training mean',...describe(active.reference)],['Linear regression',...describe(active.model)],
      ]}/>
      <p>{comparison}</p>
      <p>Lower MAE and RMSE are better. RMSE gives greater weight to large errors. R² may be negative on unseen data.</p>
      <figure className="capstone-scatter"><figcaption>Held-out predictions vs. actual scores</figcaption>
        <svg role="img" aria-label="Predicted versus actual final scores, with a perfect-prediction diagonal" viewBox="0 0 320 304">
          <path d="M42 14 V254 H282 M42 254 L282 14" fill="none" stroke="currentColor"/>
          {active.predictions.map(row=><circle key={row.id} cx={42+scale(row.y)} cy={254-scale(row.prediction)} r={4}/>)}
          <text x="158" y="282" textAnchor="middle">Actual score</text>
          <text x="14" y="136" transform="rotate(-90 14 136)" textAnchor="middle">Predicted score</text>
          <text x="35" y="269">{Math.floor(boundLow)}</text><text x="268" y="269">{Math.ceil(boundHigh)}</text>
        </svg>
      </figure>
      <DataTable title="Held-out predictions and errors" columns={['Student','Feature','Actual','Prediction','Actual − predicted']}
        rows={[...active.predictions].sort((a,b)=>Math.abs(b.error)-Math.abs(a.error)).map(row=>[row.id,row.x,row.y,number(row.prediction),number(row.error)])}/>
    </section>}
    <PracticeQuestion prompt="Which rows should determine the fitted line and baseline?" options={['Training rows only','Training and held-out rows together']} answer={0}
      explanation="Estimate model parameters and the baseline mean using training rows. Evaluate both predictors on the untouched test rows." onPass={onEvaluate}/>
    <Findings id="student-performance" results={report} exportReport={onExport}/>
  </div>;
}
