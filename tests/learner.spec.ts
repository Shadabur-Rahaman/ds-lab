import {readFileSync} from 'node:fs';
import {expect,test} from './fixtures';
import {mergeProgress,parseProgress} from '../src/lib/progress';
import {mergeBackup,parseBackup,type Backup} from '../src/lib/learnerData';
import {reconcile} from '../src/lib/learnerSync';

const key='learning-ecosystem:ds:progress:v1';
const draftKey='learning-ecosystem:ds:draft:introduction';
const backup=(progress:Backup['progress'],drafts:Backup['drafts']={}):Backup=>({format:'ds-lab-learner-v1',progress,drafts});

test('migrates older flags and reconciles account changes without losing completion',async()=>{
  const legacy=parseProgress({statistics:{quiz:true},'dl-neurons':{code:true},pandas:null});
  const merged=mergeProgress(legacy,{statistics:{quiz:false,code:true,updatedAt:10}});
  expect(merged.statistics).toMatchObject({quiz:true,code:true,updatedAt:10});
  expect(merged['dl-neurons']?.code).toBe(true);
  expect(parseProgress('broken')).toEqual({});
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

test('Iris EDA portfolio records a visit, interpretation, report and saved notes',async({page})=>{
  await page.goto('./projects/iris/');
  await page.getByRole('radio',{name:'setosa',exact:true}).check();
  await page.getByRole('button',{name:'Check interpretation'}).click();
  await page.getByPlaceholder(/Cite a mean/).fill('Setosa has a shorter petal range in this dataset.');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export report',exact:true}).click();
  await download;
  await page.goto('./projects/');
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Iris exploratory data analysis'})});
  await expect(card.getByText('Completed',{exact:true})).toBeVisible();
  await card.getByText('Saved notes',{exact:true}).click();
  await expect(card.getByText('Setosa has a shorter petal range in this dataset.')).toBeVisible();
  await card.getByRole('link',{name:'Resume project'}).click();
  await expect(page).toHaveURL(/projects\/iris/);
});
