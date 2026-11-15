import {useState} from 'react';
import {ArrowRight, BarChart3, Grid2X2, Table2} from 'lucide-react';
import {analysisLessons, chartLessonId, type AnalysisLesson, type AnalysisLessonId} from './analysisLessons';
import {CodeEditor} from './components';
import {PracticeQuestion, RangeControl} from './StudioControls';
import {cleanRetail, groupRevenue, headers, retailPath, useRetail, type RetailRow} from './lib/retail';
import {appUrl} from './lib/urls';
import './analysis-studio.css';

const knowledge = {
  NumPy: [
    ['What is the shape of two rows with three entries each?', '(2, 3)', '(3, 2)', 'Shape lists rows before columns.'],
    ['Which start index keeps the last two columns of a three-column array?', '1', '2', 'Indices are zero-based, so columns 1 and 2 are the final pair.'],
    ['How do you double each value in an array?', 'Multiply the array by 2', 'Add 2 to the array', 'Multiplication scales all values by the same factor.'],
    ['Which vector broadcasts across a grid with three columns?', 'A length-three vector', 'A length-two vector', 'The trailing dimensions must match or one must equal 1.'],
    ['Which axis reduction leaves one total per row?', 'Axis 1', 'Axis 0', 'Axis 1 removes the column dimension.'],
    ['What does mean() return when no axis is supplied?', 'One mean for the entire array', 'One mean per row', 'Omitting axis includes every value in the reduction.'],
  ],
  Pandas: [
    ['What does sales["units"] return?', 'A Series', 'A one-column DataFrame', 'Use sales[["units"]] to keep the DataFrame shape.'],
    ['Which method reports dtypes and non-null counts?', 'info()', 'head()', 'head() returns sample rows. info() prints metadata.'],
    ['What type of expression can select orders with at least five units?', 'A Boolean mask', 'A sorted index alone', 'A mask evaluates the quantity condition once per row.'],
    ['How should an unknown unit price affect order revenue?', 'Treat revenue as unknown', 'Assume the order earned zero', 'Missing price makes the product of price and units unknown.'],
    ['What does a category-level sum represent?', 'Total revenue per category', 'Typical order revenue per category', 'A sum adds every order. A mean describes a typical value.'],
    ['Which merge preserves every sales order?', 'A left merge from sales', 'An inner merge', 'A left merge keeps the sales row even without a lookup match.'],
  ],
};

export function AnalysisLinks({open}: {open: (id: AnalysisLessonId | typeof chartLessonId) => void}) {
  return <div className="analysis-links">
    {([['NumPy Learning Studio', 'numpy-arrays', Grid2X2], ['Pandas Learning Studio', 'pandas-frames', Table2],
      ['Data Visualization Lab', chartLessonId, BarChart3]] as const).map(([label, id, Icon]) =>
      <button key={id} className="button" onClick={() => open(id)}><Icon size={19}/> {label} <ArrowRight size={15}/></button>)}
  </div>;
}

export function DataTable({title, columns, rows}: {title: string; columns: readonly (string | number)[]; rows: (string | number | null)[][]}) {
  return <div className="sql-table-scroll" role="region" aria-label={title + ' scrolling region'} tabIndex={0}>
    <table aria-label={title}><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>
        {value === null || value === '' ? <span className="chip orange">Missing</span> : value}
      </td>)}</tr>)}</tbody>
    </table>{!rows.length && <p className="analysis-empty">No rows match the current filter.</p>}
  </div>;
}

export function RetailExplorer({rows}: {rows: RetailRow[]}) {
  const [cleaned, setCleaned] = useState(false);
  const [category, setCategory] = useState('');
  const [grouped, setGrouped] = useState(false);
  const {clean, duplicates, excluded} = cleanRetail(rows);
  const visible = (cleaned ? clean : rows).filter(row => !category || row.category.trim().toLowerCase() === category);
  const categories = [...new Set([...rows, ...clean].map(row => row.category.trim().toLowerCase()).filter(Boolean))].sort();
  const missing = (cleaned ? clean : rows).reduce((count, row) => count + Number(!row.category.trim()) + Number(row.units === null) + Number(row.price === null), 0);
  const columns = cleaned ? headers : headers.slice(0, -1);
  return <section className="experiment analysis-panel">
    <h2>Retail DataFrame explorer</h2>
    <p>{rows.length} raw rows → {clean.length} cleaned rows. Removed {duplicates} exact duplicate and excluded {excluded} additional rows with missing prices or quantities, or nonpositive units.</p>
    <div className="lab-actions">
      <button className="button" aria-pressed={!cleaned} onClick={() => {setCleaned(false); setGrouped(false);}}>Raw rows</button>
      <button className="button" aria-pressed={cleaned} onClick={() => setCleaned(true)}>Cleaned rows</button>
      <button className="button" aria-pressed={grouped} disabled={!cleaned} onClick={() => setGrouped(!grouped)}>Group by category</button>
      <label>Category <select value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
    </div>
    <p aria-live="polite">{visible.length} visible rows · {missing} missing values in this version</p>
    <details className="lab-hint"><summary>Column types</summary>
      <p>Order ID and category are text. Date is ISO text until parsed as a date. Units and unit price are numeric. Pandas infers floats for the raw numeric columns because they contain missing entries.</p>
    </details>
    {grouped ? <DataTable title="Revenue grouped by category" columns={['Category', 'Revenue (₹)']}
      rows={groupRevenue(clean.filter(row => !category || row.category.toLowerCase() === category), 'category')}/> :
      <DataTable title={cleaned ? 'Cleaned retail sales' : 'Raw retail sales'} columns={columns}
        rows={visible.map(row => [row.id, row.date, row.category, row.units, row.price, ...(cleaned ? [row.revenue] : [])])}/>}
    <a className="text-link" download href={appUrl(retailPath)}>Download retail-sales.csv <ArrowRight size={14}/></a>
  </section>;
}

function ArrayDemo({index}: {index: number}) {
  const [control, setControl] = useState(2);
  const base = [[3, 5, 7], [2, 4, 6]];
  const values = base.flat();
  const reshape = [values.slice(0, 2), values.slice(2, 4), values.slice(4)];
  const tools = [
    {label: 'Dimensions', rows: control === 1 ? [values] : base, output: control === 1 ? 'Shape (6,)' : 'Shape (2, 3)'},
    {label: 'Slice start column', rows: base.map(row => row.slice(control - 1)), output: 'Start index ' + (control - 1)},
    {label: 'Multiplier', rows: base.map(row => row.map(value => value * control)), output: 'Shape stays (2, 3)'},
    {label: 'Column adjustment multiplier', rows: base.map(row => row.map((value, column) => value + control * (column + 1))), output: 'Add vector [' + [control, 2 * control, 3 * control].join(', ') + '] to each row'},
    {label: 'Reduction axis', rows: [control === 1 ? reshape[0].map((_, column) => reshape.reduce((sum, row) => sum + row[column], 0)) : reshape.map(row => row[0] + row[1])], output: 'Reshape to (3, 2), then reduce axis ' + (control - 1)},
    {label: 'Reduction axis', rows: [control === 1 ? base[0].map((_, column) => (base[0][column] + base[1][column]) / 2) : base.map(row => row.reduce((sum, value) => sum + value, 0) / row.length)], output: 'Mean along axis ' + (control - 1)},
  ];
  const current = tools[index];
  return <section className="experiment analysis-panel">
    <h2>Array explorer</h2>
    <DataTable title="Input array" columns={['Row index', 0, 1, 2]} rows={base.map((row, rowIndex) => [rowIndex, ...row])}/>
    <RangeControl label={current.label} min={1} max={index === 1 ? 3 : index === 2 || index === 3 ? 5 : 2} value={control}
      display={index >= 4 || index === 1 ? String(control - 1) : String(control)} onChange={setControl}/>
    <p aria-live="polite">{current.output}</p>
    <DataTable title="Array operation preview" columns={['Row index', ...current.rows[0].map((_, position) => position)]}
      rows={current.rows.map((row, rowIndex) => [rowIndex, ...row])}/>
    <p className="muted">Use the Python editor to execute and verify the same operation with NumPy.</p>
  </section>;
}

export function AnalysisStudio({lesson, onOpen, onQuiz, onCode, progress}: {
  lesson: AnalysisLesson; onOpen: (id: AnalysisLessonId) => void; onQuiz: () => void; onCode: () => void;
  progress?: {quiz: boolean; code: boolean};
}) {
  const numpy = lesson.course === 'NumPy';
  const {data, error} = useRetail();
  const siblings = analysisLessons.filter(item => item.course === lesson.course);
  const [prompt, correct, distractor, explanation] = knowledge[lesson.course][lesson.index];
  const answer = lesson.index % 2;
  return <div className="analysis-studio">
    <div className="lesson-heading v5-heading"><div><h1>{lesson.course} Learning Studio</h1><p>{lesson.title}</p></div></div>
    <nav className="lab-picker analysis-lessons" aria-label={lesson.course + ' lessons'}>
      {siblings.map(item => <button key={item.id} aria-current={item.id === lesson.id ? 'page' : undefined}
        aria-pressed={item.id === lesson.id} onClick={() => onOpen(item.id)}>{item.title}</button>)}
    </nav>
    {!numpy && <p><a className="text-link" href={appUrl('/learn/pandas')}>Open the original Pandas Data Cleaning lesson</a></p>}
    <div className="analysis-grid">
      <div className="analysis-column">
        <article className="experiment analysis-panel">
          <h2>{lesson.title}</h2><p>{lesson.concept}</p><h3>What you’ll practice</h3><p>{lesson.challenge}</p>
          <details className="lab-hint"><summary>Common mistake</summary><p>{lesson.mistake}</p></details>
          <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{lesson.memory}</p></details>
        </article>
        {numpy ? <ArrayDemo index={lesson.index}/> : data ? <RetailExplorer rows={data.rows}/> :
          <p role={error ? 'alert' : 'status'}>{error || 'Loading the retail dataset…'}</p>}
      </div>
      <div className="analysis-column">
        {(numpy || data) && <CodeEditor draftId={lesson.id}
          lesson={{...lesson, hint: lesson.mistake, retailCsv: numpy ? undefined : data?.csv}} onPass={onCode}/>}
        <PracticeQuestion prompt={prompt} options={answer ? [distractor, correct] : [correct, distractor]}
          answer={answer} explanation={explanation} onPass={onQuiz}/>
        <p className="callout">{progress?.code && progress.quiz ? 'Lesson complete.' : 'Pass the knowledge check and the Python challenge to complete this lesson.'}</p>
      </div>
    </div>
  </div>;
}
