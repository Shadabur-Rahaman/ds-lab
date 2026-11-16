import {fitForest, fitTree, predictTree, vote} from './advancedMl';
import {confusion, irisLabels, parseIris, splitRows} from './ml';

export const settingsKey = 'ds-lab:compare-models:settings';
export const modelSettings = {depth:3, trees:11};
export type Settings = typeof modelSettings;

export function parseSettings(text: string | null): Settings | null {
  try {
    if (!text) return null;
    const {depth,trees} = JSON.parse(text);
    if (Number.isInteger(depth) && depth >= 1 && depth <= 8 && Number.isInteger(trees) && trees >= 3 && trees <= 25) return {depth,trees};
  } catch { /* A corrupt value leaves the project unlocked. */ }
  return null;
}

export function irisComparisonSplit(csv: string) {
  const source = parseIris(csv).map((row,i) => ({id:i+1,x:row.features,y:irisLabels.indexOf(row.label as typeof irisLabels[number])}));
  const groups = irisLabels.map((_,i) => {
    const first = splitRows(source.filter(row => row.y === i), .2, 403+i);
    const second = splitRows(first.train, .25, 733+i);
    return {train:second.train, validation:second.test, test:first.test};
  });
  return {train:groups.flatMap(g => g.train), validation:groups.flatMap(g => g.validation), test:groups.flatMap(g => g.test)};
}

export function comparisonTrainingCsv(split: ReturnType<typeof irisComparisonSplit>) {
  return ['sepal_length,sepal_width,petal_length,petal_width,species', ...split.train.map(row => [...row.x,irisLabels[row.y]].join(','))].join('\n');
}

export function fitComparison(train: ReturnType<typeof irisComparisonSplit>['train'], {depth,trees}: Settings) {
  const baseline = vote(train.map(row => row.y))!;
  const tree = fitTree(train,depth,'gini');
  const forest = fitForest(train,trees,depth,197);
  return [
    {name:'Majority baseline', predict: () => baseline},
    {name:'Decision tree', predict: (x: number[]) => predictTree(tree,x)},
    {name:'Random forest', predict: (x: number[]) => vote(forest.map(member => predictTree(member.tree,x)))!},
  ];
}

export function scoreComparison(models: ReturnType<typeof fitComparison>, rows: ReturnType<typeof irisComparisonSplit>['train']) {
  return models.map(({name,predict}) => {
    const predictions = rows.map(row => predict(row.x));
    const mistakes = rows.flatMap((row,i) => row.y === predictions[i] ? [] : [{id:row.id,actual:irisLabels[row.y],predicted:irisLabels[predictions[i]],features:row.x}]);
    return {name, accuracy:1-mistakes.length/rows.length, mistakes,
      matrix:confusion(rows.map(row => irisLabels[row.y]), predictions.map(y => irisLabels[y]), irisLabels)};
  });
}
