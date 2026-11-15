import {test,expect} from '@playwright/test';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {resolve, sep} from 'node:path';

test.beforeEach(async ({page}) => {
 if (process.env.DS_TEST_STATIC !== '1') return;
 const root = resolve('dist');
 const base = process.env.DS_LAB_BASE || '/';
 await page.route('http://127.0.0.1:5174/**', async (route) => {
  const requested = decodeURIComponent(new URL(route.request().url()).pathname);
  if (!requested.startsWith(base)) return route.fulfill({status:404});
  const pathname = '/' + requested.slice(base.length);
  const file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) return route.abort();
  if (existsSync(file) && statSync(file).isFile()) return route.fulfill({path:file});
  if (route.request().isNavigationRequest()) {
   const index = resolve(file, 'index.html');
   return route.fulfill({path:existsSync(index) ? index : resolve(root,'404.html')});
  }
  return route.fulfill({status:404});
 });
});
test('navigation, catalog, lesson interactions, responsive layout and theme',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await expect(page.getByRole('heading',{name:/A little curiosity/})).toBeVisible();
 if (!process.env.DS_TEST_STATIC) await page.screenshot({path:`qa/${info.project.name}-home.png`,fullPage:true});
 await page.getByRole('button',{name:'Revenue',exact:true}).click();await expect(page.getByText('Sunday earns')).toBeVisible();
 await page.getByRole('button',{name:'Switch to dark mode'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.getByRole('button',{name:'Switch to light mode'}).click();
 await page.getByRole('button',{name:'Explore all courses'}).click();await expect(page.locator('.course-card')).toHaveCount(12);
 await page.getByRole('textbox',{name:'Filter course catalog'}).fill('window');await expect(page.locator('.course-card')).toHaveCount(1);await expect(page.locator('.course-card h3')).toHaveText('SQL');
 await page.getByRole('button',{name:'View chapters'}).click();await expect(page.getByText('Window functions',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Filter course catalog'}).fill('zzzz');await expect(page.getByRole('heading',{name:'No matching courses yet'})).toBeVisible();await page.getByRole('button',{name:'Reset filters'}).click();
 await page.goto('./learn/statistics');await page.locator('#outlier').fill('200');await expect(page.getByTestId('mean')).toHaveText('₹62');
 await page.getByText('The mean increases; the median stays at ₹30.',{exact:true}).click();await page.getByRole('button',{name:'Check understanding'}).click();await expect(page.getByText('Knowledge check complete',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Knowledge check complete',{exact:true})).toBeVisible();
 if (!process.env.DS_TEST_STATIC) await page.screenshot({path:`qa/${info.project.name}-statistics.png`,fullPage:true});
 await page.goto('./learn/pandas');await expect(page.locator('tbody tr')).toHaveCount(6);await page.getByRole('button',{name:'Preview cleaning'}).click();await expect(page.locator('tbody tr')).toHaveCount(5);await expect(page.getByRole('cell',{name:'170',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Python code',exact:true}).fill('print("draft survives")');await page.reload();await expect(page.getByRole('textbox',{name:'Python code',exact:true})).toHaveValue('print("draft survives")');
 await page.goto('./dashboard');await expect(page.getByText('Knowledge checks passed')).toBeVisible();
 await page.goto('./roadmap');await expect(page.locator('.roadmap-course')).toHaveCount(12);
 for(const route of ['/','/courses','/roadmap','/dashboard','/learn/pandas']){await page.goto('.'+route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),route).toBe(true)}
 await page.getByRole('button',{name:'Open learner account'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close account'}).click();
 if(info.project.name==='mobile'){await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'My learning',exact:true}).click();await expect(page).toHaveURL(/dashboard/)}
 expect(errors).toEqual([]);
});
test('Iris project analysis, saved draft and report download',async({page})=>{
 await page.goto('./courses');
 await page.getByRole('link',{name:'Open Iris EDA project'}).click();
 await expect(page.getByRole('heading',{name:'Can petal size tell species apart?'})).toBeVisible();
 await expect(page.getByText('Mean 1.46 cm · range 1.0–1.9 cm')).toBeVisible();
 await page.getByLabel('Measurement',{exact:true}).selectOption('0');
 await expect(page.getByText('Mean 5.01 cm · range 4.3–5.8 cm')).toBeVisible();
 await page.getByRole('radio',{name:'setosa',exact:true}).check();
 await page.getByRole('button',{name:'Check interpretation'}).click();
 await expect(page.getByText(/Correct\. Setosa/)).toBeVisible();
 const finding=page.getByRole('textbox',{name:/What did you find/});
 await finding.fill('Setosa has shorter petals in this sample.');
 await page.reload();
 await expect(finding).toHaveValue('Setosa has shorter petals in this sample.');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export report'}).click();
 const report=await download;
 expect(report.suggestedFilename()).toBe('iris-eda-report.md');
 expect(readFileSync((await report.path())!,'utf8')).toContain('Setosa has shorter petals in this sample.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('real Python challenges, pandas package, failure and worker cancellation',async({page},info)=>{
 test.skip(process.env.DS_TEST_STATIC === '1', 'Live Pyodide requires access to its CDN.');
 test.skip(info.project.name==='mobile','Runtime is independently checked on desktop; mobile layout and interaction covered separately.');
 await page.goto('./learn/introduction');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.getByText('Not quite yet — check the hint',{exact:true})).toBeVisible({timeout:100000});
 await page.getByRole('textbox',{name:'Python code',exact:true}).fill('orders = [42,58,51,67,80,95,72]\naverage_orders = sum(orders) / len(orders)\nprint(average_orders)');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.getByText('Challenge passed — nice work!',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Python code',exact:true}).fill('while True: pass');await page.getByRole('button',{name:'Run code',exact:true}).click();await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByText('Stopped. Ready to restart.',{exact:true})).toBeVisible();
 await page.goto('./learn/statistics');await page.getByRole('textbox',{name:'Python code',exact:true}).fill('from statistics import median\norders=[20,25,30,35,200]\ntypical_order=median(orders)\nprint(typical_order)');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.getByText('Challenge passed — nice work!',{exact:true})).toBeVisible({timeout:100000});
 await page.goto('./learn/pandas');const editor=page.getByRole('textbox',{name:'Python code',exact:true});const starter=await editor.inputValue();await editor.fill(starter+'\nclean = df.drop_duplicates().copy()\nclean["amount"] = clean["amount"].fillna(clean["amount"].median())\nclean["city"] = clean["city"].str.strip().str.title()\nprint(clean.to_string(index=False))');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.getByText('Challenge passed — nice work!',{exact:true})).toBeVisible({timeout:100000});
 await page.screenshot({path:'qa/desktop-pandas-executed.png',fullPage:true});
});
