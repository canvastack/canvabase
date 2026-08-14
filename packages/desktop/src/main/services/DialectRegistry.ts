import { MySQLAdapter, PostgreSQLAdapter, SQLiteAdapter } from '@canvabase/dialects';
import type { DialectPort } from '@canvabase/dialects';
import type { Engine } from '@canvabase/contracts';

export class DialectRegistry {
  private readonly factories = new Map<Engine, () => DialectPort>();

  register(engine: Engine, factory: () => DialectPort): void {
    this.factories.set(engine, factory);
  }

  create(engine: Engine): DialectPort {
    const factory = this.factories.get(engine);
    if (!factory) {
      throw new Error(`unsupported engine: ${engine}`);
    }
    return factory();
  }
}

export function createBuiltinRegistry(): DialectRegistry {
  const registry = new DialectRegistry();
  registry.register('mysql', () => new MySQLAdapter());
  registry.register('postgresql', () => new PostgreSQLAdapter());
  registry.register('sqlite', () => new SQLiteAdapter());
  return registry;
}
