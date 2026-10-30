"""Import supplied CSVs into a local, queryable evidence store. Originals stay untouched."""
import argparse
import csv
import hashlib
import json
import os
import sqlite3
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

FILES = {
    'returns': 'OMS Data_Feb24-Jan26_new.csv',
    'flags': 'McGill - Returns - Returnable Flag 2024-2025.csv',
    'fees': 'McGill - Returns - Restocking Fees 2024 - 2025.csv',
    'exchanges': 'McGill_Instore_return_exchanges.csv',
    'orders': 'All OMS orders_Feb 2024 to Feb 2026.csv',
}
SCHEMA = '''
CREATE TABLE manifest (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE returns (row INTEGER PRIMARY KEY,banner TEXT,sku TEXT,name TEXT,date TEXT,reason TEXT,status TEXT,qty REAL,refund INTEGER,okey TEXT,rkey TEXT,channel TEXT);
CREATE TABLE flags (okey TEXT,sku TEXT,flag INTEGER);
CREATE TABLE fees (rkey TEXT,fee INTEGER);
CREATE TABLE exchanges (row INTEGER PRIMARY KEY,okey TEXT,sku TEXT,date TEXT,confidence TEXT,qty REAL,sales INTEGER);
CREATE TABLE orders (row INTEGER PRIMARY KEY,okey TEXT,sku TEXT,banner TEXT,date TEXT,style TEXT,size TEXT,category TEXT,requested REAL,shipped REAL);
'''

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def key(value):
    return hashlib.sha256(('perfect-pair-source-key:' + value.strip()).encode()).hexdigest() if value.strip() else None

def number(value):
    if value == '':
        return None
    n = Decimal(value)
    if not n.is_finite():
        raise ValueError('Non-finite source number')
    return float(n)

def cents(value):
    if value == '':
        return None
    n = Decimal(value)
    if not n.is_finite():
        raise ValueError('Non-finite source amount')
    return int((n * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

def day(value):
    value = value.strip().split(' ')[0]
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError('Unsupported source date')

def import_evidence(folder, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    sources = [{'dataset': k, 'file': name, 'sha256': digest(folder / name)} for k, name in FILES.items()]
    dataset = hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()
    temporary = target.with_suffix('.importing.sqlite')
    if temporary.exists():
        temporary.unlink()
    db = sqlite3.connect(temporary)
    db.executescript(SCHEMA)
    try:
        for source in sources:
            table = source['dataset']
            batch, count = [], 0
            with (folder / source['file']).open(encoding='utf-8-sig', newline='') as f:
                for i, r in enumerate(csv.DictReader(f), 1):
                    if table == 'returns':
                        row = (i, r['store_banner'], r['sku'], r['orderitem_product_name'], day(r['return_creation_date']), r['reason'], r['last return status'], number(r['item return qty']), cents(r['Refund amount']), key(r['order_number']), key(r['return_order_number']), r['return_channel'])
                    elif table == 'flags':
                        raw = r['Is item final sale?'].strip().lower()
                        row = (key(r['order_number']), r['sku'], 1 if raw in ('yes', 'true', '1') else 0 if raw in ('no', 'false', '0') else None)
                    elif table == 'fees':
                        row = (key(r['return_order_number']), cents(r['restocking revenue']))
                    elif table == 'exchanges':
                        row = (i, key(r['Original Order Number']), r['Exchange SKU'], day(r['transactions_businessdaydate']), r['Exchange_Confidence'], number(r['Exchange QTY']), cents(r['Sales']))
                    else:
                        row = (i, key(r['order_number']), r['sku'], r['Banner'], day(r['order_date_est']), r['Style'], r['Size'], r['category name'], number(r['Requested_QTY']), number(r['Shipped']))
                    batch.append(row)
                    count = i
                    if len(batch) == 10000:
                        db.executemany(f'INSERT INTO {table} VALUES ({",".join("?" for _ in row)})', batch)
                        batch.clear()
                if batch:
                    db.executemany(f'INSERT INTO {table} VALUES ({",".join("?" for _ in batch[0])})', batch)
            source['rows'] = count
            db.commit()
            print(f'{table}: {count:,} records', flush=True)
        db.executescript('''
        CREATE INDEX returns_product ON returns(banner,sku);
        CREATE INDEX returns_order ON returns(okey,sku);
        CREATE INDEX returns_transaction ON returns(rkey);
        CREATE INDEX flag_match ON flags(okey,sku);
        CREATE INDEX fee_match ON fees(rkey);
        CREATE INDEX exchange_match ON exchanges(okey);
        CREATE INDEX order_match ON orders(okey,sku,banner);
        CREATE TABLE products AS SELECT banner,sku,min(name) AS name,count(*) AS rows,
          sum(qty) AS quantity,sum(refund) AS refund FROM returns GROUP BY banner,sku;
        CREATE INDEX products_scope ON products(banner,rows DESC,sku);
        ''')
        manifest = {'dataset_id': dataset, 'sources': sources, 'classification': 'supplied_history', 'schema_version': 1,
                    'limitations': ['Currencies are not supplied.', 'Order coverage is partial; counts are not population return rates.', 'Fees are transaction-level.', 'Exchange links are associations; assumed links are not confirmed exchanges.']}
        db.execute('INSERT INTO manifest VALUES (?,?)', ('manifest', json.dumps(manifest)))
        db.commit()
        db.close()
        os.replace(temporary, target)
        return manifest
    except BaseException:
        db.close()
        temporary.unlink(missing_ok=True)
        raise

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('folder', type=Path)
    p.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'local_data/history.sqlite')
    args = p.parse_args()
    result = import_evidence(args.folder, args.output)
    print('Evidence dataset:', result['dataset_id'])
