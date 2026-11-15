import iris from '../public/datasets/iris.csv?raw';
import retail from '../public/datasets/retail-sales.csv?raw';
import {neuralDataset} from './lib/neural';
import {purchaseCsv,purchaseSummary,studentCsv,studentExperiment,studentDefaultSeed} from './lib/capstoneData';
import type {ProjectId} from './projectCatalog';

const neural = ['x1,x2,label', ...neuralDataset(17,.3,0).rows.map(row=>[...row.x,row.y].join(','))].join('\n');
const irisFile = {name:'iris.csv',csv:iris};
const retailFile = {name:'retail-sales.csv',csv:retail};
const neuralFile = {name:'neural-baseline.csv',csv:neural};
const starter = (name:string) => `import csv
with open("${name}", newline="") as file:
    rows = list(csv.DictReader(file))

# Build your result from rows.
`;
const purchaseExpected=purchaseSummary();
const studentExpected=studentExperiment('study_hours',studentDefaultSeed);
export const projectExercises = {
  'customer-purchases': {
    file:{name:'customer-purchases.csv',csv:purchaseCsv},
    starter:`import pandas as pd
lines = pd.read_csv("customer-purchases.csv")
print(lines.head())
# Clean the rows and calculate your revenue_by_category.
`,
    challenge:'Using Pandas, produce revenue_by_category (a Series or dictionary), total_revenue and retained_count from clean rows. Drop exact duplicates, exclude missing or nonpositive quantity and missing or negative price, and normalize category case and whitespace. Use Unknown for blank categories.',
    hint:'Try drop_duplicates(), dropna() on the numeric columns, str.strip().str.title() and groupby() on a computed line revenue.',
    tests:`from math import isclose as _close
_got = dict(revenue_by_category)
_expected = ${JSON.stringify(Object.fromEntries(purchaseExpected.categories))}
assert retained_count == ${purchaseExpected.retained}, "Check the retained row count after cleaning."
assert set(_got) == set(_expected), "Check category spelling and missing labels."
assert all(_close(_got[k],v,abs_tol=0.001) for k,v in _expected.items()), "Check the grouped amounts."
assert _close(total_revenue,${purchaseExpected.total},abs_tol=0.001), "Check the grand total."`,
  },
  'student-performance': {
    file:{name:'student-performance.csv',csv:studentCsv},
    starter:starter('student-performance.csv'),
    challenge:'Use study_hours only. Drop rows missing that feature, use fixed_holdout=0 for fitting and fixed_holdout=1 for evaluation. Fit least squares on the training rows, then set mae and rmse to held-out errors and baseline_mae to the held-out MAE from the training mean.',
    hint:'For the line, divide sum((x−mean_x)(y−mean_y)) by sum((x−mean_x)²). The intercept is mean_y minus slope times mean_x. Compute the baseline from those same training targets.',
    tests:`from math import isclose as _close
assert _close(mae,${studentExpected.model.mae},abs_tol=0.001), "Check model MAE on the held-out rows."
assert _close(rmse,${Math.sqrt(studentExpected.model.mse!)},abs_tol=0.001), "Check the held-out RMSE."
assert _close(baseline_mae,${studentExpected.reference.mae},abs_tol=0.001), "Predict the training target mean for each held-out row."`,
  },
  'iris-eda': {
    file:irisFile, starter:starter(irisFile.name),
    challenge:'Create means, a dictionary mapping each Iris species to its mean petal length in centimetres.',
    hint:'Group float(row["petal_length"]) values by row["species"], then divide each group sum by its size.',
    tests:`import csv as _csv
from math import isclose as _close
with open("iris.csv") as _file:
    _rows = list(_csv.DictReader(_file))
_expected = {}
for _label in {row["species"] for row in _rows}:
    _values = [float(row["petal_length"]) for row in _rows if row["species"] == _label]
    _expected[_label] = sum(_values) / len(_values)
assert set(means) == set(_expected), "Include every species."
assert all(_close(means[k], v, abs_tol=0.0001) for k, v in _expected.items()), "Check the group means before rounding."`,
  },
  'retail-project': {
    file:retailFile, starter:starter(retailFile.name),
    challenge:'Create totals, a dictionary of revenue in rupees by normalized category. Drop exact duplicate rows and exclude rows with missing units or price or nonpositive units. Use Unknown for blank categories.',
    hint:'Use a set of row tuples to skip duplicates. After checking missing values, multiply numeric quantity by numeric price. Strip category whitespace before applying title case.',
    tests:`import csv as _csv
from math import isclose as _close
with open("retail-sales.csv") as _file:
    _rows = list(_csv.DictReader(_file))
_expected = {}
for _id, _date, _cat, _units, _price in {tuple(row.values()) for row in _rows}:
    if _units and _price and float(_units) > 0:
        _label = _cat.strip().title() or "Unknown"
        _expected[_label] = _expected.get(_label, 0) + float(_units) * float(_price)
assert set(totals) == set(_expected), "Check your normalized categories."
assert all(_close(totals[k], v, abs_tol=0.001) for k, v in _expected.items()), "Check duplicate and missing-value handling before aggregating."`,
  },
  'iris-classification': {
    file:irisFile, starter:starter(irisFile.name),
    challenge:'Build a one-feature nearest-centroid baseline. Take every fifth row within each species as held-out (starting at index 0). Set accuracy to the held-out fraction correct using the nearest training mean of petal_length.',
    hint:'Group rows by species before splitting. Fit one mean on the remaining rows per group, then predict using the smallest absolute distance to those means.',
    tests:`import csv as _csv
from math import isclose as _close
with open("iris.csv") as _file:
    _iris = list(_csv.DictReader(_file))
_groups = {k: [float(r["petal_length"]) for r in _iris if r["species"] == k] for k in {r["species"] for r in _iris}}
_fit = {k: [x for i,x in enumerate(xs) if i % 5] for k,xs in _groups.items()}
_centers = {k: sum(xs)/len(xs) for k,xs in _fit.items()}
_hold = [(k,x) for k,xs in _groups.items() for x in xs[::5]]
_expected = sum(min(_centers,key=lambda k: abs(_centers[k]-x)) == y for y,x in _hold)/len(_hold)
assert _close(accuracy, _expected, abs_tol=0.0001), "Use held-out predictions and report a fraction, not a percentage."`,
  },
  'neural-classification': {
    file:neuralFile, starter:starter(neuralFile.name),
    challenge:'Set baseline_bce to the mean binary cross-entropy of a fixed single neuron on the supplied baseline CSV. Use z = x1 − x2, probability sigmoid(z), and natural logarithms.',
    hint:'Compute p = 1 / (1 + exp(-z)), then −log(p) for label 1 or −log(1−p) for label 0. Average the losses.',
    tests:`import csv as _csv
import math as _m
with open("neural-baseline.csv") as _file:
    _rows = list(_csv.DictReader(_file))
_loss = [ _m.log1p(_m.exp((1-2*int(r["label"]))*(float(r["x1"])-float(r["x2"])))) for r in _rows ]
assert _m.isclose(baseline_bce, sum(_loss)/len(_loss), abs_tol=0.0001), "Check the sigmoid, label-specific logarithm and average."`,
  },
} satisfies Record<ProjectId,{file:{name:string;csv:string};starter:string;challenge:string;hint:string;tests:string}>;

export function datasetProfile(csv:string, column:number) {
  const [header,...data]=csv.trimEnd().split(/\r?\n/);
  const columns=header.split(',');
  if (!columns[column]) return null;
  const values=data.map(line=>line.split(',')[column]?.trim()??'');
  const present=values.filter(Boolean);
  return { column:columns[column], rows:values.length, missing:values.length-present.length, distinct:new Set(present).size };
}
