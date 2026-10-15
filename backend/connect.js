let csrfToken = '';
const form = document.getElementById('connect-form');
const status = document.getElementById('status');
const secrets = ['accessKeyId', 'secretAccessKey', 'sessionToken'];
const clearSecrets = () => secrets.forEach(id => { document.getElementById(id).value = ''; });
function paint(s) {
  status.textContent = s.connected ? `Connected to Amazon Bedrock\n${s.modelId} · ${s.region}\nOpen Perfect Pair and select Live agent.` : (s.error?.message || 'AWS is not connected yet. Enter your workshop credentials below.');
}
async function load() {
  const res = await fetch('/api/status', { cache: 'no-store' });
  if (!res.ok) throw new Error('The local server is unavailable. Restart it and reload this page.');
  const s = await res.json(); csrfToken = s.csrfToken;
  for (const k of ['region', 'modelId', 'thoroughModelId']) document.getElementById(k).value = s[k] || '';
  paint(s);
}
async function post(path, input) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PP-Token': csrfToken }, body: JSON.stringify(input) });
  const s = await res.json();
  if (!res.ok) throw new Error(s.error?.message || 'Connection failed.');
  paint(s);
}
async function busy(action) {
  form.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await action(); } catch (error) { status.textContent = error.message; }
  finally { form.querySelectorAll('button').forEach(b => b.disabled = false); clearSecrets(); }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  clearSecrets();
  status.textContent = 'Testing a small request with Amazon Bedrock…';
  busy(() => post('/api/connect', input));
});
document.getElementById('disconnect').addEventListener('click', () => busy(() => post('/api/disconnect', {})));
window.addEventListener('pagehide', clearSecrets);
load().catch(error => { status.textContent = error.message; });
