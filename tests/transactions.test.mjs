import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Transactions} from '../backend/transactions.mjs';
import {Workspace} from '../backend/workspace.mjs';
import {transactionFixture} from './transactions-fixture.mjs';
function fixture(t,service){const dir=mkdtempSync(join(tmpdir(),'pp-transactions-')),path=join(dir,'transactions.sqlite'),dataset=transactionFixture(path),e=new Transactions(path),w=new Workspace({path:join(dir,'workspace.sqlite'),transactionPath:path,historyPath:join(dir,'missing.sqlite'),service});t.after(()=>{e.close();w.close();rmSync(dir,{recursive:true,force:true});});return {e,w,dataset,path};}
async function command(w,c,status='completed'){w.submit({kind:'transactions',role:'supervisor',agent:'prevention',mode:'scripted',version:w.version,...c});await w.completion;assert.equal(w.job.status,status,w.job.error);}
test('transaction aggregates retain signed net totals while comparison excludes inconsistent source signs',t=>{
 const{e}=fixture(t),a=e.overview({banner:'ALDO_CA'}),b=e.overview({banner:'ALDO_US'});
 assert.equal(a.totals.rows,6);assert.equal(a.totals.net_sales,650);assert.equal(a.totals.net_cost,260);assert.equal(a.totals.net_margin,390);assert.equal(a.totals.sold_units,11);assert.equal(a.totals.returned_units,1);assert.equal(a.totals.anomaly_rows,1);assert.equal(a.totals.return_to_sales_units,1/11);assert.equal(a.period.days,28);assert.equal(a.totals.sales_per_week,11/4);assert.equal(a.reasons[0].reason,'11');assert.equal(b.totals.net_sales,140);assert.equal(a.currency,null);
 assert.equal(e.overview({banner:'ALDO_CA',site:'S1',from:'2025-02',to:'2025-02'}).totals.sold_units,7);
 assert.equal(e.overview({banner:'ALDO_CA',channel:'WEB'}).totals.sold_units,3);
 assert.equal(e.overview({banner:'ALDO_CA',product:'P1'}).totals.sold_units,6);
 assert.equal(e.overview({banner:'ALDO_CA',site:'S2',from:'2025-03'}).totals.rows,0);
});
test('transaction catalog, product search and evidence remain in the selected scope',t=>{
 const{e,dataset}=fixture(t);assert.equal(e.catalog().sites.length,4);assert.equal(e.products({banner:'ALDO_CA',q:'Black'}).products[0].id,'P1');assert.equal(e.products({banner:'ALDO_CA',site:'S2',q:'Red'}).products.length,0);
 for(const s of [{banner:'CIS_CA'},{banner:'ALDO_CA',site:'U1'},{banner:'ALDO_CA',product:'U1'},{from:'2025-04'},{from:'2025-03',to:'2025-02'},{channel:'bogus'}])assert.throws(()=>e.overview(s));
 const p=e.overview({product:'P1'}),ref=p.citations[0];assert.equal(e.resolve(ref).product.id,'P1');assert.equal(e.resolve(ref).source.rows,7);assert.throws(()=>e.resolve(ref.replace(dataset,'f'.repeat(64))),x=>x.code==='dataset_changed');
 assert.throws(()=>e.products({offset:-1}));
});
test('actual routing separates recorded benchmark from missing costs and validates both margin floors',t=>{
 const{e}=fixture(t),p=e.routing({product:'P1'});assert.equal(p.candidate,null);assert.equal(p.benchmark.price,100);assert.equal(p.benchmark.cost,40);assert.equal(p.benchmark.profit,60);assert.equal(p.benchmark.original_customer_order_verified,false);assert.ok(p.routes.every(r=>r.contribution===null));
 const input={product:'P1',receiving:'S1',assumptions:{handling:2,transfer:3,shipping:5,packing:1}};
 const q=e.routing(input),web=q.routes.find(r=>r.id==='WEB');assert.equal(web.contribution,62);assert.equal(web.marginPass,false);assert.equal(q.candidate,null);
 const good=e.routing({...input,assumptions:{...input.assumptions,benchmarkPrice:100,benchmarkCost:45}});assert.equal(good.candidate,'WEB');assert.equal(good.operational_recommendation,null);assert.ok(good.routes[0].checks.includes('Ship-from-store capability not confirmed'));
 assert.equal(e.resolve(good.citations[0]).candidate,'WEB');
 assert.equal(e.routing({...input,grade:'B'}).routes.find(r=>r.id==='WEB').conditionOK,false);assert.ok(e.routing({...input,grade:'D'}).routes.every(r=>!r.marginPass));
 assert.throws(()=>e.routing({...input,assumptions:{transfer:-3}}));assert.throws(()=>e.routing({...input,receiving:'U1'}));
});
test('actual investigations save source evidence and replay without touching operational cases',async t=>{
 const{w,dataset}=fixture(t),before=JSON.stringify(w.api.exportCaseWorkspace().systems);await command(w,{dataset_id:dataset,scope:{banner:'ALDO_CA',site:'S1'}});
 const run=w.historyRuns[0];assert.equal(run.source,'transactions');assert.equal(run.status,'completed');assert.equal(run.observations[0].result.scope.site,'S1');assert.equal(JSON.stringify(w.api.exportCaseWorkspace().systems),before);assert.equal(w.store.readReplay(w.saveReplay(null,run.id)).history.observations[0].result.totals.sold_units,7);
 await command(w,{dataset_id:dataset,agent:'routing',scope:{product:'P1',receiving:'S1'}});assert.equal(w.historyRuns[0].agent,'routing');assert.equal(w.historyRuns[0].observations[0].result.operational_recommendation,null);
 await command(w,{dataset_id:dataset,role:'customer',scope:{}},'error');assert.equal(w.job.code,'role_required');await command(w,{dataset_id:'f'.repeat(64),scope:{}},'error');assert.equal(w.job.code,'dataset_changed');
});
test('live transaction tools are fixed-scope and require cited findings',async t=>{
 let bad=false;const service={ready:true,async start(){return {id:'mock',tools:[{name:'transaction_evidence',input:{banner:'ALDO_US'},toolUseId:'t'}]};},async resume(id,results){assert.equal(results[0].result.scope.banner,'ALDO_CA');return {id,done:true,modelId:'mock',text:JSON.stringify({summary:'Recorded transactions',findings:[{observation:'Six sold units for this variant.',uncertainty:'Stock is unknown.',citations:bad?['invented']:results[0].result.citations}],next_steps:[]})};},cancel(){}};
 const{w,dataset}=fixture(t,service);await command(w,{mode:'live',dataset_id:dataset,scope:{banner:'ALDO_CA',product:'P1'}});assert.equal(w.historyRuns[0].model,'mock');bad=true;await command(w,{mode:'live',dataset_id:dataset,scope:{banner:'ALDO_CA',product:'P1'}},'error');assert.equal(w.job.code,'uncited_findings');
});
test('one returned pair keeps one cost across destinations and target overrides remain separate',t=>{
 const{e,path}=fixture(t),db=new DatabaseSync(path);
 for(const table of ['monthly','market_monthly','scope_monthly'])db.exec(`UPDATE ${table} SET cost=180,margin=150 WHERE channel='WEB'`);db.close();
 const input={product:'P1',receiving:'S1',assumptions:{handling:2,transfer:3,shipping:5,packing:1}};
 const p=e.routing(input),web=p.routes.find(r=>r.id==='WEB');
 assert.equal(p.unit_cost.value,50);assert.ok(p.routes.every(r=>r.cost===50));assert.equal(web.recorded_cost,60);assert.equal(web.contribution,52);assert.equal(web.recoveryIfSold,102);
 const override=e.routing({...input,assumptions:{...input.assumptions,unitCost:30}});
 assert.equal(override.benchmark.cost,50);assert.ok(override.routes.every(r=>r.cost===30));assert.equal(override.routes.find(r=>r.id==='WEB').contribution,72);
 assert.throws(()=>e.routing({...input,assumptions:{unitCost:-1}}));
 const old=p.citations[0].replace(/:[^:]+$/,':'+Buffer.from(JSON.stringify(input)).toString('base64url'));
 assert.throws(()=>e.resolve(old),x=>x.code==='calculation_changed');
});
