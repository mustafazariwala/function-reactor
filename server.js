const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE = "fr_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const DB_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DB_DIR, "store.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const hash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

function defaultStore() {
  return {
    nextUserId: 1,
    nextFunctionId: 1,
    users: [],
    sessions: [],
    functions: [],
  };
}

async function ensureStore() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(defaultStore(), null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return {
    ...defaultStore(),
    ...parsed,
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    functions: Array.isArray(parsed.functions) ? parsed.functions : [],
  };
}

async function writeStore(store) {
  await fs.writeFile(DB_PATH, JSON.stringify(store, null, 2), "utf8");
}

function sessionExpired(session) {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function createSession(store, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
  const session = {
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt,
  };
  store.sessions.push(session);
  return session;
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    expires: new Date(expiresAt),
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

async function getAuthContext(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;

  const store = await readStore();
  const now = Date.now();
  const beforeCount = store.sessions.length;
  store.sessions = store.sessions.filter((session) => {
    return new Date(session.expiresAt).getTime() > now;
  });
  if (beforeCount !== store.sessions.length) {
    await writeStore(store);
  }

  const session = store.sessions.find((item) => item.token === token);
  if (!session || sessionExpired(session)) return null;

  const user = store.users.find((item) => item.id === session.userId);
  if (!user) return null;

  return { store, user, session };
}

async function requireAuth(req, res, next) {
  const auth = await getAuthContext(req);
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.auth = auth;
  next();
}

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const store = await readStore();
  if (store.users.some((user) => user.email === email)) {
    res.status(409).json({ error: "Email is already registered." });
    return;
  }

  const now = new Date().toISOString();
  const salt = createSalt();
  const user = {
    id: store.nextUserId++,
    email,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now,
  };

  store.users.push(user);
  const session = createSession(store, user.id);
  await writeStore(store);
  setSessionCookie(res, session.token, session.expiresAt);
  res.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const store = await readStore();
  const user = store.users.find((item) => item.email === email);

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const session = createSession(store, user.id);
  await writeStore(store);
  setSessionCookie(res, session.token, session.expiresAt);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const store = await readStore();
    store.sessions = store.sessions.filter((session) => session.token !== token);
    await writeStore(store);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", async (req, res) => {
  const auth = await getAuthContext(req);
  if (!auth) {
    res.json({ user: null });
    return;
  }

  res.json({ user: publicUser(auth.user) });
});

app.get("/api/functions", requireAuth, async (req, res) => {
  const { user, store } = req.auth;
  const functions = store.functions
    .filter((item) => item.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

  res.json({ functions });
});

app.post("/api/functions", requireAuth, async (req, res) => {
  const { user, store } = req.auth;
  const name = String(req.body?.name || "").trim() || "Untitled Function";
  const code = String(req.body?.code || "");
  const now = new Date().toISOString();

  const newFunction = {
    id: store.nextFunctionId++,
    userId: user.id,
    name,
    code,
    createdAt: now,
    updatedAt: now,
  };

  store.functions.push(newFunction);
  await writeStore(store);

  res.status(201).json({ function: newFunction });
});

app.put("/api/functions/:id", requireAuth, async (req, res) => {
  const { user, store } = req.auth;
  const functionId = Number(req.params.id);
  const target = store.functions.find((item) => item.id === functionId && item.userId === user.id);

  if (!target) {
    res.status(404).json({ error: "Function not found." });
    return;
  }

  const nextName = String(req.body?.name || "").trim();
  const nextCode = req.body?.code;

  if (nextName) target.name = nextName;
  if (typeof nextCode === "string") target.code = nextCode;
  target.updatedAt = new Date().toISOString();

  await writeStore(store);
  res.json({ function: target });
});

app.delete("/api/functions/:id", requireAuth, async (req, res) => {
  const { user, store } = req.auth;
  const functionId = Number(req.params.id);
  const before = store.functions.length;
  store.functions = store.functions.filter((item) => !(item.id === functionId && item.userId === user.id));

  if (before === store.functions.length) {
    res.status(404).json({ error: "Function not found." });
    return;
  }

  await writeStore(store);
  res.status(204).end();
});

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Function Reactor server running on http://localhost:${PORT}`);
});
