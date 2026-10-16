const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {once}=require('node:events');
const {chromium}=require('playwright');
(async()=>{
 const {createServer}=await import('../backend/server.mjs'),{transactionFixture}=await import('./transactions-fixture.mjs');
 const dir=mkdtempSync(join(tmpdir(),'pp-tx-ui-')),transactionPath=join(dir,'transactions.sqlite');transactionFixture(transactionPath);
 const server=createServer({workspacePath:join(dir,'work.sqlite'),historyPath:join(dir,'missing.sqlite'),transactionPath});server.listen(0,'127.0.0.1');await once(server,'listening');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const ready=()=>page.waitForFunction(()=>WORK.ready&&!WORK.busy),loaded=mode=>page.waitForFunction(mode=>!!TX.views[mode]?.data&&!TX.views[mode].loading,mode),box=mode=>page.locator('#tab-'+mode);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();const before=await page.evaluate(()=>JSON.stringify([SYS.refunds,SYS.credits,SYS.exchanges,SYS.holds]));await page.locator('#workspace-role').selectOption('customer_service');await page.locator('#tabbtn-prevention').click();await page.locator('#prevention-source').selectOption('transactions');await loaded('prevention');
 assert.equal(await page.evaluate(()=>TX.views.prevention.data.overview.totals.rows),6);assert.match(await box('prevention').textContent(),/Code 11 · definition not supplied/);
 await box('prevention').locator('[data-tx-field="site"]').selectOption('S2');await loaded('prevention');assert.equal(await page.evaluate(()=>TX.views.prevention.data.overview.totals.sold_units),1);
 await box('prevention').locator('[data-tx-field="site"]').selectOption('');await loaded('prevention');await box('prevention').locator('[data-tx-field="scope"]').selectOption('single');await loaded('prevention');await box('prevention').locator('[data-tx-product="P1"]').click();await loaded('prevention');
 await box('prevention').locator('[data-tx-run]').click();await ready();assert.equal(await page.evaluate(()=>WORK.historyRuns[0].source),'transactions');await box('prevention').locator('[data-save-history]').click();
 await box('prevention').locator('[data-evidence]').first().click();assert.match(await page.locator('#evidence-dialog').textContent(),/fixture-transactions.csv/);await page.locator('[data-close-evidence]').click();
 await box('prevention').locator('[data-tx-route-product]').click();await loaded('routing');assert.equal(await box('routing').locator('[data-tx-route-row]').count(),3);assert.match(await box('routing').textContent(),/No destination meets the benchmark yet/);
 await box('routing').locator('[data-tx-setup]').click();await box('routing').locator('[data-tx-field="receiving"]').selectOption('S1');
 for(const[k,v]of Object.entries({handling:'2',transfer:'3',shipping:'5',packing:'1'})){await box('routing').locator(`[data-tx-cost="${k}"]`).fill(v);await box('routing').locator(`[data-tx-cost="${k}"]`).blur();}
 assert.equal(await box('routing').locator('[data-tx-run]').isDisabled(),true);assert.equal(await box('routing').locator('.tx-stale').isVisible(),true);await box('routing').locator('[data-tx-recalculate]').click();await loaded('routing');assert.equal(await page.evaluate(()=>TX.views.routing.data.plan.routes.find(r=>r.id==='WEB').contribution),62);assert.equal(await page.evaluate(()=>TX.views.routing.data.plan.candidate),null);assert.equal(await box('routing').locator('.tx-stale').count(),0);await box('routing').locator('[data-tx-receipt]').selectOption('WEB');assert.match(await box('routing').locator('.receipt-equation').textContent(),/62\.00/);assert.match(await box('routing').locator('.route-receipt').textContent(),/Historical cost at this destination/);
 await box('routing').locator('[data-tx-setup]').click();await box('routing').getByText('Override the comparison benchmark',{exact:true}).click();await box('routing').locator('[data-tx-cost="benchmarkCost"]').fill('45');await box('routing').locator('[data-tx-cost="benchmarkCost"]').blur();await box('routing').locator('[data-tx-recalculate]').click();await loaded('routing');assert.equal(await page.evaluate(()=>TX.views.routing.data.plan.candidate),'WEB');
 await box('routing').locator('.destination-shortlist [data-tx-detail="WEB"]').click();assert.match(await page.locator('#evidence-dialog').textContent(),/62.00/);assert.match(await page.locator('#evidence-dialog').textContent(),/capability not confirmed/);await page.locator('[data-close-evidence]').click();
 await box('routing').locator('[data-tx-run]').click();await ready();assert.equal(await page.evaluate(()=>WORK.historyRuns[0].agent),'routing');assert.equal(await page.evaluate(()=>JSON.stringify([SYS.refunds,SYS.credits,SYS.exchanges,SYS.holds])),before);
 if(process.env.PP_SCREENSHOTS){mkdirSync(process.env.PP_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.PP_SCREENSHOTS,'actual-routing.png'),fullPage:true});}
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));if(process.env.PP_SCREENSHOTS)await page.screenshot({path:join(process.env.PP_SCREENSHOTS,'actual-routing-mobile.png'),fullPage:true});
 await page.locator('#tabbtn-prevention').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));if(process.env.PP_SCREENSHOTS)await page.screenshot({path:join(process.env.PP_SCREENSHOTS,'actual-prevention-mobile.png'),fullPage:true});
 await box('prevention').locator('[data-tx-field="banner"]').selectOption('ALDO_US');await loaded('prevention');assert.equal(await page.evaluate(()=>TX.views.prevention.product),null);assert.equal(await box('prevention').locator('[data-tx-product="P1"]').count(),0);
 await page.locator('#prevention-source').selectOption('synthetic');assert.equal(await page.locator('#prev-run').count(),1);await page.locator('#workspace-role').selectOption('store_manager');await page.locator('#tabbtn-routing').click();await page.locator('#routing-source').selectOption('synthetic');assert.equal(await page.locator('.route-row').count(),9);
 await page.reload();await ready();assert.equal(await page.evaluate(()=>WORK.historyRuns.filter(r=>r.source==='transactions').length),2);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({scopedPrevention:'passed',financialRouting:'passed',sourceEvidence:'passed',savedReplay:'passed',syntheticSwitch:'passed',mobile:'passed',browserErrors:0}));
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
