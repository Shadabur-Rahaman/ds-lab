import {expect, test} from './fixtures';

test('SQLite initializes, handles empty results and syntax errors, and resets the retail database', async ({page}) => {
  await page.goto('./learn/sql-foundations/');
  await expect(page.getByRole('heading', {name: 'SQL Learning Studio'})).toBeVisible();
  const editor = page.getByRole('textbox', {name: 'SQL query'});
  const run = page.getByRole('button', {name: 'Run query', exact: true});
  const result = page.getByRole('table', {name: 'Query result rows'});
  await expect(page.getByRole('status')).toContainText('SQLite is ready', {timeout: 35_000});
  await expect(run).toBeEnabled({timeout: 35_000});
  await expect(page.getByRole('table', {name: 'Customers sample rows'})).toContainText('Asha Rao');
  await page.getByRole('button', {name: 'Show schema'}).click();
  await expect(page.getByRole('table', {name: 'Customers schema'})).toContainText('customer_id');

  await editor.fill('SELECT sqlite_version() AS sqlite;');
  await run.click();
  await expect(result).toContainText(/3\.\d+\.\d+/);
  await editor.fill('SELECT name FROM Customers WHERE 1 = 0;');
  await run.click();
  await expect(page.getByText('No matching rows.')).toBeVisible();
  await editor.fill('SELEKT name FROM Customers;');
  await run.click();
  await expect(page.getByRole('alert')).toContainText('syntax error');
  await editor.fill("UPDATE Customers SET name = 'Changed' WHERE customer_id = 1;");
  await run.click();
  await expect(page.getByRole('status')).toContainText('executed successfully');
  await editor.fill('SELECT name FROM Customers WHERE customer_id = 1;');
  await run.click();
  await expect(result).toContainText('Changed');
  await page.getByRole('button', {name: 'Reset database'}).click();
  await expect(page.getByRole('table', {name: 'Customers sample rows'})).toContainText('Asha Rao');
  await run.click();
  await expect(result).toContainText('Asha Rao');
  await page.getByRole('button', {name: 'Reset query'}).click();
  await expect(editor).toHaveValue('SELECT name\nFROM Customers\nORDER BY customer_id;');
  await page.getByRole('button', {name: 'Switch to dark mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth + 1));
});

test('SQL lessons run real filters, aggregates, joins and NULL checks and persist completion', async ({page}) => {
  await page.goto('./');
  await page.getByRole('button', {name: /SQL Learning Studio/}).click();
  const editor = page.getByRole('textbox', {name: 'SQL query'});
  const check = page.getByRole('button', {name: 'Check answer'});
  const result = page.getByRole('table', {name: 'Query result rows'});
  const status = page.getByRole('status');
  await expect(status).toContainText('SQLite is ready', {timeout: 35_000});
  await expect(check).toBeEnabled({timeout: 35_000});
  await check.click();
  await expect(status).toContainText('rows differ');
  await page.getByRole('button', {name: 'Show expected result'}).click();
  await expect(page.getByRole('table', {name: 'Expected result rows'})).toContainText('Mysuru');
  const solutions = [
    ['SQL Foundations', 'SELECT name AS customer, city FROM Customers ORDER BY customer_id LIMIT 3;', 'Asha Rao'],
    ['Filtering and Sorting', 'SELECT name, price FROM Products WHERE price >= 100 AND price <= 400 ORDER BY price DESC, name;', 'Planter'],
    ['Aggregation', 'SELECT category, SUM(price) * 1.0 / COUNT(*) FROM Products GROUP BY category HAVING COUNT(product_id) > 1;', 'Home'],
    ['SQL Joins', 'SELECT c.name, (SELECT COUNT(*) FROM Orders o WHERE o.customer_id = c.customer_id) FROM Customers c;', 'Zoya Ali'],
    ['NULL Values and Data Quality', "SELECT name, CASE WHEN email IS NULL THEN 'Missing email' ELSE email END FROM Customers WHERE email IS NULL;", 'Missing email'],
  ];
  for (const [title, query, expected] of solutions) {
    await page.getByRole('navigation', {name: 'SQL lessons'}).getByRole('button', {name: title}).click();
    await expect(check).toBeEnabled({timeout: 35_000});
    await editor.fill(query);
    await check.click();
    await expect(status).toContainText('Challenge passed');
    await expect(result).toContainText(expected);
  }
  await page.reload();
  await expect(editor).toHaveValue(solutions[4][1]);
  await expect(page.getByRole('navigation', {name: 'SQL lessons'}).getByLabel('Completed')).toHaveCount(5);
  await page.goto('./dashboard');
  await expect(page.getByRole('heading', {name: /^5 of \d+ lessons complete$/})).toBeVisible();
  await page.goto('./courses');
  await page.getByRole('textbox', {name: 'Filter course catalog'}).fill('SQL');
  await page.getByRole('button', {name: 'Open studio'}).click();
  await expect(page.getByRole('heading', {name: 'SQL Learning Studio'})).toBeVisible();
  await page.goto('./roadmap');
  await expect(page.getByRole('button', {name: 'Open SQL Studio'})).toBeVisible();
});
