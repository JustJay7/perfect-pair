import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'source'))
from import_evidence import FILES, import_evidence, cents, number
from test_actual_data import fixtures

class EvidenceImportTests(unittest.TestCase):
    def test_source_amounts_rows_hashes_and_private_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name,frame in fixtures().items(): frame.to_csv(root/FILES[name],index=False)
            target=root/'history.sqlite';manifest=import_evidence(root,target)
            self.assertEqual({x['dataset']:x['rows'] for x in manifest['sources']}, {'returns':5,'flags':3,'fees':3,'exchanges':3,'orders':3})
            self.assertTrue(all(len(s['sha256'])==64 for s in manifest['sources']))
            db=sqlite3.connect(target)
            self.assertEqual(db.execute('select row,qty,refund from returns where row in (1,2,4) order by row').fetchall(),[(1,2,1010),(2,0,0),(4,1,-25)])
            self.assertNotIn('private-', '\n'.join(db.iterdump()))
            self.assertEqual(db.execute('select count(*) from orders').fetchone()[0],3)
            db.close()
    def test_bad_import_leaves_previous_database_intact(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);frames=fixtures()
            for name,frame in frames.items():frame.to_csv(root/FILES[name],index=False)
            target=root/'history.sqlite';import_evidence(root,target);before=target.read_bytes()
            frames['returns'].loc[0,'Refund amount']='NaN'
            frames['returns'].to_csv(root/FILES['returns'],index=False)
            with self.assertRaises(ValueError):import_evidence(root,target)
            self.assertEqual(target.read_bytes(),before)
            self.assertFalse(target.with_suffix('.importing.sqlite').exists())
    def test_missing_and_zero_are_distinct_and_decimal_rounding_is_exact(self):
        self.assertIsNone(number(''));self.assertIsNone(cents(''))
        self.assertEqual(number('0'),0);self.assertEqual(cents('0'),0)
        self.assertEqual(cents('10.105'),1011);self.assertEqual(cents('-0.25'),-25)
        for v in ['NaN','Infinity','not a number']:
            with self.assertRaises(Exception):cents(v)
