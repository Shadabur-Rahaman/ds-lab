import {useEffect, useState} from 'react';
import {appUrl} from './urls';

export const retailPath = '/datasets/retail-sales.csv';
export const headers = ['Order ID', 'Date', 'Category', 'Units', 'Unit price', 'Revenue'] as const;
export const metrics = ['units', 'price', 'revenue'] as const;
export type Metric = typeof metrics[number];
export const metricNames = {units: 'Units', price: 'Unit price (₹)', revenue: 'Revenue (₹)'};
export type RetailRow = {id: string; date: string; category: string; units: number | null; price: number | null; revenue: number | null};
export type CleanRow = RetailRow & Record<Metric, number>;

export function parseRetail(csv: string): RetailRow[] {
  const [header, ...lines] = csv.trimEnd().split(/\r?\n/);
  if (header !== 'order_id,date,category,units,unit_price') throw new Error('Unexpected retail CSV columns.');
  const numeric = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
  return lines.filter(Boolean).map(line => {
    const [id, date, category, units, price, ...extra] = line.split(',');
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || price === undefined || extra.length) {
      throw new Error('A retail CSV row is malformed.');
    }
    return {id, date, category, units: numeric(units), price: numeric(price), revenue: null};
  });
}

export function cleanRetail(rows: RetailRow[]) {
  const unique = rows.filter((row, index) => rows.findIndex(candidate =>
    candidate.id === row.id && candidate.date === row.date && candidate.category === row.category &&
    candidate.units === row.units && candidate.price === row.price) === index);
  const clean: CleanRow[] = unique.flatMap(row => row.units !== null && row.units > 0 && row.price !== null
    ? [{...row, category: row.category.trim().toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) || 'Unknown',
      units: row.units, price: row.price, revenue: row.units * row.price}] : []);
  return {clean, duplicates: rows.length - unique.length, excluded: unique.length - clean.length};
}

export function groupRevenue(rows: CleanRow[], key: 'category' | 'month') {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = key === 'category' ? row.category : row.date.slice(0, 7);
    totals.set(label, (totals.get(label) ?? 0) + row.revenue);
  }
  return [...totals].sort(([left], [right]) => left.localeCompare(right));
}

export function quantile(sorted: number[], p: number) {
  const position = (sorted.length - 1) * p;
  const left = Math.floor(position);
  return sorted[left] + (sorted[Math.ceil(position)] - sorted[left]) * (position - left);
}

export function pearson(left: number[], right: number[]) {
  if (left.length < 2 || left.length !== right.length) return null;
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const x = average(left);
  const y = average(right);
  const dx = left.map(value => value - x);
  const dy = right.map(value => value - y);
  const spread = Math.hypot(...dx) * Math.hypot(...dy);
  return spread ? Math.max(-1, Math.min(1, dx.reduce((sum, value, index) => sum + value * dy[index], 0) / spread)) : null;
}

export function useRetail(enabled = true) {
  const [data, setData] = useState<{csv: string; rows: RetailRow[]}>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(appUrl(retailPath), {signal: controller.signal}).then(response => {
      if (!response.ok) throw new Error('The retail dataset could not load.');
      return response.text();
    }).then(csv => {
      const rows = parseRetail(csv);
      if (!rows.length) throw new Error('The retail dataset has no rows.');
      if (!controller.signal.aborted) setData({csv, rows});
    }).catch((problem: Error) => {
      if (!controller.signal.aborted) setError(problem.message);
    });
    return () => controller.abort();
  }, [enabled]);
  return {data, error};
}
