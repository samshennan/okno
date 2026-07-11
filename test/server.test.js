// Boot-and-smoke tests against the REAL server (node server.js).
//
// Covers:
//   - the server actually boots with dummy OAuth env vars (no network at boot)
//   - auth gating: HTML pages redirect to /login (302), API routes answer 401 JSON
//   - the public demo surface (/demo, /api/demo/*) needs no auth
//   - static vendor assets are served
//
// DB-path caveat: the SQLite database is HARDCODED to <repo>/data/okno.db
// (db/database.js) -- there is no env var or cwd override, so even though the
// child runs in a temp cwd (which redirects logs/), the DB lands in the repo.
// data/ is gitignored; after() removes only what this run created (see the
// cleanup rules there).
//
// Run:  npm test   (no browser, no extra deps; needs Node 22+ for global fetch)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const serverJs = path.join(repoRoot, 'server.js');
const dataDir = path.join(repoRoot, 'data');
const dbFile = path.join(dataDir, 'okno.db');

let child = null;
let scratchDir = null;
let base = null;
let output = '';
// Snapshot of what existed BEFORE the run -- drives the conditional cleanup.
let dataDirPreExisted = false;
let dbPreExisted = false;

function randomPort() {
  return 3800 + Math.floor(Math.random() * 1000);
}

// Spawn the server on the given port and resolve once the winston readiness
// line appears on stdout. Rejects (with collected output) on timeout or if
// the child exits first.
function bootServer(port) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      SESSION_SECRET: 'test-session-secret',
      PORT: String(port),
    };
    delete env.NODE_ENV; // production would flip secure cookies

    output = '';
    const proc = spawn(process.execPath, [serverJs], { cwd: scratchDir, env });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      reject(new Error(`Server not ready after 20s. Output:\n${output}`));
    }, 20000);

    const onData = (chunk) => {
      output += chunk.toString();
      if (!settled && output.includes('Server listening on port')) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const err = new Error(
        `Server exited (code ${code}) before ready. Output:\n${output}`
      );
      err.addrInUse = output.includes('EADDRINUSE');
      reject(err);
    });
  });
}

// rmSync with retries -- on Windows, winston/better-sqlite3 can release file
// handles a beat after the child exits.
async function rmWithRetry(target) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  // A leftover temp/data artifact is acceptable; never fail the suite here.
}

before(async () => {
  dataDirPreExisted = fs.existsSync(dataDir);
  dbPreExisted = fs.existsSync(dbFile);

  // Child cwd is a temp dir so the CWD-relative logs/ tree lands there,
  // not in the repo. (The DB path is repo-anchored regardless -- see header.)
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'okno-smoke-'));

  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const port = randomPort();
    try {
      child = await bootServer(port);
      base = `http://127.0.0.1:${port}`;
      await warmUp(base);
      return;
    } catch (err) {
      lastErr = err;
      if (!err.addrInUse) throw err; // only port collisions merit a retry
    }
  }
  throw lastErr;
});

// The readiness log fires inside the listen callback, but on Windows the very
// first loopback connection to a fresh process can still time out. Poll until
// a request actually succeeds so the tests never race the first accept.
async function warmUp(baseUrl) {
  let lastErr;
  for (let i = 0; i < 10; i++) {
    try {
      await fetch(baseUrl + '/login', { redirect: 'manual' });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(
    `Server never accepted a connection at ${baseUrl}: ${lastErr}\nOutput:\n${output}`
  );
}

test('GET /login serves the login page publicly', async () => {
  const res = await fetch(base + '/login', { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('GET / redirects unauthenticated visitors to /login', async () => {
  const res = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('GET /slideshow.html redirects unauthenticated visitors to /login', async () => {
  const res = await fetch(base + '/slideshow.html', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('GET /api/config answers 401 JSON, not a redirect', async () => {
  const res = await fetch(base + '/api/config', { redirect: 'manual' });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.deepEqual(body, { error: 'authentication_required' });
});

test('GET /demo serves the demo page without auth', async () => {
  const res = await fetch(base + '/demo', { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('GET /api/demo/health reports ok with a populated demo cache', async () => {
  const res = await fetch(base + '/api/demo/health', { redirect: 'manual' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.demoMode, true);
  // Demo photos may be added/removed; require a positive integer, not a count.
  assert.ok(Number.isInteger(body.cache.totalItems), 'cache.totalItems is an integer');
  assert.ok(body.cache.totalItems > 0, 'demo cache is non-empty');
});

test('GET /vendor/lucide.min.js serves the vendored asset', async () => {
  const res = await fetch(base + '/vendor/lucide.min.js', { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
});

after(async () => {
  // 1. Stop the child and wait for it to actually exit (its exit handlers
  //    close the SQLite DB, unlocking the -wal/-shm files for cleanup).
  if (child && child.exitCode === null) {
    await new Promise((resolve) => {
      const force = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
        setTimeout(resolve, 500); // give the OS a beat to reap it
      }, 5000);
      child.once('exit', () => { clearTimeout(force); resolve(); });
      child.kill();
    });
  }

  // 2. Scratch dir (child cwd + logs/). Leftovers in tmp are tolerable.
  if (scratchDir) await rmWithRetry(scratchDir);

  // 3. Repo data/ cleanup -- STRICTLY conditional:
  //    - data/ did not exist before the run  -> this run created everything:
  //      remove the whole data/ dir.
  //    - data/ existed but okno.db did not   -> remove just the DB trio
  //      (okno.db, -wal, -shm), leave the rest of data/ alone.
  //    - okno.db pre-existed                 -> TOUCH NOTHING. It may be a
  //      real user database; we never delete or modify a pre-existing DB.
  if (!dataDirPreExisted) {
    await rmWithRetry(dataDir);
  } else if (!dbPreExisted) {
    for (const suffix of ['', '-wal', '-shm']) {
      await rmWithRetry(dbFile + suffix);
    }
  }
});
