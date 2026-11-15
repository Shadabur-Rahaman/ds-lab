import {expect, test} from './fixtures';

const storageKey = 'learning-ecosystem:ds:progress:v1';

test('beginner path, planned chapters and resume agree with saved learner activity', async ({page}) => {
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      introduction: {quiz:true, code:true}, 'numpy-arrays': {quiz:true, code:true},
      'pandas-csv': {quiz:true, code:false, updatedAt:200}, statistics: {quiz:true,code:false,updatedAt:100},
    }));
  },storageKey);
  await page.goto('./');
  const path = page.getByRole('list',{name:'Recommended learning path'});
  await expect(path.getByRole('listitem')).toHaveCount(7);
  expect(await path.getByRole('button').allTextContents()).toEqual([
    expect.stringContaining('Data Science Foundations'), expect.stringContaining('Statistics'),
    expect.stringContaining('SQL'), expect.stringContaining('NumPy'), expect.stringContaining('Pandas'),
    expect.stringContaining('Visualization'), expect.stringContaining('Machine Learning'),
  ]);
  await expect(path.getByRole('button',{name:/Data Science Foundations/})).toContainText('1 / 1 complete');
  await page.goto('./dashboard');
  await page.getByRole('button',{name:'Continue learning',exact:true}).click();
  await expect(page).toHaveURL(/learn\/pandas-csv/);
  await expect(page.getByRole('heading',{name:'Pandas Learning Studio'})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Learning objective'})).toBeVisible();
  await page.getByRole('navigation',{name:'Lesson progression'}).getByRole('button',{name:/Next: Selecting/}).click();
  await expect(page).toHaveURL(/learn\/pandas-selection/);

  await page.goto('./courses');
  await page.getByRole('textbox',{name:'Filter course catalog'}).fill('window');
  await page.getByRole('button',{name:'View chapters'}).click();
  await expect(page.getByText('Window functions',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Planned chapter')).toBeVisible();
});

test('retains optional Statistics checks across refresh and preserves unrelated storage updates', async ({page}) => {
  await page.goto('./learn/statistics/');
  await page.getByRole('button',{name:'Probability',exact:true}).click();
  await page.getByText('About 50 on average',{exact:true}).click();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await expect(page.getByText('Correct. Expected count', {exact:false})).toBeVisible();
  await page.evaluate(key => {
    const newest = JSON.stringify({'sql-foundations':{quiz:false,code:true}});
    localStorage.setItem(key,newest);
    dispatchEvent(new StorageEvent('storage',{key,newValue:newest}));
  },storageKey);
  await page.getByRole('button',{name:'Check understanding'}).click();
  const saved = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);
  expect(saved['statistics-probability'].quiz).toBe(true);
  expect(saved['sql-foundations'].code).toBe(true);
  await page.reload();
  await page.getByRole('button',{name:'Probability',exact:true}).click();
  await expect(page.getByText('Knowledge check complete',{exact:false})).toBeVisible();
});

test('homepage defers studio code and visualization completion leads onward to ML', async ({page}) => {
  const loaded: string[] = [];
  page.on('request', request => loaded.push(new URL(request.url()).pathname));
  await page.goto('./');
  await expect(page.getByRole('heading',{name:/Make sense of real data/})).toBeVisible();
  if (process.env.DS_TEST_STATIC === '1') expect(loaded.some(url => /\/(MlStudio|SqlStudio|VisualizationLab|AnalysisStudio)-.*\.js$/.test(url))).toBe(false);
  await page.getByRole('list',{name:'Recommended learning path'}).getByRole('button',{name:/Visualization/}).click();
  await expect(page.getByRole('img',{name:'Histogram'})).toBeVisible();
  await page.getByRole('radio',{name:'A histogram with equal-width revenue bins'}).check();
  await page.getByRole('button',{name:'Check understanding'}).click();
  await expect(page.getByText('Lesson complete.',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Lesson progression'}).getByRole('button',{name:/Next: From features/}).click();
  await expect(page.getByRole('heading',{name:'Machine Learning Studio'})).toBeVisible();
});

test('representative routes fit five widths and mobile navigation supports keyboard escape', async ({page}, info) => {
  const widths = info.project.name === 'mobile' ? [320,390] : [768,1024,1440];
  for (const width of widths) {
    await page.setViewportSize({width,height:850});
    for (const [route,heading] of [
      ['./', /Make sense of real data/], ['./dashboard','My learning'], ['./roadmap','Data science roadmap'],
      ['./learn/statistics/','Statistics Learning Studio'], ['./learn/sql-foundations/','SQL Learning Studio'],
      ['./learn/pandas-quality/','Pandas Learning Studio'], ['./learn/visualization-lab/','Data Visualization Lab'],
      ['./learn/ml-knn/','Machine Learning Studio'], ['./projects/iris-classification/',/Iris Classification/],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole('heading',{name:heading,level:1})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),width+' px '+route)
        .toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
    }
  }
  if (info.project.name === 'mobile') {
    const drawer = page.getByRole('navigation',{name:'Main navigation'});
    await expect(drawer).toBeHidden();
    const menu = page.getByRole('button',{name:'Open navigation'});
    await menu.focus();
    await menu.press('Enter');
    await expect(drawer.getByRole('link',{name:'Overview'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  }
});

test('real runtimes carry a learner from Statistics into SQL without losing drafts', async ({page}) => {
  test.setTimeout(190_000);
  await page.goto('./');
  await page.getByRole('button',{name:/Statistics Learning Studio/}).click();
  await page.locator('#knowledge-check input').nth(2).check();
  await page.locator('#knowledge-check').getByRole('button',{name:'Check understanding'}).click();
  const python = page.getByRole('textbox',{name:'Python code'});
  await python.fill('from statistics import median\norders = [20,25,30,35,200]\ntypical_order = median(orders)\nprint(typical_order)');
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/^Challenge passed/})).toBeVisible({timeout:85_000});
  await expect(page.getByText('Lesson complete.',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Lesson progression'}).getByRole('button',{name:'Next: SQL Foundations'}).click();
  const sql = page.getByRole('textbox',{name:'SQL query'});
  const draft = 'SELECT name, city FROM Customers ORDER BY customer_id LIMIT 3;';
  await sql.fill(draft);
  const example = page.getByRole('button',{name:'Run example'});
  await expect(example).toBeEnabled({timeout:35_000});
  await example.click();
  await expect(page.getByRole('status').filter({hasText:/Worked example finished/})).toBeVisible();
  await expect(sql).toHaveValue(draft);
  await page.getByRole('button',{name:'Reset query'}).click();
  await expect(sql).not.toHaveValue(draft);
  await page.getByRole('button',{name:'Undo reset'}).click();
  await expect(sql).toHaveValue(draft);
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/Challenge passed/})).toBeVisible();
  await page.goto('./dashboard');
  await expect(page.getByRole('progressbar',{name:'Lessons completed'})).toHaveAttribute('value','2');
});
