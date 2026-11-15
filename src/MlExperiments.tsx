import {useId, useState} from 'react';
import {DataTable} from './AnalysisStudio';
import {Metrics, RangeControl} from './StudioControls';
import {binaryMetrics, classify, fitLine, fitPolynomial, curveData, regressionMetrics, splitRows, type Point, type Sample} from './lib/ml';
import type {MlLessonId} from './mlLessons';

const frame = {left: 39, right: 382, top: 17, bottom: 172};
const fixed = (value: number | null) => value === null ? 'Undefined' : String(Number(value.toFixed(3)));
const percent = (value: number | null) => value === null ? 'Undefined' : (value * 100).toFixed(1) + '%';
const grid = [0, .25, .5, .75, 1];

function ModelPlot({title, xLabel, yLabel, points, test = [], curve = [], residuals = [], domain}: {
  title: string; xLabel: string; yLabel: string; points: Point[]; test?: Point[]; curve?: Point[];
  residuals?: {x: number; observed: number; predicted: number}[]; domain: [number, number, number, number];
}) {
  const id = useId();
  const [minX, maxX, minY, maxY] = domain;
  const x = (value: number) => frame.left + (value - minX) / (maxX - minX) * (frame.right - frame.left);
  const y = (value: number) => frame.bottom - (value - minY) / (maxY - minY) * (frame.bottom - frame.top);
  return <svg className="ml-plot" viewBox="0 0 405 225" role="img" aria-label={title}>
    <defs><clipPath id={id}><rect x={frame.left} y={frame.top} width={frame.right-frame.left} height={frame.bottom-frame.top}/></clipPath></defs>
    {grid.map(fraction => {
      const value = minY + fraction * (maxY - minY);
      return <g key={fraction}><line className="lab-gridline" x1={frame.left} x2={frame.right} y1={y(value)} y2={y(value)}/>
        <text x={frame.left - 4} y={y(value) + 3} textAnchor="end">{fixed(value)}</text></g>;
    })}
    {grid.map(fraction => {
      const value = minX + fraction * (maxX - minX);
      return <text key={fraction} x={x(value)} y={189} textAnchor="middle">{fixed(value)}</text>;
    })}
    <text x={211} y={213} textAnchor="middle">{xLabel}</text>
    <text transform="rotate(-90 10 95)" x={10} y={95} textAnchor="middle">{yLabel}</text>
    <g clipPath={'url(#' + id + ')'}>
      {curve.length > 0 && <polyline className="lab-curve" points={curve.map(point => x(point.x) + ',' + y(point.y)).join(' ')}/>}
      {residuals.map((row, index) => <line key={index} className="ml-residual" x1={x(row.x)} x2={x(row.x)} y1={y(row.observed)} y2={y(row.predicted)}/>)}
      {points.map((point, index) => <circle key={index} className="ml-train" cx={x(point.x)} cy={y(point.y)} r={4}/>)}
      {test.map((point, index) => <rect key={index} className="ml-test" x={x(point.x)-3} y={y(point.y)-3} width={6} height={6}/>)}
    </g>
  </svg>;
}

const rentals = [{x: 30, y: 465}, {x: 45, y: 620}, {x: 60, y: 815}, {x: 75, y: 990}];
function Introduction() {
  const [area, setArea] = useState(60);
  const [links, setLinks] = useState(1);
  const line = fitLine(rentals)!;
  const messages = [0, 1, 1, 3, 4].map((value, index) => ({features: [value], label: index < 3 ? 'Legitimate' : 'Spam'}));
  return <>
    <h2>Predict a number or a label</h2>
    <RangeControl label="Apartment area (m²)" min={25} max={90} value={area} onChange={setArea}/>
    <RangeControl label="Links in message" min={0} max={5} value={links} onChange={setLinks}/>
    <Metrics values={[[ 'Predicted rent (teaching units)', fixed(line.predict(area))],
      ['Predicted message label', classify(messages, [links], 3).label!]]}/>
    <details><summary>Inspect the labeled training examples</summary>
      <DataTable title="Apartment examples" columns={['Area (m²)', 'Rent']} rows={rentals.map(row => [row.x, row.y])}/>
      <DataTable title="Message examples" columns={['Links', 'Label']} rows={messages.map(row => [row.features[0], row.label])}/>
    </details>
    <p>The rent line was fitted from four synthetic apartments. The message classifier votes across the three nearest examples. Moving either slider changes the prediction input.</p>
  </>;
}

function Regression() {
  const initial = [{x: 1, y: 3}, {x: 2, y: 5}, {x: 3, y: 7}, {x: 4, y: 9}, {x: 5, y: 11}];
  const [points, setPoints] = useState(initial);
  const [index, setIndex] = useState(4);
  const [query, setQuery] = useState(6);
  const model = fitLine(points);
  const update = (key: keyof Point, value: number) => setPoints(previous => previous.map((point, i) =>
    index === i ? {...point, [key]: value} : point));
  const predictions = model ? points.map(point => ({x: point.x, observed: point.y, predicted: model.predict(point.x)})) : [];
  const limits = [-2, 26, ...predictions.map(row => row.predicted), ...(model ? [model.predict(0), model.predict(7)] : [])];
  const metrics = model && regressionMetrics(points, model.predict);
  return <>
    <h2>Fit and inspect a line</h2>
    <div className="ml-fields"><label>Training point <select value={index} onChange={event => setIndex(Number(event.target.value))}>
      {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}</select></label>
      <button className="button" onClick={() => {setPoints(initial); setIndex(4); setQuery(6);}}>Reset points</button>
    </div>
    <RangeControl label="Point feature x" min={0} max={7} value={points[index].x} onChange={value => update('x', value)}/>
    <RangeControl label="Point observed y" min={-2} max={26} value={points[index].y} onChange={value => update('y', value)}/>
    <RangeControl label="Prediction input" min={0} max={7} step={.5} value={query} onChange={setQuery}/>
    <ModelPlot title="Fitted line and residuals" xLabel="Feature x" yLabel="Target y" points={points}
      domain={[0, 7, Math.min(...limits)-1, Math.max(...limits)+1]} residuals={predictions}
      curve={model ? [0, 7].map(x => ({x, y: model.predict(x)})) : []}
      test={model ? [{x: query, y: model.predict(query)}] : []}/>
    <p>Circles are training observations. Dashed segments show residuals. The square is the prediction at x = {query}. Try raising the fifth observation to create an outlier.</p>
    {model && metrics ? <>
      <Metrics values={[[ 'Slope', fixed(model.slope)], ['Intercept', fixed(model.intercept)],
        ['Prediction', fixed(model.predict(query))], ['Training MAE', fixed(metrics.mae)],
        ['Training MSE', fixed(metrics.mse)], ['Training R²', fixed(metrics.r2)]]}/>
      <DataTable title="Regression residuals" columns={['x', 'Observed', 'Predicted', 'Residual']}
        rows={predictions.map(row => [row.x, row.observed, fixed(row.predicted), fixed(row.observed - row.predicted)])}/>
    </> : <p role="status">A unique line requires at least two distinct feature values.</p>}
  </>;
}

const neighbors: Sample[] = [
  {features: [1, 2], label: 'A'}, {features: [2, 4], label: 'A'}, {features: [3, 8], label: 'A'},
  {features: [4, 3], label: 'A'}, {features: [5, 7], label: 'B'}, {features: [6, 6], label: 'B'},
  {features: [7, 2], label: 'B'}, {features: [8, 4], label: 'B'}, {features: [9, 8], label: 'B'},
];
function Knn() {
  const [x, setX] = useState(4.5);
  const [y, setY] = useState(5);
  const [k, setK] = useState(3);
  const [weight, setWeight] = useState(1);
  const result = classify(neighbors, [x,y], k, [weight,1]);
  const px = (value: number) => 34 + value * 32;
  const py = (value: number) => 177 - value * 16;
  const cells = Array.from({length: 400}, (_, index) => {
    const left = (index % 20) / 2;
    const bottom = Math.floor(index / 20) / 2;
    return {left, bottom, label: classify(neighbors, [left+.25,bottom+.25], k, [weight,1]).label};
  });
  return <>
    <h2>Find the nearest neighbors</h2>
    <div className="ml-fields"><RangeControl label="Neighbors (k)" min={1} max={9} step={2} value={k} onChange={setK}/>
      <RangeControl label="Horizontal feature scale" min={.25} max={4} step={.25} value={weight} onChange={setWeight}/></div>
    <div className="ml-fields"><RangeControl label="Query feature x" min={0} max={10} step={.5} value={x} onChange={setX}/>
      <RangeControl label="Query feature y" min={0} max={10} step={.5} value={y} onChange={setY}/></div>
    <svg className="ml-plot" viewBox="0 0 380 215" role="img" aria-label="kNN decision regions, training points and query neighbors">
      {cells.map((cell, index) => <rect key={index} x={px(cell.left)} y={py(cell.bottom+.5)} width={16} height={8}
        className={'ml-region ml-' + cell.label}/>)}
      {result.neighbors.map(row => <line key={row.index} className="ml-residual" x1={px(x)} y1={py(y)}
        x2={px(row.features[0])} y2={py(row.features[1])}/>)}
      {neighbors.map((row, index) => <g key={index}>
        <circle cx={px(row.features[0])} cy={py(row.features[1])} r={8} className={'ml-point ml-' + row.label}/>
        <text x={px(row.features[0])} y={py(row.features[1])+3} textAnchor="middle" className="ml-point-label">{row.label}</text>
      </g>)}
      <rect x={px(x)-5} y={py(y)-5} width={10} height={10} className="ml-query"/>
      <text x="193" y="202" textAnchor="middle">Feature x (0–10)</text>
      <text transform="rotate(-90 14 98)" x="14" y="98" textAnchor="middle">Feature y (0–10)</text>
    </svg>
    <p aria-live="polite"><strong>Prediction: {result.label}</strong>. The square is the query. Lines connect the voting neighbors. Background cells approximate the decision regions.</p>
    <DataTable title="Voting neighbors" columns={['Feature x', 'Feature y', 'Class', 'Scaled distance']}
      rows={result.neighbors.map(row => [...row.features, row.label, fixed(row.distance)])}/>
    <p>Tied vote counts use the closest tied class. Equal distances keep dataset order. Scaling x changes the distance calculation while coordinates remain in their original units.</p>
  </>;
}

const splitData = Array.from({length: 18}, (_, index) => ({x: index + 1, y: 4 + index * 1.4 + [0, 3, -4, 2, -2][index % 5]}));
function Split() {
  const [seed, setSeed] = useState(17);
  const [testPercent, setTestPercent] = useState(30);
  const [contaminate, setContaminate] = useState(false);
  const {train,test} = splitRows(splitData, testPercent / 100, seed);
  const honest = fitLine(train)!;
  const fitRows = contaminate ? [...train, ...test] : train;
  const model = fitLine(fitRows)!;
  return <>
    <h2>Hold out unseen examples</h2>
    <div className="ml-fields"><RangeControl label="Random seed" min={1} max={50} value={seed} onChange={setSeed}/>
      <RangeControl label="Test share (%)" min={15} max={50} step={5} value={testPercent} onChange={setTestPercent}/></div>
    <label className="ml-check"><input type="checkbox" checked={contaminate} onChange={event => setContaminate(event.target.checked)}/> Leak test rows into training</label>
    <ModelPlot title="Training and test split" points={train} test={test} xLabel="Row feature" yLabel="Target"
      domain={[0, 19, 0, 36]} curve={[0,19].map(x => ({x, y: model.predict(x)}))}/>
    <p>Circles are assigned to training and squares to test. The same seed and test share reproduce the split.</p>
    <Metrics values={[[ 'Rows used to fit', String(fitRows.length)], ['Evaluation rows', String(test.length)],
      ['Evaluation rows seen in training', String(contaminate ? test.length : 0)],
      ['Training MAE', fixed(regressionMetrics(fitRows, model.predict).mae)],
      ['Honest test MAE', fixed(regressionMetrics(test, honest.predict).mae)],
      [contaminate ? 'Contaminated test MAE' : 'Current test MAE', fixed(regressionMetrics(test, model.predict).mae)]]}/>
    <DataTable title="Train and test row assignments" columns={['Training feature values', 'Test feature values']}
      rows={[[train.map(row => row.x).sort((a,b)=>a-b).join(', '), test.map(row=>row.x).sort((a,b)=>a-b).join(', ')]]}/>
    <p className="callout">{contaminate ? 'The current score uses rows the model already saw. Even if it improves, it cannot measure performance on unseen data.' :
      'Try several seeds. One favorable score can occur by chance. Scaling on all rows or using post-outcome fields can also leak information.'}</p>
  </>;
}

function ClassificationMetrics() {
  const [counts, setCounts] = useState({tp: 8, fp: 2, tn: 85, fn: 5});
  const scores = binaryMetrics(counts);
  const labels = {tp: 'True positives', fp: 'False positives', tn: 'True negatives', fn: 'False negatives'};
  return <>
    <h2>Explore the confusion matrix</h2>
    <div className="ml-fields"><button className="button" onClick={() => setCounts({tp:8,fp:2,tn:85,fn:5})}>Spam detector example</button>
      <button className="button" onClick={() => setCounts({tp:0,fp:0,tn:99,fn:1})}>Rare fraud example</button></div>
    <div className="ml-fields">{(Object.keys(labels) as (keyof typeof labels)[]).map(key =>
      <RangeControl key={key} label={labels[key]} value={counts[key]} min={0} max={100}
        onChange={value=>setCounts(previous=>({...previous,[key]:value}))}/>)}</div>
    <DataTable title="Binary confusion matrix" columns={['Actual class', 'Predicted positive', 'Predicted negative']}
      rows={[[ 'Positive', counts.tp, counts.fn], ['Negative', counts.fp, counts.tn]]}/>
    <Metrics values={[[ 'Accuracy', percent(scores.accuracy)], ['Precision', percent(scores.precision)],
      ['Recall', percent(scores.recall)], ['Specificity', percent(scores.specificity)], ['F1', percent(scores.f1)]]}/>
    <p>Undefined means the denominator is zero. In the rare fraud preset, accuracy is 99% even though the detector misses the only fraud case and never predicts fraud.</p>
  </>;
}

function Complexity() {
  const [degree, setDegree] = useState(2);
  const [noise, setNoise] = useState(1.4);
  const {train, test} = curveData(noise);
  const model = fitPolynomial(train, degree);
  const curve = model ? Array.from({length: 101}, (_, i) => {
    const x = i / 50 - 1;
    return {x, y: model(x)};
  }) : [];
  const values = [...train,...test,...curve].map(point => point.y);
  const presets = [[1,'Simple line'], [2,'Quadratic'], [12,'Interpolate training points']] as const;
  return <>
    <h2>Compare model complexity</h2>
    <div className="ml-fields">{presets.map(([value,label]) =>
      <button className="button" key={value} aria-pressed={value===degree} onClick={()=>setDegree(value)}>{label}</button>)}</div>
    <div className="ml-fields"><RangeControl label="Polynomial degree" min={0} max={12} value={degree} onChange={setDegree}/>
      <RangeControl label="Noise amplitude" min={0} max={3} step={.1} value={noise} onChange={setNoise}/></div>
    <ModelPlot title="Polynomial training and held-out observations" points={train} test={test} curve={curve}
      domain={[-1.03,1.03,Math.min(...values)-.2,Math.max(...values)+.2]} xLabel="Input" yLabel="Target"/>
    <p>Circles are fitted samples. Squares are held-out samples. These marks stay fixed when you change degree. The vertical scale adjusts if the curve swings outside the data.</p>
    {model ? <Metrics values={[[ 'Training MSE', fixed(regressionMetrics(train,model).mse)],
      ['Held-out MSE', fixed(regressionMetrics(test,model).mse)]]}/> : <p role="status">The polynomial could not be fitted reliably.</p>}
    <p>Compare the three presets with noise enabled. A degree-12 curve can pass through all 13 training points and still perform worse between them. These held-out observations are for model comparison. Reserve a separate final test set in a real project.</p>
  </>;
}

const experiments = {'ml-intro': Introduction, 'ml-regression': Regression, 'ml-knn': Knn,
  'ml-split': Split, 'ml-metrics': ClassificationMetrics, 'ml-overfit': Complexity};

export function MlExperiment({id}: {id: MlLessonId}) {
  const Experiment = experiments[id];
  return <section className="experiment analysis-panel ml-experiment"><Experiment/></section>;
}
