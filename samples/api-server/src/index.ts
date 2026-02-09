import cors from "cors";
import express from "express";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT ?? 3100);

app.use(cors());
app.use(express.json());

const users = [
  { id: 1, username: "user_a", password: "pass_a", displayName: "User A", role: "admin" },
  { id: 2, username: "user_b", password: "pass_b", displayName: "User B", role: "developer" }
];
const tokenStore = new Map<string, { userId: number; expiresAt: number }>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/users", (_req, res) => {
  res.json({
    items: users.map(({ password, ...item }) => item)
  });
});

app.get("/slow", async (req, res) => {
  const ms = Number(req.query.ms ?? 1500);
  await new Promise((resolve) => setTimeout(resolve, ms));
  res.json({ ok: true, delayedMs: ms });
});

app.post("/auth/login", (req, res) => {
  const username = String(req.body?.username ?? "");
  const password = String(req.body?.password ?? "");
  if (!username || !password) {
    res.status(400).json({ message: "username/password is required" });
    return;
  }

  const user = users.find((item) => item.username === username && item.password === password);
  if (!user) {
    res.status(401).json({ message: "invalid credentials" });
    return;
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 60 * 60 * 1000;
  tokenStore.set(token, { userId: user.id, expiresAt });

  res.json({
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    }
  });
});

app.get("/me", (req, res) => {
  const auth = req.header("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  const session = tokenStore.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    res.status(401).json({ message: "token expired or invalid" });
    return;
  }

  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    res.status(401).json({ message: "user not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  });
});

app.listen(port, () => {
  console.log(`sample api server listening on http://localhost:${port}`);
});
