import {Workspace} from './workspace.mjs';
const w=new Workspace({path:':memory:'});
async function run(c){w.submit({version:w.version,mode:'scripted',...c});await w.completion;if(w.job.status==='error')throw new Error(w.job.error);return w.job.result;}
try{for(const id of Object.keys(w.api.CASES)){await run({kind:'investigate',caseId:id});console.log(id,w.api.CASES[id].status);}
await run({kind:'act',caseId:'maya',confirmed:true,choice:{option:'exchange',method:'store_dropoff',dropStore:'S112'}});console.log('act',w.api.CASES.maya.status);
await run({kind:'receipt',caseId:'maya',store:'S112',grade:'A',role:'store_associate'});console.log('receipt',w.api.CASES.maya.received);
await run({kind:'prevention'});console.log('prevention',w.api.STATE.prevention.status);
}finally{w.close();}
