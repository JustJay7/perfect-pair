"""Build actual-data aggregates. Raw order, customer and return IDs stay local.

Usage: python3 gen_real.py '/path/to/Dataset McGill' [--output src/real.json]
Join keys follow Notes.docx. Book.xlsx is inspected, not treated as a product
master. Install dependencies from requirements-data.txt.
"""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
FILES = {
    'returns': ('OMS Data_Feb24-Jan26_new.csv', 'OMS_Data_Feb24-Jan26_new.csv'),
    'flags': ('McGill - Returns - Returnable Flag 2024-2025.csv', 'McGill_-_Returns_-_Returnable_Flag_2024-2025.csv'),
    'fees': ('McGill - Returns - Restocking Fees 2024 - 2025.csv', 'restock.csv'),
    'exchanges': ('McGill_Instore_return_exchanges.csv', 'instore.csv'),
    'orders': ('All OMS orders_Feb 2024 to Feb 2026.csv',),
}
REQUIRED = {
    'returns': ['store_banner', 'order_number', 'sku', 'orderitem_product_name', 'customer_uid', 'return_order_number', 'return_channel', 'return_creation_date', 'last return status', 'Refund amount', 'item return qty', 'reason'],
    'flags': ['order_number', 'sku', 'Is item final sale?'],
    'fees': ['return_order_number', 'restocking revenue'],
    'exchanges': ['Exchange_Confidence', 'transactions_businessdaydate', 'Original Order Number', 'Exchange SKU', 'Exchange QTY', 'Sales'],
    'orders': ['Banner', 'order_number', 'order_date_est', 'sku', 'Style', 'Size', 'category name', 'Requested_QTY', 'Shipped'],
}
GROUPS = ['fit', 'change_of_mind', 'carrier', 'expectations', 'no_merch', 'fulfilment', 'quality', 'other']
REASONS = {
    'fit': ['too big', 'too small', 'uncomfortable', 'trop grand', 'trop petit', 'inconfortable'],
    'change_of_mind': ['changed idea', 'changed my mind / other', 'changed my mind / ot', 'found something else', "j'ai changé d'idée /"],
    'expectations': ['not satisfied with the colour', 'not what i expected', 'not as advertised', 'ne répond pas aux at'],
    'fulfilment': ['wrong size delivered', 'wrong item', 'wrong item delivered'],
    'carrier': ['lost in transit', 'arrived too late', 'arrived in poor condition', 'arrived in poor cond', 'return to sender', 'arrivé en mauvais ét'],
    'quality': ['defective', 'poor quality', 'manufacturer defect'],
    'no_merch': ['return without merchandise', 'return without merch'],
}
REASON_GROUP = {reason: group for group, reasons in REASONS.items() for reason in reasons}
OPEN = {'RETURN_SHIPPING', 'RECEIVED_AT_BAR', 'RETURN_RECEIVED', 'CREATED', 'RETURN_RCV_IN_PROGRESS', 'RETURN_PROCESSED'}


def source_info(path, **extra):
    return dict(file=path.name, bytes=path.stat().st_size,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), **extra)


def load_inputs(folder):
    frames, sources = {}, []
    for key, names in FILES.items():
        path = next((folder / n for n in names if (folder / n).is_file()), None)
        if path is None:
            raise ValueError(f'Missing source: {names[0]}')
        df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding='utf-8-sig')
        missing = set(REQUIRED[key]) - set(df.columns)
        if missing:
            raise ValueError(f'{path.name}: missing columns {sorted(missing)}')
        if df.empty:
            raise ValueError(f'{path.name}: source has no rows')
        frames[key] = df
        sources.append(source_info(path, dataset=key, rows=len(df)))
    notes = folder / 'Notes.docx'
    if notes.exists():
        sources.append(source_info(notes, dataset='mapping notes', rows=None))
    book = folder / 'Book.xlsx'
    if book.exists():
        with zipfile.ZipFile(book) as z:
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            cells = sum(1 for n in z.namelist() if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')
                        for c in ET.fromstring(z.read(n)).findall('.//s:c', ns)
                        if any(c.find(f's:{tag}', ns) is not None for tag in ('v', 'is', 'f')))
        sources.append(source_info(book, dataset='workbook', rows=None, populated_cells=cells,
                                   note='Empty workbook; no product master supplied' if not cells else 'Workbook not mapped to product master'))
    return frames, sources


def numbers(values, label, integer=False, signed=False):
    result = pd.to_numeric(values, errors='raise')
    if not np.isfinite(result).all() or (not signed and (result < 0).any()):
        raise ValueError(f'{label}: invalid or missing numeric value')
    if integer and (result % 1 != 0).any():
        raise ValueError(f'{label}: expected whole quantities')
    return result.astype('int64') if integer else result


def cents(values, label):
    return (numbers(values, label, signed=True) * 100).round().astype('int64')


def lookup(df, keys, label):
    if (df[keys] == '').any().any():
        raise ValueError(f'{label}: blank join key')
    unique = df.drop_duplicates()
    if unique.duplicated(keys).any():
        raise ValueError(f'{label}: conflicting duplicate join keys {keys}')
    return unique


def table(label, description, df):
    return dict(label=label, description=description, columns=list(df.columns),
                rows=df.astype(object).where(df.notna(), None).values.tolist())


def build_actual(frames, sources):
    o = frames['returns'].copy()
    if (o[['order_number', 'sku', 'return_order_number']] == '').any().any():
        raise ValueError('Returns: blank join key')
    o['qty'] = numbers(o['item return qty'], 'return quantity', integer=True)
    o['cents'] = cents(o['Refund amount'], 'refund amount')
    o['d'] = pd.to_datetime(o.return_creation_date, format='%Y-%m-%d', errors='raise')
    if o['d'].isna().any():
        raise ValueError('Returns: missing date')
    o['reason_key'] = o.reason.str.lower().str.strip().str.replace('return.page.reasons.', '', regex=False)
    o['grp'] = o.reason_key.map(REASON_GROUP).fillna('other')
    consistent = ['store_banner', 'return_channel', 'return_creation_date', 'order_number']
    if (o.groupby('return_order_number')[consistent].nunique() > 1).any().any():
        raise ValueError('A return transaction has conflicting date, banner, channel or original order')
    o['first'] = ~o.duplicated('return_order_number')

    fs = lookup(frames['flags'].copy(), ['order_number', 'sku'], 'Final-sale flags')
    fs['flag'] = fs['Is item final sale?'].str.strip().str.lower()
    if not fs.flag.isin(['yes', 'no']).all():
        raise ValueError('Unexpected final-sale flag; expected yes/no')
    o = o.merge(fs[['order_number', 'sku', 'flag']], on=['order_number', 'sku'], how='left', validate='many_to_one')
    o['final'] = o.flag.eq('yes')
    o['final_qty'] = o.qty.where(o.final, 0)
    o['unknown_flag_qty'] = o.qty.where(o.flag.isna(), 0)

    fees = lookup(frames['fees'].copy(), ['return_order_number'], 'Restocking fees')
    fees['fee_c'] = cents(fees['restocking revenue'], 'restocking fee')
    fee_map = fees.set_index('return_order_number').fee_c
    o['fee_known'] = o.return_order_number.isin(fee_map.index)
    o['fee_c'] = o.return_order_number.map(fee_map).fillna(0).astype('int64').where(o['first'], 0)
    o['charged'] = o.fee_c.gt(0)

    ex = frames['exchanges'].copy()
    ex['date'] = pd.to_datetime(ex.transactions_businessdaydate, format='%m/%d/%Y', errors='raise')
    if ex.date.isna().any():
        raise ValueError('Exchanges: missing date')
    ex['qty'] = numbers(ex['Exchange QTY'], 'exchange quantity', integer=True)
    ex['sales_c'] = cents(ex.Sales, 'exchange sales')
    if not ex.Exchange_Confidence.isin(['CONFIRMED', 'ASSUMED']).all():
        raise ValueError('Unknown exchange confidence')
    ex_start, ex_end = ex.date.min(), ex.date.max()
    valid_ex = ex[ex['Original Order Number'].ne('')]
    confirmed = set(valid_ex.loc[valid_ex.Exchange_Confidence.eq('CONFIRMED'), 'Original Order Number'])
    assumed = set(valid_ex.loc[valid_ex.Exchange_Confidence.eq('ASSUMED'), 'Original Order Number']) - confirmed
    eligible = o.return_channel.eq('InStore') & o['first'] & o.d.between(ex_start, ex_end)
    o['exc'] = eligible & o.order_number.isin(confirmed)
    o['exa'] = eligible & o.order_number.isin(assumed)
    o['exch'] = o.exc | o.exa

    orders = lookup(frames['orders'].copy(), ['order_number', 'sku'], 'Shipped orders')
    orders['date'] = pd.to_datetime(orders.order_date_est, errors='raise').dt.normalize()
    if orders.date.isna().any():
        raise ValueError('Orders: missing date')
    orders['requested'] = numbers(orders.Requested_QTY, 'requested quantity', integer=True)
    orders['shipped'] = numbers(orders.Shipped, 'shipped quantity', integer=True)
    keys = ['order_number', 'sku']
    o = o.merge(orders[keys + ['Banner', 'Style', 'Size', 'category name']], on=keys, how='left', validate='many_to_one')
    o['order_match'] = o.Banner.notna()
    if (o.loc[o.order_match, 'store_banner'] != o.loc[o.order_match, 'Banner']).any():
        raise ValueError('Original-order join matched a different banner')
    returned = o.groupby(keys).agg(returned_qty=('qty', 'sum'), return_lines=('qty', 'size'))
    orders = orders.join(returned, on=keys, validate='one_to_one')
    orders[['returned_qty', 'return_lines']] = orders[['returned_qty', 'return_lines']].fillna(0).astype('int64')
    orders['category'] = orders['category name'].replace('', 'Not provided')
    orders['day'] = orders.date.dt.strftime('%Y-%m-%d')
    order_daily = orders.groupby(['day', 'Banner', 'category'], sort=True).agg(
        order_lines=('sku', 'size'), requested_qty=('requested', 'sum'), shipped_qty=('shipped', 'sum'),
        matched_return_qty=('returned_qty', 'sum')).reset_index()

    banners = sorted(o.store_banner.unique().tolist())
    channels = sorted(o.return_channel.unique().tolist())
    start, end = o.d.min(), o.d.max()
    o['day'] = (o.d - start).dt.days
    o['b'] = o.store_banner.map({v: i for i, v in enumerate(banners)})
    o['c'] = o.return_channel.map({v: i for i, v in enumerate(channels)})
    o['g'] = o.grp.map({v: i for i, v in enumerate(GROUPS)})
    o['failed'] = o['last return status'].str.contains('FAIL', regex=False)
    o['open'] = o['last return status'].isin(OPEN)
    o['fail_c'] = o.cents.where(o.failed, 0)
    cube = o.groupby(['day', 'b', 'c', 'g'], sort=True).agg(
        n=('qty', 'sum'), cents=('cents', 'sum'), ro=('first', 'sum'), ex=('exch', 'sum'),
        fee=('fee_c', 'sum'), fn=('charged', 'sum'), fail=('failed', 'sum'), failc=('fail_c', 'sum'),
        fs=('final_qty', 'sum'), op=('open', 'sum'), unknown_fs=('unknown_flag_qty', 'sum'),
        exc=('exc', 'sum'), exa=('exa', 'sum')).reset_index()
    cube_cols = {k: cube[k].astype(int).tolist() for k in cube}
    cube_cols['day'] = np.diff(cube.day, prepend=0).tolist()

    for col, mask in {
        'fit': o.grp.eq('fit'), 'big': o.reason_key.isin(['too big', 'trop grand']),
        'small': o.reason_key.isin(['too small', 'trop petit']),
        'unc': o.reason_key.isin(['uncomfortable', 'inconfortable']),
        'qual': o.grp.eq('quality'), 'exp': o.grp.eq('expectations'),
    }.items():
        o[col] = o.qty.where(mask, 0)
    o['product'] = o.orderitem_product_name.replace('', 'Not provided')
    products = o.groupby(['store_banner', 'product'], sort=True).agg(
        n=('qty', 'sum'), cents=('cents', 'sum'), fit=('fit', 'sum'), big=('big', 'sum'),
        small=('small', 'sum'), unc=('unc', 'sum'), qual=('qual', 'sum'), exp=('exp', 'sum')).reset_index()
    products = products.rename(columns={'store_banner': 'banner', 'product': 'name'})
    products['refund'] = products.pop('cents') / 100
    products = products.sort_values(['n', 'banner', 'name'], ascending=[False, True, True])

    o['claim'] = o.grp.isin(['no_merch', 'carrier'])
    cu = o[o.customer_uid.ne('')].groupby('customer_uid').agg(n=('qty', 'sum'), cents=('cents', 'sum'), claims=('claim', 'sum'))
    bins = pd.cut(cu.n, bins=[-0.5, 0.5, 1.5, 2.5, 3.5, 5.5, 10.5, 20.5, float('inf')],
                  labels=['0', '1', '2', '3', '4–5', '6–10', '11–20', '21+'])
    dist = cu.groupby(bins, observed=False).agg(customers=('n', 'size'), items=('n', 'sum'), cents=('cents', 'sum'))
    top = cu.sort_values('cents', ascending=False)
    n1 = max(1, len(cu) // 100) if len(cu) else 0
    claim3 = cu[cu.claims >= 3]
    customers = dict(
        known=len(cu), items_known=int(cu.n.sum()), items_unknown=int(o.loc[o.customer_uid.eq(''), 'qty'].sum()),
        dist=[dict(label=str(label), customers=int(r.customers), items=int(r['items']), refund=float(r.cents / 100)) for label, r in dist.iterrows()],
        top1_share=float(top.cents.head(n1).sum() / cu.cents.sum()) if cu.cents.sum() else 0,
        top1_n=n1, claim3_n=len(claim3), claim3_refund=float(claim3.cents.sum() / 100))

    transactions = o[o['first']].copy()
    transactions['month'] = transactions.d.dt.strftime('%Y-%m')
    transactions['fee_missing'] = ~transactions.fee_known
    fee_months = transactions.groupby(['month', 'store_banner']).agg(
        return_orders=('first', 'size'), orders_charged=('charged', 'sum'),
        missing_fee_records=('fee_missing', 'sum'), fee_cents=('fee_c', 'sum')).reset_index()
    fee_months['restocking_fees'] = fee_months.pop('fee_cents') / 100
    ex['month'] = ex.date.dt.strftime('%Y-%m')
    ex['missing_order'] = ex['Original Order Number'].eq('')
    ex_summary = ex.groupby(['month', 'Exchange_Confidence']).agg(
        exchange_lines=('qty', 'size'), exchange_qty=('qty', 'sum'),
        sales_cents=('sales_c', 'sum'), missing_original_order=('missing_order', 'sum')).reset_index()
    ex_summary['sales'] = ex_summary.pop('sales_cents') / 100
    o['flag_missing'] = o.flag.isna()
    flag_summary = o.groupby('store_banner').agg(
        return_lines=('qty', 'size'), missing_flag_lines=('flag_missing', 'sum'),
        final_sale_qty=('final_qty', 'sum'), unknown_final_sale_qty=('unknown_flag_qty', 'sum')).reset_index()
    o['order_missing'] = ~o.order_match
    coverage = o.groupby('store_banner').agg(
        return_lines=('qty', 'size'), matched_order_lines=('order_match', 'sum'),
        unmatched_order_lines=('order_missing', 'sum'), missing_flag_lines=('flag_missing', 'sum')).reset_index()
    tables = {
        'orders': table('Orders shipped (daily totals)', 'All supplied order lines, grouped by order date, banner and category. Matched return quantity uses Order Number + SKU; it is not a population return rate.', order_daily),
        'products': table('Products returned', 'All products grouped by banner and name; counts are quantities, not line counts. Missing names are retained as Not provided.', products),
        'flags': table('Final-sale flags', 'Return lines joined on Order Number + SKU. Missing flags remain unknown, not returnable.', flag_summary),
        'fees': table('Restocking fees', 'Fees joined on Return Order Number and counted once per transaction. Missing fee records are separate from zero fees.', fee_months),
        'exchanges': table('In-store exchanges', 'All supplied exchange rows, including dates after the returns extract. CONFIRMED and ASSUMED stay separate. Blank original-order numbers cannot be linked.', ex_summary),
        'coverage': table('Join coverage', 'Coverage of the supplied order and flag files. Partial matches do not establish an overall return rate.', coverage),
    }
    paid = o[o.fee_c.gt(0)]
    fee_levels = {k: float(v / 100) for k, v in paid.groupby(paid.d.dt.strftime('%Y-%m')).fee_c.agg(lambda x: x.mode().iloc[0]).items()}
    quality = dict(
        return_lines=len(o), zero_quantity_lines=int(o.qty.eq(0).sum()),
        matched_order_lines=int(o.order_match.sum()), unmatched_order_lines=int((~o.order_match).sum()),
        matched_flag_lines=int(o.flag.notna().sum()), missing_flag_lines=int(o.flag.isna().sum()),
        missing_fee_orders=int((~transactions.fee_known).sum()),
        exchange_missing_original_order=int(ex.missing_order.sum()),
        linked_orders_with_multiple_returns=int((o[o.order_number.isin(set(valid_ex['Original Order Number']))].groupby('order_number').return_order_number.nunique() > 1).sum()),
        exchange_link='Original Order Number only; association, not a one-to-one return or item match',
        currency='Source amounts are retained without currency conversion. Filter by banner for currency-specific analysis.')
    result = dict(
        schema_version=2, source='Supplied McGill / ALDO CSVs', sources=sources, quality=quality,
        start=start.strftime('%Y-%m-%d'), end=end.strftime('%Y-%m-%d'),
        ex_start=ex_start.strftime('%Y-%m-%d'), ex_end=ex_end.strftime('%Y-%m-%d'),
        banners=banners, channels=channels, groups=GROUPS, cols=list(cube), cube=cube_cols,
        products=products[products.n.gt(0)].head(60).to_dict('records'), customers=customers, fee_levels=fee_levels,
        orders=dict(lines=len(orders), orders=int(orders.order_number.nunique()), shipped_qty=int(orders.shipped.sum()),
                    requested_qty=int(orders.requested.sum()), matched_return_qty=int(orders.returned_qty.sum()),
                    start=orders.date.min().strftime('%Y-%m-%d'), end=orders.date.max().strftime('%Y-%m-%d')),
        totals=dict(items=int(o.qty.sum()), refund=float(o.cents.sum() / 100), refund_cents=int(o.cents.sum()),
                    return_orders=int(o['first'].sum()), final_items=int(o.final_qty.sum()),
                    restocking_fee_cents=int(o.fee_c.sum()), linked_exchange_orders=int(o.exch.sum())),
        tables=tables)
    assert sum(cube_cols['n']) == result['totals']['items']
    assert sum(cube_cols['cents']) == result['totals']['refund_cents']
    assert sum(cube_cols['fee']) == result['totals']['restocking_fee_cents']
    assert sum(cube_cols['ro']) == result['totals']['return_orders']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data_folder', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'src' / 'real.json')
    args = parser.parse_args()
    frames, sources = load_inputs(args.data_folder)
    result = build_actual(frames, sources)
    payload = json.dumps(result, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.json.tmp')
    temporary.write_text(payload, encoding='utf-8')
    temporary.replace(args.output)
    print(json.dumps({'output': str(args.output), 'bytes': len(payload.encode()), 'totals': result['totals'], 'quality': result['quality']}, indent=2))


if __name__ == '__main__':
    main()
