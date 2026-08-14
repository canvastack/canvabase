import { PostgreSQLAdapter } from '@canvabase/dialects';
import { dialectContractSuite, type ContractSQL } from './contract-suite.js';

const E2E_POSTGRES_URL = process.env.CANVABASE_E2E_POSTGRES ?? '';
const enabled = E2E_POSTGRES_URL.length > 0;
const url = enabled ? new URL(E2E_POSTGRES_URL) : null;

const sql: ContractSQL = {
  selectValue: 'SELECT 1 AS value',
  parameterizedWhere: 'SELECT * FROM users WHERE name = $1',
  injectionValue: "'; DROP TABLE users; --",
  sleepSQL: 'SELECT pg_sleep(10)',
  resetUsers: 'DROP TABLE IF EXISTS users',
  createUsers: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL
    )
  `,
  insertUsers: [
    "INSERT INTO users (name) VALUES ('alice')",
    "INSERT INTO users (name) VALUES ('bob')",
  ],
  selectUsers: 'SELECT * FROM users',
  dmlInsert: 'INSERT INTO users (name) VALUES ($1)',
  dmlUpdate: 'UPDATE users SET name = $1 WHERE id = $2',
  dmlDelete: 'DELETE FROM users WHERE id = $1',
};

dialectContractSuite(new PostgreSQLAdapter(), {
  enabled,
  connection: {
    host: url?.hostname ?? '127.0.0.1',
    port: url ? Number(url.port) || 5432 : 5432,
    database: url ? url.pathname.replace(/^\//, '') : 'canvabase_test',
    ...(url?.username ? { username: url.username } : {}),
    ...(url?.password ? { password: decodeURIComponent(url.password) } : {}),
  },
  sql,
});
