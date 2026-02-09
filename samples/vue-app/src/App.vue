<script setup lang="ts">
import { ref } from "vue";
import { RequestClient } from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";

type User = { id: number; name: string; role: string };

const apiBaseURL = "http://localhost:3100";
const users = ref<User[]>([]);
const status = ref("idle");

const api = createAptxCoreApiClient(new RequestClient({ baseURL: apiBaseURL, timeout: 5000 }));

const loadUsers = async () => {
  status.value = "loading users...";
  try {
    const data = await api.execute<{ items: User[] }>({
      method: "GET",
      path: "/users"
    });
    users.value = data.items;
    status.value = "loaded";
  } catch (error) {
    status.value = String(error);
  }
};

const triggerTimeout = async () => {
  status.value = "requesting /slow with timeout=300ms ...";
  try {
    await api.execute(
      { method: "GET", path: "/slow", query: { ms: 1000 } },
      { timeout: 300 }
    );
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
    <pre>{{ JSON.stringify(users, null, 2) }}</pre>
    <p>{{ status }}</p>
  </main>
</template>
