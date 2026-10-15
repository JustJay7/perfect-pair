"""Aggregate the real returns extract into src/real.json for the Dashboard.

Only aggregates leave this script: daily counts and dollars by banner, channel
and reason group, plus product-level reason shares and customer-level
distributions. No order numbers, customer ids or return ids are written.

Inputs (not shipped with the demo, ALDO confidential):
  OMS_Data_Feb24-Jan26_new.csv                   one row per returned item
  McGill_-_Returns_-_Returnable_Flag_2024-2025.csv  final-sale flag by order + sku
  restock.csv                                    restocking fee by return order
  instore.csv                                    in-store exchanges by original order
Usage: python3 gen_real.py /path/to/data_folder
"""
import json
import pathlib
import sys

import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).parent
D = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/newdata")

# 1. Returns, one row per item -------------------------------------------------
o = pd.read_csv(D / "OMS_Data_Feb24-Jan26_new.csv", dtype=str)
o["amt"] = pd.to_numeric(o["Refund amount"], errors="coerce").fillna(0.0)
o["qty"] = pd.to_numeric(o["item return qty"], errors="coerce").fillna(1).astype(int).clip(lower=1)
o["d"] = pd.to_datetime(o["return_creation_date"])

# The customer's reason, folded into eight groups.
GROUP = {
    "Too big": "fit", "Too small": "fit", "Uncomfortable": "fit",
    "Changed idea": "change_of_mind", "Changed my mind / Other": "change_of_mind",
    "Changed my mind / other": "change_of_mind", "Found something else": "change_of_mind",
    "Not satisfied with the colour": "expectations", "Not what I expected": "expectations", "Not as advertised": "expectations",
    "Wrong size delivered": "fulfilment", "Wrong Item": "fulfilment", "Wrong item delivered": "fulfilment",
    "Lost In Transit": "carrier", "Lost in transit": "carrier", "Arrived too late": "carrier",
    "Arrived in poor condition": "carrier", "Return to sender": "carrier",
    "Defective": "quality", "Poor quality": "quality", "Manufacturer defect": "quality",
    "Return Without Merchandise": "no_merch", "Return without merch": "no_merch",
}
o["grp"] = o["reason"].map(GROUP).fillna("other")

# 2. Joins, as the notes describe them ----------------------------------------
fs = pd.read_csv(D / "McGill_-_Returns_-_Returnable_Flag_2024-2025.csv", dtype=str)
final_keys = set(zip(fs.loc[fs["Is item final sale?"].str.lower() == "yes", "order_number"],
                     fs.loc[fs["Is item final sale?"].str.lower() == "yes", "sku"]))
o["final"] = [(a, b) in final_keys for a, b in zip(o.order_number, o.sku)]

rs = pd.read_csv(D / "restock.csv", dtype=str)
rs["fee"] = pd.to_numeric(rs["restocking revenue"], errors="coerce").fillna(0.0)
fee = rs.groupby("return_order_number")["fee"].max()
# A return order is counted, and its fee charged, once: on its first item.
o["first"] = ~o.duplicated("return_order_number")
o["fee"] = np.where(o["first"], o["return_order_number"].map(fee).fillna(0.0), 0.0)

ex = pd.read_csv(D / "instore.csv", dtype=str)
ex_orders = set(ex["Original Order Number"])
# The exchange file only starts in Feb 2025: earlier in-store returns can't be matched.
ex_start = pd.to_datetime(ex["transactions_businessdaydate"], format="%m/%d/%Y").min()
# An in-store return whose original order also had an exchange rung up.
o["exch"] = (o["return_channel"] == "InStore") & o["order_number"].isin(ex_orders) & o["first"]

o["failed"] = o["last return status"].str.contains("FAIL", na=False)
OPEN = {"RETURN_SHIPPING", "RECEIVED_AT_BAR", "RETURN_RECEIVED", "CREATED", "RETURN_RCV_IN_PROGRESS", "RETURN_PROCESSED"}
o["open"] = o["last return status"].isin(OPEN)

# 3. The daily cube -----------------------------------------------------------
BANNERS = ["ALDO_US", "ALDO_CA", "SPERRY_US", "SPERRY_CA", "CIS_CA"]
CHANNELS = ["InStore", "Web", "CCC", "HappyReturnMail", "HappyReturnBar"]
GROUPS = ["fit", "change_of_mind", "carrier", "expectations", "no_merch", "fulfilment", "quality", "other"]
o = o[o.store_banner.isin(BANNERS) & o.return_channel.isin(CHANNELS)].copy()
start = o["d"].min().normalize()
o["day"] = (o["d"] - start).dt.days
o["b"] = o.store_banner.map({v: i for i, v in enumerate(BANNERS)})
o["c"] = o.return_channel.map({v: i for i, v in enumerate(CHANNELS)})
o["g"] = o.grp.map({v: i for i, v in enumerate(GROUPS)})
o["cents"] = (o["amt"] * 100).round().astype(np.int64)
o["fee_c"] = (o["fee"] * 100).round().astype(np.int64)
o["fail_c"] = np.where(o["failed"], o["cents"], 0)
o["charged"] = o["fee"] > 0

cube = o.groupby(["day", "b", "c", "g"]).agg(
    n=("qty", "sum"), cents=("cents", "sum"), ro=("first", "sum"), ex=("exch", "sum"),
    fee=("fee_c", "sum"), fail=("failed", "sum"), failc=("fail_c", "sum"), fs=("final", "sum"), op=("open", "sum"), fn=("charged", "sum"),
).reset_index()
cols = ["day", "b", "c", "g", "n", "cents", "ro", "ex", "fee", "fn", "fail", "failc", "fs", "op"]
cube_cols = {k: cube[k].astype(int).tolist() for k in cols}
# Rows are sorted by day, so the day column is stored as the gap from the row before.
cube_cols["day"] = np.diff(np.asarray(cube_cols["day"]), prepend=0).tolist()

# 4. Products: reason mix for the styles returned most -------------------------
o["is_fit"] = o.grp == "fit"; o["is_big"] = o.reason == "Too big"; o["is_small"] = o.reason == "Too small"
o["is_unc"] = o.reason == "Uncomfortable"; o["is_qual"] = o.grp == "quality"; o["is_exp"] = o.grp == "expectations"
p = o.groupby("orderitem_product_name").agg(
    n=("qty", "sum"), cents=("cents", "sum"), fit=("is_fit", "sum"), big=("is_big", "sum"),
    small=("is_small", "sum"), unc=("is_unc", "sum"), qual=("is_qual", "sum"), exp=("is_exp", "sum"))
main_banner = o.groupby(["orderitem_product_name", "store_banner"]).size().reset_index().sort_values(0).drop_duplicates("orderitem_product_name", keep="last").set_index("orderitem_product_name")["store_banner"]
p["banner"] = main_banner
p = p[p["n"] >= 1200].sort_values("n", ascending=False).head(60).reset_index()
products = [dict(name=r.orderitem_product_name, banner=r.banner, n=int(r.n), refund=round(r.cents / 100), fit=int(r.fit),
                 big=int(r.big), small=int(r.small), unc=int(r.unc), qual=int(r.qual), exp=int(r.exp)) for r in p.itertuples()]

# 5. Customers: how returns spread across people (distributions only) ----------
o["is_claim"] = o.grp.isin(["no_merch", "carrier"])
cu = o.dropna(subset=["customer_uid"]).groupby("customer_uid").agg(n=("qty", "sum"), cents=("cents", "sum"), claims=("is_claim", "sum"))
edges = [1, 2, 3, 4, 6, 11, 21, 10**9]
labels = ["1", "2", "3", "4–5", "6–10", "11–20", "21+"]
bins = pd.cut(cu["n"], bins=[e - 0.5 for e in edges], labels=labels)
dist = cu.groupby(bins, observed=False).agg(customers=("n", "size"), items=("n", "sum"), cents=("cents", "sum"))
top = cu.sort_values("cents", ascending=False)
n1 = max(1, len(cu) // 100)
claim3 = cu[cu["claims"] >= 3]
customers = dict(
    known=int(len(cu)), items_known=int(cu["n"].sum()), items_unknown=int(o.loc[o.customer_uid.isna(), "qty"].sum()),
    dist=[dict(label=l, customers=int(r.customers), items=int(r["items"]), refund=round(r.cents / 100)) for l, r in dist.iterrows()],
    top1_share=round(float(top["cents"].head(n1).sum() / cu["cents"].sum()), 4), top1_n=int(n1),
    claim3_n=int(len(claim3)), claim3_refund=round(float(claim3["cents"].sum()) / 100),
)

# 6. Restocking fee level by month (the fee changed during the period) --------
paid = o[o["fee"] > 0]
fee_levels = paid.groupby(paid["d"].dt.strftime("%Y-%m"))["fee"].agg(lambda x: x.value_counts().index[0]).round(2).to_dict()

real = dict(
    ex_start=ex_start.strftime("%Y-%m-%d"),
    source="ALDO Group returns extract (OMS), Feb 2024 to Jan 2026",
    start=start.strftime("%Y-%m-%d"), end=o["d"].max().strftime("%Y-%m-%d"),
    banners=BANNERS, channels=CHANNELS, groups=GROUPS, cols=cols, cube=cube_cols,
    products=products, customers=customers, fee_levels=fee_levels,
    totals=dict(items=int(o["qty"].sum()), refund=round(float(o["amt"].sum())), return_orders=int(o["first"].sum()),
                final_items=int(o["final"].sum())),
)
out = ROOT / "src" / "real.json"
out.write_text(json.dumps(real, separators=(",", ":")))
print(f"{len(cube)} cube rows, {out.stat().st_size/1024:,.0f} KB")
print(real["totals"], customers["top1_share"], customers["claim3_n"], customers["claim3_refund"])
