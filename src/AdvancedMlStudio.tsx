import {useMemo, useState} from 'react';
import {CodeEditor} from './components';
import {LessonObjective, PracticeQuestion} from './StudioControls';
import {advancedExamples, advancedLessons, type AdvancedLesson, type AdvancedLessonId} from './advancedLessons';
import {average, boost, cluster, fitForest, fitTree, impurity, initialize, outOfBag, partition, pca, predictTree, vote, type Criterion, type Vector} from './lib/advancedMl';
import {appUrl} from './lib/urls';
import './ml-studio.css';
import './advanced-ml.css';

export function Control({label, value, min = 0, max, step = 1, change}: {
  label: string; value: number; min?: number; max: number; step?: number; change: (value: number) => void;
}) {
  return <label className="advanced-control">{label} <span aria-hidden="true">{value}</span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => change(e.target.valueAsNumber)}/>
  </label>;
}

const points: Vector[] = [[1, 2], [2, 1], [2, 3], [3, 2], [4, 5], [5, 4], [6, 7], [7, 6], [8, 7], [9, 9]];
const labels = [0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
const classification = points.map((x, i) => ({x, y: labels[i]}));
const regression = points.map(x => ({x, y: x[1]}));
const number = (value: number) => value.toFixed(3);
const percent = (value: number | null) => value === null ? 'Undefined' : (value * 100).toFixed(1) + '%';
const palette = ['#7054d1', '#087c68', '#b35316', '#bb3d72', '#126cb2'];

function Plot({data, groups, markers = [], axes = [], title, symmetric = false}: {
  data: Vector[]; groups?: number[]; markers?: Vector[]; axes?: Vector[]; title: string; symmetric?: boolean;
}) {
  const bound = symmetric ? Math.max(1, ...data.flat().map(Math.abs)) * 1.1 : 10;
  const low = symmetric ? -bound : 0;
  const x = (n: number) => 20 + (n - low) / (bound - low) * 280;
  const y = (n: number) => 300 - (n - low) / (bound - low) * 280;
  return <svg className="advanced-plot" role="img" aria-label={title} viewBox="0 0 320 320">
    <path d={`M20 20V300H300 M${x(0)} 20V300 M20 ${y(0)}H300`} stroke="currentColor" opacity=".28" fill="none"/>
    {axes.map(([a,b], i) => <line key={i} x1={x(-a * bound)} y1={y(-b * bound)} x2={x(a * bound)} y2={y(b * bound)}
      stroke={palette[i]} strokeWidth="2" strokeDasharray={i ? '4 4' : undefined}/>)}
    {data.map(([a,b], i) => <g key={i}><circle cx={x(a)} cy={y(b)} r="5" fill={palette[groups?.[i] ?? 0]}/>
      <text x={x(a)+6} y={y(b)-5} fill="currentColor" fontSize="10">{i+1}</text></g>)}
    {markers.map(([a,b], i) => <g key={i}><rect x={x(a)-6} y={y(b)-6} width="12" height="12" fill="none" stroke={groups ? palette[i] : 'currentColor'} strokeWidth="2"/>
      {groups && <text x={x(a)+8} y={y(b)+10} fill="currentColor" fontSize="10">C{i+1}</text>}</g>)}
  </svg>;
}

function TreeExplorer() {
  const [criterion, setCriterion] = useState<Criterion>('gini');
  const [threshold, setThreshold] = useState(4.5);
  const [feature, setFeature] = useState(0);
  const [depth, setDepth] = useState(2);
  const [input, setInput] = useState(5);
  const rows = criterion === 'variance' ? regression : classification;
  const {left, right, gain} = partition(rows, feature, threshold, criterion);
  const predict = (subset: typeof rows) => criterion === 'variance' ? average(subset.map(row => row.y)) : vote(subset.map(row => row.y));
  const selected = input <= threshold ? left : right;
  const x = [input, input];
  const fitted = selected.length ? fitTree(selected, depth - 1, criterion) : null;
  return <>
    <label>Split criterion <select value={criterion} onChange={e => setCriterion(e.target.value as Criterion)}>
      <option value="gini">Classification · Gini</option><option value="entropy">Classification · Entropy</option><option value="variance">Regression · Variance</option>
    </select></label>
    <label>Root feature <select value={feature} onChange={e => setFeature(Number(e.target.value))}><option value={0}>Feature 1</option><option value={1}>Feature 2</option></select></label>
    <Control label="Split threshold" value={threshold} max={10} step={.5} change={setThreshold}/>
    <Control label="Maximum depth" value={depth} min={1} max={5} change={setDepth}/>
    <Control label="Prediction input (both features)" value={input} max={10} change={setInput}/>
    <p role="status">Root impurity: {number(impurity(rows, criterion))} · Weighted gain: {number(gain)} · Prediction: {fitted ? number(predictTree(fitted,x)) : 'Empty branch'}</p>
    {(!left.length || !right.length) && <p>A fitted tree rejects this split because one child has no observations.</p>}
    <div className="advanced-nodes">{[left,right].map((branch,i) => <div key={i}><h3>{i ? 'Above threshold' : 'At or below threshold'}</h3>
      <p>{branch.length} rows · Impurity {number(impurity(branch, criterion))}</p><p>Leaf prediction at depth 1: {branch.length ? number(predict(branch)!) : 'Empty branch'}</p>
      {branch.length > 0 && <details><summary>Inspect node samples</summary><ol>{branch.map(row => <li key={rows.indexOf(row)}>Sample {rows.indexOf(row)+1}: ({row.x.join(', ')}) · target {row.y}</li>)}</ol></details>}
    </div>)}</div>
    <Plot data={points} groups={points.map((p) => Number(p[feature] > threshold))} markers={[x as Vector]} title="Training points colored by branch and the prediction input marked as a square"/>
  </>;
}

function ForestExplorer() {
  const [count, setCount] = useState(9);
  const [depth, setDepth] = useState(3);
  const [seed, setSeed] = useState(17);
  const [input, setInput] = useState(5);
  const forest = useMemo(() => fitForest(classification, count, depth, seed), [count,depth,seed]);
  const votes = forest.map(member => predictTree(member.tree, [input,input]));
  const oob = outOfBag(forest, classification);
  return <>
    <Control label="Tree count" value={count} min={1} max={21} change={setCount}/>
    <Control label="Tree depth" value={depth} min={1} max={6} change={setDepth}/>
    <Control label="Bootstrap seed" value={seed} min={1} max={99} change={setSeed}/>
    <Control label="Prediction input (both features)" value={input} max={10} change={setInput}/>
    <p role="status">Forest prediction: class {vote(votes)}. OOB accuracy: {percent(oob.accuracy)} on {oob.covered} of {oob.total} training rows.</p>
    <ol className="advanced-votes" aria-label="Individual tree votes">{votes.map((value,i) =>
      <li key={i}>Tree {i+1}: class {value} · {forest[i].inBag.size} unique training rows</li>)}</ol>
    <p>Ties choose the lowest class number. OOB accuracy excludes observations with zero eligible trees.</p>
  </>;
}

const boostTrain = regression.filter((_, i) => i % 3 !== 1);
const boostValidation = regression.filter((_, i) => i % 3 === 1);

function BoostExplorer() {
  const [count, setCount] = useState(10);
  const [rate, setRate] = useState(.25);
  const [step, setStep] = useState(4);
  const [input, setInput] = useState(6);
  const model = useMemo(() => boost(boostTrain, boostValidation, count, rate), [count,rate]);
  const current = Math.min(step,count);
  const loss = model.history[current];
  const max = Math.max(...model.history.flatMap(p => [p.train,p.validation]), .01);
  return <>
    <Control label="Estimators" value={count} min={1} max={24} change={setCount}/>
    <Control label="Learning rate" value={rate} min={.05} max={1} step={.05} change={setRate}/>
    <Control label="Inspect iteration" value={current} max={count} change={setStep}/>
    <Control label="Prediction input" value={input} max={10} change={setInput}/>
    <p role="status">Prediction: {number(model.predict([input,input], current))} · Train MSE: {number(loss.train)} · Validation MSE: {number(loss.validation)}</p>
    {current > 0 && <p>Change from previous learner: {number(model.predict([input,input], current) - model.predict([input,input], current-1))}</p>}
    <svg className="advanced-plot" viewBox="0 0 320 160" role="img" aria-label="Mean squared error by iteration. Solid line is training and dashed line is validation.">
      <path d="M20 12V140H302" fill="none" stroke="currentColor" opacity=".3"/>
      {(['train','validation'] as const).map((key,i) => <polyline key={key} points={model.history.map((p,j) => `${20+280*j/count},${140-125*p[key]/max}`).join(' ')}
        fill="none" stroke={palette[i]} strokeWidth="3" strokeDasharray={i ? '6 4' : undefined}/>)}
      <line x1={20+280*current/count} x2={20+280*current/count} y1="12" y2="140" stroke="currentColor" opacity=".6"/>
    </svg>
    <p>Iteration on horizontal axis, MSE on vertical axis. Solid: training. Dashed: validation.</p>
  </>;
}

function ClusterExplorer() {
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(8);
  const [steps, setSteps] = useState(0);
  const result = cluster(points, initialize(points,k,seed), steps);
  return <>
    <Control label="Clusters (k)" value={k} min={1} max={5} change={value => {setK(value); setSteps(0);}}/>
    <Control label="Centroid seed" value={seed} min={1} max={99} change={value => {setSeed(value); setSteps(0);}}/>
    <Control label="Centroid updates" value={steps} max={12} change={setSteps}/>
    <p role="status">Within-cluster sum of squares: {number(result.wcss)}</p>
    <Plot data={points} groups={result.assignments} markers={result.centers} title="Numbered points grouped by cluster. Squares mark centroids."/>
    <ol>{result.centers.map(([x,y],i) => <li key={i}>C{i+1}: ({number(x)}, {number(y)}) · Samples {result.assignments.map((c,j) => c === i ? j+1 : null).filter(Boolean).join(', ') || 'none'}</li>)}</ol>
    <p>Step zero uses seeded starting centroids. An empty cluster retains its previous centroid.</p>
  </>;
}

function PcaExplorer() {
  const [data, setData] = useState(points);
  const [index,setIndex] = useState(0);
  const [scale,setScale] = useState(false);
  const result = pca(data,scale)!;
  const selected = data[index];
  const edit = (axis: number, v: number) => setData(data.map((p,i): Vector => i !== index ? p : axis ? [p[0],v] : [v,p[1]]));
  const projected = result.scores.map(([score]): Vector => [score*result.pc1[0],score*result.pc1[1]]);
  return <>
    <label>Sample to edit <select value={index} onChange={e => setIndex(Number(e.target.value))}>{data.map((_,i) => <option key={i} value={i}>Sample {i+1}</option>)}</select></label>
    <Control label="Feature 1" value={selected[0]} max={10} step={.25} change={v => edit(0,v)}/>
    <Control label="Feature 2" value={selected[1]} max={10} step={.25} change={v => edit(1,v)}/>
    <label><input type="checkbox" checked={scale} onChange={e => setScale(e.target.checked)}/> Standardize features</label>
    <p role="status">PC1 explained variance: {percent(result.explained)} · PC1 score for sample {index+1}: {number(result.scores[index][0])}</p>
    {result.tied && <p>{result.explained === null ? 'All centered data coincide. There is no variance to explain.' : 'The eigenvalues tie, so there is no unique leading direction.'}</p>}
    <Plot symmetric data={result.working} markers={projected} axes={[result.pc1,result.pc2]} title="Centered points, principal axes and projected points shown as squares"/>
    <p>PC1 direction: ({result.pc1.map(number).join(', ')}) · PC2: ({result.pc2.map(number).join(', ')})</p>
    <p>Covariance rows: {result.covariance.map(row => '['+row.map(number).join(', ')+']').join(' and ')}.</p>
    <p>Selected sample on the chart: ({result.working[index].map(number).join(', ')}). Reconstructed from PC1: ({projected[index].map(number).join(', ')}). Dropped PC2 score: {number(result.scores[index][1])}.</p>
  </>;
}

const experiments = {'ml-tree':TreeExplorer,'ml-forest':ForestExplorer,'ml-boosting':BoostExplorer,'ml-clustering':ClusterExplorer,'ml-pca':PcaExplorer};
export function AdvancedMlStudio({lesson, progress, onOpen, onQuiz, onCode}: {
  lesson: AdvancedLesson; progress?: {quiz: boolean; code: boolean}; onOpen: (id: AdvancedLessonId) => void; onQuiz: () => void; onCode: () => void;
}) {
  const [prompt, options, answer, explanation] = lesson.quiz;
  const next = advancedLessons[advancedLessons.findIndex(item => item.id === lesson.id)+1];
  const Experiment = experiments[lesson.id];
  return <div className="analysis-studio ml-studio">
    <div className="lesson-heading v5-heading"><div><h1>Advanced Machine Learning Studio</h1><p>{lesson.title}</p></div></div>
    <nav className="lab-picker analysis-lessons" aria-label="Advanced ML lessons">
      {advancedLessons.map(item => <button key={item.id} aria-current={item.id === lesson.id ? 'page' : undefined} onClick={() => onOpen(item.id)}>{item.title}</button>)}
    </nav>
    <div className="analysis-grid">
      <div className="analysis-column">
        <article className="experiment analysis-panel"><h2>{lesson.title}</h2><p>{lesson.concept}</p><LessonObjective>{lesson.task}</LessonObjective>
          <h3>Worked example</h3><p>{lesson.example}</p>
          <details className="lab-hint"><summary>Common mistake</summary><p>{lesson.mistake}</p></details>
          <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{lesson.hint}</p></details>
        </article>
        <section className="experiment analysis-panel advanced-controls"><h2>Interactive experiment</h2><Experiment/></section>
      </div>
      <div className="analysis-column">
        <CodeEditor draftId={lesson.id} lesson={{challenge:lesson.task, starter:lesson.starter, tests:lesson.tests, hint:lesson.hint, example:advancedExamples[lesson.id]}} onPass={onCode}/>
        <PracticeQuestion prompt={prompt} options={[...options]} answer={answer} explanation={explanation} onPass={onQuiz}/>
        <section className="experiment analysis-panel"><h2>Takeaway</h2><p>{lesson.summary}</p><p>{progress?.code && progress.quiz ? 'Lesson complete.' : 'Pass the Python challenge and knowledge check to finish.'}</p>
          <a className="text-link" href={appUrl('/assessments/')+'?course=Machine%20Learning&topic='+encodeURIComponent(lesson.title)}>Practice {lesson.title} in Assessments</a>
          {next ? <button className="button" onClick={() => onOpen(next.id)}>Next: {next.title}</button> : <a className="button" href={appUrl('/projects/compare-models')}>Compare models on Iris</a>}
        </section>
      </div>
    </div>
  </div>;
}
