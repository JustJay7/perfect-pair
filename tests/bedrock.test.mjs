import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { BedrockService, publicError, readConfig } from '../backend/bedrock.mjs';
import { createServer } from '../backend/server.mjs';

const answer = (text = 'Hello', extra = {}) => ({ output: { message: { role: 'assistant', content: [{ text }] } }, stopReason: 'end_turn', usage: { outputTokens: 10 }, ...extra });
const tool = (id = 't1', name = 'look_up_order_and_customer', input = { why: 'Check the order.', order_id: 'O-58213' }) => ({ output: { message: { role: 'assistant', content: [{ reasoningContent: { reasoningText: { text: 'private reasoning', signature: 'signature' } } }, { text: 'Checking the order.' }, { toolUse: { toolUseId: id, name, input } }] } }, stopReason: 'tool_use', usage: { outputTokens: 20 } });
function fixture(responses = [], options = {}) {
  const sent = [];
  const client = { config: { credentials: async () => ({ accessKeyId: 'local-test', secretAccessKey: 'local-test' }) }, destroy() {}, async send(command, opts) {
    sent.push(structuredClone(command.input));
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(command.input, opts) : (next || answer());
  } };
  const service = new BedrockService({ clientFactory: () => client, ...options });
  return { service, sent };
}
const start = service => service.start({ prompt: 'Check this synthetic return.', tools: ['look_up_order_and_customer'] });
const results = [{ toolUseId: 't1', status: 'success', result: { order: { order_id: 'O-58213' } } }];

test('region accepts workshop exports while preserving the explicit AWS_REGION override', () => {
  assert.equal(readConfig({ AWS_DEFAULT_REGION: 'us-west-2' }).region, 'us-west-2');
  assert.equal(readConfig({ AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-west-2' }).region, 'us-east-1');
});
test('Marketplace denial after a successful greeting disables live mode and explains the account blocker', async () => {
  const denied = Object.assign(new Error('Not authorized due to private marketplace eligibility. sensitive-provider-detail'), { name: 'AccessDeniedException' });
  const { service } = fixture([answer(), denied]);
  await service.connect();
  await assert.rejects(start(service), { name: 'AccessDeniedException' });
  assert.equal(service.status().connected, false);
  assert.equal(service.status().error.code, 'aws_access_denied');
  assert.match(service.status().error.message, /private Marketplace policy/);
  assert.doesNotMatch(JSON.stringify(service.status()), /sensitive-provider-detail/);
  assert.equal(service.runs.size, 0);
});

test('requires a successful model call before enabling live mode', async () => {
  const { service } = fixture([Object.assign(new Error('private AWS response'), { name: 'AccessDeniedException' })]);
  await assert.rejects(start(service), { code: 'aws_credentials' });
  await assert.rejects(service.connect());
  assert.equal(service.status().connected, false);
  assert.equal(service.status().error.code, 'aws_access_denied');
  assert.doesNotMatch(JSON.stringify(service.status()), /private AWS response/);
});
test('tool results round trip with full signed assistant message, configured model, and usage', async () => {
  const { service, sent } = fixture([answer(), tool(), answer('{"decision":"review"}')]);
  await service.connect({ region: 'us-east-1', modelId: 'us.anthropic.claude-sonnet-5-5' });
  const first = await start(service);
  assert.equal(first.done, false);
  assert.equal(first.tools[0].name, 'look_up_order_and_customer');
  const last = await service.resume(first.id, results);
  assert.equal(last.done, true);
  assert.equal(last.usage.rounds, 2);
  assert.equal(sent[2].messages[1].content[0].reasoningContent.reasoningText.signature, 'signature');
  assert.deepEqual(sent[2].messages[2].content[0].toolResult.content, [{ json: results[0].result }]);
  assert.equal(sent[1].toolConfig.tools[0].toolSpec.inputSchema.json.type, 'object');
  assert.equal(service.runs.size, 0);
});
test('unknown, out-of-workflow and malformed model tool requests never reach execution', async () => {
  for (const invalid of [tool('t1', 'issue_refund', {}), tool('t1', 'shell', {}), tool('t1', 'look_up_order_and_customer', { order_id: 123 })]) {
    const { service } = fixture([answer(), invalid]);
    await service.connect();
    await assert.rejects(start(service), { code: 'invalid_tool' });
    assert.equal(service.runs.size, 0);
  }
});
test('cannot request arbitrary schemas or unknown tools', async () => {
  const { service, sent } = fixture(); await service.connect();
  await assert.rejects(service.start({ prompt: 'hello', tools: ['shell'] }), { code: 'tools_unavailable' });
  assert.equal(sent.length, 1);
});
test('rejects missing, forged and duplicate tool results without another model call', async () => {
  const { service, sent } = fixture([answer(), tool()]); await service.connect();
  const first = await start(service);
  for (const bad of [[], [{ ...results[0], toolUseId: 'forged' }], [results[0], results[0]]]) await assert.rejects(service.resume(first.id, bad), { code: 'invalid_results' });
  assert.equal(sent.length, 2);
  service.cancelAll();
});
test('policy gate failures return to the model as errors, not successful actions', async () => {
  const { service, sent } = fixture([answer(), tool(), answer('Ask for approval.')]); await service.connect();
  const first = await start(service);
  await service.resume(first.id, [{ toolUseId: 't1', status: 'error', result: { error: 'Approval required', rule: 'R1', decision: 'APPROVAL' } }]);
  assert.equal(sent[2].messages[2].content[0].toolResult.status, 'error');
});
test('round limit stops looping and clears transcript', async () => {
  const { service, sent } = fixture([answer(), tool()], { maxRounds: 1 }); await service.connect();
  const first = await start(service);
  await assert.rejects(service.resume(first.id, results), { code: 'run_limit' });
  assert.equal(sent.length, 2); assert.equal(service.runs.size, 0);
});
test('reused tool IDs and truncated responses are rejected', async () => {
  const { service } = fixture([answer(), tool(), tool()]); await service.connect();
  const first = await start(service);
  await assert.rejects(service.resume(first.id, results), { code: 'invalid_tool' });
  const f = fixture([answer(), { ...tool(), stopReason: 'max_tokens' }]); await f.service.connect();
  await assert.rejects(start(f.service), { code: 'invalid_json' });
});
test('abort cancels AWS work, expires the run and prevents continuation', async () => {
  const { service } = fixture([answer(), (_input, { abortSignal }) => new Promise((_resolve, reject) => abortSignal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })), { once: true }))]);
  await service.connect();
  const controller = new AbortController();
  const pending = service.start({ prompt: 'hello' }, controller.signal);
  const id = [...service.runs.keys()][0];
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(service.resume(id, []), { code: 'run_expired' });
  assert.equal(service.runs.size, 0);
});
test('hourly call limit applies to connection tests too', async () => {
  const { service } = fixture([], { maxCalls: 1 }); await service.connect();
  await assert.rejects(service.start({ prompt: 'hello' }), { code: 'rate_limited' });
});
test('model switching selects configured IDs and never accepts a request model override', async () => {
  const { service, sent } = fixture();
  await service.connect({ modelId: 'us.anthropic.claude-sonnet-5-5', thoroughModelId: 'approved.second-model' });
  await service.start({ prompt: 'hello', tier: 'default', modelId: 'unapproved' });
  assert.equal(sent[1].modelId, 'approved.second-model');
});
test('image conversion supports vision and rejects unsupported or oversized input', async () => {
  const { service, sent } = fixture(); await service.connect();
  await service.start({ prompt: 'Describe the image.', images: [{ format: 'png', base64: 'iVBORw==' }] });
  assert.deepEqual([...sent[1].messages[0].content[1].image.source.bytes], [...Buffer.from('iVBORw==', 'base64')]);
  await assert.rejects(service.start({ prompt: 'hello', images: [{ format: 'svg', base64: 'eA==' }] }), { code: 'image_rejected' });
  await assert.rejects(service.start({ prompt: 'hello', images: [{ format: 'png', base64: Buffer.alloc(3750001).toString('base64') }] }), { code: 'image_rejected' });
});
test('credentials, account details and raw provider errors are absent from public status', async () => {
  const { service } = fixture();
  await service.connect({ accessKeyId: 'test-access', secretAccessKey: 'secret-should-not-leak', sessionToken: 'token-should-not-leak' });
  assert.doesNotMatch(JSON.stringify(service.status()), /test-access|should-not-leak/);
  assert.doesNotMatch(JSON.stringify(publicError(new Error('secret-should-not-leak'))), /should-not-leak/);
  service.disconnect(); assert.equal(service.status().connected, false);
});
test('local HTTP server protects configuration, inference and files', async t => {
  const { service } = fixture();
  const server = createServer({ service }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(base + '/api/status')).json();
  assert.equal(status.connected, false);
  for (const route of ['/.env', '/backend/server.mjs', '/.git/config', '/source/src/real.json']) assert.equal((await fetch(base + route)).status, 404);
  const hostileHostStatus = await new Promise((resolve, reject) => { http.get(base + '/api/status', { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject); });
  assert.equal(hostileHostStatus, 403);
  assert.equal((await fetch(base + '/api/status', { headers: { Origin: 'https://attacker.example' } })).status, 403);
  const opts = { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' };
  assert.equal((await fetch(base + '/api/connect', opts)).status, 403);
  opts.headers['X-PP-Token'] = status.csrfToken;
  const connected = await fetch(base + '/api/connect', opts);
  assert.equal(connected.status, 200);
  assert.equal((await connected.json()).connected, true);
  const html = await fetch(base + '/connect');
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(html.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await html.text(), /test-access|secret-should-not-leak/);
});
