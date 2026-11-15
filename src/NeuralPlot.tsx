export const display = (number: number | null) => number === null || !Number.isFinite(number) ? 'Unavailable' : Number(number.toFixed(4)).toString();

export function Curve({values, label, xLabel, min, max, cursor}: {values: number[]; label: string; xLabel: string; min?: number; max?: number; cursor?: number}) {
  const bottom = min ?? Math.min(0, ...values);
  const top = max ?? Math.max(1e-8, ...values);
  const x = (i: number) => 54 + i * 310 / Math.max(1,values.length-1);
  const y = (value: number) => 154 - (value-bottom)*130/Math.max(1e-8,top-bottom);
  const points = values.map((value,i) => x(i) + ',' + y(value)).join(' ');
  return <svg className="neural-plot" viewBox="0 0 390 194" role="img" aria-label={label}>
    <path d="M54 24V154H364" fill="none" stroke="currentColor"/>
    <text x="49" y="29" textAnchor="end">{display(top)}</text><text x="49" y="157" textAnchor="end">{display(bottom)}</text>
    <text x="209" y="181" textAnchor="middle">{xLabel}</text>
    <polyline points={points} className="lab-curve"/>
    {cursor !== undefined && <circle cx={x(cursor)} cy={y(values[cursor])} r="4" fill="var(--accent)"/>}
  </svg>;
}
