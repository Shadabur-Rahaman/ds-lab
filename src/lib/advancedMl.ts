import {randomSequence} from './ml';

export type Row = {x: number[]; y: number};
export type Criterion = 'gini' | 'entropy' | 'variance';
export const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function frequencies(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts];
}

export function vote(values: number[]) {
  return frequencies(values).sort(([a, countA], [b, countB]) => countB - countA || a - b)[0]?.[0];
}

export function impurity(rows: Row[], criterion: Criterion) {
  if (!rows.length) return 0;
  const values = rows.map(row => row.y);
  if (criterion === 'variance') {
    const center = average(values);
    return average(values.map(value => (value - center) ** 2));
  }
  const probabilities = frequencies(values).map(([, count]) => count / rows.length);
  return criterion === 'gini'
    ? 1 - probabilities.reduce((sum, p) => sum + p ** 2, 0)
    : -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);
}

export function partition<T extends Row>(rows: T[], feature: number, threshold: number, criterion: Criterion) {
  const left = rows.filter(row => row.x[feature] <= threshold);
  const right = rows.filter(row => row.x[feature] > threshold);
  const weighted = rows.length ? (left.length * impurity(left, criterion) + right.length * impurity(right, criterion)) / rows.length : 0;
  return {left, right, gain: impurity(rows, criterion) - weighted};
}

type Tree = {value: number; branch?: {feature: number; threshold: number; left: Tree; right: Tree}};
export function fitTree(rows: Row[], depth: number, criterion: Criterion, select?: (features: number[]) => number[]): Tree {
  const value = (criterion === 'variance' ? average(rows.map(row => row.y)) : vote(rows.map(row => row.y))) ?? NaN;
  if (depth <= 0 || rows.length < 2 || impurity(rows, criterion) <= 1e-12) return {value};
  const features = rows[0].x.map((_, i) => i);
  let best: (ReturnType<typeof partition> & {feature: number; threshold: number}) | undefined;
  for (const feature of select ? select(features) : features) {
    const values = [...new Set(rows.map(row => row.x[feature]))].sort((a, b) => a - b);
    for (let i = 1; i < values.length; i++) {
      const threshold = (values[i - 1] + values[i]) / 2;
      const candidate = partition(rows, feature, threshold, criterion);
      if (candidate.gain > (best?.gain ?? 0) + 1e-12) best = {...candidate, feature, threshold};
    }
  }
  if (!best) return {value};
  const {feature, threshold, left, right} = best;
  return {value, branch: {feature, threshold, left: fitTree(left, depth - 1, criterion, select), right: fitTree(right, depth - 1, criterion, select)}};
}

export function predictTree(tree: Tree, x: number[]): number {
  const branch = tree.branch;
  if (!branch) return tree.value;
  return predictTree(x[branch.feature] <= branch.threshold ? branch.left : branch.right, x);
}

export function fitForest(rows: Row[], count: number, depth: number, seed: number) {
  const random = randomSequence(seed);
  const select = (features: number[]) => {
    const k = Math.max(1, Math.floor(Math.sqrt(features.length)));
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(random() * (features.length - i));
      [features[i], features[j]] = [features[j], features[i]];
    }
    return features.slice(0, k);
  };
  return Array.from({length: count}, () => {
    const draw = rows.map(() => Math.floor(random() * rows.length));
    return {tree: fitTree(draw.map(i => rows[i]), depth, 'gini', select), inBag: new Set(draw)};
  });
}

export function outOfBag(forest: ReturnType<typeof fitForest>, rows: Row[]) {
  const predictions = rows.map((row, i) => vote(forest.filter(member => !member.inBag.has(i)).map(member => predictTree(member.tree, row.x))));
  const covered = predictions.filter(value => value !== undefined).length;
  return {covered, total: rows.length, accuracy: covered ? predictions.filter((value, i) => value === rows[i].y).length / covered : null};
}

export function boost(train: Row[], validation: Row[], count: number, rate: number) {
  const baseline = average(train.map(row => row.y));
  const trees: Tree[] = [];
  const predict = (x: number[], step = trees.length) => trees.slice(0, step).reduce((estimate, tree) => estimate + rate * predictTree(tree, x), baseline);
  const error = (rows: Row[]) => average(rows.map(row => (row.y - predict(row.x)) ** 2));
  const history = [{train: error(train), validation: error(validation)}];
  for (let i = 0; i < count; i++) {
    const residuals = train.map(row => ({x: row.x, y: row.y - predict(row.x)}));
    trees.push(fitTree(residuals, 1, 'variance'));
    history.push({train: error(train), validation: error(validation)});
  }
  return {predict, history};
}

export type Vector = [number, number];
const squaredDistance = (a: Vector, b: Vector) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function initialize(points: Vector[], k: number, seed: number) {
  const remaining = [...points];
  const random = randomSequence(seed);
  return Array.from({length: Math.min(k, points.length)}, () => remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
}

export function cluster(points: Vector[], initial: Vector[], steps: number) {
  let centers = initial;
  const assign = () => points.map(point => centers.reduce((best, center, i) =>
    squaredDistance(point, center) < squaredDistance(point, centers[best]) ? i : best, 0));
  for (let step = 0; step < steps; step++) {
    const assignments = assign();
    const updated = centers.map((center, i): Vector => {
      const members = points.filter((_, j) => assignments[j] === i);
      return members.length ? [average(members.map(point => point[0])), average(members.map(point => point[1]))] : center;
    });
    if (updated.every((point, i) => squaredDistance(point, centers[i]) < 1e-18)) break;
    centers = updated;
  }
  const assignments = assign();
  const wcss = points.reduce((sum, point, i) => sum + squaredDistance(point, centers[assignments[i]]), 0);
  return {centers, assignments, wcss};
}

export function pca(points: Vector[], standardize: boolean) {
  if (points.length < 2) return null;
  const means = [average(points.map(p => p[0])), average(points.map(p => p[1]))];
  const centered = points.map(([x, y]): Vector => [x - means[0], y - means[1]]);
  const covariance = (rows: Vector[], a: 0 | 1, b: 0 | 1) => rows.reduce((sum, p) => sum + p[a] * p[b], 0) / (rows.length - 1);
  const scales = ([0, 1] as const).map(axis => standardize ? Math.sqrt(covariance(centered, axis, axis)) || 1 : 1);
  const working = centered.map(([x, y]): Vector => [x / scales[0], y / scales[1]]);
  const a = covariance(working, 0, 0), b = covariance(working, 0, 1), d = covariance(working, 1, 1);
  const gap = Math.hypot(a - d, 2 * b);
  const tied = gap <= (a + d) * 1e-12;
  const angle = tied ? 0 : Math.atan2(2 * b, a - d) / 2;
  const pc1: Vector = [Math.cos(angle), Math.sin(angle)];
  const pc2: Vector = [-pc1[1], pc1[0]];
  const explained = a + d > 0 ? Math.min(1, (a + d + gap) / (2 * (a + d))) : null;
  const scores = working.map(([x, y]): Vector => [x * pc1[0] + y * pc1[1], x * pc2[0] + y * pc2[1]]);
  return {working, pc1, pc2, explained, scores, tied, covariance: [[a, b], [b, d]]};
}
