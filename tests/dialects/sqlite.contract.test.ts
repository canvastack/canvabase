import { SQLiteAdapter } from '@canvabase/dialects';
import { dialectContractSuite, type ContractSQL } from './contract-suite.js';

const sql: ContractSQL = {
  selectValue: 'SELECT 1 AS value',
  parameterizedWhere: 'SELECT * FROM users WHERE name = ?',
  injectionValue: "'; DROP TABLE users; --",
  sleepSQL: null,
  createUsers: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `,
  insertUsers: [
    "INSERT INTO users (name) VALUES ('alice')",
    "INSERT INTO users (name) VALUES ('bob')",
  ],
  selectUsers: 'SELECT * FROM users',
  dmlInsert: 'INSERT INTO users (name) VALUES (?)',
  dmlUpdate: 'UPDATE users SET name = ? WHERE id = ?',
  dmlDelete: 'DELETE FROM users WHERE id = ?',
};

dialectContractSuite(new SQLiteAdapter(), {
  enabled: true,
  connection: {
    host: 'localhost',
    port: 0,
    database: ':memory:',
  },
  sql,
});
