import {readFileSync} from 'node:fs';
import {test,expect} from './fixtures';
import {boost,cluster,fitForest,fitTree,impurity,initialize,outOfBag,partition,pca,predictTree,vote,type Vector} from '../src/lib/advancedMl';
import {comparisonTrainingCsv,fitComparison,irisComparisonSplit,parseSettings,scoreComparison} from '../src/lib/modelComparison';

test('advanced model calculations use actual samples, residuals and covariance', () => {
  const rows = [0,1,4,5].map(x => ({x:[x],y:Number(x > 2)}));
  expect(impurity(rows,'gini')).toBe(.5);
  expect(impurity(rows,'entropy')).toBe(1);
  expect(partition(rows,0,2,'gini')).toMatchObject({left:rows.slice(0,2),right:rows.slice(2),gain:.5});
  const tree = fitTree(rows,1,'gini');
  expect(predictTree(tree,[2])).toBe(0);
  expect(predictTree(tree,[3])).toBe(1);
  expect(predictTree(fitTree(rows,0,'variance'),[99])).toBe(.5);
  const forest = fitForest(rows,21,2,17);
  expect(forest).toEqual(fitForest(rows,21,2,17));
  expect(vote([1,0,1,0])).toBe(0);
  expect(vote(forest.map(member => predictTree(member.tree,[4])))).toBe(1);
  expect(outOfBag(forest,rows)).toMatchObject({covered:4,total:4});
  expect(outOfBag([],rows)).toMatchObject({covered:0,accuracy:null});

  const model = boost(rows,[{x:[0],y:9}],2,.5);
  expect(model.history.map(entry => entry.train)).toEqual([.25,.0625,.015625]);
  expect(model.history[0].validation).toBe(8.5**2);
  expect(model.predict([5],0)).toBe(.5);
  expect(model.predict([5],2)).toBe(.875);

  const points: Vector[] = [[0,0],[0,2],[9,0],[9,2]];
  const initial: Vector[] = [[0,0],[9,0]];
  expect(initialize(points,3,30)).toEqual(initialize(points,3,30));
  expect(cluster(points,initial,0).wcss).toBe(8);
  expect(cluster(points,initial,12)).toEqual({centers:[[0,1],[9,1]],assignments:[0,0,1,1],wcss:4});
  expect(pca([[1,1],[1,1]],true)?.explained).toBeNull();
  expect(pca([[1,0],[-1,0],[0,1],[0,-1]],false)).toMatchObject({tied:true,explained:.5});
  expect(pca([[0,0],[1,2],[2,4]],false)?.explained).toBeCloseTo(1);
  expect(pca([[0,0],[1,2],[2,4]],true)?.pc1[0]).toBeCloseTo(Math.SQRT1_2);
});

test('model comparison partitions are deterministic, disjoint and stratified', () => {
  const csv = readFileSync('public/datasets/iris.csv','utf8');
  const split = irisComparisonSplit(csv);
  expect(split).toEqual(irisComparisonSplit(csv));
  const all = [...split.train,...split.validation,...split.test];
  expect(new Set(all.map(row => row.id)).size).toBe(150);
  for (const [rows,count] of [[split.train,30],[split.validation,10],[split.test,10]] as const) {
    for (const label of [0,1,2]) expect(rows.filter(row => row.y === label)).toHaveLength(count);
  }
  expect(comparisonTrainingCsv(split).split('\n')).toHaveLength(91);
  const models = fitComparison(split.train,{depth:3,trees:11});
  const scores = scoreComparison(models,split.test);
  expect(scores[0].accuracy).toBeCloseTo(1/3);
  for (const score of scores) {
    expect(score.matrix.flat().reduce((a,b) => a+b,0)).toBe(30);
    expect(score.accuracy).toBeCloseTo(1-score.mistakes.length/30);
  }
  expect(parseSettings('{"depth":4,"trees":5}')).toEqual({depth:4,trees:5});
  expect(parseSettings('{"depth":99,"trees":5}')).toBeNull();
});

test('advanced studio controls update calculations and link to topic practice', async ({page}) => {
  await page.goto('./learn/ml-tree/');
  const experiment = page.locator('.advanced-controls');
  await expect(experiment.getByRole('status')).toContainText('Weighted gain: 0.180');
  await page.getByRole('slider',{name:'Split threshold'}).press('Home');
  await expect(experiment.getByRole('status')).toContainText('Weighted gain: 0.000');
  await page.getByRole('button',{name:'Random Forests',exact:true}).click();
  await expect(experiment.getByRole('status')).toContainText('Forest prediction: class');
  await page.getByRole('slider',{name:'Tree count'}).press('Home');
  await expect(page.getByRole('list',{name:'Individual tree votes'}).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button',{name:'Gradient Boosting',exact:true}).click();
  await page.getByRole('slider',{name:'Inspect iteration'}).press('Home');
  await expect(experiment.getByText(/Change from previous learner/)).toHaveCount(0);
  await page.getByRole('button',{name:'K-means Clustering',exact:true}).click();
  await expect(experiment.getByRole('status')).toContainText('Within-cluster sum of squares');
  const before = await experiment.getByRole('status').textContent();
  await page.getByRole('slider',{name:'Centroid updates'}).press('End');
  expect(await experiment.getByRole('status').textContent()).not.toBe(before);
  await page.getByRole('button',{name:'Principal Component Analysis',exact:true}).click();
  await page.getByRole('checkbox',{name:'Standardize features'}).check();
  await expect(experiment.getByRole('status')).toContainText('PC1 explained variance');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.getByRole('link',{name:'Practice Principal Component Analysis in Assessments'}).click();
  await expect(page.getByRole('button',{name:'Start practice (2)'})).toBeVisible();
});

test('Iris project protects held-out results, saves findings and exports actual metrics', async ({page}) => {
  await page.goto('./projects/compare-models/');
  const lock = page.getByRole('button',{name:'Lock settings and evaluate test'});
  const validate = page.getByRole('button',{name:'Evaluate validation split'});
  await expect(lock).toBeDisabled();
  await expect(page.getByRole('heading',{name:'Held-out test accuracy'})).toHaveCount(0);
  await validate.click();
  await expect(page.getByRole('heading',{name:'Validation accuracy'})).toBeVisible();
  await page.getByRole('slider',{name:'Maximum tree depth'}).press('ArrowRight');
  await expect(lock).toBeDisabled();
  await validate.click();
  await lock.click();
  await expect(page.getByRole('table',{name:'Random forest confusion matrix'})).toBeVisible();
  await page.getByRole('radio',{name:'Reserve a fresh test set for the final evaluation'}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await page.getByRole('textbox',{name:'Findings and limitations'}).fill('The majority baseline always predicts setosa. This is one split.');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Held-out test accuracy'})).toBeVisible();
  await expect(validate).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Findings and limitations'})).toHaveValue(/one split/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export comparison report'}).click();
  const report = await download;
  expect(report.suggestedFilename()).toBe('compare-models-report.md');
  expect(readFileSync((await report.path())!,'utf8')).toContain('| Majority baseline | 33.3% | 33.3% |');
  await expect(page.getByText('3 of 6 milestones verified.')).toBeVisible();
});
