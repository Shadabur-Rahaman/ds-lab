import {appUrl} from './lib/urls';
import {useState} from 'react';
import {ArrowLeft, Download} from 'lucide-react';
import csv from '../public/datasets/iris.csv?raw';

const species = ['setosa', 'versicolor', 'virginica'] as const;
const columns = ['sepal length', 'sepal width', 'petal length', 'petal width'] as const;
const measurements = csv.trim().split(/\r?\n/).slice(1).map(line => {
 const cells = line.split(',');
 return {values: cells.slice(0, 4).map(Number), species: cells[4]};
});
const summary = (column: number) => species.map(name => {
 const values = measurements.filter(row => row.species === name).map(row => row.values[column]);
 return {name, values, mean: values.reduce((sum, value) => sum + value, 0) / values.length};
});

export default function IrisProject() {
 const [column, setColumn] = useState(2);
 const [answer, setAnswer] = useState('');
 const [checked, setChecked] = useState(false);
 const [finding, setFinding] = useState(() => {
  try { return localStorage.getItem('ds-lab:iris:report') ?? ''; } catch { return ''; }
 });
 const [saveStatus, setSaveStatus] = useState('');
 const groups = summary(column);
 const scale = Math.ceil(Math.max(...groups.flatMap(group => group.values)));
 const passed = checked && answer === 'setosa';

 function exportReport() {
  const reportGroups = summary(2);
  const body = `# Iris Exploratory Data Analysis\n\nDataset: Fisher (1936), UCI Machine Learning Repository, CC BY 4.0.\nhttps://doi.org/10.24432/C56C76\n\n## Mean petal length by species\n${reportGroups.map(group => `- ${group.name}: ${group.mean.toFixed(2)} cm (n=${group.values.length})`).join('\n')}\n\n## My finding and limitation\n${finding.trim()}\n`;
  const url = URL.createObjectURL(new Blob([body], {type:'text/markdown;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'iris-eda-report.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
 }

 return <>
  <a className="text-link" href={appUrl("/courses")}><ArrowLeft size={15}/> All courses</a>
  <div className="page-heading"><span className="eyebrow">GUIDED PROJECT · 20 MIN</span><h1>Can petal size tell species apart?</h1><p>Explore 150 real Iris observations and write a short analysis with evidence and a limitation.</p></div>
  <div className="lesson-layout project-layout">
   <div>
    <section className="experiment"><h2>1. Inspect the dataset</h2><p className="muted">Each row represents one flower. Four measurements are recorded in centimetres, alongside its species. The dataset has 50 observations per species.</p><a className="button" href={appUrl("/datasets/iris.csv")} download><Download size={16}/> Download Iris CSV</a><p className="runtime-note project-source">Fisher (1936) via <a href="https://doi.org/10.24432/C56C76">UCI Machine Learning Repository</a>. <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Column names added and species labels shortened.</p></section>
    <section className="experiment"><h2>2. Compare measurements</h2><label className="project-label" htmlFor="iris-column">Measurement</label><select id="iris-column" value={column} onChange={e => setColumn(Number(e.target.value))}>{columns.map((name, i) => <option key={name} value={i}>{name}</option>)}</select>
     <div className="iris-chart" aria-label={`${columns[column]} by species`}>
      {groups.map(({name, values, mean}) => <div key={name} className="iris-group"><div><strong>{name}</strong><span>Mean {mean.toFixed(2)} cm · range {Math.min(...values).toFixed(1)}–{Math.max(...values).toFixed(1)} cm</span></div><div className="iris-track" aria-hidden="true">{values.map((value,i) => <i key={i} style={{left:`${value / scale * 100}%`, top:`${5 + (i % 5) * 6}px`}}/>)}<b style={{left:`${mean / scale * 100}%`}}/></div></div>)}
      <small className="muted">0–{scale} cm · dots are flowers · vertical marks are means</small>
     </div><p className="callout">Compare ranges as well as means. If two ranges overlap, a single cutoff on that measurement cannot perfectly separate those two species in this sample.</p>
    </section>
   </div>
   <div>
    <section className="quiz"><h2>3. Check your interpretation</h2><p>Which species has a petal length range that does not overlap either of the other two?</p><div role="radiogroup" aria-label="Species with distinct petal length range">{species.map(name => <label className="quiz-option" key={name}><input type="radio" name="iris-check" checked={answer === name} onChange={() => {setAnswer(name); setChecked(false);}}/>{name}</label>)}</div><button className="button small" disabled={!answer} onClick={() => setChecked(true)}>Check interpretation</button>{checked && <p className="callout" role="status">{passed ? 'Correct. Setosa spans 1.0–1.9 cm. The other two species start at 3.0 cm and 4.5 cm.' : 'Switch to petal length and look for a gap between one species and both other ranges.'}</p>}</section>
    <section className="experiment"><h2>4. Write your finding</h2><label className="project-label" htmlFor="iris-finding">What did you find, and what can this sample tell you?</label><textarea id="iris-finding" rows={5} value={finding} onChange={e => {
     const value = e.target.value;
     setFinding(value);
     try { localStorage.setItem('ds-lab:iris:report', value); setSaveStatus('Draft saved on this browser.'); } catch { setSaveStatus('Draft could not be saved. Export your report to keep it.'); }
    }} placeholder="Cite a mean or range. Explain one limitation of using a single measurement."/><p className="muted" role="status">{saveStatus}</p><button className="button primary" disabled={!finding.trim()} onClick={exportReport}><Download size={16}/> Export report</button></section>
   </div>
  </div>
 </>;
}
