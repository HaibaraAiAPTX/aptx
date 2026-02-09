<script setup lang="ts">
import { ref } from "vue";
import { RequestClient } from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";
import {
  createMutationDefinition,
  createQueryDefinition,
} from "@aptx/api-query-adapter";
import {
  createVueMutationHooks,
  createVueQueryHooks,
} from "@aptx/api-query-vue";

type User = { id: number; name: string; role: string };

const apiBaseURL = "http://localhost:3100";
const status = ref("idle");

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

const { useAptxQuery: useUsersQuery } = createVueQueryHooks(usersQueryDef);
const { useAptxMutation: useSlowMutation } = createVueMutationHooks(slowMutationDef);
const usersQuery = useUsersQuery({}, { query: { enabled: false } });
const slowMutation = useSlowMutation();

const loadUsers = async () => {
  status.value = "loading users...";
  try {
    const result = await usersQuery.refetch();
    if (result.error) throw result.error;
    status.value = "loaded";
  } catch (error) {
    status.value = String(error);
  }
};

const triggerTimeout = async () => {
  status.value = "requesting /slow with timeout=300ms ...";
  try {
    await slowMutation.mutateAsync({ ms: 1000, timeoutMs: 300 });
    status.value = "unexpected: not timed out";
  } catch (error) {
    status.value = `timeout captured: ${String(error)}`;
  }
};
</script>

<template>
  <main class="app">
    <h1>aptx Vue Sample</h1>
    <p>API: {{ apiBaseURL }}</p>
    <div class="actions">
      <button @click="loadUsers">Load Users</button>
      <button @click="triggerTimeout">Trigger Timeout</button>
    </div>
    <pre>{{ JSON.stringify(usersQuery.data?.items ?? [], null, 2) }}</pre>
    <p>{{ status }}</p>
  </main>
</template>
