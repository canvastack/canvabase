import { describe, expect, it } from 'vitest';
import {
  defaultPort,
  defaultSchemaName,
  defaultTablespace,
  defaultUsername,
  dialectTag,
  isMySqlEngine,
  isPostgresEngine,
  isSqliteEngine,
  openProcedureSql,
  openTriggerSql,
  openUserSql,
  quoteIdent,
  quoteLiteral,
  toSqlDialect,
} from './dialect.js';

describe('engine predicates', () => {
  it('detects mysql', () => {
    expect(isMySqlEngine('mysql')).toBe(true);
    expect(isMySqlEngine('postgresql')).toBe(false);
    expect(isMySqlEngine('sqlite')).toBe(false);
  });

  it('detects postgresql', () => {
    expect(isPostgresEngine('postgresql')).toBe(true);
    expect(isPostgresEngine('mysql')).toBe(false);
    expect(isPostgresEngine('sqlite')).toBe(false);
  });

  it('detects sqlite', () => {
    expect(isSqliteEngine('sqlite')).toBe(true);
    expect(isSqliteEngine('mysql')).toBe(false);
    expect(isSqliteEngine('postgresql')).toBe(false);
  });
});

describe('quoteIdent', () => {
  it('uses backticks for mysql and escapes embedded backticks', () => {
    expect(quoteIdent('mysql', 'users')).toBe('`users`');
    expect(quoteIdent('mysql', 'weird`name')).toBe('`weird``name`');
  });

  it('uses double quotes for postgresql/sqlite and escapes embedded quotes', () => {
    expect(quoteIdent('postgresql', 'users')).toBe('"users"');
    expect(quoteIdent('sqlite', 'weird"name')).toBe('"weird""name"');
  });

  it('quotes qualified names per part', () => {
    expect(quoteIdent('mysql', 'public.users')).toBe('`public`.`users`');
    expect(quoteIdent('postgresql', 'public.users')).toBe('"public"."users"');
  });
});

describe('quoteLiteral', () => {
  it('escapes single quotes and backslashes', () => {
    expect(quoteLiteral("O'Brien")).toBe("'O''Brien'");
    expect(quoteLiteral('a\\b')).toBe("'a\\\\b'");
  });
});

describe('dialectTag', () => {
  it('returns display tag per engine', () => {
    expect(dialectTag('mysql')).toBe('MYSQL');
    expect(dialectTag('postgresql')).toBe('PGSQL');
    expect(dialectTag('sqlite')).toBe('SQLITE');
  });
});

describe('dialect defaults', () => {
  it('resolves default schema names', () => {
    expect(defaultSchemaName('sqlite')).toBe('main');
    expect(defaultSchemaName('postgresql')).toBe('public');
    expect(defaultSchemaName('mysql')).toBe('dbo');
  });

  it('resolves default tablespace', () => {
    expect(defaultTablespace('postgresql')).toBe('pg_default');
    expect(defaultTablespace('mysql')).toBe('InnoDB');
    expect(defaultTablespace('sqlite')).toBe('main');
  });

  it('resolves default port', () => {
    expect(defaultPort('postgresql')).toBe(5432);
    expect(defaultPort('mysql')).toBe(3306);
  });

  it('resolves default username', () => {
    expect(defaultUsername('postgresql')).toBe('postgres');
    expect(defaultUsername('mysql')).toBe('root');
  });
});

describe('toSqlDialect', () => {
  it('maps engine names to validator dialects', () => {
    expect(toSqlDialect('mysql')).toBe('mysql');
    expect(toSqlDialect('postgresql')).toBe('postgres');
    expect(toSqlDialect('sqlite')).toBe('sqlite');
  });
});

describe('object openers', () => {
  it('builds procedure SQL per engine', () => {
    expect(openProcedureSql('mysql', 'sp_cleanup')).toBe('CALL `sp_cleanup`();');
    expect(openProcedureSql('postgresql', 'sp_cleanup')).toBe('SELECT * FROM "sp_cleanup"();');
  });

  it('builds trigger SQL per engine', () => {
    expect(openTriggerSql('mysql', 'trg_users')).toBe('SHOW CREATE TRIGGER `trg_users`;');
    expect(openTriggerSql('postgresql', 'trg_users')).toBe(
      "SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_users';",
    );
  });

  it('builds user SQL per engine', () => {
    expect(openUserSql('mysql', 'alice')).toBe("SHOW GRANTS FOR 'alice';");
    expect(openUserSql('postgresql', 'alice')).toBe("SELECT * FROM pg_catalog.pg_roles WHERE rolname = 'alice';");
  });
});
