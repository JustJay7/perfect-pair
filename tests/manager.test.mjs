import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../backend/workspace.mjs';
function fixture(t,service){const dir=mkdtempSync(join(tmpdir(),'pp-manager-'));let w=new Workspace({path:join(dir,'work.sqlite'),historyPath:join(dir,'missing.sqlite'),service});t.after(()=>{w.close();rmSync(dir,{recursive:true,force:true});});return {get w(){return w;},restart(){w.close();w=new Workspace({path:join(dir,'work.sqlite'),historyPath:join(dir,'missing.sqlite'),service});return w;}};}
async function command(w,c,status='completed'){w.submit({mode:'scripted',role:'store_manager',version:w.version,...c});await w.completion;assert.equal(w.job.status,status,w.job.error);return w.job.result;}
const moneyState=w=>JSON.stringify(['refunds','credits','exchanges','holds','labels','routes'].map(k=>w.api.SYS[k]));
test('negative-review concerns persist, do not create abuse flags, and only staff can record eligible follow-up',async t=>{
 const f=fixture(t),w=f.w;await command(w,{kind:'investigate',caseId:'maya'});const before=moneyState(w);
 const text='The return process was terrible. I will post a negative review on Instagram about this customer service.';
 await command(w,{kind:'service-comment',caseId:'maya',text,role:'customer'});const c=w.api.CASES.maya;
 assert.equal(c.serviceConcern.status,'pending');assert.equal(c.flags.suspected_abuse||false,false);
 const count=c.serviceConcern.evidence.length;await command(w,{kind:'service-comment',caseId:'maya',text});assert.equal(c.serviceConcern.evidence.length,count);
 await command(w,{kind:'manager-decision',caseId:'maya',option:'refund',note:'Explain the refund and arrange a convenient return.',role:'customer'},'error');
 await command(w,{kind:'manager-decision',caseId:'maya',option:'free_extra_pair',note:'Give a free pair.'},'error');
 await command(w,{kind:'manager-decision',caseId:'maya',option:'refund',note:'Delete your review for the refund.'},'error');
 await command(w,{kind:'manager-decision',caseId:'maya',option:'refund',note:'Call to explain the refund and nearest drop-off.'});
 assert.equal(c.serviceConcern.status,'reviewed');assert.equal(c.chosen,null);assert.equal(moneyState(w),before);
 const again=f.restart();assert.equal(again.api.CASES.maya.managerDecision.option,'refund');assert.equal(again.api.CASES.maya.serviceConcern.status,'reviewed');
 await command(again,{kind:'service-comment',caseId:'maya',text:'The staff were rude and customer service was awful.',source:'Staff-recorded customer comment'});assert.equal(again.api.CASES.maya.serviceConcern.status,'pending');assert.equal(again.api.CASES.maya.serviceConcern.source,'Staff-recorded customer comment');
});
test('screening ignores positive or explicitly negated review intentions and survives investigation',async t=>{
 const {w}=fixture(t);for(const text of ['I love this product and will post a great review.','I will not post a negative review.','The shoes are too narrow.']){const r=await command(w,{kind:'service-comment',caseId:'maya',text});assert.equal(r,null);}
 await command(w,{kind:'service-comment',caseId:'maya',text:'Terrible customer service. I will leave a bad review.'});await command(w,{kind:'investigate',caseId:'maya'});assert.equal(w.api.CASES.maya.serviceConcern.status,'pending');assert.equal(w.api.CASES.maya.flags.suspected_abuse||false,false);
});
test('route calculations separate original margin, expected recovery and operational feasibility',async t=>{
 const {w}=fixture(t),before=moneyState(w);
 const p=await command(w,{kind:'manager-plan',caseId:'maya',inputs:{origin:'S112',grade:'A',handling:6,pack:2,onlineShip:8,matchingOrder:true,orderPrice:130}});
 assert.equal(p.originalProfit,72);assert.equal(p.recommended,null);assert.ok(p.bestRecovery);
 const online=p.routes.find(r=>r.id==='ecommerce');assert.equal(online.contribution,56);assert.equal(online.expected,56);assert.equal(online.gap,-16);assert.equal(online.protects,false);assert.equal(online.probability,1);
 const local=p.routes.find(r=>r.id==='store:S112');assert.equal(local.transport,0);assert.equal(local.contribution,66);assert.equal(local.gap,-6);
 assert.equal(p.nearest,'S112');assert.equal(moneyState(w),before);
 const atFloor=w.api.planReturnNetwork('maya',{matchingOrder:true,orderPrice:online.minimumPrice}).routes.find(r=>r.id==='ecommerce');assert.equal(atFloor.protects,true);
 const eligible=await command(w,{kind:'manager-plan',caseId:'maya',inputs:{matchingOrder:true,orderPrice:180}});assert.equal(eligible.recommended,'ecommerce');assert.equal(eligible.routes.find(r=>r.id==='ecommerce').protects,true);
});
test('online SKU mismatch, deadline, capability and condition block fulfillment',t=>{
 const{w}=fixture(t);for(const input of [{matchingOrder:true,orderSku:'wrong-size'},{matchingOrder:true,orderDeadline:1},{shipFromStore:false},{grade:'B'},{grade:'C'},{grade:'D'}]){const p=w.api.planReturnNetwork('maya',{orderPrice:500,...input}),e=p.routes.find(r=>r.id==='ecommerce');assert.equal(e.operational,false);assert.equal(e.protects,false);}
 for(const grade of ['C','D']){const p=w.api.planReturnNetwork('maya',{grade});assert.equal(p.recommended,null);assert.equal(p.bestRecovery,null);}
 assert.throws(()=>w.api.planReturnNetwork('maya',{handling:-1}));assert.throws(()=>w.api.planReturnNetwork('maya',{onlineShip:NaN}));assert.throws(()=>w.api.planReturnNetwork('maya',{origin:'unknown'}));
});
test('missing transfer quotes are unknown; replacements require stock and margin; inspection overrides planning grade',async t=>{
 const {w}=fixture(t);await command(w,{kind:'investigate',caseId:'maya'});
 const p=w.api.planReturnNetwork('maya');assert.ok(p.nearestReplacement.sources.length);assert.ok(p.nearestReplacement.sources.every(x=>x.available>0));
 const quote=w.api.IDX.xfer['S112|S118'];delete w.api.IDX.xfer['S112|S118'];
 const absent=w.api.planReturnNetwork('maya',{origin:'S112'}).routes.find(r=>r.id==='store:S118');
 assert.equal(absent.transport,null);assert.equal(absent.operational,false);assert.equal(absent.contribution,null);w.api.IDX.xfer['S112|S118']=quote;
 await command(w,{kind:'act',caseId:'maya',confirmed:true,choice:{option:'refund',method:'store_dropoff',dropStore:'S112'}});
 await command(w,{kind:'receipt',caseId:'maya',store:'S112',grade:'B'});
 const inspected=w.api.planReturnNetwork('maya',{grade:'A',origin:'S118'});assert.equal(inspected.grade,'B');assert.equal(inspected.origin,'S112');assert.equal(inspected.routes.find(r=>r.id==='ecommerce').operational,false);
});
test('manager planning enforces role, saves snapshots and validates live model choices',async t=>{
 let invalid=false;const service={ready:true,config:{modelId:'mock-opus'},async start(){return{id:'r',done:true,text:JSON.stringify({summary:'Review the computed alternatives.',recommended_route_id:invalid?'ecommerce':null,remedy_ids:[]})};},cancel(){}};
 const f=fixture(t,service),w=f.w;
 await command(w,{kind:'manager-plan',caseId:'maya',role:'customer'},'error');assert.equal(w.api.CASES.maya.networkPlan,undefined);
 await command(w,{kind:'manager-plan',caseId:'maya',mode:'live'});assert.equal(w.api.CASES.maya.networkPlan.agent.model,'mock-opus');
 service.config.thoroughModelId='mock-thorough';await command(w,{kind:'manager-plan',caseId:'maya',mode:'live',tier:'default'});assert.equal(w.api.CASES.maya.networkPlan.agent.model,'mock-thorough');
 invalid=true;await command(w,{kind:'manager-plan',caseId:'maya',mode:'live'},'error');assert.equal(w.job.code,'invalid_plan');
 assert.equal(f.restart().api.CASES.maya.networkPlan.agent.model,'mock-thorough');
});
