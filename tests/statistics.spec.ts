import {expect, test} from './fixtures';

test('Statistics studio charts, quizzes and independent Python drafts', async ({page}) => {
  await page.goto('./');
  await page.getByRole('button', {name: /Statistics Learning Studio/}).click();
  await expect(page.getByRole('heading', {name: 'Statistics Learning Studio', exact: true})).toBeVisible();
  const topics = page.getByRole('group', {name: 'Statistics topics'});
  const editor = page.getByRole('textbox', {name: 'Python code'});
  await page.getByRole('slider', {name: /^Largest order/}).fill('200');
  await expect(page.getByTestId('mean')).toHaveText('₹62');
  await page.getByText('Hinglish memory hint').click();
  await expect(page.getByText(/Median sorted list/)).toBeVisible();

  await topics.getByRole('button', {name: 'Probability'}).click();
  await page.getByLabel('Signup probability').fill('100');
  await page.getByRole('button', {name: 'Simulate 200 visits'}).click();
  await expect(page.getByRole('img', {name: '200 signups in 200 visits'})).toBeVisible();
  await page.getByLabel('Signup probability').fill('0');
  await page.getByRole('button', {name: 'Simulate 10 visits'}).click();
  await expect(page.getByRole('img', {name: '0 signups in 10 visits'})).toBeVisible();
  await page.getByRole('radio', {name: 'About 50 on average'}).check();
  await page.getByRole('button', {name: 'Check understanding'}).click();
  await expect(page.getByText(/^Correct\. Expected count/)).toBeVisible();
  await editor.fill('expected = 200 * 0.25');

  await topics.getByRole('button', {name: 'Normal curve'}).click();
  await page.getByLabel('Standard deviations from the mean').fill('2');
  await expect(page.getByText('95.45%', {exact: true})).toBeVisible();
  await expect(page.getByText('34–66 cm', {exact: true})).toBeVisible();
  await expect(editor).toHaveValue(/NormalDist/);

  await topics.getByRole('button', {name: 'Correlation'}).click();
  await page.getByLabel('Simulated trend').fill('-100');
  await expect(page.getByText('-1.00', {exact: true})).toBeVisible();
  await page.getByLabel('Simulated trend').fill('0');
  await expect(page.getByText('0.00', {exact: true})).toBeVisible();

  await topics.getByRole('button', {name: 'Sampling'}).click();
  await page.getByLabel('Deliveries per sample').fill('16');
  await expect(page.getByText('3.00 min', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Draw 100 samples'}).click();
  await expect(page.getByRole('img', {name: /^Bin starting at 12 minutes/})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

  await page.reload();
  await topics.getByRole('button', {name: 'Probability'}).click();
  await expect(editor).toHaveValue('expected = 200 * 0.25');
});
