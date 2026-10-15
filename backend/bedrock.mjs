import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

export const fail = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const source = new URL('../source/src/', import.meta.url);
const context = vm.createContext({ document: { getElementById: () => ({ textContent: readFileSync(new URL('data.json', source), 'utf8') }) } });
vm.runInContext(readFileSync(new URL('core.js', source), 'utf8'), context, { timeout: 5000 });
const definitions = JSON.parse(vm.runInContext('JSON.stringify(Object.values(TOOLS).map(({name, description, inputSchema}) => ({name, description, inputSchema})))', context));
const extra = (name, description, properties, required = []) => ({ name, description, inputSchema: { type: 'object', properties, required } });
const str = { type: 'string' };
definitions.push(
  extra('search_policy', 'Search the synthetic return policy and safety rules.', { query: str }, ['query']),
  extra('list_requests', 'List synthetic approval requests; this tool cannot approve them.', { status: { type: 'string', enum: ['pending', 'decided', 'all'] }, query: str }),
  extra('get_request', 'Read a synthetic approval request by ID or order number.', { review_id: str }, ['review_id']),
  extra('returns_stats', 'Totals from the synthetic pilot ledger, not actual ALDO returns.', { from: str, to: str, category: str, channel: { type: 'string', enum: ['Online', 'Store'] } }, ['from', 'to']),
  extra('customer_profile', 'Read a synthetic customer profile.', { customer_id: str }, ['customer_id']),
  extra('real_returns_stats', 'Read aggregate ALDO return counts and source amounts for a date range. No customer identifiers. These are observed totals, not intervention results.', { from: str, to: str, banner: str, channel: str, reason: str }, ['from', 'to']),
);
const registry = new Map(definitions.map(d => [d.name, d]));
const ajv = new Ajv({ strict: false, allErrors: false });
const validators = new Map(definitions.map(d => [d.name, ajv.compile(d.inputSchema)]));

export function publicError(error) {
  if (error.code && error.status) return { code: error.code, message: error.message };
  if (error.name === 'AccessDeniedException' && /private marketplace eligibility/i.test(error.message || '')) return { code: 'aws_access_denied', message: 'The workshop account’s private Marketplace policy blocks this model’s subscription. Ask the organizers to enable this Haiku model for the account. Its presence in the model catalog does not confirm access.' };
  const messages = {
    CredentialsProviderError: ['aws_credentials', 'Connect your workshop AWS session using Connect AWS.'],
    ExpiredTokenException: ['aws_credentials', 'Your workshop credentials expired. Reconnect with fresh temporary credentials.'],
    UnrecognizedClientException: ['aws_credentials', 'AWS did not recognize these credentials. Copy all three workshop credential fields again.'],
    InvalidSignatureException: ['aws_credentials', 'AWS could not validate these credentials. Reconnect your workshop session.'],
    AccessDeniedException: ['aws_access_denied', 'This AWS role cannot invoke the selected model or inference profile. Ask the organizers to enable it, or select their approved Haiku profile.'],
    ValidationException: ['aws_model_config', 'AWS rejected the model configuration or request. Check the approved model/profile ID, region, and supported features.'],
    ResourceNotFoundException: ['aws_model_config', 'AWS could not find the selected model or inference profile in this region.'],
    ThrottlingException: ['rate_limited', 'AWS is throttling requests. Wait briefly before trying again.'],
    ServiceQuotaExceededException: ['rate_limited', 'The workshop AWS inference quota was reached.'],
    AbortError: ['cancelled', 'The request was stopped or timed out.'],
    TimeoutError: ['cancelled', 'AWS took too long to respond. Try again.'],
  };
  const [code, message] = messages[error.name] || ['aws_unavailable', 'Could not reach Amazon Bedrock. Check the connection and try again.'];
  return { code, message };
}

export function readConfig(env = process.env) {
  return { region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1', modelId: env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0', thoroughModelId: env.BEDROCK_THOROUGH_MODEL_ID || '' };
}

export class BedrockService {
  constructor({ config = readConfig(), clientFactory = options => new BedrockRuntimeClient(options), maxRounds = 8, maxCalls = 120, timeoutMs = 90000 } = {}) {
    this.config = config;
    this.clientFactory = clientFactory;
    this.maxRounds = maxRounds;
    this.maxCalls = maxCalls;
    this.timeoutMs = timeoutMs;
    this.client = this.makeClient(config);
    this.ready = false;
    this.runs = new Map();
    this.calls = [];
    this.lastError = null;
    this.checking = false;
    this.connectionAbort = null;
  }
  makeClient(config, credentials) {
    return this.clientFactory({ region: config.region, ...(credentials ? { credentials } : {}), maxAttempts: 1 });
  }
  status() {
    return { provider: 'bedrock', connected: this.ready, ...this.config, error: this.lastError, mode: 'local-demo', toolExecution: 'browser-simulation' };
  }
  async send(client, input, signal) {
    const now = Date.now();
    this.calls = this.calls.filter(t => now - t < 3600000);
    if (this.calls.length >= this.maxCalls) throw fail('rate_limited', 'The local limit of 120 model calls per hour was reached. Wait before continuing.', 429);
    signal?.throwIfAborted();
    this.calls.push(now);
    return client.send(new ConverseCommand(input), { abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs) });
  }
  async connect(input = {}) {
    if (this.checking || this.runs.size) throw fail('busy', 'Finish or stop the current run before changing the AWS connection.', 409);
    this.checking = true;
    this.connectionAbort = new AbortController();
    let candidate;
    try {
      const config = { region: input.region || this.config.region, modelId: input.modelId || this.config.modelId, thoroughModelId: input.thoroughModelId ?? this.config.thoroughModelId };
      if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(config.region) || !/^[\w.:/-]{1,2048}$/.test(config.modelId) || (config.thoroughModelId && !/^[\w.:/-]{1,2048}$/.test(config.thoroughModelId))) throw fail('invalid_config', 'Enter a valid AWS region and model or inference profile ID.');
      let credentials;
      if (input.accessKeyId || input.secretAccessKey || input.sessionToken) {
        if (![input.accessKeyId, input.secretAccessKey, input.sessionToken].every(v => typeof v === 'string' && v.trim().length > 0 && v.length < 20000)) throw fail('invalid_credentials', 'Workshop credentials require the access key ID, secret access key, and session token.');
        credentials = { accessKeyId: input.accessKeyId.trim(), secretAccessKey: input.secretAccessKey.trim(), sessionToken: input.sessionToken.trim() };
      }
      // Rechecking a configured session retains its in-memory credentials.
      candidate = !credentials && JSON.stringify(config) === JSON.stringify(this.config) ? this.client : this.makeClient(config, credentials || this.client.config?.credentials);
      const response = await this.send(candidate, { modelId: config.modelId, messages: [{ role: 'user', content: [{ text: 'Reply with a short greeting to the Perfect Pair team.' }] }], inferenceConfig: { maxTokens: 1024 } }, this.connectionAbort.signal);
      this.connectionAbort.signal.throwIfAborted();
      if (!response.output?.message?.content?.some(c => c.text?.trim()) || response.stopReason !== 'end_turn') throw fail('empty_completion', 'The connection returned no complete text response. Check this model configuration.', 502);
      if (candidate !== this.client) this.client.destroy?.();
      this.client = candidate;
      this.config = config;
      this.ready = true;
      this.lastError = null;
      return this.status();
    } catch (error) {
      if (candidate && candidate !== this.client) candidate.destroy?.();
      this.ready = false;
      this.lastError = publicError(error);
      throw error;
    } finally { this.checking = false; this.connectionAbort = null; }
  }
  disconnect() {
    this.connectionAbort?.abort();
    this.cancelAll();
    this.client.destroy?.();
    this.client = this.makeClient(this.config);
    this.ready = false;
    this.lastError = null;
  }
  cancelAll() { for (const id of this.runs.keys()) this.cancel(id); }
  cancel(id) {
    const run = this.runs.get(id);
    if (run) { run.abort.abort(); clearTimeout(run.expiry); this.runs.delete(id); }
  }
  async start(input, requestSignal) {
    if (this.checking) throw fail('busy', 'Wait for the AWS connection test to finish.', 409);
    if (!this.ready) throw fail('aws_credentials', 'Connect and test AWS before starting a live run.', 503);
    if (this.runs.size >= 2) throw fail('busy', 'Two live requests are already running. Finish one before starting another.', 429);
    if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 100000) throw fail('invalid_request', 'The prompt is empty or too large.');
    const names = input.tools || [];
    if (!Array.isArray(names) || names.length > 30 || new Set(names).size !== names.length || names.some(n => !registry.has(n))) throw fail('tools_unavailable', 'The request included an unknown or repeated demo tool.');
    const content = [{ text: input.prompt }];
    const images = input.images || [];
    if (!Array.isArray(images) || images.length > 4) throw fail('image_rejected', 'Attach at most four supported images.');
    for (const im of images) {
      if (!['jpeg', 'png', 'gif', 'webp'].includes(im.format) || typeof im.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(im.base64)) throw fail('image_rejected', 'Use JPEG, PNG, GIF, or WebP photos.');
      const bytes = Buffer.from(im.base64, 'base64');
      if (!bytes.length || bytes.length > 3750000) throw fail('image_rejected', 'Each photo must be at most 3.75 MB.');
      content.push({ image: { format: im.format, source: { bytes } } });
    }
    const run = { id: randomUUID(), modelId: input.tier === 'default' && this.config.thoroughModelId ? this.config.thoroughModelId : this.config.modelId, names, messages: [{ role: 'user', content }], text: '', rounds: 0, outputTokens: 0, pending: [], seen: new Set(), abort: new AbortController(), busy: false };
    this.runs.set(run.id, run);
    run.expiry = setTimeout(() => this.cancel(run.id), 300000).unref();
    return this.step(run, requestSignal);
  }
  async resume(id, results, requestSignal) {
    const run = this.runs.get(id);
    if (!run) throw fail('run_expired', 'This run expired or was stopped. Start a new run.', 404);
    if (run.busy) throw fail('busy', 'This run is already waiting for AWS.', 409);
    if (!run.pending.length || !Array.isArray(results) || results.length !== run.pending.length || new Set(results.map(r => r?.toolUseId)).size !== results.length || results.some(r => !run.pending.includes(r?.toolUseId) || !['success', 'error'].includes(r.status) || r.result === undefined || JSON.stringify(r.result).length > 40000)) throw fail('invalid_results', 'Tool results do not match the pending calls.');
    run.messages.push({ role: 'user', content: results.map(r => ({ toolResult: { toolUseId: r.toolUseId, status: r.status, content: [{ json: r.result }] } })) });
    run.pending = [];
    return this.step(run, requestSignal);
  }
  async step(run, requestSignal) {
    run.busy = true;
    try {
      if (++run.rounds > this.maxRounds || run.outputTokens >= 16000) throw fail('run_limit', 'The agent reached the demo limit. Review the trace or use the scripted backup.', 429);
      const input = { modelId: run.modelId, messages: run.messages, inferenceConfig: { maxTokens: Math.min(4096, 16000 - run.outputTokens) } };
      if (Buffer.byteLength(JSON.stringify(run.messages)) > 1500000 && !run.messages[0].content.some(c => c.image)) throw fail('prompt_too_large', 'This conversation is too large. Start a new run.');
      if (run.names.length) input.toolConfig = { tools: run.names.map(n => ({ toolSpec: { ...registry.get(n), inputSchema: { json: registry.get(n).inputSchema } } })), toolChoice: { auto: {} } };
      const signal = requestSignal ? AbortSignal.any([run.abort.signal, requestSignal]) : run.abort.signal;
      const response = await this.send(this.client, input, signal);
      signal.throwIfAborted();
      const message = response.output?.message;
      if (message?.role !== 'assistant' || !Array.isArray(message.content)) throw fail('empty_completion', 'AWS returned no assistant response.', 502);
      run.outputTokens += response.usage?.outputTokens || 0;
      // Preserve full assistant blocks, including reasoning signatures, for the next request.
      run.messages.push(message);
      const text = message.content.filter(c => typeof c.text === 'string').map(c => c.text).join('\n');
      run.text += (run.text && text ? '\n\n' : '') + text;
      const calls = message.content.filter(c => c.toolUse).map(c => c.toolUse);
      if (['guardrail_intervened', 'content_filtered'].includes(response.stopReason)) throw fail('refused', 'The model declined this request.', 422);
      if (response.stopReason === 'max_tokens') throw fail('invalid_json', 'The model hit its response length limit. No incomplete tool calls were executed.', 502);
      if (calls.length) {
        if (response.stopReason !== 'tool_use' || calls.length > 16) throw fail('invalid_tool', 'AWS returned an invalid tool request.', 502);
        for (const call of calls) {
          if (!run.names.includes(call.name) || typeof call.toolUseId !== 'string' || run.seen.has(call.toolUseId) || !validators.get(call.name)(call.input)) throw fail('invalid_tool', 'The model requested an unknown tool, repeated call, or invalid tool arguments. No tools in this response were executed.', 502);
          run.seen.add(call.toolUseId);
        }
        run.pending = calls.map(c => c.toolUseId);
        return { id: run.id, text: run.text, tools: calls, done: false, modelId: run.modelId };
      }
      if (response.stopReason !== 'end_turn' || !text.trim()) throw fail('empty_completion', 'The model did not return a complete answer.', 502);
      const result = { id: run.id, text: run.text, tools: [], done: true, modelId: run.modelId, usage: { outputTokens: run.outputTokens, rounds: run.rounds } };
      this.cancel(run.id);
      return result;
    } catch (error) {
      this.cancel(run.id);
      const safe = publicError(error);
      if (['aws_credentials', 'aws_access_denied', 'aws_model_config'].includes(safe.code)) { this.ready = false; this.lastError = safe; }
      throw error;
    } finally { run.busy = false; }
  }
}
