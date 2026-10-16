const assert=require('node:assert/strict'),{mkdtempSync,rmSync,mkdirSync}=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os'),{once}=require('node:events'),{chromium}=require('playwright');
(async()=>{
 const {createServer}=await import('../backend/server.mjs'),{historyFixture}=await import('./history-fixture.mjs');
 const dir=mkdtempSync(join(tmpdir(),'pp-navigation-')),historyPath=join(dir,'history.sqlite');historyFixture(historyPath);
 const server=createServer({workspacePath:join(dir,'work.sqlite'),historyPath});server.listen(0,'127.0.0.1');await once(server,'listening');const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],visited=new Set();page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
  const ready=()=>page.waitForFunction(()=>WORK.ready&&!WORK.busy),role=r=>page.locator('#workspace-role').selectOption(r);
  const check=async id=>{assert.equal(await page.evaluate(()=>STATE.tab),id);assert.equal(await page.locator('.tab-panel:not([hidden])').count(),1);assert.ok((await page.locator('#tab-'+id).textContent()).trim().length>20);visited.add(id);};
  const shot=async name=>{if(process.env.PP_SCREENSHOTS){mkdirSync(process.env.PP_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.PP_SCREENSHOTS,name+'.png'),fullPage:true});}};
  await page.goto('http://127.0.0.1:'+server.address().port);await ready();await check('return');await page.locator('#tabbtn-scenarios').click();await check('scenarios');
  await role('store_manager');await check('manager');assert.equal(await page.locator('#tabs [role=tab]').count(),2);await shot('store-work-queue');
  await page.locator('#tab-manager [data-tab="approvals"]').click();await check('approvals');assert.equal(await page.locator('#tabbtn-manager').getAttribute('aria-selected'),'true');await page.locator('#section-manager').click();await check('manager');
  await page.locator('#tabbtn-store').click();await check('store');await page.locator('#section-routing').click();await check('routing');assert.equal(await page.locator('#tabbtn-store').getAttribute('aria-selected'),'true');await shot('store-process-returns');
  await role('customer_service');await check('inbox');assert.equal(await page.locator('#tabs [role=tab]').count(),3);await shot('service-cases');
  await page.locator('#tab-inbox [data-open-case="maya"]').click();await check('return');assert.equal(await page.evaluate(()=>STATE.active),'maya');await page.locator('#section-inbox').click();await check('inbox');
  await page.locator('#tab-inbox [data-tab="approvals"]').click();await check('approvals');await page.locator('#section-inbox').click();await page.locator('#tab-inbox [data-tab="manager"]').click();await check('manager');
  await page.locator('#tabbtn-prevention').click();await check('prevention');await page.locator('#section-history').click();await page.waitForSelector('#history-banner');await check('history');assert.equal(await page.locator('#tabbtn-prevention').getAttribute('aria-selected'),'true');
  await page.locator('#tabbtn-dashboard').click();await check('dashboard');for(const id of ['data','audit','evals','how']){await page.locator('#workspace-tool').selectOption(id);await check(id);assert.equal(await page.locator('#tabbtn-dashboard').getAttribute('aria-selected'),'true');}await shot('secondary-tools');
  for(const r of ['customer','store_manager','customer_service']){await role(r);const landing=await page.evaluate(()=>workspaceLanding());await page.evaluate(()=>showTab('home'));await check(landing);assert.equal(await page.locator('#tabbtn-home').count(),0);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));await shot(r+'-mobile');}
  assert.deepEqual([...visited].sort(),['return','scenarios','manager','approvals','store','routing','inbox','prevention','history','dashboard','data','audit','evals','how'].sort());assert.deepEqual(errors,[]);
  console.log(JSON.stringify({all14RetainedViews:'reachable',duplicateHome:'removed',roleLandings:'passed',caseBackLinks:'passed',groupedApprovalsAndRouting:'passed',secondaryTools:'passed',mobile:'passed',browserErrors:0}));
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
