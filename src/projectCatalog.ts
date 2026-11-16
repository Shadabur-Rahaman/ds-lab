export const projectCatalog = {
  'iris-eda': {
    level: 'Beginner', minutes: 30, skills: ['Python', 'Descriptive statistics', 'Visual interpretation'],
    problem: 'Which flower measurements separate the three Iris species in this sample?',
    dataset: 'Fisher’s Iris dataset via UCI, CC BY 4.0. It contains 150 flowers, four measurements in centimetres and three species.',
    prerequisite: 'CSV files, group means and ranges',
    goal: 'Compare measurements by species and explain where a simple cutoff breaks down.',
    analysis: 'Lock a petal-length cutoff and inspect its held-out errors.',
    limitation: 'This small, balanced teaching dataset represents three species. The full-sample plot includes the held-out rows.',
    outcome: 'Compare distributions and separate descriptive exploration from model evaluation.',
    question: 'What is the grouping variable?', options: ['Species', 'Petal length'], answer: 0,
  },
  'retail-project': {
    level: 'Beginner', minutes: 40, skills: ['Python', 'Data cleaning', 'Aggregation', 'Visualization'],
    problem: 'How do duplicate, incomplete and inconsistent orders affect revenue summaries?',
    dataset: 'Synthetic shop orders from January to March 2026, with quantities, categories and unit prices in rupees.',
    prerequisite: 'CSV files, filtering and missing values',
    goal: 'Audit the ledger, reproduce cleaning in Python and report revenue only for valid retained orders.',
    analysis: 'Change the chart or its outlier filter and inspect the cleaned observations.',
    limitation: 'The sample is synthetic. Excluded orders have unknown revenue, and no market or business inference follows from this sample.',
    outcome: 'Explain how deduplication, exclusion and label normalization affect an aggregate.',
    question: 'What does each raw record represent?', options: ['An order', 'A monthly total'], answer: 0,
  },
  'iris-classification': {
    level: 'Intermediate', minutes: 45, skills: ['Python', 'kNN', 'Reproducibility', 'Model evaluation'],
    problem: 'How accurately can selected measurements predict Iris species on held-out rows?',
    dataset: 'Fisher’s Iris dataset via UCI, CC BY 4.0. There are 50 observations in each of three species.',
    prerequisite: 'Train/test splits, distance and classification accuracy',
    goal: 'Choose features, fit a classifier with a reproducible split and explain its errors.',
    analysis: 'Train the classifier and compare the confusion matrix with the held-out score.',
    limitation: 'A single split gives one performance estimate. Tuning on it requires a fresh final test set.',
    outcome: 'Explain how feature selection and test-set design affect a classifier’s reported results.',
    question: 'What does the classifier predict by default?', options: ['Sepal length', 'Species'], answer: 1,
  },
  'neural-classification': {
    level: 'Intermediate', minutes: 50, skills: ['Python', 'Neural networks', 'Learning curves', 'Error analysis'],
    problem: 'Can a small neural network learn the nonlinear boundary in synthetic two-feature data?',
    dataset: 'A reproducibly generated 100-point synthetic baseline for the code exercise. The experiment has adjustable seed and label noise.',
    prerequisite: 'Binary classification, loss and gradient descent',
    goal: 'Train a network, compare losses and identify held-out mistakes and model limits.',
    analysis: 'Complete a training run and compare the held-out mistakes with the loss curves.',
    limitation: 'The data and noise mechanism are synthetic. Repeatedly tuning on held-out results biases that estimate.',
    outcome: 'Connect learning rate, model complexity and generalization to observed behavior.',
    question: 'What does the model predict?', options: ['A binary class', 'The learning rate'], answer: 0,
  },
  'customer-purchases': {
    level:'Intermediate',minutes:55,skills:['SQLite','Pandas','Data cleaning','Revenue analysis'],
    problem:'Which categories, products and customers account for recorded shop revenue?',
    dataset:'Synthetic January–March 2026 purchase ledger. Each row is a line item with an order, customer, product, quantity and unit price in rupees.',
    prerequisite:'SQL GROUP BY, Pandas and missing values',
    goal:'Clean the same purchase data in SQLite and Pandas, then explain where the observed revenue comes from.',
    analysis:'Compute the purchase summary and compare category, customer and order views.',
    limitation:'Synthetic records and excluded lines limit interpretation. Recorded revenue measures neither profit nor future demand.',
    outcome:'Reconcile two independent analytical approaches and explain missing-data decisions.',
    question:'Which value belongs in the revenue formula?',options:['The price recorded on each purchase line','The number of unique customers'],answer:0,
  },
  'student-performance': {
    level:'Intermediate',minutes:55,skills:['Python','Data preparation','Linear regression','Error analysis'],
    problem:'How does one pre-exam feature compare with a mean baseline for predicting a synthetic final score?',
    dataset:'96 generated records with study hours, prior attendance, prior assessment score, final score and a post-exam pass indicator.',
    prerequisite:'Train/test splitting, averages and regression errors',
    goal:'Profile features, exclude leakage, fit a line on training observations and compare held-out predictions.',
    analysis:'Fit and evaluate a reproducible split, then inspect mismatches between predicted and actual scores.',
    limitation:'The dataset is synthetic. Its associations do not establish relationships in real students or support educational decisions.',
    outcome:'Explain missing cases, data leakage and whether a model beats a baseline on the same test split.',
    question:'Which variable is unavailable before the exam?',options:['Weekly study hours','Post-exam pass indicator'],answer:1,
  },
  'compare-models': {
    level:'Intermediate',minutes:55,skills:['Decision trees','Random forests','Validation','Error analysis'],
    problem:'How well do a decision tree and a random forest predict Iris species compared with a majority-class baseline?',
    dataset:'UCI Iris, CC BY 4.0. The exercise CSV has 90 training observations. The workbench uses 30 separate validation and 30 separate test observations.',
    prerequisite:'Classification and train/validation/test splitting',
    goal:'Tune the models on validation data, lock a choice, then explain errors from an untouched test split.',
    analysis:'Compare a few validation settings before locking one choice and evaluating on the test split.',
    limitation:'One small, balanced dataset and one fixed split cannot establish the best algorithm for other data.',
    outcome:'Compare all three models under the same evaluation protocol and explain at least one model trade-off.',
    question:'Which split is used to select hyperparameters?',options:['Validation','Held-out test'],answer:0,
  },
} as const;

export type ProjectId = keyof typeof projectCatalog;
export const projectSteps = [
  ['Understand', 'Answer the framing check.'],
  ['Explore', 'Compute a profile for a dataset column.'],
  ['Implement', 'Pass the Python result checks.'],
  ['Analyze', 'Produce a result using the interactive workbench.'],
  ['Evaluate', 'Pass the project interpretation check.'],
  ['Present', 'Write findings and generate a report.'],
] as const;
export const projectBits = {understand:1, explore:2, implement:4, analyze:8, evaluate:16, present:32};
export const allProjectBits = Object.values(projectBits).reduce((total, bit) => total | bit, 0);
export const legacyProjectBit = 64;
export const purchaseSqlBit=128;
export const purchasePythonBit=256;
export const isNewCapstone=(id:string)=>id==='customer-purchases'||id==='student-performance'||id==='compare-models';
export function normalizeProjectStudio(id:string,bits:number) {
  const studio=isNewCapstone(id)?bits&~legacyProjectBit:bits;
  if(id!=='customer-purchases')return studio;
  const evidence=purchaseSqlBit|purchasePythonBit;
  return (studio & ~projectBits.implement) | ((studio&evidence)===evidence ? projectBits.implement : 0);
}
export const isProject = (id:string):id is ProjectId => Object.hasOwn(projectCatalog,id);
export const projectDraftId = (id:ProjectId) => id+'-studio';
export const projectReportKey = (id:ProjectId) => 'ds-lab:project-report:'+id;
export const projectModeKey = (id:ProjectId) => 'ds-lab:project-mode:'+id;

export type ProjectActions = {onAnalyze:()=>void; onExport:(markdown:string)=>void};
