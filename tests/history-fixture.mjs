import {DatabaseSync} from 'node:sqlite';
export function historyFixture(path) {
  const db=new DatabaseSync(path), dataset_id='a'.repeat(64);
  db.exec(`CREATE TABLE manifest(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE returns(row INTEGER PRIMARY KEY,banner TEXT,sku TEXT,name TEXT,date TEXT,reason TEXT,status TEXT,qty REAL,refund INTEGER,okey TEXT,rkey TEXT,channel TEXT);
    CREATE TABLE flags(okey TEXT,sku TEXT,flag INTEGER);CREATE TABLE fees(rkey TEXT,fee INTEGER);
    CREATE TABLE exchanges(row INTEGER PRIMARY KEY,okey TEXT,sku TEXT,date TEXT,confidence TEXT,qty REAL,sales INTEGER);
    CREATE TABLE orders(row INTEGER PRIMARY KEY,okey TEXT,sku TEXT,banner TEXT,date TEXT,style TEXT,size TEXT,category TEXT,requested REAL,shipped REAL);
    INSERT INTO returns VALUES(1,'ALDO_CA','A','Test shoe','2025-03-02','Too small','RETURN_COMPLETED',1,10000,'hashed-o1','hashed-r1','InStore'),(2,'ALDO_CA','A','Test shoe','2025-03-03','Too big','RETURN_COMPLETED',0,0,'hashed-o2','hashed-r2','Web'),(3,'ALDO_US','B','Other shoe','2025-03-02','Quality','REFUND_FAILED',1,-25,'hashed-o1','hashed-r3','Web');
    INSERT INTO flags VALUES('hashed-o1','A',0),('hashed-o2','A',0),('hashed-o2','A',1);
    INSERT INTO fees VALUES('hashed-r1',495),('hashed-r2',0),('hashed-r2',500);
    INSERT INTO exchanges VALUES(1,'hashed-o1','C','2025-03-02','ASSUMED',1,10000);
    INSERT INTO orders VALUES(1,'hashed-o1','A','ALDO_CA','2025-02-01','A','8','Shoes',1,1);
    CREATE TABLE products AS SELECT banner,sku,min(name) AS name,count(*) AS rows,sum(qty) AS quantity,sum(refund) AS refund FROM returns GROUP BY banner,sku;`);
  db.prepare('INSERT INTO manifest VALUES(?,?)').run('manifest',JSON.stringify({dataset_id,sources:[{dataset:'returns',file:'fixture-returns.csv',rows:3,sha256:'b'.repeat(64)}],limitations:['Currency and costs not supplied.']}));
  db.close();return dataset_id;
}
