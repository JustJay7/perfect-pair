const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  if (process.env.PP_LIVE_TEST !== '1') throw new Error('This test uses AWS inference. Set PP_LIVE_TEST=1 to run one synthetic Maya investigation and exchange.');
  const base = process.env.PP_BASE_URL || 'http://127.0.0.1:8787';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { at: new Date().toISOString(), evidence: 'Real Bedrock inference; synthetic tools and records', passed: false, phase: 'connect', errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = report.errors;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => STATE.live.checked && WORK.ready);
    assert.equal(await page.evaluate(() => STATE.live.available), true, 'Connect the workshop session before testing.');
    await page.locator('#workspace-role').selectOption('customer_service');
    await page.locator('#settings-open').click();
    await page.locator('#mode-live').click();
    await page.locator('#settings-close').click();
    await page.locator('#tabbtn-return').click();
    report.phase = 'investigate';
    const investigation = await page.evaluate(async () => {
      const decision = await investigate('maya', { mode: 'live', throwOnError: true });
      return { status: CASES.maya.status, model: CASES.maya.tierApplied, tools: CASES.maya.stats.tools, checks: evalChecks('maya', decision, SYS), events: CASES.maya.events, audit: STATE.audit };
    });
    report.investigation = investigation;
    console.log(JSON.stringify({ phase: 'investigate', status: investigation.status, model: investigation.model, tools: investigation.tools, checks: investigation.checks }));
    assert.ok(investigation.checks.every(c => c.pass), 'The live decision did not pass every Maya scenario check.');
    report.phase = 'act';
    const action = await page.evaluate(async () => {
      const best = bestDropOffStore('maya');
      CASES.maya.chosen = { option: 'exchange', method: 'store_dropoff', dropStore: best.location_id };
      await act('maya', { mode: 'live' });
      return { status: CASES.maya.status, verified: CASES.maya.verified, error: CASES.maya.error, stats: CASES.maya.stats, records: recordsFor('maya'), events: CASES.maya.events, audit: STATE.audit };
    });
    report.action = action;
    console.log(JSON.stringify({ phase: 'act', status: action.status, verified: action.verified, error: action.error, stats: action.stats, exchangeStatuses: action.records.exchanges.map(r => r.status) }));
    assert.equal(action.status, 'done');
    assert.equal(action.verified, true);
    assert.ok(action.stats.replans >= 1, 'The simulated stock failure must trigger re-planning.');
    assert.equal(action.records.exchanges.length, 1);
    assert.notEqual(action.records.exchanges[0].status, 'shipped', 'Exchange must wait for inspection.');
    assert.deepEqual(errors, []);
    if (process.env.PP_SCREENSHOTS) await page.screenshot({ path: process.env.PP_SCREENSHOTS + '/bedrock-live-maya.png' });
    report.passed = true;
    report.phase = 'complete';
    console.log('Real Bedrock Maya investigation, stock re-plan, and held exchange: passed.');
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    await browser.close();
    if (process.env.PP_LIVE_REPORT) fs.writeFileSync(process.env.PP_LIVE_REPORT, JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
