import {useEffect, useMemo, useState} from 'react';
import iris from '../public/datasets/iris.csv?raw';
import {Control} from './AdvancedMlStudio';
import {PracticeQuestion} from './StudioControls';
import {irisLabels, irisFeatures} from './lib/ml';
import {fitComparison, irisComparisonSplit, modelSettings, parseSettings, scoreComparison, settingsKey} from './lib/modelComparison';
import {readLearnerText, watchLearnerText, writeLearnerText} from './lib/learnerData';
import {downloadText} from './lib/downloadText';
import {type ProjectActions} from './projectCatalog';

const split = irisComparisonSplit(iris);
const findingsKey = 'ds-lab:compare-models:findings';
const pct = (value: number) => (value * 100).toFixed(1) + '%';

export function ModelComparisonProject({onAnalyze,onExport,onEvaluate}: ProjectActions & {onEvaluate: () => void}) {
  const [locked,setLocked] = useState(() => parseSettings(readLearnerText(settingsKey)));
  const [draft,setDraft] = useState(modelSettings);
  const [trial,setTrial] = useState<ReturnType<typeof scoreComparison> | null>(null);
  const [tested,setTested] = useState<typeof draft | null>(null);
  const [notes,setNotes] = useState(() => readLearnerText(findingsKey) ?? '');
  const [notice,setNotice] = useState('');
  const selected = locked ?? draft;
  const models = useMemo(() => fitComparison(split.train,selected),[selected]);
  const visibleValidation = locked ? scoreComparison(models,split.validation) : trial;
  const test = useMemo(() => locked ? scoreComparison(models,split.test) : null, [models,locked]);
  useEffect(() => watchLearnerText(settingsKey,value => {
    const saved = parseSettings(value);
    if (saved) setLocked(saved);
  }),[]);
  useEffect(() => watchLearnerText(findingsKey,setNotes),[]);
  const eligible = tested?.depth === draft.depth && tested.trees === draft.trees;

  function lock() {
    if (!eligible || locked) return;
    const stored = parseSettings(readLearnerText(settingsKey));
    if (stored) {setLocked(stored); return;}
    const saved = writeLearnerText(settingsKey, JSON.stringify(draft));
    setLocked(draft);
    onAnalyze();
    if (!saved) setNotice('The test was opened for this session. Browser storage could not save the lock.');
  }
  function exportReport() {
    if (!test || !locked || !visibleValidation || !notes.trim()) return;
    const body = [
      '# Compare Machine Learning Models on Iris', '',
      'Source: UCI Iris (CC BY 4.0). Target: species. Inputs: ' + irisFeatures.join(', ') + ' (cm).',
      'Fixed stratified split: 90 training, 30 validation, 30 held-out test observations.',
      `Locked maximum depth: ${locked.depth}. Forest size: ${locked.trees}. Forest seed: 197.`, '',
      '## Accuracy', '', '| Model | Validation | Held-out test |', '| --- | ---: | ---: |',
      ...test.map((result,i) => `| ${result.name} | ${pct(visibleValidation[i].accuracy)} | ${pct(result.accuracy)} |`),
      '', '## Held-out confusion matrices', '', 'Rows are actual species. Columns are predicted species.',
      ...test.flatMap(result => ['', '### ' + result.name, '', '| Actual \\ predicted | '+irisLabels.join(' | ')+' |',
        '| --- | ---: | ---: | ---: |', ...result.matrix.map((row,i) => '| '+irisLabels[i]+' | '+row.join(' | ')+' |')]),
      '', '## Findings and limitations', '', notes.trim(),
    ].join('\n');
    downloadText('compare-models-report.md',body,'text/markdown;charset=utf-8');
    onExport(body);
  }

  return <section className="experiment analysis-panel advanced-controls">
    <h1>Compare Machine Learning Models</h1>
    <p>Predict Iris species from four measurements in centimetres. The supplied exercise CSV contains 90 training rows. The workbench reserves 30 rows for validation and 30 for the final test, with equal species counts in each split.</p>
    <p>All models fit training rows only. The majority baseline breaks the class-count tie in favor of setosa. Use validation accuracy to choose settings before opening the held-out results.</p>
    {!locked && <>
      <Control label="Maximum tree depth" value={draft.depth} min={1} max={8} change={depth => setDraft({...draft,depth})}/>
      <Control label="Forest tree count" value={draft.trees} min={3} max={25} change={trees => setDraft({...draft,trees})}/>
      <button className="button" onClick={() => {setTrial(scoreComparison(models,split.validation));setTested(draft);}}>Evaluate validation split</button>
      {trial && !eligible && <p>These results use the previous settings. Run validation again before locking.</p>}
    </>}
    {visibleValidation && <div><h2>Validation accuracy</h2><ul>{visibleValidation.map(result => <li key={result.name}>{result.name}: {pct(result.accuracy)}</li>)}</ul></div>}
    {!locked && <button className="button primary" disabled={!eligible} onClick={lock}>Lock settings and evaluate test</button>}
    {notice && <p role="status">{notice}</p>}
    {test && locked && <>
      <div><h2>Held-out test accuracy</h2><p>Locked at depth {locked.depth} and {locked.trees} trees. Each confusion matrix uses actual species as rows and predicted species as columns.</p></div>
      {test.map(result => <section key={result.name} className="advanced-matrix" tabIndex={0} aria-label={result.name+' evaluation'}>
        <h3>{result.name}: {pct(result.accuracy)}</h3>
        <table><caption>{result.name} confusion matrix</caption><thead><tr><th scope="col">Actual species</th>{irisLabels.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{result.matrix.map((row,i) => <tr key={irisLabels[i]}><th scope="row">{irisLabels[i]}</th>{row.map((n,j) => <td key={irisLabels[j]}>{n}</td>)}</tr>)}</tbody>
        </table>
        <details><summary>Inspect mistakes ({result.mistakes.length})</summary>
          {result.mistakes.length ? <><p>Measurements are shown in this order: {irisFeatures.join(', ')}.</p><ul>{result.mistakes.map(error =>
            <li key={error.id}>Row {error.id}: {error.actual} predicted as {error.predicted} · {error.features.join(', ')} cm</li>)}</ul></> : <p>Every test prediction matched its species on this split.</p>}
        </details>
      </section>)}
      <PracticeQuestion prompt="What should you do if you want to tune the forest after seeing these held-out results?"
        options={['Tune it on this test set and keep reporting it as held out','Reserve a fresh test set for the final evaluation']}
        answer={1} explanation="Once you use test results to inform settings, that split becomes part of model selection." onPass={onEvaluate}/>
      <label htmlFor="comparison-findings">Findings and limitations</label>
      <textarea id="comparison-findings" rows={5} value={notes} onChange={e => {
        setNotes(e.target.value);
        if (!writeLearnerText(findingsKey,e.target.value)) setNotice('Browser storage could not save your findings.');
      }} placeholder="Compare both learners with the baseline. Explain a confusion-matrix pattern and one limitation of this dataset."/>
      <button className="button primary" disabled={!notes.trim()} onClick={exportReport}>Export comparison report</button>
    </>}
  </section>;
}
