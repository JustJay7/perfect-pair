const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const url = pathToFileURL(path.join(root, 'perfect_pair_demo_offline.html')).href;
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'source/src/real.json'), 'utf8'));
  const synthetic = JSON.parse(fs.readFileSync(path.join(root, 'source/src/data.json'), 'utf8'));
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(url);
    const toggle = page.getByRole('group', {name: 'Dataset', exact: true});
    assert.equal(await toggle.getByRole('button', {name: 'Synthetic', exact: true}).getAttribute('aria-pressed'), 'true');
    const baselineState = await page.evaluate(() => JSON.stringify({cases: CASES, systems: SYS}));
    assert.deepEqual(await page.evaluate(() => DATA.orders), synthetic.orders);
    await page.getByRole('tab', {name: 'Dashboard', exact: true}).click();
    assert.match(await page.locator('#tab-dashboard .eyebrow').first().textContent(), /synthetic/);
    await toggle.getByRole('button', {name: 'Actual', exact: true}).click();
    assert.match(await page.locator('#tab-dashboard .eyebrow').first().textContent(), /actual ALDO/);
    const totals = await page.evaluate(() => realAgg(REAL.rows));
    assert.equal(totals.n, expected.totals.items);
    assert.equal(Math.round(totals.amt * 100), expected.totals.refund_cents);
    assert.equal(totals.ro, expected.totals.return_orders);
    assert.equal(Math.round(totals.fee * 100), expected.totals.restocking_fee_cents);
    const tile = page.locator('#tab-dashboard .stat').first().locator('.v');
    assert.equal(await tile.textContent(), expected.totals.items.toLocaleString('en-CA'));
    await page.locator('[data-rfilter="banner"]').selectOption('ALDO_CA');
    const canada = await page.evaluate(() => realAgg(REAL.rows.filter(r => r.b === 'ALDO_CA')).n);
    assert.equal(await tile.textContent(), canada.toLocaleString('en-CA'));
    await page.locator('[data-rfilter="banner"]').selectOption('all');
    await page.locator('[data-rrange="30d"]').click();
    const recent = await page.evaluate(() => {const {start,end} = realRange(); return realAgg(REAL.rows.filter(r => r.dn >= start && r.dn <= end)).n;});
    assert.equal(await tile.textContent(), recent.toLocaleString('en-CA'));
    await page.locator('[data-rrange="all"]').click();
    if (process.env.PP_SCREENSHOTS) {
      fs.mkdirSync(process.env.PP_SCREENSHOTS, {recursive: true});
      await page.screenshot({path: path.join(process.env.PP_SCREENSHOTS, 'actual-dashboard.png')});
    }
    await page.getByRole('tab', {name: 'Data', exact: true}).click();
    const values = await page.locator('#ds option').evaluateAll(options => options.map(option => option.value));
    assert.equal(values.length, 8);
    for (const value of values) {
      await page.locator('#ds').selectOption(value);
      assert.ok(await page.locator('#tab-data tbody tr').count() > 0, value);
      assert.ok(await page.locator('#tab-data tbody tr').count() <= 200, value);
    }
    await page.locator('#ds').selectOption('actual-orders');
    await page.locator('#dsq').fill('GLOBO_CA');
    await page.waitForFunction(() => document.querySelector('#tab-data tbody').textContent.includes('GLOBO_CA') && !document.querySelector('#tab-data tbody').textContent.includes('ALDO_CA'));
    if (process.env.PP_SCREENSHOTS) await page.screenshot({path: path.join(process.env.PP_SCREENSHOTS, 'actual-data.png')});
    await toggle.getByRole('button', {name: 'Synthetic', exact: true}).click();
    assert.match(await page.locator('#tab-data .eyebrow').textContent(), /Synthetic data/);
    assert.equal(await page.locator('#ds').inputValue(), 'orders');
    await toggle.getByRole('button', {name: 'Actual', exact: true}).click();
    assert.equal(await page.locator('#ds').inputValue(), 'actual-orders');
    assert.equal(await page.locator('#dsq').inputValue(), 'GLOBO_CA');
    assert.equal(await page.evaluate(() => JSON.stringify({cases: CASES, systems: SYS})), baselineState);
    await page.evaluate(() => { STATE.running = 'test'; });
    await toggle.getByRole('button', {name: 'Synthetic', exact: true}).click();
    assert.equal(await page.evaluate(() => UI.dataSource), 'actual');
    await page.evaluate(() => { STATE.running = null; UI.showSource('orders/O-58213'); });
    assert.equal(await page.evaluate(() => UI.dataSource), 'synthetic');
    assert.equal(await page.locator('#ds').inputValue(), 'orders');
    await toggle.getByRole('button', {name: 'Actual', exact: true}).click();
    for (const id of ['return', 'store', 'approvals', 'prevention', 'evals', 'audit', 'how']) {
      await page.locator('#tabbtn-' + id).click();
      assert.match(await page.locator('#data-source-note').textContent(), /synthetic agent demo/);
    }
    await toggle.getByRole('button', {name: 'Synthetic', exact: true}).click();
    await page.getByRole('tab', {name: 'Evaluations', exact: true}).click();
    await page.locator('#eval-all').click();
    await page.waitForFunction(() => !STATE.evalRunning && Object.keys(STATE.evals).length === DATA.cases.filter(c => c.expect).length, null, {timeout: 90000});
    const evals = await page.evaluate(() => Object.values(STATE.evals).map(r => ({case: r.caseId, passed: r.checks.every(c => c.pass), failures: r.checks.filter(c => !c.pass)})));
    assert.ok(evals.every(r => r.passed), JSON.stringify(evals));
    await page.goto(url + '#dashboard');
    await page.reload();
    assert.equal(await page.evaluate(() => UI.dataSource), 'synthetic');
    assert.match(await page.locator('#tab-dashboard .eyebrow').first().textContent(), /synthetic/);
    await page.setViewportSize({width: 390, height: 844});
    await toggle.getByRole('button', {name: 'Actual', exact: true}).click();
    assert.equal(await toggle.getByRole('button', {name: 'Actual', exact: true}).getAttribute('aria-pressed'), 'true');
    const bounds = await toggle.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'dataset toggle fits mobile viewport');
    if (process.env.PP_SCREENSHOTS) await page.screenshot({path: path.join(process.env.PP_SCREENSHOTS, 'mobile-toggle.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({browser: 'Chrome', sourceToggle: 'passed', actualTables: values.length, syntheticEvaluations: evals, consoleErrors: errors.length}, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
