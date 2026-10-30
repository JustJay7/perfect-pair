import json
from pathlib import Path
import sys
import tempfile
import unittest

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from gen_real import FILES, build_actual, load_inputs


def fixtures():
    returns = []
    for order, sku, ret, date, qty, amount, banner, customer in [
        ('private-o1', 'A', 'private-r1', '2025-02-03', '2', '10.10', 'ALDO_CA', 'private-c1'),
        ('private-o1', 'B', 'private-r1', '2025-02-03', '0', '0', 'ALDO_CA', ''),
        ('private-o2', 'A', 'private-r2', '2025-02-03', '1', '5.00', 'ALDO_US', 'private-c2'),
        ('private-o3', 'C', 'private-r3', '2025-02-03', '1', '-0.25', 'ALDO_CA', ''),
        ('private-o1', 'A', 'private-r0', '2024-02-04', '1', '4.00', 'ALDO_CA', 'private-c1'),
    ]:
        returns.append(dict(zip(
            ['order_number', 'sku', 'return_order_number', 'return_creation_date', 'item return qty', 'Refund amount', 'store_banner', 'customer_uid'],
            [order, sku, ret, date, qty, amount, banner, customer]),
            orderitem_product_name='Same product', return_channel='InStore', reason='return.page.reasons.Too small',
            **{'last return status': 'RETURN_COMPLETED'}))
    return {
        'returns': pd.DataFrame(returns),
        'flags': pd.DataFrame([
            ['private-o1', 'A', 'yes'], ['private-o1', 'B', 'no'], ['private-o2', 'A', 'no'],
        ], columns=['order_number', 'sku', 'Is item final sale?']),
        'fees': pd.DataFrame([
            ['private-r1', '4.95'], ['private-r2', '0'], ['private-r0', '0'],
        ], columns=['return_order_number', 'restocking revenue']),
        'orders': pd.DataFrame([
            ['ALDO_CA', 'private-o1', '2024-02-01 00:00:00', 'A', 'Style', '7', 'Shoes', '2', '2'],
            ['ALDO_CA', 'private-o1', '2024-02-01 00:00:00', 'B', 'Style', '', '', '1', '1'],
            ['ALDO_US', 'private-o4', '2025-02-01 00:00:00', 'A', 'Style', '8', 'Shoes', '3', '2'],
        ], columns=['Banner', 'order_number', 'order_date_est', 'sku', 'Style', 'Size', 'category name', 'Requested_QTY', 'Shipped']),
        'exchanges': pd.DataFrame([
            ['CONFIRMED', '02/02/2025', 'private-o1', 'A', '1', '8.00'],
            ['ASSUMED', '02/03/2025', 'private-o2', 'A', '1', '5.00'],
            ['ASSUMED', '02/03/2025', '', 'A', '1', '-4.00'],
        ], columns=['Exchange_Confidence', 'transactions_businessdaydate', 'Original Order Number', 'Exchange SKU', 'Exchange QTY', 'Sales']),
    }


class ActualDataTests(unittest.TestCase):
    def test_joins_quantities_and_fees(self):
        result = build_actual(fixtures(), [])
        self.assertEqual(result['totals']['items'], 5)
        self.assertEqual(result['totals']['refund_cents'], 1885)
        self.assertEqual(result['totals']['return_orders'], 4)
        self.assertEqual(result['totals']['restocking_fee_cents'], 495)
        self.assertEqual(result['totals']['final_items'], 3)
        self.assertEqual(sum(result['cube']['unknown_fs']), 1)
        self.assertEqual(result['quality']['missing_fee_orders'], 1)
        self.assertEqual(result['quality']['matched_order_lines'], 3)
        self.assertEqual(result['quality']['zero_quantity_lines'], 1)
        self.assertEqual(result['orders']['shipped_qty'], 5)
        self.assertEqual(result['totals']['linked_exchange_orders'], 2)
        self.assertEqual(sum(result['cube']['exc']), 1)
        self.assertEqual(sum(result['cube']['exa']), 1)
        self.assertEqual(result['quality']['exchange_missing_original_order'], 1)
        self.assertEqual(result['quality']['linked_orders_with_multiple_returns'], 1)
        self.assertEqual(sum(p['fit'] for p in result['products']), 5)
        self.assertEqual({p['banner'] for p in result['products']}, {'ALDO_CA', 'ALDO_US'})
        self.assertEqual(sum(d['items'] for d in result['customers']['dist']) + result['customers']['items_unknown'], 5)
        ex = result['tables']['exchanges']
        self.assertEqual(sum(r[ex['columns'].index('sales')] for r in ex['rows']), 9)

    def test_no_raw_identifiers_or_mutation(self):
        frames = fixtures()
        original = {k: v.copy(deep=True) for k, v in frames.items()}
        result = build_actual(frames, [])
        self.assertNotIn('private-', json.dumps(result, allow_nan=False))
        for key in frames:
            pd.testing.assert_frame_equal(frames[key], original[key])

    def test_conflicting_lookup_keys_rejected(self):
        for source, column, value in [('flags', 'Is item final sale?', 'no'), ('fees', 'restocking revenue', '9.95'), ('orders', 'Shipped', '4')]:
            with self.subTest(source=source):
                frames = fixtures()
                duplicate = frames[source].iloc[[0]].copy()
                duplicate[column] = value
                frames[source] = pd.concat([frames[source], duplicate], ignore_index=True)
                with self.assertRaisesRegex(ValueError, 'conflicting duplicate'):
                    build_actual(frames, [])

    def test_bad_quantities_do_not_silently_become_one(self):
        for value in ['-1', '0.5', '', 'unknown']:
            with self.subTest(value=value):
                frames = fixtures()
                frames['returns'].loc[0, 'item return qty'] = value
                with self.assertRaises(ValueError):
                    build_actual(frames, [])

    def test_source_files_and_missing_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for key, frame in fixtures().items():
                frame.to_csv(root / FILES[key][0], index=False)
            frames, sources = load_inputs(root)
            self.assertEqual(len(sources), 5)
            self.assertTrue(all(len(s['sha256']) == 64 for s in sources))
            self.assertEqual(build_actual(frames, sources)['totals']['items'], 5)
            (root / FILES['orders'][0]).unlink()
            with self.assertRaisesRegex(ValueError, 'Missing source'):
                load_inputs(root)

    def test_missing_customer_and_zero_only_sources(self):
        frames = fixtures()
        frames['returns']['customer_uid'] = ''
        frames['returns']['item return qty'] = '0'
        frames['returns']['Refund amount'] = '0'
        result = build_actual(frames, [])
        self.assertEqual(result['totals']['items'], 0)
        self.assertEqual(result['customers']['known'], 0)
        self.assertEqual(result['products'], [])
        json.dumps(result, allow_nan=False)


if __name__ == '__main__':
    unittest.main()
