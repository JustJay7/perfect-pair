import {DatabaseSync} from 'node:sqlite';
export function transactionFixture(path){
 const db=new DatabaseSync(path),dataset='c'.repeat(64);
 db.exec(`CREATE TABLE manifest(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE products(id TEXT PRIMARY KEY,banner TEXT,brand TEXT,name TEXT,color TEXT,size TEXT,category TEXT,material TEXT,fabric TEXT,image TEXT,sample_row INTEGER,sample TEXT);
 CREATE TABLE sites(banner TEXT,id TEXT,region TEXT,state TEXT,city TEXT,postal TEXT,type TEXT,cluster TEXT);
 CREATE TABLE monthly(banner TEXT,site TEXT,month TEXT,product TEXT,channel TEXT,kind TEXT,reason TEXT,rows INTEGER,units REAL,retail REAL,cost REAL,margin REAL,first_row INTEGER);
 INSERT INTO sites VALUES('ALDO_CA','S1','Quebec','QC','Montreal','H1A','REGULAR','A'),('ALDO_CA','S2','Quebec','QC','Laval','H2B','OUTLET','B'),('ALDO_CA','WEB','Quebec','QC','Montreal','H3C','ECOMM',''),('ALDO_US','U1','NY','NY','New York','10001','REGULAR','A');
 INSERT INTO products VALUES('P1','ALDO_CA','ALDO','Test shoe','Black','8','Shoes','Leather','Smooth','',1,'{"Net_Sales_Units":"2"}'),('P2','ALDO_CA','ALDO','Other shoe','Red','9','Shoes','Leather','Smooth','',7,'{}'),('U1','ALDO_US','ALDO','Test shoe','Black','8','Shoes','Leather','Smooth','',6,'{}');
 INSERT INTO monthly VALUES('ALDO_CA','S1','2025-02','P1','STR','sale','',1,2,200,80,120,1),('ALDO_CA','S2','2025-02','P1','STR','sale','',1,1,70,40,30,2),('ALDO_CA','WEB','2025-02','P1','WEB','sale','',1,3,330,120,210,3),('ALDO_CA','S1','2025-03','P1','STR','return','11',1,-1,-100,-40,-60,4),('ALDO_CA','S1','2025-03','P1','STR','anomaly','11',1,1,100,40,60,5),('ALDO_US','U1','2025-02','U1','STR','sale','',1,1,140,50,90,6),('ALDO_CA','S1','2025-02','P2','STR','sale','',1,5,50,20,30,7);
 CREATE TABLE market_monthly AS SELECT banner,month,product,channel,kind,reason,sum(rows) rows,sum(units) units,sum(retail) retail,sum(cost) cost,sum(margin) margin FROM monthly GROUP BY banner,month,product,channel,kind,reason;
 CREATE TABLE scope_monthly AS SELECT banner,site,month,channel,kind,reason,sum(rows) rows,sum(units) units,sum(retail) retail,sum(cost) cost,sum(margin) margin FROM monthly GROUP BY banner,site,month,channel,kind,reason;`);
 db.prepare('INSERT INTO manifest VALUES(?,?)').run('manifest',JSON.stringify({dataset_id:dataset,schema:2,start:'2025-02-02',end:'2025-03-01',sites:4,products:3,source:{file:'fixture-transactions.csv',sha256:'d'.repeat(64),rows:7},identity:'Descriptive variant, not SKU',limitations:['No live inventory or currency supplied.']}));db.close();return dataset;
}
