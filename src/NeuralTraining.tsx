import {useEffect, useMemo, useRef, useState} from 'react';
import {Metrics, PracticeQuestion, RangeControl} from './StudioControls';
import {Curve, display} from './NeuralPlot';
import {evaluateNetwork, forward, initialize, meanLoss, neuralDataset, predict, trainStep, type Row} from './lib/neural';
import './neural-studio.css';

type Run = {params: number[]; trainLoss: number[]; testLoss: number[]};
const lo = -1;
const plotX = (x: number) => 30 + (x-lo)*145;
const plotY = (y: number) => 316 - (y-lo)*145;

function DecisionPlot({params, rows, project}: {params?: number[]; rows: Row[]; project: boolean}) {
  const cells = useMemo(() => params ? Array.from({length:576},(_,i) => {
    const x = -1 + (i%24)/12, y = 1 - Math.floor(i/24)/12;
    return {x,y,label:predict(params,[x+1/24,y-1/24])};
  }) : [],[params]);
  return <svg className="neural-plot" viewBox="0 0 345 350" role="img" aria-label={params?'Model decision regions and held-out points':'Synthetic classification dataset'}>
    <rect x="30" y="26" width="290" height="290" fill="var(--surface)" stroke="currentColor"/>
    {cells.map((cell,i)=><rect key={i} x={plotX(cell.x)} y={plotY(cell.y)} width={290/24} height={290/24} className={'neural-region class-'+cell.label}/>)}
    {rows.map(row => row.y ? <circle key={row.id} className="neural-point class-1" cx={plotX(row.x[0])} cy={plotY(row.x[1])} r="3.6"/> :
      <rect key={row.id} className="neural-point class-0" x={plotX(row.x[0])-3} y={plotY(row.x[1])-3} width="6" height="6"/>)}
    <text x="175" y="338" textAnchor="middle">Feature x₁ (−1 to 1)</text>
    <text x="13" y="170" transform="rotate(-90 13 170)" textAnchor="middle">Feature x₂ (−1 to 1)</text>
    {project && <text x="175" y="16" textAnchor="middle">{params?'Held-out rows over predicted classes':'All generated observations'}</text>}
  </svg>;
}

const percentage = (value: number | null) => value === null ? 'Undefined' : (100*value).toFixed(1)+'%';

export function TrainingLab({project = false, onExport}: {project?: boolean; onExport?: () => void}) {
  const [units,setUnits] = useState(6);
  const [rate,setRate] = useState(.8);
  const [epochs,setEpochs] = useState(500);
  const [seed,setSeed] = useState(17);
  const [share,setShare] = useState(30);
  const [noise,setNoise] = useState(0);
  const [query,setQuery] = useState<Row['x']>([.5,.5]);
  const [state,setState] = useState<Run>();
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('Ready to train.');
  const [error,setError] = useState('');
  const [finding,setFinding] = useState(() => {try {return project ? localStorage.getItem('ds-lab:neural-report') ?? '' : '';} catch {return '';}});
  const [storageError,setStorageError] = useState(false);
  const job = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dataset = useMemo(()=>neuralDataset(seed,share/100,noise),[seed,share,noise]);
  useEffect(()=>()=>clearTimeout(job.current),[]);
  const result = useMemo(()=>state ? evaluateNetwork(state.params,dataset.test) : null,[state,dataset.test]);
  const trainResult = useMemo(()=>state ? evaluateNetwork(state.params,dataset.train) : null,[state,dataset.train]);

  function reset() {
    clearTimeout(job.current);
    setBusy(false);setState(undefined);
    setStatus('Ready to train.');setError('');
  }

  function train() {
    reset();
    setBusy(true);
    setStatus('Training epoch 0 of '+epochs+'.');
    let params = initialize(units,seed);
    const trainLoss = [meanLoss(params,dataset.train)!];
    const testLoss = [meanLoss(params,dataset.test)!];
    function chunk() {
      try {
        for (let i=0; i<12 && trainLoss.length<=epochs;i++) {
          params = trainStep(params,dataset.train,rate);
          trainLoss.push(meanLoss(params,dataset.train)!);
          testLoss.push(meanLoss(params,dataset.test)!);
        }
        const epoch = trainLoss.length-1;
        setStatus(epoch===epochs ? 'Training complete.' : 'Training epoch '+epoch+' of '+epochs+'.');
        if (epoch===epochs) {
          const run = {params,trainLoss,testLoss};
          setState(run);setBusy(false);
        } else job.current=setTimeout(chunk,0);
      } catch (problem) {
        setBusy(false);setStatus('Training stopped.');
        setError(problem instanceof Error?problem.message:'Training could not finish.');
      }
    }
    job.current=setTimeout(chunk,0);
  }

  function exportReport() {
    const run = state;
    if (!run || !result || !trainResult || !finding.trim()) return;
    const {counts} = result;
    const report = [
      '# Neural Network Classification — From Features to Predictions','',
      'Synthetic 2D data. Features x1 and x2 range from −1 to 1. Same-sign pairs start in class 1. Label flips simulate noise.','',
      'Seed '+seed+', hidden units '+units+', learning rate '+rate+', epochs '+epochs+', noise probability '+noise+'.','',
      'Training rows: '+dataset.train.length+'. Held-out rows: '+dataset.test.length+'. Once you tune on the held-out rows, use fresh data for final evaluation.','',
      'Training accuracy: '+percentage(trainResult.accuracy)+'. Held-out accuracy: '+percentage(result.accuracy)+'.',
      'Held-out precision: '+percentage(result.precision)+'. Recall: '+percentage(result.recall)+'. F1: '+percentage(result.f1)+'.',
      'Training BCE: '+display(run.trainLoss.at(-1)!)+'. Held-out BCE: '+display(run.testLoss.at(-1)!)+'.','',
      'True positives '+counts.tp+', false positives '+counts.fp+', true negatives '+counts.tn+', false negatives '+counts.fn+'.','',
      'Mistaken held-out row IDs: '+(result.mistakes.map(row=>row.id).join(', ')||'None')+'.','',
      '## Learner conclusion',finding.trim(),
    ].join('\n');
    const url=URL.createObjectURL(new Blob([report],{type:'text/markdown;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='neural-classification-report.md';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    onExport?.();
  }
  const metric = (name: string,value: number,min: number,max: number,step: number,set: (v:number)=>void) =>
    <RangeControl label={name} value={value} min={min} max={max} step={step} onChange={change=>{reset();set(change);}}/>;
  const ceiling = state ? Math.max(1,...state.trainLoss,...state.testLoss) : 1;

  return <div className="neural-training"><h2>{project?'Configure and train the classifier':'Train a small network'}</h2>
    <p>Predict class 1 when both features have the same sign. The synthetic data can flip some labels to mimic noise. Training updates a tanh hidden layer and sigmoid output with batch gradient descent.</p>
    <details><summary>Inspect generated rows</summary><div className="sql-table-scroll" tabIndex={0} role="region" aria-label="Synthetic dataset rows">
      <table aria-label="Dataset preview"><thead><tr>{['Row','Feature x₁','Feature x₂','Label','Split'].map(value=><th key={value} scope="col">{value}</th>)}</tr></thead>
      <tbody>{dataset.rows.slice(0,12).map(row=><tr key={row.id}><th scope="row">{row.id}</th><td>{display(row.x[0])}</td><td>{display(row.x[1])}</td><td>{row.y}</td><td>{dataset.train.includes(row)?'Training':'Held out'}</td></tr>)}</tbody></table>
    </div></details>
    <fieldset disabled={busy} className="neural-settings"><legend>Training settings</legend><div className="neural-controls">
      {metric('Hidden units',units,1,8,1,setUnits)}{metric('Network learning rate',rate,.05,2,.05,setRate)}
      {metric('Training epochs',epochs,50,800,50,setEpochs)}{metric('Dataset seed',seed,1,40,1,setSeed)}
      {metric('Test share (%)',share,20,50,10,setShare)}{metric('Label flip probability',noise,0,.3,.05,setNoise)}
    </div></fieldset>
    <div className="lab-actions"><button className="button primary" disabled={busy} onClick={train}>Train network</button>
      {busy && <button className="button" onClick={()=>{reset();setStatus('Training cancelled.');}}>Cancel training</button>}
      <button className="button" onClick={reset}>Reset training</button></div>
    <p role="status">{busy ? 'Training in progress. You can cancel.' : status}</p>
    {busy && <p>{status}</p>}{error && <p role="alert">{error}</p>}
    <p>{dataset.train.length} training rows · {dataset.test.length} held-out rows. Squares represent label 0 and circles represent label 1.</p>
    <DecisionPlot params={state?.params} rows={state?dataset.test:dataset.rows} project={project}/>
    {state && result && trainResult && <>
      <p>Background shades are model decision regions at a 0.5 threshold. Points show true labels.</p>
      <div className="neural-controls">
        <RangeControl label="Prediction feature x₁" min={-1} max={1} step={.05} value={query[0]} onChange={value=>setQuery([value,query[1]])}/>
        <RangeControl label="Prediction feature x₂" min={-1} max={1} step={.05} value={query[1]} onChange={value=>setQuery([query[0],value])}/>
      </div>
      <p>Predicted class <strong>{predict(state.params,query)}</strong> · Class 1 probability {percentage(forward(state.params,query).probability)}</p>
      <Curve values={state.trainLoss} label="Training loss curve" xLabel={'Training BCE · epoch 0 to '+epochs} min={0} max={ceiling}/>
      <Curve values={state.testLoss} label="Held-out loss curve" xLabel={'Held-out BCE · epoch 0 to '+epochs} min={0} max={ceiling}/>
      <Metrics values={[[ 'Training accuracy',percentage(trainResult.accuracy)], ['Held-out accuracy',percentage(result.accuracy)],
        ['Initial training BCE',display(state.trainLoss[0])], ['Final training BCE',display(state.trainLoss.at(-1)!)],
        ['Held-out BCE',display(state.testLoss.at(-1)!)], ['Held-out F1',percentage(result.f1)]]}/>
      <p>Held-out confusion counts: {result.counts.tp} true positives, {result.counts.fp} false positives, {result.counts.tn} true negatives, {result.counts.fn} false negatives.</p>
      <details><summary>Inspect held-out mistakes ({result.mistakes.length})</summary>
        {result.mistakes.length ? <ul>{result.mistakes.map(row=><li key={row.id}>Row {row.id}: ({display(row.x[0])}, {display(row.x[1])}), actual {row.y}, predicted {predict(state.params,row.x)}</li>)}</ul> : <p>No mistakes on this split.</p>}
      </details>
      <p>Compare training and held-out results. Lower training loss alone does not demonstrate better generalization. Keep a fresh final test set if you tune settings using this split.</p>
    </>}
    {project && <section className="analysis-panel"><h2>Record what you learned</h2>
      <label>Conclusion<textarea value={finding} maxLength={6000} onChange={event=>{
        const value=event.target.value;setFinding(value);
        try {localStorage.setItem('ds-lab:neural-report',value);setStorageError(false);} catch {setStorageError(true);}
      }}/></label>
      {storageError && <p role="status">This browser could not save your conclusion. Copy or export it before leaving.</p>}
      <button className="button primary" disabled={!state || !finding.trim()} onClick={exportReport}>Export neural report</button>
    </section>}
  </div>;
}
export function NeuralProject({passed,exported,onQuiz,onExport}: {passed:boolean;exported:boolean;onQuiz:()=>void;onExport:()=>void}) {
  return <div className="analysis-studio neural-studio">
    <div className="page-heading v5-heading"><h1>Neural Network Classification — From Features to Predictions</h1></div>
    <ol className="analysis-steps"><li>Inspect the two features and binary labels.</li><li>Choose a seed, split, hidden layer size and learning rate. Train the network.</li>
      <li>Compare the loss curves, predicted regions and held-out mistakes. Explain one finding and one limitation in your report.</li></ol>
    <section className="experiment analysis-panel"><TrainingLab project onExport={onExport}/></section>
    <PracticeQuestion prompt="Which rows were excluded from weight updates?" options={['Training rows','Held-out rows']} answer={1}
      explanation="Only training rows contribute gradients. Held-out rows are scored separately." onPass={onQuiz}/>
    <p className="callout">{passed&&exported?'Project complete.':'Pass the check and export a report to complete the project.'}</p>
  </div>;
}
