const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {once}=require('node:events');
const {chromium}=require('playwright');
(async()=>{
 const {createServer}=await import('../backend/server.mjs');
 const dir=mkdtempSync(join(tmpdir(),'pp-manager-ui-'));const server=createServer({workspacePath:join(dir,'work.sqlite'),historyPath:join(dir,'missing.sqlite')});server.listen(0,'127.0.0.1');await once(server,'listening');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const ready=()=>page.waitForFunction(()=>WORK.ready&&!WORK.busy),role=r=>page.locator('#workspace-role').selectOption(r);
 const shot=async name=>{if(process.env.PP_SCREENSHOTS){mkdirSync(process.env.PP_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.PP_SCREENSHOTS,name+'.png'),fullPage:true});}};
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();
 await page.locator('#tabbtn-return').click();await page.locator('#start-btn').click();await page.waitForFunction(()=>CASES.maya.status==='options'&&!WORK.busy);
 await page.locator('#cust-chat-fab').click();await page.locator('#cust-q').fill('I will post a negative review on Instagram about this terrible customer service.');await page.locator('#cust-chat').getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>!!CASES.maya.serviceConcern&&!WORK.busy&&!CHAT.cust.maya.busy);await page.getByRole('button',{name:'Close the chat',exact:true}).click();
 await role('store_manager');await page.locator('#tabbtn-manager').click();assert.equal(await page.locator('[data-customer-profile="maya"]').count(),1);assert.equal(await page.locator('#counter-confirm').count(),0);assert.equal(await page.locator('.customer-fact').count(),6);assert.match(await page.locator('.manager-alert').textContent(),/negative review on Instagram/);assert.equal(await page.evaluate(()=>CASES.maya.flags.suspected_abuse||false),false);await shot('customer-review');
 await page.locator('#manager-decision-note').fill('Call the customer, apologize for the experience, and explain the eligible refund and nearest drop-off.');await page.locator('[data-manager-recommend="refund"]').click();await ready();assert.equal(await page.evaluate(()=>CASES.maya.managerDecision.option),'refund');assert.equal(await page.evaluate(()=>CASES.maya.chosen),null);
 await page.reload();await ready();await page.locator('#tabbtn-manager').click();assert.match(await page.locator('.manager-alert').textContent(),/Service concern reviewed/);
 await page.locator('#tabbtn-routing').click();assert.equal(await page.locator('.route-row').count(),9);assert.match(await page.locator('#tab-routing .manager-alert').textContent(),/No option preserves/);await shot('routing');
 await page.locator('[data-route-detail="ecommerce"]').click();assert.equal(await page.locator('#evidence-dialog').isVisible(),true);assert.match(await page.locator('#evidence-dialog').textContent(),/Packing \+ online shipping/);assert.match(await page.locator('#evidence-dialog').textContent(),/\$56\.00/);await page.locator('[data-close-evidence]').click();
 await page.locator('.routing-assumptions>summary').click();await page.locator('[data-route-input="matchingOrder"]').check();await page.locator('[data-route-input="orderSku"]').fill('wrong-variant');await page.locator('[data-route-input="orderSku"]').blur();assert.match(await page.locator('[data-route-id="ecommerce"]').textContent(),/does not match/);
 await page.locator('[data-route-input="orderSku"]').fill(await page.evaluate(()=>caseCtx('maya').line.sku));await page.locator('[data-route-input="orderSku"]').blur();await page.locator('[data-route-input="orderPrice"]').fill('180');await page.locator('[data-route-input="orderPrice"]').blur();assert.match(await page.locator('#tab-routing .manager-alert').textContent(),/Scenario meets/);
 await page.locator('#routing-save').click();await ready();assert.equal(await page.evaluate(()=>CASES.maya.networkPlan.recommended),'ecommerce');assert.equal(await page.evaluate(()=>Object.values(SYS.refunds).some(x=>x.case_id==='maya')),false);
 await role('customer');await page.locator('#tabbtn-return').click();await page.locator('[data-choose="refund"]').click();await page.locator('#m-store').check();await page.locator('#confirm-btn').click();await page.waitForFunction(()=>CASES.maya.status==='done'&&!WORK.busy);
 await role('store_manager');await page.locator('#tabbtn-store').click();await page.locator('[data-counter="maya"]').click();assert.equal(await page.locator('.customer-fact').count(),0);assert.equal(await page.locator('#counter-confirm').count(),1);await shot('inspection-separated');
 await page.locator('[data-grade="B"]').click();await page.locator('#counter-confirm').click();await page.waitForFunction(()=>CASES.maya.received&&!WORK.busy);await page.locator('#tabbtn-routing').click();await page.locator('.routing-assumptions>summary').click();assert.equal(await page.locator('[data-route-input="grade"]').isDisabled(),true);assert.equal(await page.locator('[data-route-input="grade"]').inputValue(),'B');assert.match(await page.locator('[data-route-id="ecommerce"]').textContent(),/Only inspected Grade A/);
 await page.setViewportSize({width:390,height:844});for(const tab of ['manager','store','routing']){await page.locator('#tabbtn-'+tab).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390),tab+' fits mobile');await shot(tab+'-mobile');}
 await page.locator('#theme-btn').click();await page.locator('#tabbtn-manager').click();await shot('manager-dark-mobile');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({separatePages:'passed',serviceFlag:'passed',managerDecisionPersistence:'passed',routingMarginAndExactSku:'passed',inspectionLock:'passed',mobile:'passed',browserErrors:0}));
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
