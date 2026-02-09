import { useState } from "react";
import { RequestClient } from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";
import {
  createMutationDefinition,
  createQueryDefinition,
} from "@aptx/api-query-adapter";
import {
  createReactMutationHooks,
  createReactQueryHooks,
} from "@aptx/api-query-react";

type User = { id: number; name: string; role: string };

const apiBaseURL = "http://localhost:3100";
const api = createAptxCoreApiClient(new RequestClient({ baseURL: apiBaseURL, timeout: 5000 }));

const usersQueryDef = createQueryDefinition({
  keyPrefix: ["sample", "users"] as const,
  buildSpec: () => ({
    method: "GET" as const,
    path: "/users",
  }),
  execute: (spec, options) => api.execute<{ items: User[] }>(spec, options),
});

const slowMutationDef = createMutationDefinition({
  buildSpec: (input: { ms: number; timeoutMs: number }) => ({
    method: "GET" as const,
    path: "/slow",
    query: { ms: input.ms },
  }),
  getRequestOptions: (input) => ({ timeout: input.timeoutMs }),
  execute: (spec, options) => api.execute<{ ok: boolean }>(spec, options),
});

const { useAptxQuery: useUsersQuery } = createReactQueryHooks(usersQueryDef);
const { useAptxMutation: useSlowMutation } = createReactMutationHooks(slowMutationDef);

export function App() {
  const [status, setStatus] = useState("idle");
  const usersQuery = useUsersQuery(
    {},
    {
      query: {
        enabled: false,
      },
    }
  );
  const slowMutation = useSlowMutation();

  const loadUsers = async () => {
    setStatus("loading users...");
    try {
      const result = await usersQuery.refetch();
      if (result.error) throw result.error;
      setStatus("loaded");
    } catch (error) {
      setStatus(String(error));
    }
  };

  const triggerTimeout = async () => {
    setStatus("requesting /slow with timeout=300ms ...");
    try {
      await slowMutation.mutateAsync({ ms: 1000, timeoutMs: 300 });
      setStatus("unexpected: not timed out");
    } catch (error) {
      setStatus(`timeout captured: ${String(error)}`);
    }
  };

  return (
    <main className="app">
      <h1>aptx React Sample</h1>
      <p>API: {apiBaseURL}</p>
      <div className="actions">
        <button onClick={loadUsers}>Load Users</button>
        <button onClick={triggerTimeout}>Trigger Timeout</button>
      </div>
      <pre>{JSON.stringify(usersQuery.data?.items ?? [], null, 2)}</pre>
      <p>{status}</p>
    </main>
  );
}
