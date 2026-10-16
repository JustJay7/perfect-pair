import csv
import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('transactions',Path(__file__).resolve().parents[1]/'source/import_transactions.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TransactionImport(unittest.TestCase):
    def test_complete_chunked_import_and_atomic_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            source,target=Path(folder)/'transactions.csv',Path(folder)/'transactions.sqlite'
            base={'banner':'ALDO_CA','site_id':'1001','region_name':'Quebec','state_code':'QC','city_name':'Montreal','postal_code':'H1A','store_type_description':'REGULAR','cluster_group_name':'A','business_date':'2025-02-02','brand_description':'ALDO','style_name':'Shoe','color_name':'Black','size_value':'8','merchandise_category_name':'Shoes','main_material_description':'Leather','fashion_fabric_description':'Smooth','article_image_url':'','channel':'STR','return_indicator':'0','return_reason':'','consumer_profile_guid':'','Net_Sales_Units':'1','Net_Sales_Retail_Amount':'100','Net_Sales_Cost_Amount':'40','Gross_Margin_Amount':'60'}
            rows=[base,base,{**base,'return_indicator':'1','return_reason':'11','Net_Sales_Units':'-1','Net_Sales_Retail_Amount':'-100','Net_Sales_Cost_Amount':'-40','Gross_Margin_Amount':'-60'}]
            def write(values):
                with source.open('w',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=list(base));w.writeheader();w.writerows(values)
            write(rows);original=source.read_bytes();manifest=module.import_transactions(source,target,chunksize=1)
            self.assertEqual(source.read_bytes(),original)
            self.assertEqual(manifest['source']['rows'],3)
            self.assertEqual(manifest['source']['sha256'],hashlib.sha256(original).hexdigest())
            with sqlite3.connect(target) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM products').fetchone()[0],1)
                self.assertEqual(db.execute('SELECT count(*),sum(rows),sum(retail) FROM monthly').fetchone(),(2,3,100))
                self.assertEqual(db.execute('SELECT sold,returned FROM product_totals').fetchone(),(2,1))
                self.assertEqual(db.execute('SELECT sum(rows) FROM scope_monthly').fetchone()[0],3)
            previous=target.read_bytes()
            write([{**base,'Gross_Margin_Amount':'99'}])
            with self.assertRaises(ValueError):module.import_transactions(source,target,chunksize=1)
            self.assertEqual(target.read_bytes(),previous)
            write([base,{**base,'city_name':'Toronto'}])
            with self.assertRaises(ValueError):module.import_transactions(source,target,chunksize=1)
            self.assertEqual(target.read_bytes(),previous)


if __name__=='__main__':unittest.main()
