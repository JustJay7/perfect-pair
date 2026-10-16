const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'source/src/real.json'), 'utf8'));
  // Independent totals from the generated source, without the app's filter/aggregation helpers.
  let date = Date.parse(data.start);
  const records = data.cube.n.map((quantity, i) => {
    date += data.cube.day[i] * 86400000;
    return {date: new Date(date).toISOString().slice(0, 10), quantity,
      banner: data.banners[data.cube.b[i]], channel: data.channels[data.cube.c[i]], reason: data.groups[data.cube.g[i]]};
  });
  const bannerNames = {ALDO_CA:'ALDO Canada', ALDO_US:'ALDO US', CIS_CA:'Call It Spring Canada', SPERRY_CA:'Sperry Canada', SPERRY_US:'Sperry US'};
  const percentage = (n, total) => (100 * n / total).toFixed(1) + '%';
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440, height:1000}, reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'perfect_pair_demo_offline.html')).href);
    await page.locator('#workspace-role').selectOption('customer_service');
    await page.locator('#tabbtn-dashboard').click();
    await page.locator('[data-dsrc="real"]').click();
    const heat = page.locator('[data-vizkey="r:heat"]');
    const tile = i => page.locator('#tab-dashboard .dash-tiles .stat .v').nth(i);
    const shot = async name => {
      if (!process.env.PP_SCREENSHOTS) return;
      fs.mkdirSync(process.env.PP_SCREENSHOTS, {recursive:true});
      await page.screenshot({path:path.join(process.env.PP_SCREENSHOTS, name + '.png')});
    };
    const check = async ({banner='all', channel='all', reason='all', from=data.start, to=data.end}={}) => {
      await page.locator('[data-rfilter="banner"]').selectOption(banner);
      await page.locator('[data-rfilter="channel"]').selectOption(channel);
      await page.locator('[data-rfilter="group"]').selectOption(reason);
      if (from !== data.start || to !== data.end) {
        await page.locator('[data-rdate="from"]').fill(from);
        await page.locator('[data-rdate="to"]').fill(to);
      } else await page.locator('[data-rrange="all"]').click();
      const scope = records.filter(r => (banner === 'all' || r.banner === banner) && (channel === 'all' || r.channel === channel) && r.date >= from && r.date <= to);
      const filtered = scope.filter(r => reason === 'all' || r.reason === reason);
      const total = scope.reduce((sum, r) => sum + r.quantity, 0);
      const quantity = filtered.reduce((sum, r) => sum + r.quantity, 0);
      const group = reason === 'all' ? 'fit' : reason;
      const numerator = scope.filter(r => r.reason === group).reduce((sum,r) => sum+r.quantity, 0);
      assert.equal(await tile(0).textContent(), quantity.toLocaleString('en-CA'));
      assert.equal(await tile(2).textContent(), total ? percentage(numerator, total) : '—');
      const expectedBanners = data.banners.filter(b => scope.some(r => r.banner === b && r.quantity > 0));
      assert.deepEqual(await heat.locator('.heat-lab').allTextContents(), expectedBanners.map(b => bannerNames[b]));
      const groups = reason === 'all' ? data.groups : [reason];
      const expectedCells = expectedBanners.flatMap(b => {
        const rows = scope.filter(r => r.banner === b), base = rows.reduce((sum,r) => sum+r.quantity, 0);
        return groups.map(g => percentage(rows.filter(r => r.reason === g).reduce((sum,r) => sum+r.quantity, 0), base));
      });
      assert.deepEqual(await heat.locator('.hc').allTextContents(), expectedCells);
      assert.equal(await heat.locator('.hc.empty').count(), 0, 'Zero quantities are not missing data');
      if (total) assert.deepEqual(await heat.locator('.heat-key>span').allTextContents(), ['0.0%', '100.0%'], 'Percentage colors keep the same scale across filters');
      assert.equal(await page.locator('#insights-no-matches').count(), filtered.length ? 0 : 1);
      if (!total) {
        assert.match(await heat.textContent(), /No records match these filters|No returned items in this scope/);
        assert.equal(await page.locator('[data-vizkey="r:count"]').count(), 0);
      }
      if (reason !== 'all') assert.equal(await page.locator('[data-vizkey="r:reason"] [data-form="pie"]').count(), 0);
      assert.doesNotMatch(await page.locator('#tab-dashboard').innerHTML(), /NaN|Infinity/);
      return {quantity, total, share:total ? percentage(numerator,total) : null};
    };

    await check();
    assert.equal(await page.locator('.insights-context').getAttribute('open'), null);
    assert.match(await page.locator('.insights-context').textContent(), /dashboard filters do not apply/);
    const results = [];
    for (const filters of [
      {banner:'CIS_CA', channel:'CCC', reason:'no_merch'},
      {banner:'CIS_CA', channel:'CCC', reason:'fit'},
      {banner:'CIS_CA', channel:'HappyReturnBar', reason:'fit'},
      {banner:'CIS_CA', channel:'InStore', reason:'fit'},
      {banner:'ALDO_CA', channel:'InStore', reason:'fit'},
      {banner:'ALDO_CA', reason:'fit'},
      {banner:'ALDO_US', channel:'Web', reason:'fit', from:'2025-04-01', to:'2025-06-30'}
    ]) {
      results.push({...filters, ...await check(filters)});
      if (filters.channel === 'HappyReturnBar') await shot('insights-empty');
      if (filters.banner === 'ALDO_CA' && filters.channel === 'InStore') {
        await shot('insights-filtered');
        const expected = results.at(-1).share;
        await heat.locator('summary').click();
        assert.match(await heat.locator('tbody').textContent(), new RegExp(expected.replace('.', '\\.')));
        await heat.locator('summary').click();
        assert.ok((await heat.locator('.hc').boundingBox()).height < 100, 'Heatmap rows stay compact');
      }
    }
    const first = records.find(r => r.quantity > 0);
    const missing = data.groups.find(g => !records.some(r => r.date === first.date && r.banner === first.banner && r.channel === first.channel && r.reason === g && r.quantity > 0));
    assert.ok(missing, 'Source fixture contains a genuine zero-reason scope');
    await check({banner:first.banner, channel:first.channel, reason:missing, from:first.date, to:first.date});
    assert.deepEqual(await heat.locator('.hc').allTextContents(), ['0.0%']);
    await page.locator('.dash-controls [data-rreset]').click();
    assert.equal(await page.locator('[data-rfilter="banner"]').inputValue(), 'all');
    assert.equal(await page.locator('[data-rfilter="channel"]').inputValue(), 'all');
    assert.equal(await page.locator('[data-rfilter="group"]').inputValue(), 'all');
    assert.equal(await page.locator('[data-rdate="from"]').inputValue(), data.start);
    assert.equal(await tile(0).textContent(), data.totals.items.toLocaleString('en-CA'));
    await shot('insights-all');
    await page.setViewportSize({width:390, height:844});
    await check({banner:'ALDO_CA', channel:'InStore', reason:'fit'});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
    await shot('insights-mobile');
    await page.locator('#theme-btn').click();
    await shot('insights-dark-mobile');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({filters:results, zeroReason:'passed', reset:'passed', mobile:'passed', browserErrors:0}, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
