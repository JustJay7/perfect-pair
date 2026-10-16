/* Bedrock transport for the local demo. Existing tools still simulate actions in the page. */
const BEDROCK_LOCAL = location.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(location.hostname);
let bedrockToken = '';
function rememberAgentMode(mode){try{localStorage.setItem('pp-agent-mode',mode);}catch{}}
function restoreAgentMode(){try{if(STATE.live.available&&localStorage.getItem('pp-agent-mode')==='live')STATE.mode='live';}catch{}}
async function bedrockPost(path, input, signal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PP-Token': bedrockToken }, body: JSON.stringify(input), signal });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Bedrock request failed.'), { code: result.error?.code || 'aws_unavailable' });
  return result;
}
async function bedrockImage(blob) {
  const format = ({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' })[blob.type];
  if (!format || blob.size > 3750000) throw Object.assign(new Error('Use a supported image smaller than 3.75 MB.'), { code: 'image_rejected' });
  const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
  return { format, base64 };
}
async function bedrockSample(prompt, options = {}) {
  const tools = new Map((options.tools || []).map(t => [t.name, t]));
  if (tools.has('find_exchange_options')) prompt += '\nTool input contract: find_exchange_options takes the ORIGINAL returned item’s style_id, size, width and colour from look_up_order_and_customer. Its width means the returned shoe’s width, not the desired replacement width. Pass the customer’s fit problem as issue; the tool generates replacement sizes and widths itself.';
  let run;
  try {
    options.signal?.throwIfAborted();
    const images = await Promise.all((options.images || []).map(bedrockImage));
    run = await bedrockPost('/api/runs', { prompt, tools: [...tools.keys()], tier: options.modelTier || 'quick', images }, options.signal);
    while (true) {
      options.signal?.throwIfAborted();
      if (run.text) options.onText?.({ text: run.text });
      if (run.done) return { text: run.text, modelTierApplied: run.modelId, truncated: false, usage: run.usage };
      const results = [];
      // Keep dependent simulated actions in order and stop before another action after cancellation.
      for (const call of run.tools) {
        options.signal?.throwIfAborted();
        const tool = tools.get(call.name);
        if (!tool) throw Object.assign(new Error('The model requested a tool outside this workflow.'), { code: 'invalid_tool' });
        try {
          const value = await tool.execute(call.input, { signal: options.signal });
          const json = JSON.stringify(value ?? null);
          results.push({ toolUseId: call.toolUseId, status: 'success', result: json.length <= 40000 ? (value ?? null) : { note: 'Tool result exceeded the response limit. Narrow the query.' } });
        } catch (error) {
          if (options.signal?.aborted) throw error;
          results.push({ toolUseId: call.toolUseId, status: 'error', result: { error: error.message || 'Tool failed.', ...(error.rule ? { rule: error.rule, decision: error.decision, tier: error.tier } : {}) } });
        }
      }
      run = await bedrockPost(`/api/runs/${run.id}/results`, { results }, options.signal);
    }
  } catch (error) {
    if (run && !run.done) await bedrockPost(`/api/runs/${run.id}/cancel`, {}).catch(() => {});
    if (options.signal?.aborted || error.name === 'AbortError') throw Object.assign(new Error('Stopped.'), { code: 'cancelled' });
    throw error;
  }
}
bedrockSample.limits = async () => ({ tools: { maxCount: 30 }, images: { mediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], maxInputBytes: 3750000 } });
bedrockSample.json = async (prompt, options) => {
  const result = await bedrockSample(prompt + '\nReturn the requested JSON object only.', options);
  const parsed = extractLastJSON(result.text);
  if (!parsed) throw Object.assign(new Error('The model did not return valid JSON.'), { code: 'invalid_json' });
  return parsed;
};
async function getLiveSample() {
  if (!BEDROCK_LOCAL) return window.claude?.use ? window.claude.use('sample') : null;
  STATE.live.provider = 'bedrock';
  try {
    const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    const info = await response.json();
    bedrockToken = info.csrfToken;
    STATE.live.modelId = info.modelId;
    STATE.live.thoroughModelId = info.thoroughModelId;
    STATE.live.reason = info.error?.message || 'Connect AWS once for this running server. Refreshing the page does not disconnect AWS; restarting the server or disconnecting clears the temporary session. Expired workshop credentials must be renewed.';
    return info.connected ? bedrockSample : null;
  } catch {
    STATE.live.reason = 'The local AWS connection is unavailable. Start the Perfect Pair server, then reload.';
    return null;
  }
}
async function refreshBedrock() {
  if (!BEDROCK_LOCAL || anyBusy()) return;
  const sample = await getLiveSample();
  STATE.live.checked = true;
  STATE.live.available = !!sample;
  STATE.live.sample = sample;
  STATE.live.limits = sample ? await sample.limits() : null;
  STATE.live.images = !!sample;
  if (!sample) STATE.mode = 'scripted';
  else restoreAgentMode();
  renderMast();
}
window.addEventListener('focus', refreshBedrock);
