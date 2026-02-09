import { useMemo, useState } from "react";
import { RequestClient } from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";

type User = { id: number; name: string; role: string };

const apiBaseURL = "http://localhost:3100";

export function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState("idle");

  const api = useMemo(() => {
    const client = new RequestClient({ baseURL: apiBaseURL, timeout: 5000 });
    return createAptxCoreApiClient(client);
  }, []);

  const loadUsers = async () => {
    setStatus("loading users...");
    try {
      const data = await api.execute<{ items: User[] }>({
        method: "GET",
        path: "/users"
      });
      setUsers(data.items);
      setStatus("loaded");
    } catch (error) {
      setStatus(String(error));
    }
  };

  const triggerTimeout = async () => {
    setStatus("requesting /slow with timeout=300ms ...");
    try {
      await api.execute(
        { method: "GET", path: "/slow", query: { ms: 1000 } },
        { timeout: 300 }
      );
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
      <pre>{JSON.stringify(users, null, 2)}</pre>
      <p>{status}</p>
    </main>
  );
}
