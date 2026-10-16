import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { BedrockService, fail, publicError } from './bedrock.mjs';
import { keychainStore, SavedConnection } from './keychain.mjs';
import { Workspace } from './workspace.mjs';

const root = new URL('../', import.meta.url);
const files = new Map([
  ['/', ['perfect_pair_demo_offline.html', 'text/html; charset=utf-8']],
  ['/connect', ['backend/connect.html', 'text/html; charset=utf-8']],
  ['/connect.js', ['backend/connect.js', 'text/javascript; charset=utf-8']],
]);

async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail('invalid_request', 'Use JSON requests.', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 22000000) throw fail('request_too_large', 'This request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw fail('invalid_request', 'The request is not a JSON object.'); }
}

export function createServer({ service = new BedrockService(), workspacePath = ':memory:', historyPath, transactionPath, credentialStore = null } = {}) {
  const workspace = new Workspace({ service, path: workspacePath, ...(historyPath ? { historyPath } : {}), ...(transactionPath ? { transactionPath } : {}) });
  const connection=new SavedConnection(service,credentialStore);
  const restored=connection.restore();
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const reply = (status, body) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); } };
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    try {
      const port = server.address()?.port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host) || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) throw fail('forbidden', 'Open Perfect Pair directly on this Mac.', 403);
      const origin = `http://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== origin) throw fail('forbidden', 'Cross-origin requests are not allowed.', 403);
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && files.has(url.pathname)) {
        const [file, type] = files.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type });
        res.end(await readFile(new URL(file, root)));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/status') { reply(200, { ...connection.status(), csrfToken: token }); return; }
      if (req.method === 'GET' && url.pathname === '/api/workspace') { reply(200, workspace.snapshot()); return; }
      if (req.method === 'GET' && url.pathname === '/api/history/overview') { reply(200, workspace.evidence.overview(url.searchParams.get('banner') || 'ALDO_CA')); return; }
      if (req.method === 'GET' && url.pathname === '/api/history/products') { reply(200, workspace.evidence.products({ banner:url.searchParams.get('banner') || 'ALDO_CA', q:url.searchParams.get('q') || '', offset:Number(url.searchParams.get('offset') || 0) })); return; }
      if (req.method === 'GET' && url.pathname === '/api/history/product') { reply(200, workspace.evidence.product(url.searchParams.get('banner'),url.searchParams.get('sku'))); return; }
      if (req.method === 'GET' && url.pathname === '/api/history/return') { reply(200, workspace.evidence.record(Number(url.searchParams.get('row')))); return; }
      if (req.method === 'GET' && url.pathname === '/api/history/evidence') { const ref=url.searchParams.get('ref');reply(200,ref?.startsWith('transactions:')?workspace.transactions.resolve(ref):workspace.evidence.resolve(ref));return; }
      if (req.method === 'GET' && url.pathname === '/api/transactions/catalog') { reply(200,workspace.transactions.catalog());return; }
      if (req.method === 'GET' && url.pathname === '/api/transactions/overview') { reply(200,workspace.transactions.overview(Object.fromEntries(url.searchParams)));return; }
      if (req.method === 'GET' && url.pathname === '/api/transactions/products') { reply(200,workspace.transactions.products(Object.fromEntries(url.searchParams)));return; }
      if (req.method === 'GET' && url.pathname === '/api/replays') { reply(200, { replays:workspace.store.replays() }); return; }
      if (req.method === 'GET' && /^\/api\/replays\/[a-f0-9-]{36}$/.test(url.pathname)) { reply(200, workspace.store.readReplay(url.pathname.split('/').pop())); return; }
      if (req.method !== 'POST' || !url.pathname.startsWith('/api/')) { reply(404, { error: { code: 'not_found', message: 'Page not found.' } }); return; }
      const given = Buffer.from(req.headers['x-pp-token'] || '');
      if (req.headers.origin !== origin || given.length !== token.length || !timingSafeEqual(given, Buffer.from(token))) throw fail('forbidden', 'Reload the local app before continuing.', 403);
      const body = await jsonBody(req);
      if (url.pathname === '/api/transactions/plan') { reply(200,workspace.transactions.routing(body));return; }
      if (url.pathname === '/api/workflow') { reply(202, workspace.submit(body)); return; }
      if (url.pathname === '/api/workflow/stop') { workspace.stop(); reply(200,{stopped:true}); return; }
      if (url.pathname === '/api/replays') { reply(201,{id:workspace.saveReplay(body.caseId,body.historyId)}); return; }
      if (url.pathname === '/api/connect') { await restored;reply(200, await connection.connect(body)); return; }
      if (url.pathname === '/api/disconnect') { await restored;reply(200, await connection.disconnect()); return; }
      if (url.pathname === '/api/runs') { reply(200, await service.start(body, abort.signal)); return; }
      const match = /^\/api\/runs\/([a-f0-9-]{36})\/(results|cancel)$/.exec(url.pathname);
      if (match) {
        if (match[2] === 'cancel') { service.cancel(match[1]); reply(200, { cancelled: true }); }
        else reply(200, await service.resume(match[1], body.results, abort.signal));
        return;
      }
      reply(404, { error: { code: 'not_found', message: 'Endpoint not found.' } });
    } catch (error) { reply(error.status || 502, { error: publicError(error) }); }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  server.workspace=workspace;
  server.on('close', () => { service.disconnect(); workspace.stop(); if(workspace.busy)workspace.completion.finally(()=>workspace.close());else workspace.close(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  process.env.AWS_EC2_METADATA_DISABLED = 'true';
  const server = createServer({ credentialStore:keychainStore(), workspacePath: process.env.PP_STATE_PATH || new URL('../local_data/workspace.sqlite', import.meta.url).pathname, historyPath:process.env.PP_HISTORY_PATH,transactionPath:process.env.PP_TRANSACTIONS_PATH });
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Stop the other server or choose another PORT.` : 'Could not start the local server.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Perfect Pair: http://127.0.0.1:${port}\nConnect AWS: http://127.0.0.1:${port}/connect\nLocal access only. Remembered AWS credentials restore from macOS Keychain. Disconnect removes the saved connection.`));
}
