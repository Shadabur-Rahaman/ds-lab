export type Point = {x: number; y: number};
export type Sample = {features: number[]; label: string};
export type BinaryCounts = {tp: number; fp: number; tn: number; fn: number};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;

export function fitLine(points: Point[]) {
  if (points.length < 2) return null;
  const x = mean(points.map(point => point.x));
  const y = mean(points.map(point => point.y));
  const spread = points.reduce((sum, point) => sum + (point.x - x) ** 2, 0);
  if (spread === 0) return null;
  const slope = points.reduce((sum, point) => sum + (point.x - x) * (point.y - y), 0) / spread;
  const intercept = y - slope * x;
  return {slope, intercept, predict: (input: number) => slope * input + intercept};
}

export function regressionMetrics(points: Point[], predict: (x: number) => number) {
  if (!points.length) return {mae: null, mse: null, r2: null};
  const center = mean(points.map(point => point.y));
  const errors = points.map(point => point.y - predict(point.x));
  const squared = errors.reduce((sum, error) => sum + error ** 2, 0);
  const total = points.reduce((sum, point) => sum + (point.y - center) ** 2, 0);
  return {mae: mean(errors.map(Math.abs)), mse: squared / points.length, r2: total ? 1 - squared / total : null};
}

export function nearest(samples: Sample[], features: number[], k: number, scales = features.map(() => 1)) {
  return samples.map((sample, index) => ({
    ...sample, index, distance: Math.hypot(...features.map((value, axis) => (value - sample.features[axis]) * scales[axis])),
  })).sort((a, b) => a.distance - b.distance || a.index - b.index).slice(0, k);
}

export function classify(samples: Sample[], features: number[], k: number, scales?: number[]) {
  const neighbors = nearest(samples, features, k, scales);
  const votes = new Map<string, number>();
  for (const neighbor of neighbors) votes.set(neighbor.label, (votes.get(neighbor.label) ?? 0) + 1);
  const label = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {label, neighbors};
}

export function randomSequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function splitRows<T>(rows: readonly T[], proportion: number, seed: number) {
  const shuffled = [...rows];
  const random = randomSequence(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const count = rows.length < 2 ? 0 : Math.max(1, Math.min(rows.length - 1, Math.round(rows.length * proportion)));
  return {train: shuffled.slice(count), test: shuffled.slice(0, count)};
}

export function binaryMetrics({tp, fp, tn, fn}: BinaryCounts) {
  return {accuracy: ratio(tp + tn, tp + fp + tn + fn), precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn), specificity: ratio(tn, tn + fp), f1: ratio(2 * tp, 2 * tp + fp + fn)};
}

export function confusion(actual: string[], predictions: (string | null)[], labels: readonly string[]) {
  return labels.map(truth => labels.map(prediction =>
    actual.filter((label, index) => label === truth && predictions[index] === prediction).length));
}

export function fitPolynomial(points: Point[], degree: number) {
  if (degree < 0 || points.length <= degree) return null;
  const center = mean(points.map(point => point.x));
  const scale = Math.max(1e-10, ...points.map(point => Math.abs(point.x - center)));
  const normalized = points.map(point => (point.x - center) / scale);
  // Modified Gram-Schmidt QR on the scaled polynomial basis.
  const q: number[][] = [];
  const r = Array.from({length: degree + 1}, () => Array<number>(degree + 1).fill(0));
  for (let column = 0; column <= degree; column++) {
    let vector = normalized.map(value => value ** column);
    for (let previous = 0; previous < column; previous++) {
      r[previous][column] = vector.reduce((sum, value, row) => sum + value * q[previous][row], 0);
      vector = vector.map((value, row) => value - r[previous][column] * q[previous][row]);
    }
    const length = Math.hypot(...vector);
    if (length < 1e-10) return null;
    r[column][column] = length;
    q.push(vector.map(value => value / length));
  }
  const coefficients = q.map(column => column.reduce((sum, value, row) => sum + value * points[row].y, 0));
  for (let row = degree; row >= 0; row--) {
    for (let column = row + 1; column <= degree; column++) coefficients[row] -= r[row][column] * coefficients[column];
    coefficients[row] /= r[row][row];
  }
  return (x: number) => coefficients.reduceRight((sum, coefficient) => sum * ((x - center) / scale) + coefficient, 0);
}

export const irisLabels = ['setosa', 'versicolor', 'virginica'] as const;
export const irisFeatures = ['Sepal length', 'Sepal width', 'Petal length', 'Petal width'];
export function parseIris(csv: string): Sample[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (header !== 'sepal_length,sepal_width,petal_length,petal_width,species') throw new Error('Unexpected Iris CSV header.');
  const samples = rows.map(row => {
    const fields = row.split(',');
    const features = fields.slice(0, 4).map(Number);
    const label = fields[4];
    if (fields.length !== 5 || features.some(value => !Number.isFinite(value) || value <= 0) ||
        !irisLabels.some(species => species === label)) throw new Error('Invalid Iris observation.');
    return {features, label};
  });
  if (irisLabels.some(label => samples.filter(row => row.label === label).length !== 50)) {
    throw new Error('Expected 50 observations of each Iris species.');
  }
  return samples;
}

export function fitIris(samples: Sample[], columns: number[], seed: number, proportion: number, k: number, binary = false) {
  const splits = irisLabels.map((label, index) => splitRows(samples.filter(row => row.label === label), proportion, seed + index));
  const labels = binary ? ['setosa', 'other species'] : irisLabels;
  const project = (row: Sample): Sample => ({
    label: binary && row.label !== 'setosa' ? 'other species' : row.label,
    features: columns.map(column => row.features[column]),
  });
  const train = splits.flatMap(split => split.train.map(project));
  const test = splits.flatMap(split => split.test.map(project));
  const scales = columns.map((_, index) => {
    const center = mean(train.map(row => row.features[index]));
    const sd = Math.sqrt(mean(train.map(row => (row.features[index] - center) ** 2)));
    return sd ? 1 / sd : 1;
  });
  const predict = (features: number[]) => classify(train, features, k, scales).label;
  const evaluation = (rows: Sample[]) => rows.map(row => predict(row.features));
  const training = evaluation(train);
  const predictions = evaluation(test);
  const accuracy = (rows: Sample[], results: (string | null)[]) =>
    mean(rows.map((row, index) => Number(row.label === results[index])));
  return {train, test, predict, predictions, labels, trainAccuracy: accuracy(train, training), testAccuracy: accuracy(test, predictions),
    matrix: confusion(test.map(row => row.label), predictions, labels)};
}

export function curveData(noise: number) {
  const random = randomSequence(43);
  const all = Array.from({length: 25}, (_, index) => {
    const x = -1 + index / 12;
    return {x, y: 1 + 2*x*x - .6*x + (random()-.5)*noise};
  });
  return {train: all.filter((_, index) => index % 2 === 0), test: all.filter((_, index) => index % 2 === 1)};
}
