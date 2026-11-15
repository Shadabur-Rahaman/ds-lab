const distributions = [
  'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/',
];
let engine;
let database;

async function loadEngine() {
  for (const distribution of distributions) {
    try {
      importScripts(distribution + 'sql-wasm.js');
      return await self.initSqlJs({locateFile: file => distribution + file});
    } catch (error) {
      console.warn('Could not load SQLite from ' + distribution, error);
    }
  }
  throw new Error('No SQLite distribution could be loaded.');
}

const seed = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE Customers (customer_id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT, email TEXT);
  CREATE TABLE Products (product_id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL);
  CREATE TABLE Orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES Customers, ordered_on TEXT NOT NULL);
  CREATE TABLE OrderItems (order_id INTEGER REFERENCES Orders, product_id INTEGER REFERENCES Products,
    quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price INTEGER NOT NULL, PRIMARY KEY (order_id, product_id));
  INSERT INTO Customers VALUES
    (1,'Asha Rao','Shivamogga','asha@example.test'), (2,'Irfan Khan','Mysuru',NULL),
    (3,'Meera Das','Bengaluru','meera@example.test'), (4,'Ravi Nair','Mysuru','ravi@example.test'),
    (5,'Zoya Ali',NULL,NULL), (6,'Neha Sen','Mangaluru','neha@example.test');
  INSERT INTO Products VALUES
    (1,'Notebook','Office',100), (2,'Desk lamp','Office',650), (3,'Mug','Home',180),
    (4,'Planter','Home',400), (5,'Tea infuser','Home',180), (6,'Tote bag','Accessories',320),
    (7,'Pencil','Office',40);
  INSERT INTO Orders VALUES (101,1,'2026-01-12'), (102,2,'2026-01-19'), (103,1,'2026-02-02'),
    (104,3,'2026-02-07'), (105,4,'2026-02-15'), (106,3,'2026-03-01');
  INSERT INTO OrderItems VALUES (101,1,3,100), (101,3,1,180), (102,2,1,600), (102,7,4,40),
    (103,4,2,400), (104,5,2,180), (104,6,1,320), (105,3,3,175), (106,1,2,100);
`;

function createDatabase() {
  const db = new engine.Database();
  db.run(seed);
  return db;
}

function execute(db, query) {
  let result;
  for (const statement of db.iterateStatements(query)) {
    const columns = statement.getColumnNames();
    const rows = [];
    let truncated = false;
    while (statement.step()) {
      if (rows.length < 250) rows.push(statement.get());
      else truncated = true;
    }
    result = {columns, rows, truncated};
  }
  if (!result) throw new Error('Enter a SQL statement to run.');
  return result;
}

function matches(actual, expected, ordered) {
  if (actual.truncated || actual.columns.length !== expected.columns.length || actual.rows.length !== expected.rows.length) return false;
  const sameRow = (a, b) => a.every((value, index) => typeof value === 'number' && typeof b[index] === 'number'
    ? Math.abs(value - b[index]) <= 1e-8 : value === b[index]);
  if (ordered) return actual.rows.every((row, index) => sameRow(row, expected.rows[index]));
  const unmatched = [...expected.rows];
  return actual.rows.every(row => {
    const index = unmatched.findIndex(other => sameRow(row, other));
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  });
}

self.onmessage = async ({data}) => {
  const {id, action, query, answer, ordered} = data;
  try {
    engine ??= await loadEngine();
    database ??= createDatabase();
    let result;
    let expected;
    let passed;
    if (action === 'reset') {
      database.close();
      database = createDatabase();
    } else if (action === 'check' || action === 'expected') {
      const grading = createDatabase();
      try {
        grading.run('PRAGMA query_only = ON');
        expected = execute(grading, answer);
        if (action === 'check') {
          result = execute(grading, query);
          passed = matches(result, expected, ordered);
        }
      } finally {
        grading.close();
      }
    } else if (action === 'run') {
      result = execute(database, query);
    }
    self.postMessage({id, result, expected, passed});
  } catch (error) {
    self.postMessage({id, error: engine ? error.message : 'SQLite could not load. Check your connection and try again.'});
  }
};
