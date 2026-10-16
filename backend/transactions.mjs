import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {fail} from './bedrock.mjs';

const safeNumber=(x,label)=>{if(x==null||x==='')return null;if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>100000)throw fail('invalid_assumption',`Enter a nonnegative number for ${label}.`);return x;};
const physical=s=>/^(REGULAR|OUTLET|ACCESSORIES)/.test(s.type);
const sums=`sum(m.rows) AS rows,sum(m.units) AS net_units,sum(m.retail) AS net_sales,sum(m.cost) AS net_cost,sum(m.margin) AS net_margin,
 sum(CASE WHEN m.kind='sale' THEN m.units ELSE 0 END) AS sold_units,
 sum(CASE WHEN m.kind='sale' THEN m.retail ELSE 0 END) AS sale_amount,
 sum(CASE WHEN m.kind='sale' THEN m.cost ELSE 0 END) AS sale_cost,
 sum(CASE WHEN m.kind='sale' THEN m.margin ELSE 0 END) AS sale_margin,
 sum(CASE WHEN m.kind='return' THEN -m.units ELSE 0 END) AS returned_units,
 sum(CASE WHEN m.kind='return' THEN m.rows ELSE 0 END) AS return_rows,
 sum(CASE WHEN m.kind='anomaly' THEN m.rows ELSE 0 END) AS anomaly_rows`;

export class Transactions {
  constructor(path){
    this.db=existsSync(path)?new DatabaseSync(path,{readOnly:true}):null;this.cache=new Map();
    this.manifest=this.db?JSON.parse(this.db.prepare("SELECT value FROM manifest WHERE key='manifest'").get().value):null;
    this.sites=this.db?this.db.prepare('SELECT * FROM sites ORDER BY banner,city,id').all():[];
  }
  ready(dataset){if(!this.db)throw fail('transactions_missing','Import the transaction file to open store-level evidence.',503);if(dataset&&dataset!==this.manifest.dataset_id)throw fail('dataset_changed','Reload the current transaction dataset.',409);}
  catalog(){this.ready();return {...this.manifest,banners:[...new Set(this.sites.map(s=>s.banner))],sites:this.sites,channels:['STR','WEB','INSTORE','WCC'],months:this.db.prepare('SELECT DISTINCT month FROM scope_monthly ORDER BY month').all().map(x=>x.month)};}
  scope(input={}){
    this.ready(input.dataset_id);const banner=input.banner||'ALDO_CA';
    if(!this.sites.some(s=>s.banner===banner))throw fail('bad_scope','Choose ALDO Canada or ALDO US.');
    const site=input.site||'',channel=input.channel||'',product=input.product||'';
    if(site&&!this.sites.some(s=>s.banner===banner&&s.id===site))throw fail('bad_scope','The site is outside this market.');
    if(channel&&!['STR','WEB','INSTORE','WCC'].includes(channel))throw fail('bad_scope','Choose a recorded channel.');
    if(product&&!this.db.prepare('SELECT id FROM products WHERE banner=? AND id=?').get(banner,product))throw fail('bad_scope','The product is outside this market.');
    const from=input.from||this.manifest.start.slice(0,7),to=input.to||this.manifest.end.slice(0,7);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(from)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(to)||from>to||from<this.manifest.start.slice(0,7)||to>this.manifest.end.slice(0,7))throw fail('bad_scope','Choose months inside the supplied period.');
    return {banner,site,channel,product,from,to};
  }
  query(scope){const clauses=['m.banner=?','m.month>=?','m.month<=?'],args=[scope.banner,scope.from,scope.to];for(const [k,c] of [['site','site'],['channel','channel'],['product','product']])if(scope[k]){clauses.push(`m.${c}=?`);args.push(scope[k]);}return {where:clauses.join(' AND '),args};}
  evidence(kind,args,body){return {...body,dataset_id:this.manifest.dataset_id,origin:'supplied-transactions',source:this.manifest.source,currency:null,limitations:this.manifest.limitations,citations:[`transactions:${this.manifest.dataset_id}:${kind}:${Buffer.from(JSON.stringify(args)).toString('base64url')}`]};}
  product(id){const p=this.db.prepare('SELECT * FROM products WHERE id=?').get(id);return p&&{...p,sample:JSON.parse(p.sample),identity:this.manifest.identity};}
  products(input={}){
    const s=this.scope({...input,product:''}),{where,args}=this.query(s),q=String(input.q||'').trim().slice(0,100),offset=Number(input.offset||0);
    if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw fail('invalid_query','Invalid product page.');
    const search=`(?='' OR instr(lower(p.name||' '||p.color||' '||p.size||' '||p.category),lower(?))>0)`;
    const table=s.site?'monthly':'market_monthly';
    const rows=this.db.prepare(`SELECT p.id,p.name,p.color,p.size,p.category,sum(CASE WHEN m.kind='sale' THEN m.units ELSE 0 END) sold,sum(CASE WHEN m.kind='return' THEN -m.units ELSE 0 END) returned FROM ${table} m JOIN products p ON p.id=m.product WHERE ${where} AND ${search} GROUP BY p.id ORDER BY sold DESC,p.id LIMIT 26 OFFSET ?`).all(...args,q,q,offset);
    return {products:rows.slice(0,25),more:rows.length>25,offset,scope:s,dataset_id:this.manifest.dataset_id};
  }
  overview(input={}){
    const s=this.scope(input),key=JSON.stringify(s);if(this.cache.has(key))return this.cache.get(key);
    const {where,args}=this.query(s),table=s.product?'monthly':'scope_monthly',productsTable=s.site?'monthly':'market_monthly';
    const totals=this.db.prepare(`SELECT ${sums},count(DISTINCT m.site) sites FROM ${table} m WHERE ${where}`).get(...args);
    totals.products=this.db.prepare(`SELECT count(DISTINCT m.product) n FROM ${productsTable} m WHERE ${where}`).get(...args).n;
    for(const k of Object.keys(totals))if(totals[k]==null)totals[k]=0;
    const first=s.from+'-01',last=new Date(Date.UTC(Number(s.to.slice(0,4)),Number(s.to.slice(5)),0)).toISOString().slice(0,10);
    const start=first<this.manifest.start?this.manifest.start:first,end=last>this.manifest.end?this.manifest.end:last;
    const days=(Date.parse(end)-Date.parse(start))/86400000+1;
    totals.return_to_sales_units=totals.sold_units?totals.returned_units/totals.sold_units:null;
    totals.sales_per_week=totals.sold_units/(days/7);
    const reasons=this.db.prepare(`SELECT reason,sum(rows) rows,sum(-units) units FROM ${table} m WHERE ${where} AND kind='return' GROUP BY reason ORDER BY units DESC,reason LIMIT 12`).all(...args);
    const by_channel=this.db.prepare(`SELECT channel,${sums} FROM ${table} m WHERE ${where} GROUP BY channel ORDER BY sold_units DESC`).all(...args);
    const top_products=this.db.prepare(`SELECT p.id,p.name,p.color,p.size,sum(CASE WHEN m.kind='sale' THEN m.units ELSE 0 END) sold,sum(CASE WHEN m.kind='return' THEN -m.units ELSE 0 END) returned FROM ${productsTable} m JOIN products p ON p.id=m.product WHERE ${where} GROUP BY p.id ORDER BY returned DESC,p.id LIMIT 10`).all(...args);
    const result=this.evidence('overview',s,{scope:s,period:{start,end,days},totals,reasons,by_channel,top_products,product:s.product?this.product(s.product):null,
      method:'All matching source rows contribute to net amounts. Consistent positive sale lines and negative return/adjustment lines supply the comparison measures. Anomalies are excluded from those measures only. Calendar-week pace does not account for stockouts, days a store was closed or product launch dates. Top products and reasons are ranked subsets, not the whole population.'});
    if(this.cache.size>=40)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,result);return result;
  }
  routing(input={}){
    const scope=this.scope({...input,site:''});if(!scope.product)throw fail('bad_scope','Choose a specific supplied product variant.');
    const history=this.overview(scope),receiving=input.receiving||'';
    if(receiving&&!this.sites.some(s=>s.banner===scope.banner&&s.id===receiving&&physical(s)))throw fail('bad_scope','Choose a physical receiving store in this market.');
    const assumptions={};for(const k of ['handling','transfer','shipping','packing','benchmarkPrice','benchmarkCost','unitCost'])assumptions[k]=safeNumber(input.assumptions?.[k],k);
    const grade=input.grade||'A';if(!['A','B','C','D'].includes(grade))throw fail('bad_scope','Select a valid scenario condition.');
    const shipFromStore=input.shipFromStore===true,inspected=input.inspected===true;
    const t=history.totals,benchmarkPrice=assumptions.benchmarkPrice??(t.sold_units?t.sale_amount/t.sold_units:null),benchmarkCost=assumptions.benchmarkCost??(t.sold_units?t.sale_cost/t.sold_units:null);
    const unitCost=assumptions.unitCost??(t.sold_units?t.sale_cost/t.sold_units:null);
    const benchmarkProfit=benchmarkPrice!=null&&benchmarkCost!=null?benchmarkPrice-benchmarkCost:null,benchmarkPct=benchmarkPrice>0?benchmarkProfit/benchmarkPrice:null;
    const {where,args}=this.query(scope);
    const observations=this.db.prepare(`SELECT m.site,${sums},group_concat(DISTINCT channel) channels FROM monthly m WHERE ${where} AND channel IN ('STR','INSTORE','WEB') GROUP BY m.site`).all(...args);
    const routes=observations.filter(r=>r.sold_units>0).map(r=>{
      const loc=this.sites.find(s=>s.banner===scope.banner&&s.id===r.site),online=loc.type==='ECOMM',outlet=loc.type.startsWith('OUTLET');
      const price=r.sale_amount/r.sold_units,recorded_cost=r.sale_cost/r.sold_units,cost=unitCost;
      const transfer=online?0:receiving?(receiving===r.site?0:assumptions.transfer):null;
      const fulfillment=online&&assumptions.shipping!=null&&assumptions.packing!=null?assumptions.shipping+assumptions.packing:online?null:0;
      const costsKnown=[cost,assumptions.handling,transfer,fulfillment].every(x=>x!=null);
      const contribution=costsKnown?price-cost-assumptions.handling-transfer-fulfillment:null,marginPct=price>0&&contribution!=null?contribution/price:null;
      const conditionOK=grade==='A'||grade==='B'&&outlet,channelOK=online||physical(loc);
      const marginPass=conditionOK&&channelOK&&contribution!=null&&benchmarkProfit!=null&&benchmarkPct!=null&&contribution+1e-8>=benchmarkProfit&&marginPct+1e-8>=benchmarkPct;
      return {id:r.site,site:loc,online,channels:r.channels,sold_units:r.sold_units,returned_units:r.returned_units,weekly_units:r.sold_units/(history.period.days/7),price,cost,recorded_cost,sale_amount:r.sale_amount,sale_cost:r.sale_cost,recorded_unit_margin:r.sale_margin/r.sold_units,handling:assumptions.handling,transfer,fulfillment,recoveryIfSold:costsKnown?price-assumptions.handling-transfer-fulfillment:null,contribution,marginPct,gap:contribution==null||benchmarkProfit==null?null:contribution-benchmarkProfit,marginPass,conditionOK,channelOK,
        checks:[!receiving&&'Select a receiving store',!costsKnown&&'Enter missing logistics costs',!conditionOK&&'Condition is unsuitable for this channel',!channelOK&&'Site type is unclassified',!inspected&&'Physical inspection not confirmed',online&&!shipFromStore&&'Ship-from-store capability not confirmed','Current demand, capacity and delivery quote still need verification'].filter(Boolean)};
    }).sort((a,b)=>Number(b.marginPass)-Number(a.marginPass)||(b.contribution??-Infinity)-(a.contribution??-Infinity)||b.weekly_units-a.weekly_units||a.id.localeCompare(b.id));
    return this.evidence('routing',{...scope,method_version:2,receiving,grade,shipFromStore,inspected,assumptions},{scope,method_version:2,unit_cost:{value:unitCost,source:assumptions.unitCost!=null?'User-entered returned-pair cost assumption':'Selected product sales cost / sold units across the selected market, period and channel',verified:false,total_cost:t.sale_cost,sold_units:t.sold_units},product:history.product,period:history.period,receiving,grade,assumptions,benchmark:{price:benchmarkPrice,cost:benchmarkCost,profit:benchmarkProfit,percent:benchmarkPct,source:assumptions.benchmarkPrice!=null||assumptions.benchmarkCost!=null?'User-entered scenario benchmark':'Recorded weighted-average sale in the selected product/period/channel',original_customer_order_verified:false},routes,candidate:routes.find(r=>r.marginPass)?.id||null,operational_recommendation:null,
      method:'Recorded price/cost/margin per unit use positive sale lines, weighted by units. Contribution = historical price − common returned-pair cost proxy − assumed handling − transfer − online fulfillment. The same returned-pair cost is used at every destination; historical destination costs are descriptive only. Cash recovered if sold excludes that already-paid product cost. A financial candidate must preserve benchmark dollars and percentage. Historical selling pace is units per calendar week, not a probability of resale. No exact original-order match or live fulfillment is established.'});
  }
  resolve(ref){this.ready();const m=/^transactions:([a-f0-9]{64}):(overview|routing):([A-Za-z0-9_-]{1,8000})$/.exec(ref||'');if(!m)throw fail('invalid_citation','Invalid transaction evidence reference.');this.ready(m[1]);let args;try{args=JSON.parse(Buffer.from(m[3],'base64url').toString());}catch{throw fail('invalid_citation','Invalid evidence arguments.');}if(!args||typeof args!=='object'||Array.isArray(args))throw fail('invalid_citation','Invalid evidence arguments.');if(m[2]==='routing'&&args.method_version!==2)throw fail('calculation_changed','This reference uses the earlier routing calculation. Read the original saved observation or run a new comparison.',409);return m[2]==='routing'?this.routing(args):this.overview(args);}
  close(){this.db?.close();}
}
