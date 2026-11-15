import {randomSequence, splitRows, binaryMetrics} from './ml';

export const activations = ['Linear', 'Sigmoid', 'Tanh', 'ReLU'] as const;
export type Activation = typeof activations[number];
export type Row = {id: number; x: [number, number]; y: 0 | 1};

export function sigmoid(z: number) {
  const e = Math.exp(-Math.abs(z));
  return z >= 0 ? 1 / (1 + e) : e / (1 + e);
}
export function activate(kind: Activation, z: number) {
  if (kind === 'Sigmoid') return sigmoid(z);
  if (kind === 'Tanh') return Math.tanh(z);
  if (kind === 'ReLU') return Math.max(0, z);
  return z;
}
export function derivative(kind: Activation, z: number) {
  if (kind === 'Sigmoid') return sigmoid(z) * sigmoid(-z);
  if (kind === 'Tanh') return 1 - Math.tanh(z) ** 2;
  if (kind === 'ReLU') return Number(z > 0);
  return 1;
}
export const weighted = (x: number[], weights: number[], bias: number) =>
  x.length === weights.length ? x.reduce((sum, value, i) => sum + value * weights[i], bias) : NaN;
export const bce = (logit: number, target: number) => target === 0 || target === 1
  ? Math.max(target === 1 ? -logit : logit, 0) + Math.log1p(Math.exp(-Math.abs(logit))) : NaN;
export const squared = (prediction: number, target: number) => (prediction - target) ** 2;

// Four entries per hidden unit: input weights, hidden bias, output weight.
// The final entry is the output bias.
export function initialize(units: number, seed: number) {
  const random = randomSequence(seed);
  return [...Array.from({length: units * 4}, () => (random() - .5) * 2), 0];
}
export function forward(params: number[], x: [number, number]) {
  const hidden: number[] = [];
  let logit = params.at(-1)!;
  for (let i = 0; i < params.length - 1; i += 4) {
    const h = Math.tanh(x[0] * params[i] + x[1] * params[i + 1] + params[i + 2]);
    hidden.push(h);
    logit += h * params[i + 3];
  }
  return {hidden, logit, probability: sigmoid(logit)};
}
export function gradient(params: number[], row: Row) {
  const {hidden, logit} = forward(params, row.x);
  const delta = row.y ? -sigmoid(-logit) : sigmoid(logit);
  return [...hidden.flatMap((h, i) => {
    const d = delta * params[4 * i + 3] * (1 - h * h);
    return [d * row.x[0], d * row.x[1], d, delta * h];
  }), delta];
}
export function numericalGradient(params: number[], row: Row, index: number, step = 1e-5) {
  const plus = [...params], minus = [...params];
  plus[index] += step;
  minus[index] -= step;
  return (bce(forward(plus, row.x).logit, row.y) - bce(forward(minus, row.x).logit, row.y)) / (2 * step);
}
export function trainStep(params: number[], rows: Row[], rate: number) {
  if (!rows.length || params.length < 5 || params.length % 4 !== 1 || !Number.isFinite(rate) || rate <= 0 ||
      params.some(value => !Number.isFinite(value))) throw new Error('Training needs finite parameters, a positive rate, and training rows.');
  const totals = params.map(() => 0);
  for (const row of rows) gradient(params, row).forEach((value, index) => {totals[index] += value;});
  const next = params.map((value, index) => value - rate * totals[index] / rows.length);
  if (next.some(value => !Number.isFinite(value) || Math.abs(value) > 1e6)) throw new Error('Updates became unstable. Try a smaller learning rate.');
  return next;
}
export function meanLoss(params: number[], rows: Row[]) {
  return rows.length ? rows.reduce((sum, row) => sum + bce(forward(params, row.x).logit, row.y), 0) / rows.length : null;
}
export function predict(params: number[], x: [number, number]) {
  const probability = forward(params, x).probability;
  if (!Number.isFinite(probability) || x.some(value => !Number.isFinite(value))) throw new Error('Prediction needs finite features and a valid network.');
  return probability >= .5 ? 1 : 0;
}
export function evaluateNetwork(params: number[], rows: Row[]) {
  const counts = {tp: 0, tn: 0, fp: 0, fn: 0};
  const mistakes = rows.filter(row => {
    const guess = predict(params, row.x);
    counts[row.y ? (guess ? 'tp' : 'fn') : (guess ? 'fp' : 'tn')]++;
    return guess !== row.y;
  });
  return {counts, mistakes, ...binaryMetrics(counts)};
}
export function neuralDataset(seed: number, testShare: number, noise: number) {
  const random = randomSequence(seed);
  const rows: Row[] = Array.from({length: 100}, (_, id) => {
    const x: Row['x'] = [random() * 2 - 1, random() * 2 - 1];
    const base = Number(x[0] * x[1] > 0);
    const y = (random() < noise ? 1 - base : base) as Row['y'];
    return {id, x, y};
  });
  const groups = ([0, 1] as const).map(y => splitRows(rows.filter(row => row.y === y), testShare, seed + 17 + y));
  return {rows, train: groups.flatMap(group => group.train), test: groups.flatMap(group => group.test)};
}

export function descent(initial: number, rate: number, kind: 'MSE' | 'BCE', steps = 16) {
  if (!Number.isFinite(initial) || !Number.isFinite(rate) || rate <= 0) throw new Error('Use a finite weight and positive learning rate.');
  const history = [];
  let weight = initial;
  for (let step = 0; step <= steps; step++) {
    const loss = kind === 'MSE' ? squared(weight, 2) : bce(weight, 1);
    if (!Number.isFinite(loss) || Math.abs(weight) > 1e6) return {history, unstable: true};
    const gradient = kind === 'MSE' ? 2 * (weight - 2) : -sigmoid(-weight);
    history.push({weight, loss, gradient});
    weight -= rate * gradient;
  }
  return {history, unstable: false};
}
