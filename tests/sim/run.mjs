import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Harness, sleep, request } from './lib.mjs';
import { scenarios as classic } from './classic.mjs';
import { scenarios as relay } from './relay.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const REAL = process.env.REAL === '1';
const PORT = Number(process.env.PORT || (REAL ? 3112 : 3111));
const ENTRY = REAL ? path.join(ROOT, 'server.js') : path.join(__dirname, 'server-fast.mjs');
const filter = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
const keep = (name) => !filter.length || filter.some((f) => name.includes(f));
const perScenarioMs = Number(process.env.SCENARIO_TIMEOUT || (REAL ? 420000 : 90000));

function startServer() {
  const child = spawn(process.execPath, [ENTRY], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_NO_WARNINGS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => { logs.push(String(d)); process.env.VERBOSE && process.stdout.write(`[server] ${d}`); });
  child.stderr.on('data', (d) => { logs.push(String(d)); console.error(`[server:err] ${d}`); });
  child.on('exit', (code, signal) => { child.exited = { code, signal, tail: logs.join('').slice(-2000) }; });
  return child;
}

const server = startServer();
let ready = false;
for (let i = 0; i < 60; i += 1) {
  try {
    const r = await request(PORT, 'GET', '/api/rooms');
    if (r.status === 200) { ready = true; break; }
  } catch { /* not up yet */ }
  await sleep(150);
}
if (!ready) { console.error('server failed to start'); server.kill(); process.exit(1); }
console.log(`\n=== 你画我猜对战模拟 · ${REAL ? '真实计时' : '缩放计时(1/10)'} · 端口 ${PORT} ===\n`);

const all = [...classic, ...relay].filter((s) => keep(s.name));
const results = [];
for (const s of all) {
  const h = new Harness({ port: PORT, label: s.name });
  h.fast = !REAL;
  console.log(`▶ ${s.name}`);
  const started = Date.now();
  let crash = null;
  try {
    await Promise.race([s.fn(h), sleep(perScenarioMs).then(() => { throw new Error(`场景超时 ${perScenarioMs}ms 未完成`); })]);
  } catch (e) {
    crash = e;
    h.fail('crash', e.message);
  }
  const ms = Date.now() - started;
  for (const b of h.bots) { try { b.ws && b.ws.close(); } catch { /* ignore */ } }
  await sleep(80);
  const issues = h.issues;
  results.push({ name: s.name, ms, checks: h.checks, issues: issues.slice(), crash });
  if (!issues.length) console.log(`  ✓ ${h.checks} 项检查通过 · ${(ms / 1000).toFixed(1)}s`);
  else console.log(`  ✗ ${issues.length} 个问题 · ${(ms / 1000).toFixed(1)}s`);
  if (crash) console.log(`    崩溃：${crash.stack?.split('\n').slice(0, 3).join(' | ')}`);
}

if (server.exited) {
  console.log(`\n[X] 服务进程中途退出 code=${server.exited.code} signal=${server.exited.signal}`);
  console.log(server.exited.tail);
}
server.kill('SIGTERM');

const totalIssues = results.reduce((a, r) => a + r.issues.length, 0);
console.log('\n================ 汇总 ================');
for (const r of results) {
  console.log(`${r.issues.length ? '✗' : '✓'} ${r.name} — ${r.checks} checks, ${r.issues.length} issues, ${(r.ms / 1000).toFixed(1)}s`);
}
console.log(`\n场景 ${results.length} 个，问题 ${totalIssues} 个`);
const byKind = {};
for (const r of results) for (const i of r.issues) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
console.log(JSON.stringify(byKind));
console.log('\n================ 明细 ================');
for (const r of results) {
  if (!r.issues.length) continue;
  console.log(`\n## ${r.name}`);
  for (const i of r.issues) console.log(`- [${i.kind}] ${i.label}${i.detail ? ` — ${i.detail}` : ''}`);
}
process.exit(0);
