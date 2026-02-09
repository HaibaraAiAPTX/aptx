import express from "express";
import { createAptxCoreApiClient } from "@aptx/api-client";
import { RequestClient } from "@aptx/api-core";

type User = { id: number; name: string; role: string };

const app = express();
const port = Number(process.env.PORT ?? 3300);
const apiBaseURL = process.env.API_BASE_URL ?? "http://localhost:3100";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

app.get("/", async (_req, res) => {
  const client = new RequestClient({ baseURL: apiBaseURL, timeout: 5000 });
  const api = createAptxCoreApiClient(client);

  try {
    const data = await api.execute<{ items: User[] }>({
      method: "GET",
      path: "/users"
    });

    const rows = data.items
      .map((item) => `<li>#${item.id} ${escapeHtml(item.name)} (${escapeHtml(item.role)})</li>`)
      .join("");

    const html = `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>aptx SSR Sample</title></head>
  <body style="font-family:Segoe UI,system-ui,sans-serif;padding:24px;">
    <h1>aptx SSR Sample</h1>
    <p>API: ${escapeHtml(apiBaseURL)}</p>
    <ul>${rows}</ul>
  </body>
</html>`;

    res.status(200).type("html").send(html);
  } catch (error) {
    res.status(500).json({ message: "failed to fetch users", error: String(error) });
  }
});

app.listen(port, () => {
  console.log(`sample ssr server listening on http://localhost:${port}`);
});
