import assert from 'node:assert/strict';
import {Workspace} from './workspace.mjs';
let passed=0;
async function command(w,c){w.submit({version:w.version,mode:'scripted',...c});await w.completion;assert.notEqual(w.job.status,'error',w.job.error);}
const seed=new Workspace({path:':memory:'});const ids=Object.keys(seed.api.CASES);seed.close();
for(const id of ids){const probe=new Workspace({path:':memory:'});await command(probe,{kind:'investigate',caseId:id});const options=probe.api.CASES[id].decision?.options?.map(x=>x.type)||[];probe.close();
 for(const option of options){const w=new Workspace({path:':memory:'});try{await command(w,{kind:'investigate',caseId:id});await command(w,{kind:'act',caseId:id,confirmed:true,choice:{option,method:option==='keep_it'?'none':'store_dropoff',dropStore:'S112'}});assert.ok(['done','needs_person','awaiting_approval'].includes(w.api.CASES[id].status),id+': '+w.api.CASES[id].status);passed++;}finally{w.close();}}
}
for(const choice of ['approve_refund','approve_credit','approve_exchange']){const w=new Workspace({path:':memory:'});try{await command(w,{kind:'investigate',caseId:'noah'});const r=Object.values(w.api.SYS.reviews).find(r=>r.case_id==='noah'&&r.status==='pending');await command(w,{kind:'review',reviewId:r.id,choice,consent:{how:'in store'},role:w.api.reviewRole(r)==='manager'?'store_manager':'store_associate'});assert.ok(!w.api.CASES.noah.error,w.api.CASES.noah.error?.copy);passed++;}finally{w.close();}}
console.log(`${passed} scripted resolution and approval paths passed.`);
