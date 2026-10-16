/* Shared planning model. Operational stock and money are never mutated here. */
function detectServiceConcern(text) {
  const clean = inputCheck(String(text || '').slice(0, 6000)).clean;
  const sentences = clean.split(/(?<=[.!?])\s+|\n/).filter(Boolean);
  const evidence = sentences.filter(s => {
    if (/\b(won't|will not|not going to|never would)\s+(post|leave|write|share)/i.test(s)) return false;
    const negative = /bad|poor|terrible|awful|horrible|rude|unhelpful|unacceptable|worst|frustrat|disappoint|angry|upset|one.star|1.star|negative/i.test(s);
    return negative && /review|social media|instagram|tiktok|facebook|twitter|reddit|yelp|google|customer service|service|return experience|return process/i.test(s);
  }).slice(0, 5);
  return { flagged:evidence.length>0, evidence, method:'Comment screening · manager confirmation required', reason:'Customer reports a poor return/service experience or mentions sharing a negative review.' };
}
function recordServiceConcern(caseId, text, source='Return conversation') {
  const cs=CASES[caseId], signal=detectServiceConcern(text); if(!signal.flagged)return null;
  const prior=cs.serviceConcern;
  const evidence=[...new Set([...(prior?.evidence||[]),...signal.evidence])].slice(-10);
  if(prior&&JSON.stringify(evidence)===JSON.stringify(prior.evidence))return prior;
  cs.serviceConcern={...signal,evidence,source,status:'pending',at:new Date().toISOString(),decision:null};
  return cs.serviceConcern;
}
const PLANNING_DISTANCE = {
  'Greater Montreal':{S112:4,S118:18,S131:26,S140:15,S205:198,S301:545,S410:254,OUT1:46},
  Ottawa:{S112:198,S118:187,S131:174,S140:211,S205:5,S301:448,S410:444,OUT1:165},
  Toronto:{S112:545,S118:548,S131:522,S140:551,S205:448,S301:6,S410:795,OUT1:524},
  'Quebec City':{S112:254,S118:263,S131:280,S140:251,S205:444,S301:795,S410:5,OUT1:285}
};
function planningDefaults(caseId) {
  const {c,line,ec,k}=caseCtx(caseId), distances=PLANNING_DISTANCE[c.region]||{};
  const nearby=DATA.locations.filter(x=>x.type==='store'&&Number.isFinite(distances[x.location_id])).sort((a,b)=>distances[a.location_id]-distances[b.location_id]);
  const nearest=nearby[0]?.location_id||null;
  const dc=invRow(line.sku,'DC-MTL');
  return {origin:CASES[caseId].received?.store||CASES[caseId].chosen?.dropStore||nearest||'S112',grade:CASES[caseId].received?.grade||k.photo.grade,
    handling:Number(ec.processing_cost),pack:2,onlineShip:8,onlineSold8w:dc?.units_sold_8w||0,onlineStock:dc?.on_hand_quantity||0,
    matchingOrder:false,orderSku:line.sku,orderPrice:caseCtx(caseId).st.price,orderDeadline:5,shipFromStore:true,
    nearest,distances,asOf:META.today};
}
function planReturnNetwork(caseId, input={}) {
  const {line,ec,st}=caseCtx(caseId), cs=CASES[caseId], d=planningDefaults(caseId);
  const s={...d,...Object.fromEntries(Object.entries(input).filter(([k])=>['origin','grade','handling','pack','onlineShip','onlineSold8w','onlineStock','matchingOrder','orderSku','orderPrice','orderDeadline','shipFromStore'].includes(k)))};
  for(const k of ['handling','pack','onlineShip','onlineSold8w','onlineStock','orderPrice','orderDeadline'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>100000)throw new Error('Enter a nonnegative, finite planning input for '+k+'.');
  if(!DATA.locations.some(l=>l.location_id===s.origin&&l.type==='store')||!['A','B','C','D'].includes(s.grade))throw new Error('Select a valid receiving store and grade.');
  if(typeof s.matchingOrder!=='boolean'||typeof s.shipFromStore!=='boolean'||typeof s.orderSku!=='string'||s.orderSku.length>150)throw new Error('Invalid online-order scenario.');
  if(cs.received){s.origin=cs.received.store;s.grade=cs.received.grade;}
  const cost=ec.estimated_cost, original= r2(line.selling_price-cost), originalPct=line.selling_price>0?original/line.selling_price:null;
  const transfer=(to)=>to===s.origin?{cost:0,days:0,known:true}:(()=>{const x=IDX.xfer[s.origin+'|'+to];return {cost:x?.estimated_shipping_cost??null,days:x?.typical_transit_days??null,known:!!x};})();
  const routes=[];
  const add=(row)=>{
    const costsKnown=[row.price,cost,s.handling,row.transport,row.fulfillment].every(Number.isFinite);
    const contribution=costsKnown?r2(row.price-cost-s.handling-row.transport-row.fulfillment):null;
    const expected=costsKnown&&Number.isFinite(row.probability)?r2(row.probability*(row.price-cost-row.fulfillment)-s.handling-row.transport):null;
    const marginPct=contribution!==null&&row.price>0?contribution/row.price:null;
    const gap=contribution===null?null:r2(contribution-original);
    const protects=!!(row.operational&&contribution!==null&&originalPct!==null&&contribution+0.001>=original&&marginPct+0.00001>=originalPct);
    routes.push({...row,cost,handling:s.handling,contribution,expected,marginPct,gap,protects,
      minimumPrice:costsKnown&&originalPct!==null&&originalPct<1?Math.ceil((Math.max(original+cost+s.handling+row.transport+row.fulfillment,(cost+s.handling+row.transport+row.fulfillment)/(1-originalPct))-1e-9)*100)/100:null});
  };
  for(const loc of DATA.locations.filter(l=>['store','outlet'].includes(l.type))) {
    const inv=invRow(line.sku,loc.location_id), t=transfer(loc.location_id);
    const sold=inv?.units_sold_8w??null, stock=inv?Math.max(0,inv.on_hand_quantity-(SYS.sold[line.sku+'|'+loc.location_id]||0)):null;
    const gradeOK=s.grade==='A'||s.grade==='B'&&loc.type==='outlet';
    const price=r2(st.price*(loc.type==='outlet'?(s.grade==='B'?0.6:0.7):1));
    const probability=sold!==null&&stock!==null?1-Math.exp(-(sold/8)*4/(stock+1)):null;
    const capacity=DATA.inventory.filter(x=>x.location_id===loc.location_id).reduce((n,x)=>n+x.on_hand_quantity,0)<loc.inventory_capacity;
    const blockers=[!gradeOK&&'Condition is not eligible for this resale channel',!t.known&&'Transfer quote missing',!capacity&&'Receiving capacity unavailable',!inv&&'SKU demand / stock missing'].filter(Boolean);
    add({id:'store:'+loc.location_id,name:loc.name,channel:loc.type==='outlet'?'Outlet resale':'Store resale',location:loc.location_id,price,transport:t.cost,fulfillment:0,days:t.days===null?null:t.days+loc.handling_days,sold8w:sold,stock,probability,operational:!blockers.length,blockers,demandBasis:'Synthetic SKU sales and inventory · 8 weeks',distance:d.distances[loc.location_id]??null});
  }
  const exact=s.orderSku===line.sku;
  const onlineBlockers=[s.grade!=='A'&&'Only inspected Grade A can be sold as new online',!s.shipFromStore&&'Receiving store cannot fulfill online orders',s.matchingOrder&&!exact&&'Online order SKU does not match size / colour / width',s.matchingOrder&&s.orderDeadline<2&&'Cannot meet the assumed two-day delivery promise'].filter(Boolean);
  add({id:'ecommerce',name:'Ship online from '+IDX.loc[s.origin].name,channel:s.matchingOrder?'Matching online order · simulated':'E-commerce demand · forecast',location:s.origin,price:s.matchingOrder?s.orderPrice:st.price,transport:0,fulfillment:r2(s.pack+s.onlineShip),days:2,sold8w:s.onlineSold8w,stock:s.onlineStock,
    probability:s.matchingOrder&&exact?1:1-Math.exp(-(s.onlineSold8w/8)*4/(s.onlineStock+1)),operational:!onlineBlockers.length,blockers:onlineBlockers,demandBasis:s.matchingOrder?'Assumed open order; exact SKU match, not a live order feed':'Synthetic e-commerce scenario; default demand is a DC-inventory proxy',distance:d.distances[s.origin]??null});
  routes.sort((a,b)=>Number(b.operational)-Number(a.operational)||(b.expected??-Infinity)-(a.expected??-Infinity));
  const feasible=routes.filter(r=>r.protects), bestRecovery=routes.find(r=>r.operational&&r.expected!==null)||null;
  const replacement=cs.decision?.options.find(o=>o.type==='exchange');
  const replacementSku=replacement?.sku, replacementCost=replacementSku?IDX.econ[IDX.sku[replacementSku]?.style_id]?.estimated_cost:null;
  const replacementSources=replacementSku&&d.nearest?DATA.locations.filter(l=>atp(replacementSku,l.location_id)>0).map(loc=>{
    const x=loc.location_id===d.nearest?{estimated_shipping_cost:0,typical_transit_days:0}:IDX.xfer[loc.location_id+'|'+d.nearest];
    const transferCost=x?.estimated_shipping_cost??null,days=x?x.typical_transit_days+IDX.loc[d.nearest].handling_days:null;
    const contribution=transferCost!==null&&Number.isFinite(replacementCost)?r2(line.selling_price-replacementCost-s.handling-transferCost):null;
    const marginPct=contribution!==null&&line.selling_price>0?contribution/line.selling_price:null;
    return {source:loc.name,sku:replacementSku,available:atp(replacementSku,loc.location_id),transferCost,days,contribution,marginPct,
      protects:contribution!==null&&originalPct!==null&&contribution+0.001>=original&&marginPct+0.00001>=originalPct&&days!==null&&days<=META.delivery_promise_days};
  }).sort((a,b)=>(a.transferCost??Infinity)-(b.transferCost??Infinity)):[];
  return {caseId,sku:line.sku,grade:s.grade,inspected:!!cs.received,origin:s.origin,nearest:d.nearest,distance:d.nearest?d.distances[d.nearest]:null,actualDropDistance:d.distances[s.origin]??null,
    originalPrice:line.selling_price,originalCost:cost,originalProfit:original,originalMarginPct:originalPct,inputs:s,routes,
    recommended:feasible[0]?.id||null,bestRecovery:bestRecovery?.id||null,nearestReplacement:{store:d.nearest,sources:replacementSources},
    status:feasible.length?'Scenario meets original unit-margin floor':'No option preserves the original unit margin',
    provenance:'Synthetic planning inputs. Customer region distances are assumptions, not geocoded home addresses. No live stock, open-order, shipping or store-capability feed is connected.',
    formula:'Contribution if sold = sale price − unit cost − inspection/handling − transfer − fulfillment. Expected contribution in 28 days = sale probability × (sale price − unit cost − fulfillment) − inspection/handling − transfer. Sell probability uses 1 − exp(−4 × weekly SKU sales ÷ (stock + 1)), a steady-demand scenario approximation. Unsold stock stays inventory; no salvage proceeds assumed. Original benchmark = price originally paid − unit cost (gross profit, before original fulfillment costs).',
    limitation:'Margin checks use dollars per unit and percentage on resale; a forecast cannot guarantee the original order’s profit after a refund. Refunds, replacement remedies and resale are separate ledgers and must not be added as savings.',at:new Date().toISOString()};
}
function managerRemedies(caseId) {
  const cs=CASES[caseId], {line}=caseCtx(caseId);
  return (cs.decision?.options||[]).filter(o=>o.eligible!==false).map((o,i)=>{
    const label={exchange:'Fit-corrected exchange + convenient collection',smart_credit:'Store credit + approved bonus + suitable picks',store_credit:'Store credit + personal assistance',refund:'Refund + convenient return',keep_it:'Eligible refund without a return'}[o.type]||o.type;
    return {id:o.type,label,recommended:o.type===cs.decision.recommended,details:o.type==='exchange'?'Offer the agent’s eligible replacement. Nearest-store availability and transfer costs are checked separately.':o.type==='smart_credit'?'Use only the picks and bonus already approved by the existing policy.':o.type==='refund'?'Keep the refund choice visible. Receipt, inspection and existing approvals still apply.':'Explain this saved eligible option and ask for the customer’s choice.',amount:line.selling_price,option:o};
  }).sort((a,b)=>Number(b.recommended)-Number(a.recommended));
}
function saveManagerDecision(caseId,option,note,role) {
  if(!['store_manager','service_lead','supervisor'].includes(role))throw new Error('A store manager or service lead must record this recommendation.');
  const cs=CASES[caseId];if(!cs)throw new Error('Case not found.');
  if(option!=='contact_customer'&&!managerRemedies(caseId).some(o=>o.id===option))throw new Error('Choose a currently eligible saved remedy.');
  const clean=inputCheck(String(note||'').slice(0,1000)).clean;if(clean.trim().length<3)throw new Error('Add a brief reason for the customer follow-up.');
  if(/(delete|remove|edit|take down).{0,40}(review|post)|(?:refund|discount|credit).{0,30}(?:only if|in exchange for)/i.test(clean))throw new Error('Customer remedies cannot be conditional on changing or deleting a review.');
  const result={option,note:clean,by:role,at:new Date().toISOString(),status:'Recommended · customer agreement still required'};
  cs.managerDecision=result;if(cs.serviceConcern){cs.serviceConcern.status='reviewed';cs.serviceConcern.decision=result;}
  return result;
}
