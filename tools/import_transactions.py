"""Build a separate, local transaction evidence database without changing the CSV."""
import argparse
import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

IDENTITY = ['banner', 'brand_description', 'style_name', 'color_name', 'size_value',
            'merchandise_category_name', 'main_material_description', 'fashion_fabric_description']
SITE = ['banner', 'site_id', 'region_name', 'state_code', 'city_name', 'postal_code',
        'store_type_description', 'cluster_group_name']
AMOUNTS = ['Net_Sales_Units', 'Net_Sales_Retail_Amount', 'Net_Sales_Cost_Amount', 'Gross_Margin_Amount']
SCHEMA = '''
CREATE TABLE manifest (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE products (id TEXT PRIMARY KEY,banner TEXT,brand TEXT,name TEXT,color TEXT,size TEXT,category TEXT,material TEXT,fabric TEXT,image TEXT,sample_row INTEGER,sample TEXT);
CREATE TABLE sites (banner TEXT,id TEXT,region TEXT,state TEXT,city TEXT,postal TEXT,type TEXT,cluster TEXT,PRIMARY KEY(banner,id));
CREATE TABLE monthly (banner TEXT,site TEXT,month TEXT,product TEXT,channel TEXT,kind TEXT,reason TEXT,rows INTEGER,units REAL,retail REAL,cost REAL,margin REAL,first_row INTEGER);
'''


def import_transactions(source, target, chunksize=150000):
    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open('rb') as f:
        source_hash = hashlib.file_digest(f, 'sha256').hexdigest()
    dataset = hashlib.sha256(('transactions-v2:' + source_hash).encode()).hexdigest()
    fd, staging = tempfile.mkstemp(prefix='transactions-', suffix='.sqlite', dir=target.parent)
    os.close(fd)
    db = sqlite3.connect(staging)
    db.executescript('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;' + SCHEMA)
    identities, site_keys = {}, {}
    count = 0
    start, end = None, None
    missing_customer = anomalies = 0
    checks = np.zeros(4)
    reader = None
    try:
        reader = pd.read_csv(source, dtype=str, keep_default_na=False, chunksize=chunksize)
        for frame in reader:
            required = set(IDENTITY + SITE + AMOUNTS + ['business_date', 'channel', 'return_indicator', 'return_reason', 'consumer_profile_guid', 'article_image_url'])
            if not required.issubset(frame.columns):
                raise ValueError('Transaction CSV is missing required columns: ' + ', '.join(sorted(required-set(frame.columns))))
            frame['source_row'] = np.arange(count + 1, count + len(frame) + 1)
            count += len(frame)
            parsed = pd.to_datetime(frame.business_date, format='%Y-%m-%d', errors='raise')
            lo, hi = parsed.min().date().isoformat(), parsed.max().date().isoformat()
            start, end = min(start or lo, lo), max(end or hi, hi)
            if not frame.banner.isin(['ALDO_CA', 'ALDO_US']).all() or not frame.return_indicator.isin(['0', '1']).all():
                raise ValueError('Unrecognized banner or return flag; review source definitions.')
            frame['month'] = frame.business_date.str[:7]
            missing_customer += int(frame.consumer_profile_guid.eq('').sum())
            for values in frame[SITE].drop_duplicates().itertuples(index=False, name=None):
                key = values[:2]
                if key in site_keys and site_keys[key] != values:
                    raise ValueError('Conflicting metadata for site ' + str(key))
                if key not in site_keys:
                    site_keys[key] = values
                    db.execute('INSERT INTO sites VALUES (?,?,?,?,?,?,?,?)', values)
            new_products = []
            for row in frame.drop_duplicates(IDENTITY).to_dict('records'):
                key = tuple(row[c] for c in IDENTITY)
                if key not in identities:
                    pid = hashlib.sha256(json.dumps(key, ensure_ascii=False).encode()).hexdigest()[:24]
                    identities[key] = pid
                    sample = {k: row[k] for k in IDENTITY + ['site_id', 'business_date', 'channel', 'return_indicator', 'return_reason'] + AMOUNTS}
                    new_products.append((pid, *key, row['article_image_url'], row['source_row'], json.dumps(sample, ensure_ascii=False)))
            db.executemany('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', new_products)
            frame['product'] = [identities[x] for x in frame[IDENTITY].itertuples(index=False, name=None)]
            for col in AMOUNTS:
                frame[col] = pd.to_numeric(frame[col], errors='raise')
                if not np.isfinite(frame[col]).all():
                    raise ValueError('Non-finite amount in ' + col)
            if (frame.Net_Sales_Retail_Amount-frame.Net_Sales_Cost_Amount-frame.Gross_Margin_Amount).abs().gt(.01).any():
                raise ValueError('Sales less cost does not reconcile to recorded margin within one cent.')
            checks += frame[AMOUNTS].sum().to_numpy()
            sale = frame.return_indicator.eq('0') & frame.Net_Sales_Units.gt(0) & frame.Net_Sales_Retail_Amount.ge(0) & frame.Net_Sales_Cost_Amount.ge(0)
            returned = frame.return_indicator.eq('1') & frame.Net_Sales_Units.lt(0) & frame.Net_Sales_Retail_Amount.le(0) & frame.Net_Sales_Cost_Amount.le(0)
            frame['kind'] = np.where(sale, 'sale', np.where(returned, 'return', 'anomaly'))
            anomalies += int(frame.kind.eq('anomaly').sum())
            grouped = frame.groupby(['banner','site_id','month','product','channel','kind','return_reason'], sort=False, dropna=False).agg(
                rows=('source_row','size'), units=('Net_Sales_Units','sum'), retail=('Net_Sales_Retail_Amount','sum'),
                cost=('Net_Sales_Cost_Amount','sum'), margin=('Gross_Margin_Amount','sum'), first_row=('source_row','min')).reset_index()
            db.executemany('INSERT INTO monthly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', grouped.itertuples(index=False, name=None))
            db.commit()
            print(f'Processed {count:,} transaction lines', flush=True)
        if not count:
            raise ValueError('Empty transaction dataset')
        # A group may cross chunk boundaries. Consolidate once, then index for bounded queries.
        db.executescript('''CREATE TABLE combined AS SELECT banner,site,month,product,channel,kind,reason,sum(rows) rows,sum(units) units,sum(retail) retail,sum(cost) cost,sum(margin) margin,min(first_row) first_row FROM monthly GROUP BY banner,site,month,product,channel,kind,reason;
          DROP TABLE monthly; ALTER TABLE combined RENAME TO monthly;
          CREATE INDEX monthly_product ON monthly(banner,product,month,site,channel);
          CREATE INDEX monthly_scope ON monthly(banner,site,month,channel);
          CREATE INDEX products_banner ON products(banner,name);
          CREATE TABLE product_totals AS SELECT banner,product,sum(CASE WHEN kind='sale' THEN units ELSE 0 END) sold,sum(CASE WHEN kind='return' THEN -units ELSE 0 END) returned FROM monthly GROUP BY banner,product;
          CREATE INDEX product_totals_scope ON product_totals(banner,sold DESC,product);
          CREATE TABLE market_monthly AS SELECT banner,month,product,channel,kind,reason,sum(rows) rows,sum(units) units,sum(retail) retail,sum(cost) cost,sum(margin) margin FROM monthly GROUP BY banner,month,product,channel,kind,reason;
          CREATE INDEX market_product ON market_monthly(banner,product,month,channel);
          CREATE TABLE scope_monthly AS SELECT banner,site,month,channel,kind,reason,sum(rows) rows,sum(units) units,sum(retail) retail,sum(cost) cost,sum(margin) margin FROM monthly GROUP BY banner,site,month,channel,kind,reason;
          CREATE INDEX scope_filter ON scope_monthly(banner,site,month,channel);''')
        actual = db.execute('SELECT sum(rows),sum(units),sum(retail),sum(cost),sum(margin) FROM monthly').fetchone()
        if actual[0] != count or not np.allclose(actual[1:], checks, rtol=0, atol=.05):
            raise ValueError('Imported aggregate totals do not reconcile to the complete source')
        manifest = {'dataset_id': dataset, 'schema': 2, 'source': {'file': source.name, 'sha256': source_hash, 'rows': count},
                    'start': start, 'end': end, 'sites': len(site_keys), 'products': len(identities),
                    'customer_id_missing': missing_customer, 'anomaly_rows': anomalies,
                    'source_totals': dict(zip(AMOUNTS, checks.tolist())), 'currency': None,
                    'identity': 'Product identity uses banner, brand, style, colour, size, category and materials. No SKU or width supplied; no automatic OMS join.',
                    'limitations': ['Historical sales are not live stock, open orders or a guarantee of future demand.',
                      'Store postal codes are not customer addresses. No distances are calculated.',
                      'Currency is not explicit. Compare amounts within one market only.',
                      'Numeric return reasons remain unmapped. Returns include cancellations and adjustments.',
                      'Return-to-sale ratios compare events in the period, not a matched purchase cohort or customer return rate.',
                      'Inconsistent sign rows remain in net totals and are excluded from sales/return comparison measures.']}
        db.execute('INSERT INTO manifest VALUES (?,?)', ('manifest', json.dumps(manifest)))
        db.commit()
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Database integrity check failed')
        db.close()
        os.chmod(staging, 0o600)
        os.replace(staging, target)
        print(json.dumps({'database': str(target), 'rows': count, 'sites': len(site_keys), 'products': len(identities), 'dataset_id': dataset}), flush=True)
        return manifest
    except BaseException:
        db.close()
        Path(staging).unlink(missing_ok=True)
        raise
    finally:
        if reader is not None:
            reader.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent.parent/'local_data/transactions.sqlite')
    args = parser.parse_args()
    import_transactions(args.source, args.output)
