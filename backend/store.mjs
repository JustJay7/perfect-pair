import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const canonical = v => JSON.stringify(v && typeof v === 'object' ? Array.isArray(v) ? v.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, JSON.parse(canonical(v[k]))])) : v);
export const sha = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export class Store {
  constructor(path) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      this.lock = path + '.lock';
      try { this.acquireLock(); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const pid = Number(readFileSync(this.lock, 'utf8'));
        let alive = true;
        try { if(Number.isSafeInteger(pid) && pid > 0)process.kill(pid, 0); } catch(e) { if(e.code==='ESRCH')alive=false; }
        if(alive)throw new Error('This saved workspace is already open in another server. Use that server or choose a different PP_STATE_PATH.');
        unlinkSync(this.lock); this.acquireLock();
      }
    }
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS actions (key TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, case_id TEXT, body TEXT, at TEXT);
      CREATE TABLE IF NOT EXISTS replays (id TEXT PRIMARY KEY, body TEXT NOT NULL, checksum TEXT NOT NULL, at TEXT NOT NULL);`);
  }
  acquireLock() { const fd=openSync(this.lock,'wx',0o600);try{writeFileSync(fd,String(process.pid));}finally{closeSync(fd);} }
  load() { const row = this.db.prepare('SELECT body FROM state WHERE id=1').get(); return row ? JSON.parse(row.body) : null; }
  save(state) { this.db.prepare('INSERT INTO state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(JSON.stringify(state)); }
  getAction(key) { const r = this.db.prepare('SELECT * FROM actions WHERE key=?').get(key); return r && { payload: JSON.parse(r.payload), result: JSON.parse(r.result) }; }
  commit(state, action) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.save(state);
      if (action) this.db.prepare('INSERT INTO actions VALUES (?,?,?,?)').run(action.key, canonical(action.payload), JSON.stringify(action.result), new Date().toISOString());
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  journal(kind, caseId, body) { this.db.prepare('INSERT INTO journal(kind,case_id,body,at) VALUES(?,?,?,?)').run(kind, caseId || null, JSON.stringify(body), new Date().toISOString()); }
  replay(body) {
    const id = randomUUID(), at = new Date().toISOString(), text = JSON.stringify({ ...body, captured_at: at, action_execution: false });
    this.db.prepare('INSERT INTO replays VALUES(?,?,?,?)').run(id, text, sha(text), at);
    return id;
  }
  replays() { return this.db.prepare("SELECT id,at,json_extract(body,'$.label') AS label,json_extract(body,'$.mode') AS mode FROM replays ORDER BY at DESC LIMIT 100").all(); }
  readReplay(id) {
    const r = this.db.prepare('SELECT * FROM replays WHERE id=?').get(id);
    if (!r) throw Object.assign(new Error('Replay not found.'), { status: 404, code: 'not_found' });
    if (sha(r.body) !== r.checksum) throw Object.assign(new Error('Replay integrity check failed.'), { status: 409, code: 'replay_changed' });
    return { id, checksum: r.checksum, ...JSON.parse(r.body) };
  }
  close() { this.db.close(); if(this.lock){unlinkSync(this.lock);this.lock=null;} }
}
