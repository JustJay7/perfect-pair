import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from './workspace.mjs';
const dir=mkdtempSync(join(tmpdir(),'pp-scoped-')),path=join(dir,'state.sqlite');let w=new Workspace({path});let checks=0;
const ok=(v)=>{assert.ok(v);checks++};
async function run(c){w.submit({version:w.version,mode:'scripted',...c});await w.completion;return w.job;}
try{
 await run({kind:'investigate',caseId:'maya'});ok(w.job.status==='completed');
 const stale=w.version;
 w.submit({kind:'act',version:w.version,mode:'scripted',caseId:'maya',confirmed:true,choice:{option:'exchange',method:'store_dropoff',dropStore:'S112'}});
 assert.throws(()=>w.submit({kind:'reset',version:w.version}),/Another workflow/);checks++;
 await w.completion;ok(w.job.status==='completed');ok(Object.keys(w.api.SYS.exchanges).length===1);
 assert.throws(()=>w.submit({kind:'reset',version:stale}),/changed/);checks++;
 const replay=w.saveReplay('maya');const snap=w.store.readReplay(replay);ok(snap.evidence.length>0);ok(snap.policy.length>0||typeof snap.policy==='object');
 w.close();w=new Workspace({path});ok(w.api.CASES.maya.status==='done');ok(w.store.readReplay(replay).evidence.length===snap.evidence.length);
 await run({kind:'act',caseId:'maya',confirmed:true,choice:{option:'refund',method:'carrier'}});ok(w.job.status==='error');ok(Object.keys(w.api.SYS.exchanges).length===1&&Object.keys(w.api.SYS.refunds).length===0);
 await run({kind:'receipt',caseId:'maya',store:'S112',grade:'A',role:'customer'});ok(w.job.status==='error');
 await run({kind:'receipt',caseId:'maya',store:'S112',grade:'A',role:'store_associate'});ok(w.job.status==='completed');
 await run({kind:'receipt',caseId:'maya',store:'S112',grade:'C',role:'store_associate'});ok(w.job.status==='error');
 await run({kind:'investigate',caseId:'jordan'});const review=Object.values(w.api.SYS.reviews).find(r=>r.case_id==='jordan'&&r.status==='pending');ok(review);
 await run({kind:'review',reviewId:review.id,choice:'more_info',role:'customer'});ok(w.job.status==='error');
 await run({kind:'review',reviewId:review.id,choice:'more_info',role:'store_manager'});ok(w.job.status==='completed');
 await run({kind:'prevention'});ok(w.job.status==='completed');
 const o=w.evidence.overview('ALDO_CA'),sku=o.top_products[0].sku;
 await run({kind:'history',agent:'prevention',banner:'ALDO_CA',dataset_id:o.dataset_id,sku});ok(w.job.status==='completed');
 const product=w.evidence.product('ALDO_CA',sku);await run({kind:'history',agent:'resolution',banner:'ALDO_CA',dataset_id:o.dataset_id,sku,row:product.records[0].row});ok(w.job.status==='completed');
 const h=w.historyRuns[0];ok(h.findings.every(f=>f.citations.length));const saved=w.saveReplay(null,h.id);ok(w.store.readReplay(saved).history.observations.length===2);
 const c=w.api.DATA.skus[0];await run({kind:'custom',spec:{sku:c.sku,words:'The shoes are too small',grade:'A',name:'Test',days_since_delivery:5,region:'Greater Montreal',matches:true}});ok(w.job.status==='completed');
 console.log(`${checks} persistence, authorization, concurrency, replay and original-evidence checks passed.`);
}finally{w.close();rmSync(dir,{recursive:true,force:true});}
