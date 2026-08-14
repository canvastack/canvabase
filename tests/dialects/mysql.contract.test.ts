import { MySQLAdapter } from '@canvabase/dialects';
import { dialectContractSuite, type ContractSQL } from './contract-suite.js';

const E2E_MYSQL_URL = process.env.CANVABASE_E2E_MYSQL ?? '';
const enabled = E2E_MYSQL_URL.length > 0;
const url = enabled ? new URL(E2E_MYSQL_URL) : null;

const sql: ContractSQL = {
  selectValue: 'SELECT 1 AS value',
  parameterizedWhere: 'SELECT * FROM users WHERE name = ?',
  injectionValue: "'; DROP TABLE users; --",
  sleepSQL: 'SELECT SLEEP(10)',
  resetUsers: 'DROP TABLE IF EXISTS users',
  createUsers: `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL
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

dialectContractSuite(new MySQLAdapter(), {
  enabled,
  connection: {
    host: url?.hostname ?? '127.0.0.1',
    port: url ? Number(url.port) || 3306 : 3306,
    database: url ? url.pathname.replace(/^\//, '') : 'canvabase_test',
    ...(url?.username ? { username: url.username } : {}),
    ...(url?.password ? { password: decodeURIComponent(url.password) } : {}),
  },
  sql,
});
