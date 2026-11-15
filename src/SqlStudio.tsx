import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Play, RotateCcw} from 'lucide-react';
import {sqlLessons, type SqlLesson} from './sqlLessons';
import {LessonObjective, PracticeQuestion} from './StudioControls';
import workerSource from './lib/sqlWorker.js?raw';
import './sql-studio.css';

type Grid = {columns: string[]; rows: (string | number | null | Uint8Array)[][]; truncated: boolean};
type Reply = {id: number; result?: Grid; expected?: Grid; passed?: boolean; error?: string};
type Action = 'initialize' | 'run' | 'check' | 'expected' | 'reset';
const knowledge = [
  {prompt:'How do you make the first three results reproducible?',options:['Use LIMIT alone','Use ORDER BY before LIMIT'],answer:1,explanation:'ORDER BY defines which rows come first. LIMIT then takes three of those rows.'},
  {prompt:'Which clause keeps rows that satisfy a condition?',options:['WHERE','ORDER BY'],answer:0,explanation:'WHERE filters rows. ORDER BY sorts the surviving rows.'},
  {prompt:'Which clause filters a count after GROUP BY?',options:['WHERE','HAVING'],answer:1,explanation:'HAVING can test the aggregated count. WHERE filters before groups are formed.'},
  {prompt:'Which join can keep customers without orders?',options:['LEFT JOIN from Customers','INNER JOIN'],answer:0,explanation:'A left join keeps customers with no match and returns NULL for the order columns.'},
  {prompt:'How do you test for an unknown email address?',options:['email = NULL','email IS NULL'],answer:1,explanation:'SQL comparisons with NULL do not return true. IS NULL checks directly for a missing value.'},
];
const tables = ['Customers', 'Orders', 'OrderItems', 'Products'] as const;

function ResultGrid({result, title}: {result: Grid; title: string}) {
  if (!result.columns.length) return <p>Statement executed successfully.</p>;
  return <>
    <p className="sql-row-count">{result.truncated ? 'First 250 rows' : `${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'}`}</p>
    <div className="sql-table-scroll" tabIndex={0} role="region" aria-label={title}>
      <table aria-label={title}><thead><tr>{result.columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
        <tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>
          {value === null ? <code className="sql-null">NULL</code> : value instanceof Uint8Array ? `BLOB (${value.length} bytes)` : value}
        </td>)}</tr>)}</tbody>
      </table>
    </div>
    {!result.rows.length && <p>No matching rows.</p>}
  </>;
}

export function SqlStudio({lesson, completed, onSelect, onStart, onPass}: {
  lesson: SqlLesson;
  completed: (id: SqlLesson['id']) => boolean;
  onSelect: (id: SqlLesson['id']) => void;
  onStart: () => void;
  onPass: () => void;
}) {
  const draftKey = 'ds-lab:sql-draft:' + lesson.id;
  const [query, setQuery] = useState<string>(() => {
    try { return localStorage.getItem(draftKey) ?? lesson.starter; }
    catch { return lesson.starter; }
  });
  const [storageError, setStorageError] = useState(false);
  const [resetUndo, setResetUndo] = useState<string>();
  const [busy, setBusy] = useState<Action | null>('initialize');
  const [result, setResult] = useState<Grid>();
  const [expected, setExpected] = useState<Grid>();
  const [preview, setPreview] = useState<Grid>();
  const [table, setTable] = useState<(typeof tables)[number]>('Customers');
  const [schema, setSchema] = useState(false);
  const [message, setMessage] = useState('Loading SQLite…');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const requestId = useRef(0);
  const active = useRef(false);
  const index = sqlLessons.findIndex(item => item.id === lesson.id);
  const next = sqlLessons[index + 1];

  function updateQuery(value: string) {
    setQuery(value);
    try { localStorage.setItem(draftKey, value); setStorageError(false); } catch { setStorageError(true); }
  }

  function request(action: Action, sql = '', inspect = false, example = false) {
    if (active.current) return;
    active.current = true;
    setBusy(action);
    setError('');
    const id = ++requestId.current;
    function finish() {
      window.clearTimeout(timer.current);
      active.current = false;
      setBusy(null);
    }
    function fail(reason: string) {
      worker.current?.terminate();
      worker.current = null;
      setPreview(undefined);
      setMessage('');
      setError(reason);
      finish();
    }
    try {
      if (!worker.current) {
        const url = URL.createObjectURL(new Blob([workerSource], {type: 'text/javascript'}));
        try { worker.current = new Worker(url); }
        finally { URL.revokeObjectURL(url); }
      }
      worker.current.onerror = () => fail('SQLite could not start. Run the query to try again.');
      worker.current.onmessage = ({data}: MessageEvent<Reply>) => {
        if (data.id !== id) return;
        finish();
        if (data.error) {
          setError(data.error);
          setMessage('');
          if (inspect) setPreview(undefined);
          else if (action === 'check' || action === 'run') setResult(undefined);
          return;
        }
        if (inspect) { setPreview(data.result); return; }
        if (action === 'expected') { setExpected(data.expected); return; }
        if (action === 'initialize' || action === 'reset') {
          setResult(undefined);
          setPreview(undefined);
          setMessage(action === 'reset' ? 'Sample database restored.' : 'SQLite is ready.');
          request('run', `SELECT * FROM ${table} LIMIT 25;`, true);
          return;
        }
        setResult(data.result);
        if (action === 'check') {
          setMessage(data.passed ? 'Challenge passed. Lesson complete.' : 'The rows differ from the expected result. Compare the columns, values, and any requested sort order.');
          if (data.passed) onPass();
          else onStart();
        } else {
          if (!example) onStart();
          setMessage(data.result?.columns.length ? (example ? 'Worked example finished. Your draft is unchanged.' : 'Query finished.') : 'Statement executed successfully.');
        }
      };
      timer.current = window.setTimeout(() => fail('SQLite timed out. The sample database will restart on the next run.'), action === 'initialize' ? 30_000 : 12_000);
      worker.current.postMessage({id, action, query: sql, answer: lesson.answer, ordered: lesson.ordered});
    } catch {
      fail('SQLite could not start. Run the query to try again.');
    }
  }

  useEffect(() => {
    request('initialize');
    return () => {
      worker.current?.terminate();
      worker.current = null;
      active.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  function stopQuery() {
    worker.current?.terminate();
    worker.current = null;
    ++requestId.current;
    active.current = false;
    window.clearTimeout(timer.current);
    setBusy(null);
    setPreview(undefined);
    setError('');
    setMessage('Stopped. The sample database will restart on the next run.');
  }

  function viewTable(name: typeof table, showSchema: boolean) {
    setTable(name);
    setSchema(showSchema);
    setPreview(undefined);
    request('run', showSchema ? `PRAGMA table_info(${name});` : `SELECT * FROM ${name} LIMIT 25;`, true);
  }

  return <div className="sql-studio">
    <div className="lesson-heading v5-heading"><div><h1>SQL Learning Studio</h1><p>Explore a synthetic retail database and run real SQLite queries.</p></div></div>
    <nav className="lab-picker sql-lessons" aria-label="SQL lessons">
      {sqlLessons.map(item => <button key={item.id} aria-current={lesson.id === item.id ? 'page' : undefined}
        aria-pressed={lesson.id === item.id} onClick={() => onSelect(item.id)}>{item.title}{completed(item.id) && <Check size={15} aria-label="Completed"/>}</button>)}
    </nav>
    <div className="sql-workspace">
      <article className="experiment sql-panel sql-guide" aria-labelledby="sql-lesson-title">
        <span className="eyebrow">Lesson {index + 1} of {sqlLessons.length}</span>
        <h2 id="sql-lesson-title">{lesson.title}</h2>
        <p>{lesson.concept}</p><p>{lesson.analogy}</p>
        {lesson.id === 'sql-joins' && <figure className="sql-relationship">
          <figcaption>Retail table relationships</figcaption>
          <div><span>Customers</span><ArrowRight size={16}/><span>Orders</span><ArrowRight size={16}/><span>OrderItems</span></div>
          <div><span>Products</span><ArrowRight size={16}/><span>OrderItems</span></div>
          <p>Each arrow goes from one record to its many related records.</p>
        </figure>}
        <h3>Worked example</h3><pre><code>{lesson.example}</code></pre>
        <button className="button" disabled={!!busy} onClick={() => request('run', lesson.example, false, true)}>Run example</button>
        <LessonObjective>{lesson.challenge}</LessonObjective>
        <details className="lab-hint"><summary>Hint</summary><p>{lesson.hint}</p></details>
        <details className="lab-hint"><summary>Common mistake</summary><p>{lesson.mistake}</p></details>
        <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{lesson.memory}</p></details>
      </article>
      <div className="sql-workbench">
        <section className="experiment sql-panel" aria-labelledby="editor-title">
          <h2 id="editor-title">Query editor</h2>
          <label className="sr-only" htmlFor="sql-query">SQL query</label>
          <textarea id="sql-query" value={query} onChange={event => {setResetUndo(undefined);updateQuery(event.target.value);}} spellCheck={false} autoCapitalize="off" maxLength={20000}
            onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (query.trim()) request('run', query); } }}/>
          <div className="lab-actions">
            <button className="button primary" disabled={!!busy || !query.trim()} onClick={() => request('run', query)}><Play size={15}/> Run query</button>
            <button className="button" disabled={!!busy || !query.trim()} onClick={() => request('check', query)}>Check answer</button>
            <button className="button" disabled={!!busy} onClick={() => {if(query !== lesson.starter) setResetUndo(query); updateQuery(lesson.starter);}}><RotateCcw size={15}/> Reset query</button>
            {resetUndo !== undefined && <button className="button" onClick={() => {updateQuery(resetUndo);setResetUndo(undefined);}}>Undo reset</button>}
            {busy && <button className="button" onClick={stopQuery}>Stop query</button>}
          </div>
          <p className="muted sql-keyboard">Ctrl or Cmd + Enter to run. Only the final statement’s results are shown.</p>
          <div role="status" className="sql-status">{busy ? busy === 'initialize' ? 'Loading SQLite…' : 'Working…' : message}</div>
          {storageError && <p className="callout">This browser could not save your query. Copy it before leaving.</p>}
          {error && <p role="alert" className="sql-error">{error}</p>}
        </section>
        <section className="experiment sql-panel" aria-labelledby="results-title">
          <h2 id="results-title">Query results</h2>
          {result ? <ResultGrid title="Query result rows" result={result}/> : <p>Run a query to see its results.</p>}
          <button className="text-link" disabled={!!busy} onClick={() => expected ? setExpected(undefined) : request('expected')}>{expected ? 'Hide expected result' : 'Show expected result'}</button>
          {expected && <ResultGrid title="Expected result rows" result={expected}/>}
          {completed(lesson.id) && next && <button className="button" onClick={() => onSelect(next.id)}>Next lesson <ArrowRight size={15}/></button>}
        </section>
      </div>
    </div>
    <section className="experiment sql-panel sql-explorer" aria-labelledby="explorer-title">
      <div className="section-heading"><div><h2 id="explorer-title">Sample database explorer</h2><p>All records are synthetic. Prices are in rupees.</p></div>
        <button className="button" disabled={!!busy} onClick={() => { setSchema(false); request('reset'); }}><RotateCcw size={15}/> Reset database</button>
      </div>
      <div className="lab-actions" role="group" aria-label="Sample tables">
        {tables.map(name => <button key={name} className="button" disabled={!!busy} aria-pressed={table === name} onClick={() => viewTable(name, false)}>{name}</button>)}
        <button className="text-link" disabled={!!busy} onClick={() => viewTable(table, !schema)}>{schema ? 'Show rows' : 'Show schema'}</button>
      </div>
      {preview && <ResultGrid title={table + (schema ? ' schema' : ' sample rows')} result={preview}/>}
    </section>
    <PracticeQuestion key={lesson.id} {...knowledge[index]}/>
  </div>;
}
