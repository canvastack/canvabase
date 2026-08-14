import { createContext, useContext, type ReactNode } from 'react';
import type { Client } from '@canvabase/contracts';

const ClientContext = createContext<Client | null>(null);

export function ClientProvider({
  client,
  children,
}: {
  client: Client;
  children: ReactNode;
}): ReactNode {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useClient(): Client {
  const client = useContext(ClientContext);
  if (!client) throw new Error('Client not provided');
  return client;
}
