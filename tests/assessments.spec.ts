import {test,expect} from './fixtures';
import {assessmentCourses,assessmentItems} from '../src/assessmentCatalog';
import {parseAttempts,missedItems,scoreAttempt,submitAnswer,topicPerformance,type Attempt} from '../src/lib/assessmentProgress';

test('assessment bank and score protect answer history and count unique skills',()=>{
  const ids=assessmentItems.map(item=>item.id);
  expect(new Set(ids).size).toBe(ids.length);
  for(const course of assessmentCourses){
    const items=assessmentItems.filter(item=>item.course===course);
    expect(items.some(item=>item.kind==='choice')).toBe(true);
    expect(items.some(item=>item.kind!=='choice')).toBe(true);
    for(const item of items)if(item.kind==='choice')expect(item.options[item.answer]).toBeDefined();
  }
  const median=assessmentItems.find(item=>item.id==='s-median')!;
  const initial:Attempt={id:'first',mode:'course',items:[median.id],answers:{},position:0,updated:0};
  const wrong=submitAnswer(initial,median,{correct:false,option:0});
  expect(scoreAttempt(wrong)).toEqual({answered:1,correct:0,total:1,complete:true});
  expect(missedItems(wrong)).toEqual(['s-median']);
  expect(submitAnswer(wrong,median,{correct:true,option:1})).toBe(wrong);
  const solved=submitAnswer({...initial,id:'retry',mode:'practice'},median,{correct:true,option:1});
  expect(topicPerformance('Statistics',[solved,wrong]).find(item=>item.topic==='Center and spread')).toMatchObject({answered:1,correct:1});
  expect(parseAttempts('{broken','Statistics')).toEqual([]);
  expect(parseAttempts(JSON.stringify([{...wrong,items:['s-median','m-mae','s-median'],answers:{'s-median':{correct:true,option:0}}}]),'Statistics')[0])
    .toMatchObject({items:['s-median'],answers:{'s-median':{correct:false}}});
});
test('topic practice explains mistakes, survives reload and retries missed items',async({page})=>{
  await page.goto('./assessments/?course=Statistics&topic=Probability');
  await page.getByRole('button',{name:'Start practice (1)'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Resume attempt'}).click();
  await page.getByRole('radio',{name:'1/4',exact:true}).check();
  await page.getByRole('button',{name:'Submit answer',exact:true}).click();
  await expect(page.getByText('HT and TH are two of the four equally likely outcomes.')).toBeVisible();
  await page.getByRole('button',{name:'Retry missed questions'}).click();
  await page.getByRole('radio',{name:'1/2',exact:true}).check();
  await page.getByRole('button',{name:'Submit answer',exact:true}).click();
  await expect(page.getByText('Assessment complete · 1/1 answered · 1 correct')).toBeVisible();
  await page.goto('./dashboard/');
  await expect(page.getByRole('heading',{name:'Assessment performance'})).toBeVisible();
  await expect(page.getByText('Statistics · Probability',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
});
test('course assessment requires a graded Python submission and records completion',async({page})=>{
  test.setTimeout(140_000);
  await page.goto('./assessments/?course=Foundations');
  await page.getByRole('button',{name:'Start course assessment (3)'}).click();
  await page.getByRole('radio',{name:'Selection bias',exact:true}).check();
  await page.getByRole('button',{name:'Submit answer',exact:true}).click();
  await page.getByRole('button',{name:'Next question'}).click();
  await page.getByRole('radio',{name:'Zero counts as an observed instant delivery',exact:true}).check();
  await page.getByRole('button',{name:'Submit answer',exact:true}).click();
  await page.getByRole('button',{name:'Next question'}).click();
  await page.getByRole('textbox',{name:'Python code'}).fill(`def count_labels(labels):
    counts = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return counts
print(count_labels(["a","b","a"]))
`);
  await page.getByRole('button',{name:'Run code',exact:true}).click();
  await expect(page.getByLabel('Python output')).toContainText("'a': 2",{timeout:90_000});
  await expect(page.getByText('2/3 answered · 2 correct',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Submit Python solution'}).click();
  await expect(page.getByText('Assessment complete · 3/3 answered · 3 correct')).toBeVisible({timeout:20_000});
  await page.reload();
  await page.getByRole('button',{name:'Review attempt'}).click();
  await expect(page.getByText('Assessment complete · 3/3 answered · 3 correct')).toBeVisible();
});
test('SQL assessment accepts an equivalent join solution',async({page})=>{
  await page.goto('./assessments/?course=SQL&topic=Joins%20and%20subqueries');
  await page.getByRole('button',{name:'Start practice (2)'}).click();
  await page.getByRole('textbox',{name:'SQL query'}).fill('SELECT c.name, (SELECT COUNT(*) FROM Orders o WHERE o.customer_id = c.customer_id) FROM Customers c ORDER BY c.name DESC');
  await page.getByRole('button',{name:'Submit SQL solution'}).click({timeout:35000});
  await expect(page.getByText('1/2 answered · 1 correct',{exact:true})).toBeVisible({timeout:35000});
  await expect(page.getByText(/LEFT JOIN preserves unmatched/)).toBeVisible();
});
