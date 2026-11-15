import {readLearnerText, watchLearnerText, writeLearnerText} from './lib/learnerData';
import {downloadText} from './lib/downloadText';
import type {ProjectActions} from './projectCatalog';
import {useEffect, useState} from 'react';
import {Download} from 'lucide-react';
import {DataTable} from './AnalysisStudio';
import {Metrics, PracticeQuestion, RangeControl} from './StudioControls';
import {fitIris, irisFeatures, parseIris, type Sample} from './lib/ml';
import {appUrl} from './lib/urls';

const findingKey = 'ds-lab:iris-classification-conclusion';
const pct = (value: number) => (value * 100).toFixed(1) + '%';

export function IrisClassification({passed, exported, studioCompleted, onPass, onExport, onAnalyze}: {
  passed: boolean; exported: boolean; studioCompleted:boolean; onPass: () => void;
}&ProjectActions) {
  const [samples, setSamples] = useState<Sample[]>();
  const [error, setError] = useState('');
  const [columns, setColumns] = useState([2,3]);
  const [binary, setBinary] = useState(false);
  const [seed, setSeed] = useState(17);
  const [share, setShare] = useState(30);
  const [k, setK] = useState(5);
  const [conclusion, setConclusion] = useState(() => {try {return readLearnerText(findingKey) ?? '';} catch {return '';}});
  const [storageError, setStorageError] = useState(false);
  const [trained, setTrained] = useState<{
    model: ReturnType<typeof fitIris>; columns: number[]; seed: number; share: number; k: number; binary: boolean;
  }>();
  const [predictionInputs, setPredictionInputs] = useState([5.8,3,4.4,1.4]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(appUrl('/datasets/iris.csv'), {signal: controller.signal}).then(response => {
      if (!response.ok) throw new Error('The Iris dataset could not load.');
      return response.text();
    }).then(csv => {
      if (!controller.signal.aborted) setSamples(parseIris(csv));
    }).catch((problem: Error) => {if (!controller.signal.aborted) setError(problem.message);});
    return () => controller.abort();
  }, []);
  const stale = !!trained && (trained.seed !== seed || trained.share !== share || trained.k !== k ||
    trained.binary !== binary || trained.columns.join(',') !== columns.join(','));
  const model = trained?.model;
  const mistakes = model?.test.flatMap((row, index) => row.label === model.predictions[index] ? [] :
    [[index + 1, ...row.features, row.label, model.predictions[index]]]) ?? [];
  useEffect(()=>watchLearnerText(findingKey, setConclusion), []);
  function download() {
    if (!trained || stale) return;
    const {model, columns, seed, share, k, binary} = trained;
    const labels = [...model.labels];
    const lines = ['# Iris Classification — From Dataset to Prediction', '',
      'Dataset: 150 Iris observations, 50 per species. Measurements are in centimeters.', '',
      '## Training settings',
      '- Features: ' + columns.map(index => irisFeatures[index]).join(', '),
      '- Target: ' + (binary ? 'Setosa versus other species' : 'Species'),
      '- Seed: ' + seed + ', requested test share: ' + share + '%, k = ' + k,
      '- Stratified split by original species. Distance scaling fitted only on training rows.', '',
      '## Evaluation',
      '- Training accuracy (includes self-neighbors): ' + pct(model.trainAccuracy) + ' on ' + model.train.length + ' rows.',
      '- Held-out test accuracy: ' + pct(model.testAccuracy) + ' on ' + model.test.length + ' rows.',
      '- Test mistakes: ' + mistakes.length, '',
      '| Actual / predicted | ' + labels.join(' | ') + ' |',
      '| --- | ' + labels.map(()=>'---').join(' | ') + ' |',
      ...model.matrix.map((row,index) => '| ' + labels[index] + ' | ' + row.join(' | ') + ' |'), '',
      '## Learner conclusion', conclusion.trim()];
    const report=lines.join('\n');
    downloadText('iris-classification-report.md',report,'text/markdown;charset=utf-8');
    onExport(report);
  }
  return <div className="analysis-studio ml-studio">
    <div className="page-heading"><h1>Iris Classification — From Dataset to Prediction</h1>
      <p>Choose flower measurements, fit a k-nearest neighbors classifier, and explain what it gets wrong.</p></div>
    {!samples ? <p role={error ? 'alert' : 'status'}>{error || 'Loading the Iris dataset…'}</p> : <>
      <section className="experiment analysis-panel">
        <h2>1. Inspect and select</h2><p>{samples.length} flowers. Each of the three species has 50 observations.</p>
        <details><summary>Inspect dataset samples</summary><DataTable title="Iris feature samples" columns={[...irisFeatures,'Species']}
          rows={[...new Set(samples.map(row => row.label))].flatMap(label =>
            samples.filter(row=>row.label===label).slice(0,4).map(row=>[...row.features,row.label]))}/></details>
        <fieldset className="ml-feature-options"><legend>Input features (cm)</legend>
          {irisFeatures.map((name,index) => <label key={name}><input type="checkbox" checked={columns.includes(index)}
            disabled={columns.length===1&&columns.includes(index)} onChange={event => setColumns(previous =>
              event.target.checked ? [...previous,index].sort((a,b)=>a-b) : previous.filter(column=>column!==index))}/> {name}</label>)}
        </fieldset>
        <label>Target <select value={binary ? 'binary' : 'species'} onChange={event=>setBinary(event.target.value==='binary')}>
          <option value="species">Species (three classes)</option><option value="binary">Setosa versus other species</option>
        </select></label>
      </section>
      <section className="experiment analysis-panel">
        <h2>2. Split and train</h2>
        <p>Each species is shuffled with a reproducible seed. Feature variances are estimated on training rows only. Test rows are reserved for evaluation.</p>
        <div className="ml-fields">
          <RangeControl label="Split seed" min={1} max={50} value={seed} onChange={setSeed}/>
          <RangeControl label="Test share (%)" min={20} max={40} step={10} value={share} onChange={setShare}/>
          <RangeControl label="Iris neighbors (k)" min={1} max={15} step={2} value={k} onChange={setK}/>
        </div>
        <button className="button primary" onClick={() => {setTrained({
          model: fitIris(samples,columns,seed,share/100,k,binary), columns, seed, share, k, binary,
        });onAnalyze();}}>Train classifier</button>
        {stale && <p role="status">Settings changed. Train again to evaluate these settings. The results below are from the previous fit.</p>}
      </section>
      <section className="experiment analysis-panel">
        <h2>3. Evaluate and predict</h2>
        {trained && model ? <>
          <Metrics values={[[ 'Training accuracy', pct(model.trainAccuracy)], ['Test accuracy', pct(model.testAccuracy)],
            ['Training rows', String(model.train.length)], ['Test rows', String(model.test.length)]]}/>
          <p>Training predictions include each row as a possible neighbor of itself. Use the held-out score to judge performance on this split. If you tune settings here, reserve a fresh final test set for an unbiased check.</p>
          <DataTable title="Iris test confusion matrix" columns={['Actual / Predicted', ...model.labels]}
            rows={model.matrix.map((row,index)=>[model.labels[index],...row])}/>
          <h3>Inspect model mistakes</h3>
          {mistakes.length ? <DataTable title="Iris test mistakes" columns={['Test row',...trained.columns.map(index=>irisFeatures[index]),'Actual','Predicted']}
            rows={mistakes}/> : <p>No test mistakes on this split. Try a different feature set or split and compare.</p>}
          <h3>Predict a new measurement</h3>
          <div className="ml-fields">{trained.columns.map(index => <RangeControl key={index} label={irisFeatures[index]+' (cm)'} min={0} max={9} step={.1}
            value={predictionInputs[index]} onChange={value=>setPredictionInputs(previous=>previous.map((input,position)=>position===index?value:input))}/>)}</div>
          <p aria-live="polite"><strong>Predicted class:</strong> {model.predict(trained.columns.map(index=>predictionInputs[index]))}</p>
        </> : <p>Train a classifier to see its evaluation and try a new prediction.</p>}
      </section>
      <PracticeQuestion prompt="Which score measures predictions on examples held out of training?"
        options={['Training accuracy', 'Test accuracy']} answer={1} explanation="Test rows are reserved separately from the data used to fit the classifier." onPass={onPass}/>
      <section className="experiment analysis-panel">
        <h2>4. Record your conclusion</h2>
        <p>Cite both scores. If the model made mistakes, describe which classes it confused. Explain one limitation of using this split.</p>
        <label htmlFor="iris-ml-conclusion">Conclusion</label>
        <textarea id="iris-ml-conclusion" maxLength={6000} value={conclusion} onChange={event=>{
          setConclusion(event.target.value);
          try {if(!writeLearnerText(findingKey,event.target.value)) throw new Error('Draft storage unavailable.'); setStorageError(false);} catch {setStorageError(true);}
        }}/>
        {storageError && <p role="status">This browser could not save your conclusion. Export a copy before leaving.</p>}
        <button className="button primary" disabled={!trained || stale || !conclusion.trim()} onClick={download}><Download size={16}/> Export Iris report</button>
        <p className="callout" role="status">{studioCompleted ? 'Project complete.' : passed && exported ? 'Report and interpretation saved. See the Studio checklist for remaining milestones.' :
          passed ? 'Knowledge check complete. Export your report to finish the project.' :
          exported ? 'Report exported. Complete the remaining milestones in the Studio checklist.' :
          'Pass the knowledge check and export your report to complete this project.'}</p>
      </section>
    </>}
  </div>;
}
