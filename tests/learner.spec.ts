import {readFileSync} from 'node:fs';
import {expect,test} from './fixtures';
import {mergeProgress,parseProgress} from '../src/lib/progress';
import {mergeBackup,parseBackup,type Backup} from '../src/lib/learnerData';
import {reconcile} from '../src/lib/learnerSync';
import {lessonState} from '../src/curriculum';

const key='learning-ecosystem:ds:progress:v1';
const draftKey='learning-ecosystem:ds:draft:introduction';
const backup=(progress:Backup['progress'],drafts:Backup['drafts']={}):Backup=>({format:'ds-lab-learner-v1',progress,drafts});

test('migrates older flags and reconciles account changes without losing completion',async()=>{
  const legacy=parseProgress({statistics:{quiz:true},'dl-neurons':{code:true},pandas:null});
  const merged=mergeProgress(legacy,{statistics:{quiz:false,code:true,updatedAt:10}});
  expect(merged.statistics).toMatchObject({quiz:true,code:true,updatedAt:10});
  expect(merged['dl-neurons']?.code).toBe(true);
  expect(parseProgress('broken')).toEqual({});
  expect(lessonState(parseProgress({'iris-eda':{quiz:true,code:true}}),'iris-eda')).toBe('Completed');
  const imported=mergeProgress({'iris-eda':{quiz:false,code:false,studio:1}},{'iris-eda':{quiz:true,code:true}});
  expect(lessonState(imported,'iris-eda')).toBe('Completed');
  const project=mergeProgress({'iris-eda':{quiz:false,code:false,studio:5}},{'iris-eda':{quiz:true,code:true,studio:58}});
  expect(project['iris-eda']?.studio).toBe(63);
  expect(lessonState(project,'iris-eda')).toBe('Completed');
  expect(lessonState(parseProgress({'iris-eda':{quiz:true,code:true,studio:48}}),'iris-eda')).toBe('In progress');
  const first=backup({statistics:{quiz:true,code:false}},{[draftKey]:{text:'old',updatedAt:3}});
  let remote=backup({statistics:{quiz:false,code:true}},{[draftKey]:{text:'new',updatedAt:5}});
  expect(mergeBackup(first,remote).drafts[draftKey].text).toBe('new');
  expect(mergeBackup(remote,first).drafts).toEqual(mergeBackup(first,remote).drafts);
  let revision=1;
  const result=await reconcile({
    async read(){return {revision,payload:remote};},
    async write(expected,payload){
      expect(expected).toBe(revision);
      if(revision===1){revision++;remote=mergeBackup(remote,backup({pandas:{quiz:true,code:false}}));return false;}
      remote=payload; revision++; return true;
    },
  },()=>first);
  expect(result?.progress.statistics).toMatchObject({quiz:true,code:true});
  expect(result?.progress.pandas?.quiz).toBe(true);
  expect(result?.drafts[draftKey].text).toBe('new');
  await expect(reconcile({read:async()=>{throw Error('offline');},write:async()=>true},()=>first)).rejects.toThrow('offline');
  expect(first.progress.statistics?.quiz).toBe(true);
  expect(()=>parseBackup({...first,drafts:{'sb-token':{text:'private',updatedAt:10}}})).toThrow();
});

test('dashboard works as an offline guest and backups merge only supported learner data',async({page,context})=>{
  await page.addInitScript(({key,draftKey})=>{
    if(sessionStorage.getItem('learner-fixture'))return;
    sessionStorage.setItem('learner-fixture','1');
    localStorage.setItem(key,'bad JSON');
    localStorage.setItem(draftKey,'# previously saved draft');
    localStorage.setItem('sb-test-auth-token','do not export');
  },{key,draftKey});
  await page.goto('./dashboard/');
  await expect(page.getByRole('heading',{name:'Recently visited'})).toBeVisible();
  await expect(page.getByRole('progressbar',{name:'Lessons completed'})).toHaveAttribute('value','0');
  await context.setOffline(true);
  const control=page.getByLabel('Import progress backup');
  await control.setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('invalid')});
  await expect(page.getByText('This file is not valid JSON.')).toBeVisible();
  await control.setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup({statistics:{quiz:true,code:true,viewedAt:1}})))});
  await expect(page.getByText('Backup merged with your current progress.')).toBeVisible();
  await expect(page.getByRole('region',{name:'Learning activity'}).locator('ul a')).toHaveAttribute('href', /\/learn\/statistics$/);
  const file=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export progress backup'}).click();
  const json=readFileSync((await (await file).path())!,'utf8');
  expect(JSON.parse(json).drafts[draftKey].text).toBe('# previously saved draft');
  expect(json).not.toContain('do not export');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('progressbar',{name:'Lessons completed'})).toHaveAttribute('value','1');
  await page.getByLabel('Lesson to clear').selectOption('statistics');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Clear selected lesson checks'}).click();
  await expect(page.getByRole('progressbar',{name:'Lessons completed'})).toHaveAttribute('value','0');
  expect(await page.evaluate(key=>localStorage.getItem(key),draftKey)).toBe('# previously saved draft');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
});

test('Iris EDA Studio grades Python and saves the completed portfolio',async({page})=>{
  test.setTimeout(150_000);
  await page.goto('./projects/iris/');
  await page.getByLabel('Workspace mode').selectOption('independent');
  await expect(page.getByText('Need a hint?',{exact:false})).toHaveCount(0);
  await page.getByLabel('What is the grouping variable?').selectOption({label:'Species'});
  await page.getByRole('button',{name:'Check project framing'}).click();
  await page.getByLabel('Profile column').selectOption({label:'species'});
  await page.getByRole('button',{name:'Compute column profile'}).click();
  await expect(page.getByText(/150 rows · 0 missing · 3 distinct/)).toBeVisible();
  await page.getByRole('button',{name:'Lock cutoff and test'}).click();
  await page.getByRole('radio',{name:'setosa',exact:true}).check();
  await page.getByRole('button',{name:'Check interpretation'}).click();
  await page.getByPlaceholder(/Cite a mean/).fill('Setosa has a shorter petal range in this dataset.');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export report',exact:true}).click();
  await download;
  await expect(page.getByText('5 of 6 milestones verified.')).toBeVisible();
  const editor=page.getByRole('textbox',{name:'Python code'});
  await page.reload();
  await expect(page.getByLabel('Workspace mode')).toHaveValue('independent');
  const starter=await editor.inputValue();
  await editor.fill(starter+'\nmeans = {}');
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/Not quite yet/})).toBeVisible({timeout:100_000});
  await editor.fill(starter+`
groups = {}
for row in rows:
    groups.setdefault(row["species"], []).append(float(row["petal_length"]))
means = {name: sum(values) / len(values) for name, values in groups.items()}
print(means)
`);
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByText('All six Project Studio milestones complete.')).toBeVisible({timeout:25_000});
  await page.goto('./projects/');
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Iris exploratory data analysis'})});
  await expect(card.getByText('Completed',{exact:true})).toBeVisible();
  await card.getByText('Saved notes',{exact:true}).click();
  await expect(card.getByText('Setosa has a shorter petal range in this dataset.')).toBeVisible();
  const portfolioDownload=page.waitForEvent('download');
  await card.getByRole('button',{name:'Export portfolio JSON'}).click();
  const data=JSON.parse(readFileSync((await (await portfolioDownload).path())!,'utf8'));
  expect(data.milestones).toHaveLength(6);
  expect(data.report).toContain('Held-out errors: 0 false positives and 0 false negatives on 30 rows.');
  await card.getByRole('link',{name:'Resume project'}).click();
  await expect(page).toHaveURL(/projects\/iris/);
});
