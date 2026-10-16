import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { fail } from './bedrock.mjs';

export class Evidence {
  constructor(path) {
    this.overviews=new Map();
    this.db = existsSync(path) ? new DatabaseSync(path, { readOnly: true }) : null;
    this.manifest = this.db ? JSON.parse(this.db.prepare("SELECT value FROM manifest WHERE key='manifest'").get().value) : null;
  }
  ready(dataset) {
    if (!this.db) throw fail('history_missing', 'Import the supplied files with npm run import:history before opening source records.', 503);
    if (dataset && dataset !== this.manifest.dataset_id) throw fail('dataset_changed', 'This evidence belongs to a different import. Reload the history.', 409);
  }
  scope(kind, args, body) {
    return { ...body, dataset_id: this.manifest.dataset_id, origin: 'supplied', limitations: this.manifest.limitations,
      citations: [`history:${this.manifest.dataset_id}:${kind}:${Buffer.from(JSON.stringify(args)).toString('base64url')}`] };
  }
  overview(banner = 'ALDO_CA') {
    this.ready();
    if(this.overviews.has(banner))return this.overviews.get(banner);
    const banners = this.db.prepare('SELECT DISTINCT banner FROM products ORDER BY banner').all().map(r => r.banner);
    if (!banners.includes(banner)) throw fail('bad_scope', 'Select a supplied brand and market.');
    const totals = this.db.prepare('SELECT count(*) AS rows,sum(qty) AS quantity,count(DISTINCT rkey) AS transactions,min(date) AS start,max(date) AS end FROM returns WHERE banner=?').get(banner);
    const reasons = this.db.prepare('SELECT reason,count(*) AS rows,sum(qty) AS quantity FROM returns WHERE banner=? GROUP BY reason ORDER BY rows DESC,reason').all(banner);
    const products = this.db.prepare('SELECT count(*) AS n FROM products WHERE banner=?').get(banner).n;
    const top_products = this.db.prepare('SELECT sku,name,rows,quantity FROM products WHERE banner=? ORDER BY rows DESC,sku LIMIT 10').all(banner);
    const result=this.scope('overview', [banner], { banner, banners, totals, reasons, products, top_products, currency:null, return_rate:null, sources: this.manifest.sources });this.overviews.set(banner,result);return result;
  }
  products({ banner = 'ALDO_CA', q = '', offset = 0 } = {}) {
    this.overview(banner);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw fail('invalid_query', 'Invalid page.');
    const query = String(q).slice(0, 100).trim();
    const where = 'banner=? AND (?=\'\' OR instr(lower(sku),lower(?))>0 OR instr(lower(name),lower(?))>0)';
    const args = [banner, query, query, query];
    return { products: this.db.prepare(`SELECT * FROM products WHERE ${where} ORDER BY rows DESC,sku LIMIT 25 OFFSET ?`).all(...args, offset),
      total: this.db.prepare(`SELECT count(*) AS n FROM products WHERE ${where}`).get(...args).n, offset, limit: 25, dataset_id: this.manifest.dataset_id };
  }
  product(banner, sku) {
    this.ready();
    const product = this.db.prepare('SELECT * FROM products WHERE banner=? AND sku=?').get(banner, sku);
    if (!product) throw fail('not_found', 'Product not found in this banner.', 404);
    const reasons = this.db.prepare('SELECT reason,count(*) AS rows,sum(qty) AS quantity FROM returns WHERE banner=? AND sku=? GROUP BY reason ORDER BY rows DESC,reason').all(banner, sku);
    const records = this.db.prepare('SELECT row,date,reason,status,qty,refund FROM returns WHERE banner=? AND sku=? ORDER BY date DESC,row DESC LIMIT 20').all(banner, sku);
    return this.scope('product', [banner, sku], { ...product, reasons, records, currency: null, return_rate: null });
  }
  record(row) {
    this.ready();
    if (!Number.isSafeInteger(row) || row < 1) throw fail('invalid_query', 'Invalid source row.');
    const raw = this.db.prepare('SELECT * FROM returns WHERE row=?').get(row);
    if (!raw) throw fail('not_found', 'Source row not found.', 404);
    const { okey, rkey, ...record } = raw;
    const ambiguousOrder = this.db.prepare('SELECT count(DISTINCT banner) AS n FROM returns WHERE okey=? AND sku=?').get(okey, raw.sku).n > 1;
    const ambiguousFee = this.db.prepare('SELECT count(DISTINCT banner) AS n FROM returns WHERE rkey=?').get(rkey).n > 1;
    const flags = this.db.prepare('SELECT count(*) AS n,count(flag) AS known,count(DISTINCT flag) AS values_n,min(flag) AS value FROM flags WHERE okey=? AND sku=?').get(okey, raw.sku);
    const fee = this.db.prepare('SELECT count(*) AS n,count(fee) AS known,count(DISTINCT fee) AS values_n,min(fee) AS value FROM fees WHERE rkey=?').get(rkey);
    const orderRows = this.db.prepare('SELECT DISTINCT date,style,size,category,requested,shipped FROM orders WHERE okey=? AND sku=? AND banner=? LIMIT 5').all(okey, raw.sku, raw.banner);
    const exchangeAmbiguous=this.db.prepare('SELECT count(DISTINCT banner) AS n FROM returns WHERE okey=?').get(okey).n>1;
    const exchanges = this.db.prepare('SELECT confidence,count(*) AS rows FROM exchanges WHERE okey=? GROUP BY confidence').all(okey);
    const supportingSources = [
      ['flags', 'SELECT rowid AS source_row,flag FROM flags WHERE okey=? AND sku=? LIMIT 10', [okey, raw.sku]],
      ['fees', 'SELECT rowid AS source_row,fee FROM fees WHERE rkey=? LIMIT 10', [rkey]],
      ['orders', 'SELECT row AS source_row,date,size,style FROM orders WHERE okey=? AND sku=? AND banner=? LIMIT 10', [okey, raw.sku, raw.banner]],
      ['exchanges', 'SELECT row AS source_row,confidence FROM exchanges WHERE okey=? LIMIT 10', [okey]],
    ].map(([dataset, sql, args]) => ({ ...this.manifest.sources.find(s => s.dataset === dataset), dataset,
      candidate_rows: this.db.prepare(sql).all(...args), note: 'At most 10 matching source rows, header excluded. Conflicting or cross-banner matches are not accepted as established facts.' }));
    return this.scope('return', [row], { record, currency: null,
      final_sale: !ambiguousOrder && flags.n && flags.n === flags.known && flags.values_n === 1 ? !!flags.value : null,
      transaction_fee_cents: !ambiguousFee && fee.n && fee.n === fee.known && fee.values_n === 1 ? fee.value : null,
      fee_scope: 'Whole return transaction; shown for context, not added once per item.',
      order_matches: orderRows, exchange_links: exchangeAmbiguous ? [] : exchanges,
      exchange_note: 'Original-order association only; purchased replacement SKU may differ. ASSUMED is not confirmed.',
      supporting_sources: supportingSources,
      source: { file: this.manifest.sources.find(s => s.dataset === 'returns').file, row, row_numbering:'One-based data record; header excluded.', sha256: this.manifest.sources.find(s => s.dataset === 'returns').sha256 } });
  }
  resolve(ref) {
    this.ready();
    const match = /^history:([a-f0-9]{64}):(overview|product|return):([A-Za-z0-9_-]{1,2000})$/.exec(ref || '');
    if (!match) throw fail('invalid_citation', 'Invalid evidence reference.');
    this.ready(match[1]);
    let args; try { args = JSON.parse(Buffer.from(match[3], 'base64url').toString()); } catch { throw fail('invalid_citation', 'Invalid evidence arguments.'); }
    if (!Array.isArray(args)) throw fail('invalid_citation', 'Invalid evidence arguments.');
    if (match[2] === 'overview' && args.length === 1 && typeof args[0] === 'string') return this.overview(...args);
    if (match[2] === 'product' && args.length === 2 && args.every(x => typeof x === 'string')) return this.product(...args);
    if (match[2] === 'return' && args.length === 1) return this.record(...args);
    throw fail('invalid_citation', 'Unsupported evidence reference.');
  }
  close() { this.db?.close(); }
}
