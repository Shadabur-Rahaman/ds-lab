import {readFileSync} from 'node:fs';
import {expect,test} from './fixtures';
import {activate,bce,descent,derivative,evaluateNetwork,forward,gradient,initialize,meanLoss,neuralDataset,numericalGradient,predict,trainStep,weighted,type Row} from '../src/lib/neural';

test('neural reference cases and central differences agree with backpropagation', () => {
  expect(weighted([2,1],[3,-1],.5)).toBe(5.5);
  expect(activate('Linear',-3)).toBe(-3);
  expect(activate('Sigmoid',1000)).toBe(1);
  expect(activate('Sigmoid',-1000)).toBe(0);
  expect(activate('ReLU',-3)).toBe(0);
  expect(activate('Tanh',0)).toBe(0);
  expect(derivative('Sigmoid',0)).toBe(.25);
  expect(bce(1000,1)).toBe(0);
  expect(bce(-1000,1)).toBe(1000);
  expect(bce(Infinity,1)).toBe(0);
  expect(bce(Infinity,0)).toBe(Infinity);
  expect(bce(0,2)).toBeNaN();
  expect(forward([0,0,0,0,0],[1,2])).toEqual({hidden:[0],logit:0,probability:.5});
  const row: Row={id:0,x:[.5,-.75],y:1};
  const params=initialize(3,19);
  gradient(params,row).forEach((value,index)=>expect(value).toBeCloseTo(numericalGradient(params,row,index),8));
  const next=trainStep(params,[row],.2);
  expect(next).not.toEqual(params);
  expect(meanLoss(next,[row])!).toBeLessThan(meanLoss(params,[row])!);
  expect(()=>trainStep(params,[],1)).toThrow();
  expect(()=>trainStep(params,[row],Infinity)).toThrow();
  expect(()=>trainStep([NaN,0,0,0,0],[row],1)).toThrow();
  expect(()=>predict(params,[Infinity,0])).toThrow();
  expect(descent(0,.1,'MSE').history[1]).toMatchObject({weight:.4});
  expect(descent(0,2.5,'MSE').unstable).toBe(true);
});

test('deterministic classifier learns from training rows and evaluates separate test rows', () => {
  const data=neuralDataset(17,.3,0);
  expect(data).toEqual(neuralDataset(17,.3,0));
  expect(new Set([...data.train,...data.test].map(row=>row.id)).size).toBe(100);
  expect(data.train.some(row=>data.test.includes(row))).toBe(false);
  let model=initialize(6,17);
  expect(initialize(6,17)).toEqual(model);
  const first=meanLoss(model,data.train)!;
  for(let epoch=0;epoch<500;epoch++) model=trainStep(model,data.train,.8);
  expect(meanLoss(model,data.train)!).toBeLessThan(first);
  expect(predict(model,[.8,.8])).toBe(1);
  expect(predict(model,[.8,-.8])).toBe(0);
  const evaluation=evaluateNetwork(model,data.test);
  expect(evaluation.accuracy!).toBeGreaterThan(.8);
  expect(evaluation.mistakes.length).toBe(evaluation.counts.fp+evaluation.counts.fn);
  expect(evaluateNetwork(model,[]).accuracy).toBeNull();
});

test('deep learning routes show real experiments and fit representative screen widths', async ({page},info) => {
  const widths=info.project.name==='mobile'?[320,390]:[768,1024,1440];
  for (const width of widths) {
    await page.setViewportSize({width,height:850});
    await page.goto('./learn/dl-forward/');
    await expect(page.getByRole('img',{name:/Two inputs, two tanh/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
  }
  const lessons=page.getByRole('navigation',{name:'Deep Learning lessons'});
  await expect(lessons.getByRole('button')).toHaveCount(6);
  await lessons.getByRole('button',{name:'Artificial neurons'}).click();
  await expect(page.getByText('5.5',{exact:true})).toHaveCount(2);
  await page.getByRole('slider',{name:/Input 1/}).fill('1');
  await expect(page.getByText('2.5',{exact:true})).toHaveCount(2);
  await lessons.getByRole('button',{name:'Activation functions'}).click();
  await expect(page.getByRole('img',{name:'Sigmoid activation curve'})).toBeVisible();
  await lessons.getByRole('button',{name:'Loss and gradient descent'}).click();
  await page.getByRole('slider',{name:/Learning rate/}).fill('2.5');
  await expect(page.getByRole('alert')).toContainText('stability limit');
  await lessons.getByRole('button',{name:'Backpropagation',exact:true}).click();
  await expect(page.getByText('Finite difference',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apply gradient step'}).click();
  await expect(page.getByText('Absolute difference',{exact:true})).toBeVisible();
});

test('neural project trains real weights, exports metrics, and retains completion', async ({page}) => {
  await page.goto('./projects/neural-classification/');
  await page.getByRole('button',{name:'Train network'}).click();
  await expect(page.getByRole('img',{name:'Training loss curve'})).toBeVisible({timeout:25_000});
  await expect(page.getByRole('img',{name:'Held-out loss curve'})).toBeVisible();
  await expect(page.getByRole('img',{name:/Model decision regions/})).toBeVisible();
  await page.getByRole('textbox',{name:'Conclusion'}).fill('Compare the held-out errors on another seed.');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export neural report'}).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('neural-classification-report.md');
  const report=readFileSync((await file.path())!,'utf8');
  expect(report).toMatch(/Held-out accuracy: \d+\.\d%/);
  expect(report).toContain('Compare the held-out errors');
  await page.getByRole('radio',{name:'Held-out rows'}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await page.reload();
  await expect(page.getByText(/Report and interpretation saved/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Download saved report'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Conclusion'})).toHaveValue(/held-out errors/);
});

test('executes real Python for a neural challenge and retains the draft and checks', async ({page}) => {
  await page.goto('./learn/dl-neurons/');
  const editor=page.getByRole('textbox',{name:'Python code'});
  await page.getByRole('button',{name:'Load example'}).click();
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/^Challenge passed/})).toBeVisible({timeout:85_000});
  await page.getByRole('radio',{name:'Adds an offset'}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await page.reload();
  await expect(editor).toHaveValue(/sum/);
  await expect(page.getByText('Lesson complete.',{exact:true})).toBeVisible();
});
