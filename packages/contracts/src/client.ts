import type { ConnectionApi } from './connection.js';
import type { QueryApi } from './query.js';
import type { BrowserApi } from './browser.js';
import type { DataApi } from './data.js';
import type { DesignerApi } from './designer.js';
import type { ErdApi } from './erd.js';
import type { TransferApi } from './transfer.js';
import type { Result } from './errors.js';

export interface SettingsApi {
  get(): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
}

export interface HealthApi {
  health(): Promise<{ online: boolean }>;
}

export interface EventBusApi {
  subscribe(event: string, handler: (payload: unknown) => void): () => void;
  emit(event: string, payload: unknown): void;
}

export interface WindowPopoutInput {
  type: 'query' | 'table';
  title: string;
  connectionId?: string;
  tabId?: string;
  sql?: string;
  table?: string;
}

export interface WindowApi {
  openPopout(input: WindowPopoutInput): Promise<Result<{ opened: boolean }>>;
}

export interface Client {
  connections: ConnectionApi;
  browser: BrowserApi;
  query: QueryApi;
  data: DataApi;
  designer: DesignerApi;
  erd: ErdApi;
  transfer: TransferApi;
  settings: SettingsApi;
  events: EventBusApi;
  health: HealthApi;
  window?: WindowApi;
}
