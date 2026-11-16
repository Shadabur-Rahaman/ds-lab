import {copyFileSync, mkdirSync} from 'node:fs';

// Pages serves directory indexes for links opened directly or refreshed.
const routes = ['dashboard', 'assessments', 'projects', 'courses', 'roadmap', 'learn/introduction', 'learn/statistics', 'learn/pandas',
 'learn/sql-foundations', 'learn/sql-filtering', 'learn/sql-aggregation', 'learn/sql-joins', 'learn/sql-null',
 'learn/numpy-arrays', 'learn/numpy-slicing', 'learn/numpy-operations', 'learn/numpy-broadcasting', 'learn/numpy-axis', 'learn/numpy-aggregation',
 'learn/pandas-frames', 'learn/pandas-csv', 'learn/pandas-selection', 'learn/pandas-quality', 'learn/pandas-groupby', 'learn/pandas-merge',
 'learn/visualization-lab', 'learn/ml-intro', 'learn/ml-regression', 'learn/ml-knn', 'learn/ml-split', 'learn/ml-metrics', 'learn/ml-overfit',
 'learn/ml-tree', 'learn/ml-forest', 'learn/ml-boosting', 'learn/ml-clustering', 'learn/ml-pca',
 'learn/dl-neurons', 'learn/dl-activations', 'learn/dl-forward', 'learn/dl-descent', 'learn/dl-backprop', 'learn/dl-training',
 'projects/iris', 'projects/retail', 'projects/iris-classification', 'projects/neural-classification', 'projects/customer-purchases', 'projects/student-performance', 'projects/compare-models'];
for (const route of routes) {
 const directory = `dist/${route}`;
 mkdirSync(directory, {recursive: true});
 copyFileSync('dist/index.html', `${directory}/index.html`);
}
copyFileSync('dist/index.html', 'dist/404.html');
