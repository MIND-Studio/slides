// Stateless Slidev build/export worker.
//
// Real `slidev export` (PDF, via Playwright/Chromium) and `slidev build` (static
// SPA) cannot run in the browser — they need Node + Chromium. This worker is the
// only place that runs them, and it is deliberately:
//   - STATELESS & CREDENTIAL-FREE — it never touches the pod, holds no pod
//     credentials, and persists nothing. The browser uploads the artifacts it
//     returns to the pod with the user's own authed fetch.
//   - PER-REQUEST ISOLATED — every request gets its own temp project dir (a copy
//     of the committed slidev/ project + the posted slides.md). The shared
//     slidev/slides.md is never written, so concurrent users can't clobber each
//     other (the sidecar's old failure mode).
//
// Endpoints:
//   GET  /healthz  → 200 "ok"
//   POST /export   { slidesMd }        → application/pdf bytes
//   POST /build    { slidesMd, base }  → JSON { files: [{path, base64, contentType}] }
//
// Run locally: `npm run worker` (uses Playwright's bundled Chromium).
// In Docker (alpine): set CHROMIUM_PATH=/usr/bin/chromium-browser.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SLIDEV_DIR = path.join(REPO, "slidev");
const SLIDEV_BIN = path.join(REPO, "node_modules", "@slidev", "cli", "bin", "slidev.mjs");
// Temp projects live under the repo so Vite/slidev resolve REPO/node_modules by
// walking up from the temp dir's cwd.
const WORK_ROOT = path.join(REPO, ".work");

const PORT = Number(process.env.WORKER_PORT ?? 3162);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? ""; // empty → Playwright bundled
const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_TIMEOUT_MS ?? 120_000);
const MAX_CONCURRENT = Number(process.env.WORKER_CONCURRENCY ?? 2);
const QUEUE_LIMIT = Number(process.env.WORKER_QUEUE_LIMIT ?? 8);

// ---- tiny concurrency gate (Chromium is heavy) ----------------------------
let active = 0;
const queue = [];
function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  if (queue.length >= QUEUE_LIMIT) return null; // saturated → caller returns 503
  return new Promise((resolve) => queue.push(resolve));
}
function release() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

// ---- content types for build artifacts ------------------------------------
const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
};
function contentTypeFor(p) {
  return CONTENT_TYPES[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

// ---- helpers --------------------------------------------------------------
async function makeProject(slidesMd) {
  await fs.mkdir(WORK_ROOT, { recursive: true });
  const dir = await fs.mkdtemp(path.join(WORK_ROOT, "job-"));
  // Copy the committed slidev project (layouts, styles, style.css, setup,
  // vite.config.ts), then overwrite slides.md with the posted deck.
  await fs.cp(SLIDEV_DIR, dir, { recursive: true });
  await fs.writeFile(path.join(dir, "slides.md"), slidesMd, "utf8");
  return dir;
}

function runSlidev(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [SLIDEV_BIN, ...args],
      { cwd, timeout: REQUEST_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          err.message = `slidev ${args[0]} failed: ${err.message}\n${stderr || stdout}`;
          reject(err);
        } else resolve({ stdout, stderr });
      }
    );
    child.on("error", reject);
  });
}

async function walk(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, baseDir)));
    else out.push(path.relative(baseDir, full).split(path.sep).join("/"));
  }
  return out;
}

async function doExport(slidesMd) {
  const dir = await makeProject(slidesMd);
  try {
    const out = path.join(dir, "out.pdf");
    const args = [
      "export",
      "slides.md",
      "--format",
      "pdf",
      "--output",
      out,
      "--timeout",
      "60000",
      "--wait-until",
      "networkidle",
    ];
    if (CHROMIUM_PATH) args.push("--executable-path", CHROMIUM_PATH);
    await runSlidev(args, dir);
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function doBuild(slidesMd, base) {
  const dir = await makeProject(slidesMd);
  try {
    const outDir = path.join(dir, "dist");
    await runSlidev(["build", "slides.md", "--base", base, "--out", outDir], dir);
    const rels = await walk(outDir);
    const files = await Promise.all(
      rels.map(async (rel) => ({
        path: rel,
        base64: (await fs.readFile(path.join(outDir, rel))).toString("base64"),
        contentType: contentTypeFor(rel),
      }))
    );
    return { files };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// ---- http -----------------------------------------------------------------
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 16 * 1024 * 1024) reject(new Error("payload too large"));
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.method !== "POST" || (req.url !== "/export" && req.url !== "/build")) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }

  const slot = acquire();
  if (slot === null) {
    res.writeHead(503, { "content-type": "text/plain", "retry-after": "10" });
    res.end("worker busy");
    return;
  }
  await slot;

  try {
    const body = await readJson(req);
    const slidesMd = String(body.slidesMd ?? "");
    if (!slidesMd.trim()) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("missing slidesMd");
      return;
    }

    if (req.url === "/export") {
      const pdf = await doExport(slidesMd);
      res.writeHead(200, { "content-type": "application/pdf" });
      res.end(pdf);
    } else {
      const base = String(body.base ?? "/");
      const manifest = await doBuild(slidesMd, base);
      const json = Buffer.from(JSON.stringify(manifest), "utf8");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(json);
    }
  } catch (e) {
    console.error("[worker]", e?.message ?? e);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`worker error: ${e?.message ?? e}`);
  } finally {
    release();
  }
});

// Sweep any temp dirs a previous crash left behind.
async function sweep() {
  try {
    await fs.rm(WORK_ROOT, { recursive: true, force: true });
  } catch {
    /* nothing to clean */
  }
}

await sweep();
server.listen(PORT, () => {
  console.log(`[worker] slidev build/export worker on :${PORT}`);
  console.log(`[worker] repo=${REPO} chromium=${CHROMIUM_PATH || "(playwright bundled)"}`);
});
