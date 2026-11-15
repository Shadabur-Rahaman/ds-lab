import {downloadText} from './lib/downloadText';
import type {ProjectActions} from './projectCatalog';
import {readLearnerText, watchLearnerText, writeLearnerText} from './lib/learnerData';
import {useEffect, useState, type ReactNode} from 'react';
import {DataTable, RetailExplorer} from './AnalysisStudio';
import {LessonObjective, PracticeQuestion, RangeControl} from './StudioControls';
import {cleanRetail, groupRevenue, metricNames, metrics, pearson, quantile, useRetail, type CleanRow, type Metric} from './lib/retail';

const chartTypes = ['Histogram', 'Bar chart', 'Line chart', 'Scatter plot', 'Box plot', 'Correlation heatmap'] as const;
type Chart = typeof chartTypes[number];
const notes: Record<Chart, string> = {
  Histogram: 'Use equal-width bins to see the distribution of a numeric variable. Changing bin width can hide or reveal patterns.',
  'Bar chart': 'Compare discrete categories with a zero baseline. A truncated baseline exaggerates differences.',
  'Line chart': 'Read change along ordered time. These points summarize months in the sample, and intermediate values were not measured.',
  'Scatter plot': 'Each point is an order. A trend can reflect other variables or the revenue formula. Correlation alone cannot establish causation.',
  'Box plot': 'The box spans Q1 to Q3. Whiskers reach the furthest observed values within 1.5 times the IQR. Individual dots mark potential outliers.',
  'Correlation heatmap': 'Pearson r measures linear association from −1 to +1. Outliers can strongly affect it. A shared calculation can also produce a correlation.',
};
const short = (value: number) => Number(value.toFixed(2)).toLocaleString('en-IN');
const bounds = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [min, min === max ? max + 1 : max] as const;
};
const x0 = 65, x1 = 445, y0 = 22, y1 = 176;
const scale = (value: number, min: number, max: number, start: number, end: number) => start + (value - min) / (max - min) * (end - start);
const axisTicks = (min: number, max: number) => [min, (min + max) / 2, max];

function Axes({name, xLabel, yLabel, xTicks, yTicks, children}: {
  name: string; xLabel: string; yLabel: string;
  xTicks: [number, string][]; yTicks: [number, string][]; children: ReactNode;
}) {
  return <svg className="analysis-chart" viewBox="0 0 470 235" role="img" aria-label={name}>
    {yTicks.map(([point, label]) => <g key={point}>
      <line x1={x0} x2={x1} y1={point} y2={point} className="lab-gridline"/>
      <text x={x0 - 5} y={point + 4} textAnchor="end">{label}</text>
    </g>)}
    <path d={'M' + x0 + ',' + y0 + ' V' + y1 + ' H' + x1} fill="none" stroke="currentColor"/>
    {xTicks.map(([point, label]) => <text key={point} x={point} y={y1 + 19} textAnchor="middle">{label}</text>)}
    <text x={(x0 + x1) / 2} y={225} textAnchor="middle">{xLabel}</text>
    <text x={14} y={100} transform="rotate(-90 14 100)" textAnchor="middle">{yLabel}</text>
    {children}
  </svg>;
}

function ChartDisplay({rows, chart, metric, secondary, binCount}: {
  rows: CleanRow[]; chart: Chart; metric: Metric; secondary: Metric; binCount: number;
}) {
  const values = rows.map(row => row[metric]);
  const xs = bounds(values);
  const x = (value: number) => scale(value, ...xs, x0, x1);
  const numberTicks = axisTicks(...xs).map(value => [x(value), short(value)] as [number, string]);
  const title = chart + ' values';

  if (chart === 'Box plot') {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, .25), median = quantile(sorted, .5), q3 = quantile(sorted, .75);
    const iqr = q3 - q1;
    const within = sorted.filter(value => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
    const low = within[0], high = within.at(-1)!;
    const outliers = sorted.filter(value => value < low || value > high);
    return <>
      <Axes name="Box plot" xLabel={metricNames[metric]} yLabel="" xTicks={numberTicks} yTicks={[]}>
        <line x1={x(low)} x2={x(high)} y1={95} y2={95} stroke="currentColor"/>
        {[low, high].map((value, index) => <line key={index} x1={x(value)} x2={x(value)} y1={81} y2={109} stroke="currentColor"/>)}
        <rect x={x(q1)} y={72} width={Math.max(1, x(q3) - x(q1))} height={46} className="lab-bar"/>
        <line x1={x(median)} x2={x(median)} y1={72} y2={118} className="analysis-median"/>
        {outliers.map((value, index) => <circle key={index} cx={x(value)} cy={95} r={4} className="analysis-outlier"/>)}
      </Axes>
      <p>Q1 {short(q1)} · Median {short(median)} · Q3 {short(q3)} · {outliers.length} potential outlier{outliers.length === 1 ? '' : 's'}</p>
      <details><summary>View box plot values</summary><DataTable title={title} columns={['Measure', 'Value']}
        rows={[[ 'Lower whisker', low], ['Q1', q1], ['Median', median], ['Q3', q3], ['Upper whisker', high], ...outliers.map(value => ['Potential outlier', value])]}/></details>
    </>;
  }

  if (chart === 'Scatter plot') {
    const ys = bounds(rows.map(row => row[secondary]));
    const y = (value: number) => scale(value, ...ys, y1, y0);
    const r = pearson(values, rows.map(row => row[secondary]));
    return <>
      <Axes name={chart} xLabel={metricNames[metric]} yLabel={metricNames[secondary]} xTicks={numberTicks}
        yTicks={axisTicks(...ys).map(value => [y(value), short(value)])}>
        {rows.map((row, index) => <circle key={index} className="lab-bar" cx={x(row[metric])} cy={y(row[secondary])} r={5}>
          <title>{row.id}: {row[metric]}, {row[secondary]}</title></circle>)}
      </Axes>
      <p>Pearson r: {r?.toFixed(3) ?? 'undefined for a constant column'}</p>
      <details><summary>View scatter plot values</summary><DataTable title={title} columns={['Order', 'X · ' + metricNames[metric], 'Y · ' + metricNames[secondary]]}
        rows={rows.map(row => [row.id, row[metric], row[secondary]])}/></details>
    </>;
  }

  const histogram = chart === 'Histogram';
  const line = chart === 'Line chart';
  const bins = Array<number>(binCount).fill(0);
  const binSize = (xs[1] - xs[0]) / binCount;
  if (histogram) for (const value of values) bins[Math.min(binCount - 1, Math.floor((value - xs[0]) / binSize))]++;
  const pairs: [string, number][] = histogram ? bins.map((count, index) =>
    [short(xs[0] + index * binSize) + '–' + short(xs[0] + (index + 1) * binSize), count]) :
    groupRevenue(rows, line ? 'month' : 'category');
  const width = (x1 - x0) / pairs.length;
  const at = (index: number) => x0 + (index + .5) * width;
  const max = Math.max(1, ...pairs.map(([, value]) => value));
  const y = (value: number) => scale(value, 0, max, y1, y0);
  return <>
    <Axes name={chart} xLabel={histogram ? metricNames[metric] : line ? 'Month' : 'Category'} yLabel={histogram ? 'Orders' : 'Revenue (₹)'}
      xTicks={histogram ? numberTicks : pairs.map(([label], index) => [at(index), label])}
      yTicks={axisTicks(0, max).map(value => [y(value), short(value)])}>
      {line ? <>
        <polyline className="lab-curve" points={pairs.map(([, value], index) => at(index) + ',' + y(value)).join(' ')}/>
        {pairs.map(([label, value], index) => <circle key={label} className="lab-bar" cx={at(index)} cy={y(value)} r={5}/>)}
      </> : pairs.map(([label, value], index) => <rect key={index} className="lab-bar"
        x={at(index) - width * (histogram ? .5 : .32)} y={y(value)} width={width * (histogram ? 1 : .64)} height={y1 - y(value)}>
        <title>{label}: {value}</title></rect>)}
    </Axes>
    <details><summary>View chart values</summary><DataTable title={title}
      columns={[histogram ? 'Bin' : line ? 'Month' : 'Category', histogram ? 'Count' : 'Revenue (₹)']} rows={pairs}/></details>
  </>;
}

function Heatmap({rows}: {rows: CleanRow[]}) {
  return <div className="analysis-heatmap">
    <table aria-label="Correlation heatmap"><thead><tr><th scope="col">Metric</th>{metrics.map(key => <th key={key} scope="col">{metricNames[key]}</th>)}</tr></thead>
      <tbody>{metrics.map(left => <tr key={left}><th scope="row">{metricNames[left]}</th>{metrics.map(right => {
        const r = pearson(rows.map(row => row[left]), rows.map(row => row[right]));
        return <td key={right} style={{backgroundColor: r === null ? undefined : 'color-mix(in srgb, ' + (r < 0 ? '#e07933' : '#4385dd') + ' ' + Math.round(Math.abs(r) * 42) + '%, var(--surface))'}}>{r?.toFixed(3) ?? 'Undefined'}</td>;
      })}</tr>)}</tbody></table>
  </div>;
}

export function ChartLab({rows,onAnalyze}: {rows: CleanRow[];onAnalyze?:()=>void}) {
  const [chart, setChart] = useState<Chart>('Histogram');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [secondary, setSecondary] = useState<Metric>('units');
  const [bins, setBins] = useState(5);
  const [include, setInclude] = useState(true);
  const visible = include ? rows : rows.filter(row => row.units < 18);
  const columns = (label: string, value: Metric, change: (value: Metric) => void) => <label>{label}
    <select value={value} onChange={event => change(event.target.value as Metric)}>{metrics.map(key => <option key={key} value={key}>{metricNames[key]}</option>)}</select></label>;
  return <section className="experiment analysis-panel">
    <h2>Chart workbench</h2>
    <div className="lab-picker" role="group" aria-label="Chart type">{chartTypes.map(kind =>
      <button key={kind} aria-pressed={chart === kind} onClick={() => {if(kind!==chart&&(include ? rows.length : rows.some(row=>row.units<18)))onAnalyze?.();setChart(kind);}}>{kind}</button>)}</div>
    <div className="lab-actions analysis-chart-controls">
      {['Histogram', 'Box plot', 'Scatter plot'].includes(chart) && columns(chart === 'Scatter plot' ? 'X column' : 'Numeric column', metric, setMetric)}
      {chart === 'Scatter plot' && columns('Y column', secondary, setSecondary)}
      <label><input type="checkbox" checked={include} onChange={event => {setInclude(event.target.checked);if(event.target.checked ? rows.length : rows.some(row=>row.units<18))onAnalyze?.();}}/> Include orders of 18+ units</label>
    </div>
    {chart === 'Histogram' && <RangeControl label="Histogram bins" min={3} max={8} value={bins} onChange={setBins}/>}
    <p aria-live="polite">{visible.length} cleaned observations in view</p>
    {visible.length ? chart === 'Correlation heatmap' ? <Heatmap rows={visible}/> :
      <ChartDisplay rows={visible} chart={chart} metric={metric} secondary={secondary} binCount={bins}/> : <p>No observations to plot.</p>}
    <p className="callout">{notes[chart]}</p>
  </section>;
}

export function VisualizationLab({passed, onPass}: {passed: boolean; onPass: () => void}) {
  const {data, error} = useRetail();
  return <div className="analysis-studio">
    <div className="lesson-heading v5-heading"><div><h1>Data Visualization Lab</h1><p>Choose a chart, change the data, and see how the interpretation changes.</p></div></div>
    <LessonObjective>Choose a chart for a question, check its values, and explain what changes when you exclude a large order.</LessonObjective>
    {data ? <ChartLab rows={cleanRetail(data.rows).clean}/> : <p role={error ? 'alert' : 'status'}>{error || 'Loading retail data…'}</p>}
    <PracticeQuestion prompt="Which chart shows the distribution of individual order revenue?"
      options={['A histogram with equal-width revenue bins', 'A line connecting category names', 'A bar showing only total revenue']}
      answer={0} explanation="A histogram counts observations within each revenue interval. Compare it with and without the large order."
      onPass={onPass}/>
    {passed && <p className="callout">Lesson complete.</p>}
  </div>;
}

const findingsKey = 'ds-lab:retail-findings';
export function RetailProject({passed, onPass, onExport, onAnalyze}: {passed: boolean; onPass: () => void}&ProjectActions) {
  const {data, error} = useRetail();
  const [findings, setFindings] = useState(() => {try {return readLearnerText(findingsKey) ?? '';} catch {return '';}});
  const [storageError, setStorageError] = useState(false);
  useEffect(()=>watchLearnerText(findingsKey, setFindings), []);
  if (!data) return <div className="page-heading"><h1>Retail Sales Data Cleaning & Exploratory Analysis</h1>
    <p role={error ? 'alert' : 'status'}>{error || 'Loading retail data…'}</p></div>;
  const {clean, duplicates, excluded} = cleanRetail(data.rows);
  const totals = groupRevenue(clean, 'category');
  const revenues = clean.map(row => row.revenue).sort((left, right) => left - right);
  function download() {
    const monthly=groupRevenue(clean,'month');
    const report = ['# Retail Sales Data Cleaning & Exploratory Analysis', '',
      'Synthetic teaching data, January–March 2026. Each row is an order with quantity and unit price in rupees.', '',
      '## Cleaning audit', data!.rows.length + ' raw rows, ' + duplicates + ' exact duplicate removed, ' + excluded + ' additional exclusions, ' + clean.length + ' retained.',
      'Excluded rows with missing units or unit price or nonpositive units. Standardized categories and labeled blanks Unknown.', '',
      '## Revenue by category (₹)', ...totals.map(([name, total]) => '- ' + name + ': ' + total), '',
      '## Revenue by month', ...monthly.map(([month,total])=>'- '+month+': '+total), '',
      '## Order revenue distribution', revenues.length
        ? 'Median ₹' + short(quantile(revenues, .5)) + ', range ₹' + short(revenues[0]) + '–₹' + short(revenues.at(-1)!) + '.'
        : 'No complete orders remained after cleaning.', '', '## Learner findings', findings.trim()].join('\n');
    downloadText('retail-analysis.md',report,'text/markdown;charset=utf-8');
    onExport(report);
  }
  return <div className="analysis-studio">
    <div className="page-heading"><h1>Retail Sales Data Cleaning & Exploratory Analysis</h1>
      <p>Investigate a synthetic shop ledger. Each row describes one order from January to March 2026, with unit price in rupees.</p></div>
    <ol className="analysis-steps">
      <li>Inspect the raw data. Find blank cells, the duplicate, and the nonpositive quantity.</li>
      <li>Compare with the cleaned table. Explain why unknown categories can stay while unknown quantities or prices are excluded.</li>
      <li>Group cleaned revenue by category. Use the histogram or box plot to compare the distribution with and without the large order.</li>
      <li>Document a calculated finding and a limitation, then export your report.</li>
    </ol>
    <RetailExplorer rows={data.rows}/><ChartLab rows={clean} onAnalyze={onAnalyze}/>
    <PracticeQuestion prompt="Why exclude an order with missing quantity or price from revenue totals?"
      options={['Its revenue cannot be calculated reliably.', 'The order always has zero revenue.', 'It is necessarily a duplicate.']}
      answer={0} explanation="A missing factor makes order revenue unknown. Document the exclusion and avoid treating missing amounts as zero."
      onPass={onPass}/>
    <section className="experiment analysis-panel">
      <h2>Write your findings</h2><label htmlFor="retail-findings">Findings and limitations</label>
      <textarea id="retail-findings" maxLength={6000} value={findings} onChange={event => {
        setFindings(event.target.value);
        try {if(!writeLearnerText(findingsKey,event.target.value)) throw new Error('Draft storage unavailable.'); setStorageError(false);} catch {setStorageError(true);}
      }}/>
      {storageError && <p role="status">Draft is only available in this session. Download it to keep a copy.</p>}
      <button className="button primary" disabled={!findings.trim()} onClick={download}>Export analysis report</button>
      {passed && <p className="callout">Project knowledge check complete.</p>}
    </section>
  </div>;
}
