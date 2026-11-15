import {useId, useState, type ReactNode} from 'react';

export function LessonObjective({children}: {children: ReactNode}) {
  return <aside className="lesson-objective" aria-label="Learning objective">
    <strong>Learning objective</strong><p>{children}</p>
  </aside>;
}

export function RangeControl({label, value, min, max, step = 1, onChange, display = String(value)}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (value: number) => void; display?: string;
}) {
  const id = useId();
  return <div className="lab-slider">
    <label htmlFor={id}>{label}<strong>{display}</strong></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      aria-valuetext={display} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}

export function Metrics({values}: {values: [string, string][]}) {
  return <dl className="lab-metrics">{values.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function Plot({description, caption, children}: {
  description: string; caption: string; children: ReactNode;
}) {
  return <figure className="lab-plot">
    <svg viewBox="0 0 400 180" role="img" aria-label={description}>
      {[25, 65, 105, 145].map(y => <line className="lab-gridline" key={y} x1="28" x2="372" y1={y} y2={y}/>)}
      {children}
    </svg>
    <figcaption>{caption}</figcaption>
  </figure>;
}

export function BarChart({counts, labels, description, caption, scale = Math.max(1, ...counts)}: {
  counts: number[]; labels: string[]; description: string; caption: string; scale?: number;
}) {
  const width = 344 / counts.length;
  return <Plot description={description} caption={caption}>
    {counts.map((count, index) => {
      const height = count / scale * 120;
      const center = 28 + width * (index + .5);
      return <g key={index}>
        <rect className="lab-bar" x={center - width * .34} y={145 - height} width={width * .68} height={height} rx="3"/>
        <text x={center} y="167" textAnchor="middle">{labels[index]}</text>
      </g>;
    })}
  </Plot>;
}

export function PracticeQuestion({prompt, options, answer, explanation, onPass}: {
  prompt: string; options: readonly string[]; answer: number; explanation: string; onPass?: () => void;
}) {
  const name = useId();
  const [choice, setChoice] = useState<number>();
  const [checked, setChecked] = useState(false);
  return <fieldset className="quiz lab-quiz">
    <legend>Knowledge check</legend>
    <h3>{prompt}</h3>
    {options.map((option, index) => <label key={option} className="quiz-option">
      <input name={name} type="radio" checked={choice === index}
        onChange={() => {setChoice(index); setChecked(false);}}/>
      <span>{option}</span>
    </label>)}
    <button className="button" disabled={choice === undefined} onClick={() => {
      setChecked(true);
      if (choice === answer) onPass?.();
    }}>Check understanding</button>
    {checked && <p className="callout" role="status">{choice === answer ? 'Correct. ' : 'Try again. '}{explanation}</p>}
  </fieldset>;
}
