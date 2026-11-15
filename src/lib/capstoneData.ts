import {fitLine, randomSequence, regressionMetrics, splitRows} from './ml';

const products = [
  ['Notebook','Office',100], ['Desk lamp','Office',600], ['Mug','Home',180],
  ['Planter','Home',400], ['Tote bag','Accessories',320], ['Pencil','Office',40],
] as const;
const customers=['Asha','Irfan','Meera','Ravi','Zoya','Neha','Sana','Kabir'] as const;
type Purchase = {line_id:number; order_id:number; customer:string; product:string; category:string; month:string; quantity:number|null; unit_price:number|null};
const purchases:Purchase[]=Array.from({length:48},(_,i)=>{
  const [product,category,price]=products[(i+Math.floor(i/8))%products.length];
  return {line_id:i+1,order_id:101+Math.floor(i/2),customer:customers[(Math.floor(i/2)*3)%customers.length],
    product,category:i===10?'':i%7===0?' '+category.toLowerCase()+' ':category,month:'2026-0'+(1+Math.floor(i/16)),
    quantity:i===11?null:i===16?0:i===27?-1:1+(i*7)%5,unit_price:i===29?null:price};
});
const rawPurchases=[...purchases,purchases[6],purchases[19]];
export const purchaseCsv=['line_id,order_id,customer,product,category,month,quantity,unit_price',
  ...rawPurchases.map(row=>Object.values(row).join(','))].join('\n');

export function purchaseSummary(rows:Purchase[]=rawPurchases) {
  const unique=[...new Map(rows.map(row=>[JSON.stringify(row),row])).values()];
  const clean=unique.flatMap(row=>row.quantity===null||row.quantity<=0||row.unit_price===null||row.unit_price<0?[]:
    [{...row,category:row.category.trim().replace(/^./,letter=>letter.toUpperCase())||'Unknown',revenue:row.quantity*row.unit_price}]);
  const by=(column:'category'|'product'|'customer'|'month'|'order_id')=>{
    const totals=new Map<string,number>();
    for(const row of clean){const key=String(row[column]);totals.set(key,(totals.get(key)??0)+row.revenue);}
    return [...totals].sort(([a,x],[b,y])=>y-x||a.localeCompare(b));
  };
  return {rows:rows.length, duplicates:rows.length-unique.length, excluded:unique.length-clean.length, retained:clean.length,
    total:clean.reduce((sum,row)=>sum+row.revenue,0), categories:by('category'), products:by('product'),customers:by('customer'),
    months:by('month').sort(([a],[b])=>a.localeCompare(b)),orders:by('order_id')};
}

const sqlValue=(value:unknown)=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export const purchaseSeed=`CREATE TABLE PurchaseLines (line_id INTEGER, order_id INTEGER, customer TEXT, product TEXT, category TEXT, month TEXT, quantity INTEGER, unit_price INTEGER);
INSERT INTO PurchaseLines VALUES ${rawPurchases.map(row=>'('+Object.values(row).map(sqlValue).join(',')+')').join(',')};`;

export const purchaseSQL = {
  title:'SQLite purchase analysis',
  concept:'PurchaseLines contains raw transaction lines. Several rows may belong to one order.',
  analogy:'Use the price recorded on each line and group only after cleaning.',
  example:'SELECT product, COUNT(*) AS raw_lines FROM PurchaseLines GROUP BY product;',
  starter:'SELECT * FROM PurchaseLines LIMIT 10;',
  challenge:'Return two columns, normalized category and revenue in rupees. Remove exact duplicate lines, exclude missing quantity or price, nonpositive quantities and negative prices, then group. Use Unknown for blank categories. Order is flexible.',
  answer:`WITH clean AS (
    SELECT DISTINCT * FROM PurchaseLines WHERE quantity > 0 AND unit_price >= 0
  ) SELECT CASE WHEN trim(category) = '' THEN 'Unknown'
    ELSE upper(substr(trim(category),1,1)) || lower(substr(trim(category),2)) END AS category_name,
    SUM(quantity*unit_price) AS revenue FROM clean GROUP BY category_name;`,
  ordered:false, hint:'Try SELECT DISTINCT before GROUP BY. SQL NULL comparisons filter unknown quantities and prices.',
  mistake:'COUNT counts lines. SUM(quantity * unit_price) adds the recorded revenue.',
  memory:'Pehle data clean, phir totals.',
};

export const studentFeatures = {study_hours:'Weekly study hours',attendance:'Prior attendance (%)',prior_score:'Prior assessment score'};
export type StudentFeature=keyof typeof studentFeatures;
const random=randomSequence(202613);
export const studentRows=Array.from({length:96},(_,i)=>{
  const study_hours=1+Math.floor(random()*15);
  const attendance=55+Math.floor(random()*46);
  const prior_score=35+Math.floor(random()*58);
  const final_score=Math.max(0,Math.min(100,Math.round(7+1.6*study_hours+.28*attendance+.34*prior_score+(random()-.5)*28)));
  return {student_id:'S'+String(i+1).padStart(3,'0'),study_hours:i%11===0?null:study_hours,
    attendance:i%17===0?null:attendance,prior_score:i%19===0?null:prior_score,final_score,post_exam_pass:Number(final_score>=60)};
});
export const studentDefaultSeed=23;

export function studentExperiment(feature:StudentFeature, seed:number) {
  const complete=studentRows.flatMap(row=>row[feature]===null?[]:[{id:row.student_id,x:row[feature]!,y:row.final_score}]);
  const {train,test}=splitRows(complete,.25,seed);
  const fit=fitLine(train);
  if(!fit)throw new Error('The training sample needs distinct feature values.');
  const baseline=train.reduce((sum,point)=>sum+point.y,0)/train.length;
  return {train,test,fit,baseline,model:regressionMetrics(test,fit.predict),reference:regressionMetrics(test,()=>baseline),
    predictions:test.map(point=>({...point,prediction:fit.predict(point.x),error:point.y-fit.predict(point.x)})),
    excluded:studentRows.length-complete.length};
}
const defaultTest = new Set(studentExperiment('study_hours',studentDefaultSeed).test.map(row=>row.id));
export const studentCsv=['student_id,study_hours,attendance,prior_score,final_score,post_exam_pass,fixed_holdout',
  ...studentRows.map(row=>[...Object.values(row),Number(defaultTest.has(row.student_id))].join(','))].join('\n');
