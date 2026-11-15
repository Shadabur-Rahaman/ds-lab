import {expect, test} from './fixtures';
import {readFileSync} from 'node:fs';

test('array explorer displays slices, broadcasts, and axis totals and retains drafts', async ({page}) => {
  await page.goto('./learn/numpy-axis/');
  await expect(page.getByRole('heading', {name: 'NumPy Learning Studio'})).toBeVisible();
  const output = page.getByRole('table', {name: 'Array operation preview'});
  await expect(output.getByRole('cell', {name: '10', exact: true})).toBeVisible();
  await page.getByRole('slider', {name: 'Reduction axis'}).fill('1');
  await expect(output.getByRole('cell', {name: '14', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Broadcasting', exact: true}).click();
  await expect(output.getByRole('cell', {name: '13', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Indexing and slicing', exact: true}).click();
  await page.getByRole('slider', {name: 'Slice start column'}).fill('3');
  await expect(output.getByRole('row').nth(1).getByRole('cell')).toHaveCount(2);
  const editor = page.getByRole('textbox', {name: 'Python code'});
  await editor.fill('# local array draft');
  await page.reload();
  await expect(editor).toHaveValue('# local array draft');
  await page.getByRole('button', {name: 'Switch to dark mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test('retail project loads, cleans, filters, charts, and exports calculated findings', async ({page}) => {
  await page.goto('./projects/retail/');
  const raw = page.getByRole('table', {name: 'Raw retail sales'});
  await expect(raw.getByRole('row')).toHaveCount(21);
  await expect(raw.getByText('Missing', {exact: true})).toHaveCount(3);
  await page.getByRole('button', {name: 'Cleaned rows'}).click();
  const clean = page.getByRole('table', {name: 'Cleaned retail sales'});
  await expect(clean.getByRole('row')).toHaveCount(17);
  await expect(clean.getByText('Missing', {exact: true})).toHaveCount(0);
  await page.getByRole('combobox', {name: 'Category'}).selectOption('office');
  await expect(clean.getByRole('row')).toHaveCount(7);
  await page.getByRole('button', {name: 'Group by category'}).click();
  await expect(page.getByRole('table', {name: 'Revenue grouped by category'})).toContainText('2890');
  await page.getByText('View chart values').click();
  const bins = page.getByRole('table', {name: 'Histogram values'});
  const counts = await bins.locator('tbody td:nth-child(2)').allTextContents();
  expect(counts.map(Number).reduce((sum, value) => sum + value, 0)).toBe(16);
  await page.getByRole('button', {name: 'Box plot', exact: true}).click();
  await expect(page.getByText(/1 potential outlier/)).toBeVisible();
  await page.getByRole('checkbox', {name: 'Include orders of 18+ units'}).uncheck();
  await expect(page.getByText('15 cleaned observations in view')).toBeVisible();
  await page.getByRole('button', {name: 'Correlation heatmap'}).click();
  const heatmap = page.getByRole('table', {name: 'Correlation heatmap'});
  const heat = heatmap.getByRole('cell', {name: '1.000', exact: true});
  await expect(heat).toHaveCount(3);
  await page.getByRole('button', {name: 'Scatter plot'}).click();
  await page.getByRole('combobox', {name: 'Y column'}).selectOption('price');
  await expect(page.getByRole('img', {name: 'Scatter plot'})).toBeVisible();
  await page.getByRole('button', {name: 'Line chart'}).click();
  await expect(page.getByRole('img', {name: 'Line chart'})).toBeVisible();
  await page.getByRole('button', {name: 'Bar chart'}).click();
  await expect(page.getByRole('img', {name: 'Bar chart'})).toBeVisible();

  const findings = page.getByRole('textbox', {name: 'Findings and limitations'});
  await findings.fill('Office revenue was 2890 rupees. The sample is synthetic.');
  await page.reload();
  await expect(findings).toHaveValue(/2890/);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export analysis report'}).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('retail-analysis.md');
  const report = readFileSync((await download.path())!, 'utf8');
  expect(report).toContain('Office: 2890');
  expect(report).toContain('16 retained');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});

test('retail dataset reports missing and malformed sources', async ({page}) => {
  const path = '**/datasets/retail-sales.csv';
  await page.route(path, route => route.fulfill({status: 404}));
  await page.goto('./projects/retail/');
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.unroute(path);
  await page.route(path, route => route.fulfill({body: 'incorrect,header\n1,2'}));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Unexpected retail CSV columns');
});

test('executes real NumPy and Pandas challenges in the V7 studios', async ({page}) => {
  test.setTimeout(210_000);
  await page.goto('./learn/numpy-broadcasting/');
  const code = page.getByRole('textbox', {name: 'Python code'});
  const check = page.getByRole('button', {name: 'Check answer', exact: true});
  const run = page.getByRole('button', {name: 'Run code', exact: true});
  const output = page.getByLabel('Python output');
  await run.click();
  await expect(output).toContainText('[[13 15 17]', {timeout: 85_000});
  await code.fill('import numpy as np\nbase = np.array([[3,5,7],[2,4,6]])\nresult = base + np.array([10,20,30])\nprint(result)');
  await check.click();
  await expect(page.getByRole('status').filter({hasText: /^Challenge passed/})).toBeVisible({timeout: 30_000});
  await expect(page.getByText('Lesson complete.', {exact: true})).toHaveCount(0);
  await page.getByText('A length-three vector', {exact: true}).click();
  await page.getByRole('button', {name: 'Check understanding'}).click();
  await expect(page.getByText('Lesson complete.', {exact: true})).toBeVisible();

  await page.goto('./learn/pandas-groupby/');
  await expect(code).toBeVisible();
  const starter = await code.inputValue();
  await check.click();
  await expect(page.getByRole('status').filter({hasText: /^Not quite yet/})).toBeVisible({timeout: 85_000});
  await code.fill(starter.replace('.mean()', '.sum()'));
  await check.click();
  await expect(page.getByRole('status').filter({hasText: /^Challenge passed/})).toBeVisible({timeout: 35_000});
  await expect(output).toContainText('2890');
  await page.getByRole('button', {name: 'Missing values and duplicates', exact: true}).click();
  await code.fill(`import pandas as pd
sales = pd.read_csv("retail-sales.csv")
result = sales.drop_duplicates().dropna(subset=["units", "unit_price"])
result = result.loc[result["units"] > 0].copy()
result["category"] = result["category"].fillna("Unknown").str.strip().str.title()
print(len(result))`);
  await check.click();
  await expect(page.getByRole('status').filter({hasText: /^Challenge passed/})).toBeVisible({timeout: 85_000});
  await expect(output).toContainText('16');
  await page.goto('./dashboard');
  await expect(page.getByRole('button', {name: /Broadcasting/})).toContainText('Python complete');
  await expect(page.getByRole('button', {name: /GroupBy and aggregation/})).toContainText('Python complete');
});
