import {readFileSync} from 'node:fs';
import {test,expect} from './fixtures';
import {purchaseSummary,purchaseSQL,studentDefaultSeed,studentExperiment} from '../src/lib/capstoneData';
import {lessonState} from '../src/curriculum';
import {mergeProgress,parseProgress} from '../src/lib/progress';
import {purchaseSqlBit,purchasePythonBit} from '../src/projectCatalog';

test('capstone math reconciles revenue totals and uses disjoint reproducible regression splits',()=>{
  const summary=purchaseSummary();
  expect([summary.rows,summary.duplicates,summary.excluded,summary.retained]).toEqual([50,2,4,44]);
  for(const groups of [summary.categories,summary.customers,summary.products,summary.orders,summary.months]) {
    expect(groups.reduce((sum,[,value])=>sum+value,0)).toBe(summary.total);
  }
  expect(summary.total).toBe(41040);
  const model=studentExperiment('study_hours',studentDefaultSeed);
  const ids=new Set(model.train.map(row=>row.id));
  expect(model.test.some(row=>ids.has(row.id))).toBe(false);
  expect(model.test.map(row=>row.id)).toEqual(studentExperiment('study_hours',studentDefaultSeed).test.map(row=>row.id));
  expect(model.train.length+model.test.length+model.excluded).toBe(96);
  expect(model.baseline).toBeCloseTo(model.train.reduce((sum,row)=>sum+row.y,0)/model.train.length);
  expect(model.model.mae).toBeCloseTo(model.predictions.reduce((sum,row)=>sum+Math.abs(row.error),0)/model.test.length);
  expect(model.model.mse).toBeCloseTo(model.predictions.reduce((sum,row)=>sum+row.error**2,0)/model.test.length);
  const id='customer-purchases';
  const sql=parseProgress({[id]:{quiz:true,code:true,studio:63|purchaseSqlBit}});
  expect(lessonState(sql,id)).toBe('In progress');
  const pandas=parseProgress({[id]:{studio:purchasePythonBit}});
  expect(mergeProgress(sql,pandas)[id]?.studio).toBe(63|purchaseSqlBit|purchasePythonBit);
  expect(lessonState(mergeProgress(sql,pandas),id)).toBe('Completed');
  expect(lessonState(parseProgress({[id]:{quiz:true,code:true,studio:64}}),id)).toBe('In progress');
});

test('purchase capstone verifies real SQLite and Pandas and exports completed work',async({page})=>{
  test.setTimeout(160_000);
  await page.goto('./projects/customer-purchases/');
  await page.getByLabel('Which value belongs in the revenue formula?').selectOption('0');
  await page.getByRole('button',{name:'Check project framing'}).click();
  await page.getByLabel('Profile column').selectOption({label:'quantity'});
  await page.getByRole('button',{name:'Compute column profile'}).click();
  const sql=page.getByRole('region',{name:'Purchase SQL workspace'});
  await sql.getByRole('textbox',{name:'SQL query'}).fill(purchaseSQL.answer);
  await sql.getByRole('button',{name:'Check answer',exact:true}).click({timeout:45_000});
  await expect(sql.getByText('SQL challenge passed.',{exact:true})).toBeVisible({timeout:35_000});
  await expect(page.getByText(/SQLite check: verified · Pandas check: pending/)).toBeVisible();
  const python=page.getByRole('region',{name:'Python workspace'});
  await python.getByRole('textbox',{name:'Python code'}).fill(`import pandas as pd
lines = pd.read_csv("customer-purchases.csv").drop_duplicates()
clean = lines.dropna(subset=["quantity", "unit_price"]).query("quantity > 0 and unit_price >= 0").copy()
clean["category"] = clean["category"].fillna("").str.strip().str.title().replace("", "Unknown")
clean["revenue"] = clean["quantity"] * clean["unit_price"]
revenue_by_category = clean.groupby("category")["revenue"].sum()
total_revenue = clean["revenue"].sum()
retained_count = len(clean)
print(revenue_by_category)
`);
  await python.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(python.getByRole('status').filter({hasText:/Challenge passed/})).toBeVisible({timeout:85_000});
  await page.getByRole('button',{name:'Compute purchase summary'}).click();
  await expect(page.getByRole('list',{name:'Order-value distribution'})).toBeVisible();
  await page.getByRole('radio',{name:'Their revenue is unknown.'}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await page.getByRole('textbox',{name:'Findings and limitations'}).fill('Retained sales exclude records with unknown revenue. The dataset is synthetic.');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export capstone report'}).click();
  expect(readFileSync((await (await download).path())!,'utf8')).toContain('44 retained');
  await expect(page.getByText('All six Project Studio milestones complete.')).toBeVisible();
  await page.reload();
  await expect(sql.getByRole('textbox',{name:'SQL query'})).toHaveValue(purchaseSQL.answer);
  await expect(page.getByRole('button',{name:'Download saved report'})).toBeVisible();
});

test('student capstone fits held-out regression, rejects stale reports and resumes notes',async({page})=>{
  await page.goto('./projects/student-performance/');
  await expect(page.getByRole('heading',{name:'Student Performance Prediction'})).toBeVisible();
  await page.getByRole('button',{name:'Fit and evaluate'}).click();
  await expect(page.getByRole('img',{name:/Predicted versus actual/})).toBeVisible();
  await expect(page.getByText(/65 training rows · 22 held-out rows/)).toBeVisible();
  const model=studentExperiment('study_hours',studentDefaultSeed);
  await expect(page.getByRole('row').filter({hasText:'Linear regression'})).toContainText(model.model.mae!.toFixed(2));
  await page.getByRole('textbox',{name:'Findings and limitations'}).fill('I compared held-out errors with the training mean. These data are synthetic.');
  await page.getByLabel('Split seed',{exact:true}).fill('42');
  await expect(page.getByRole('button',{name:'Export capstone report'})).toBeDisabled();
  await page.getByRole('button',{name:'Fit and evaluate'}).click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export capstone report'}).click();
  expect(readFileSync((await (await download).path())!,'utf8')).toContain('Seed 42');
  await page.goto('./projects/');
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Student Performance Prediction'})});
  await expect(card.getByText('In progress',{exact:true})).toBeVisible();
  await card.getByRole('link',{name:'Resume project'}).click();
  await expect(page.getByRole('textbox',{name:'Findings and limitations'})).toHaveValue(/training mean/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
});

test('student capstone grades actual Python and completes the portfolio',async({page})=>{
  test.setTimeout(145_000);
  await page.goto('./projects/student-performance/');
  await page.getByLabel('Which variable is unavailable before the exam?').selectOption('1');
  await page.getByRole('button',{name:'Check project framing'}).click();
  await page.getByLabel('Profile column').selectOption({label:'study_hours'});
  await page.getByRole('button',{name:'Compute column profile'}).click();
  await page.getByRole('button',{name:'Fit and evaluate'}).click();
  await page.getByRole('radio',{name:'Training rows only',exact:true}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await page.getByRole('textbox',{name:'Python code'}).fill(`import csv, math, statistics
with open("student-performance.csv") as file:
    rows = [(float(r["study_hours"]), float(r["final_score"]), int(r["fixed_holdout"]))
            for r in csv.DictReader(file) if r["study_hours"]]
train = [(x,y) for x,y,hold in rows if not hold]
test = [(x,y) for x,y,hold in rows if hold]
mx = statistics.mean(x for x,y in train)
my = statistics.mean(y for x,y in train)
slope = sum((x-mx)*(y-my) for x,y in train) / sum((x-mx)**2 for x,y in train)
errors = [y - (my + slope*(x-mx)) for x,y in test]
mae = statistics.mean(abs(e) for e in errors)
rmse = math.sqrt(statistics.mean(e*e for e in errors))
baseline_mae = statistics.mean(abs(y-my) for x,y in test)
print(mae, rmse, baseline_mae)
`);
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/Challenge passed/})).toBeVisible({timeout:95_000});
  await page.getByRole('textbox',{name:'Findings and limitations'}).fill('The model changes held-out error on one synthetic split. I would evaluate more splits.');
  const report=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export capstone report'}).click();
  await report;
  await page.goto('./projects/');
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Student Performance Prediction'})});
  await expect(card.getByText('Completed',{exact:true})).toBeVisible();
  const data=page.waitForEvent('download');
  await card.getByRole('button',{name:'Export portfolio JSON'}).click();
  expect(JSON.parse(readFileSync((await (await data).path())!,'utf8')).report).toContain('Held-out predictions');
});
