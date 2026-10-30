"""Pack the 2025 transaction aggregates into src/txn.json for the demo.

Input: the agg_*.csv files that agg.py / agg2.py wrote on the laptop from
Transaction_Detail_ALDO_CA_US_2025.csv (8.7M rows; never copied here).
Only totals: no transaction numbers, customer ids, stores or postal codes.
Usage: python3 gen_txn.py /path/to/agg_folder
"""
import json
import pathlib
import sys

import pandas as pd

ROOT = pathlib.Path(__file__).parent
D = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/txn")
V = ["su", "sv", "sm", "ru", "rv", "rm", "cu"]
R = lambda x: int(round(float(x)))

cube = pd.read_csv(D / "agg_cube.csv")
cube = cube[cube.channel != "(blank)"]
months = sorted(cube.month.unique())
banners = sorted(cube.banner.unique())
channels = ["STR", "WEB", "INSTORE", "WCC"]
cats = cube.groupby("merchandise_category_name").sv.sum().sort_values(ascending=False).index.tolist()
prices = ["Regular", "Markdown", "Promo Regular", "Promo Markdown"]
cube = cube[cube.channel.isin(channels) & cube.price_group.isin(prices)]
cube_cols = {
    "m": [months.index(x) for x in cube.month], "b": [banners.index(x) for x in cube.banner],
    "c": [channels.index(x) for x in cube.channel], "k": [cats.index(x) for x in cube.merchandise_category_name],
    "p": [prices.index(x) for x in cube.price_group],
}
for v in V: cube_cols[v] = [R(x) for x in cube[v]]

day = pd.read_csv(D / "agg_day.csv")
day = day[day.channel.isin(channels)]
d0 = pd.Timestamp(day.business_date.min())
day_cols = {"d": [(pd.Timestamp(x) - d0).days for x in day.business_date], "b": [banners.index(x) for x in day.banner], "c": [channels.index(x) for x in day.channel]}
for v in V: day_cols[v] = [R(x) for x in day[v]]

# Styles: summed across banners; the 300 that sell the most units.
st = pd.read_csv(D / "agg_style.csv", dtype={"style_name": str})
st = st[(st.style_name != "(blank)") & ~st.style_name.str.match(r"^\d")]
cat_of = st.groupby(["style_name", "merchandise_category_name"]).su.sum().reset_index().sort_values("su").drop_duplicates("style_name", keep="last").set_index("style_name").merchandise_category_name
ban_of = st.groupby(["style_name", "banner"]).su.sum().unstack(fill_value=0)
g = st.groupby("style_name")[V].sum()
g = g[g.su >= 500]
g = g.loc[sorted(set(g.sort_values("su", ascending=False).head(200).index) | set(g.sort_values("ru", ascending=False).head(250).index), key=lambda n: -g.loc[n, "su"])]
sz = pd.read_csv(D / "agg_stsize.csv", dtype={"style_name": str, "size_value": str})
sr = pd.read_csv(D / "agg_streason.csv", dtype={"style_name": str, "return_reason": str})
CANCEL = {"CANCELLED_OUT_OF_STOCK", "RISKIFIED::DECLINED", "ORDER CANCELLED", "MANUALLY_CANCELLED_PRE_PICK"}
sr = sr[~sr.return_reason.str.upper().isin(CANCEL)]
styles = []
for name, r in g.iterrows():
    s = sz[(sz.style_name == name) & (sz.size_value != "(blank)")]
    rs = sr[sr.style_name == name].copy()
    rs["key"] = rs.channel.map({"STR": "Store code ", "INSTORE": "Store code ", "WEB": "", "WCC": ""}).fillna("") + rs.return_reason.astype(str)
    rs = rs.groupby("key").ru.sum().sort_values(ascending=False).head(6)
    styles.append(dict(name=name, category=cat_of.get(name, ""), ca=R(ban_of.loc[name].get("ALDO_CA", 0)), us=R(ban_of.loc[name].get("ALDO_US", 0)),
                       **{v: R(r[v]) for v in V}, sizes={x.size_value: [R(x.su), R(x.ru)] for x in s.itertuples() if x.su >= 20},
                       reasons={k: R(v) for k, v in rs.items()}))

size = pd.read_csv(D / "agg_size.csv", dtype={"size_value": str})
SHOE = [c for c in cats if any(w in c for w in ("Shoes", "Boots", "Sandals"))]
size = size[size.merchandise_category_name.isin(SHOE) & size.size_value.str.match(r"^\d+(\.5)?$")]
sizes = size.groupby("size_value")[["su", "ru"]].sum().reset_index()
sizes["n"] = sizes.size_value.astype(float)
sizes = [dict(size=r.size_value, su=R(r.su), ru=R(r.ru)) for r in sizes.sort_values("n").itertuples() if r.su >= 5000]

def table(path, keys, cols=V):
    t = pd.read_csv(D / path)
    t = t.groupby(keys)[cols].sum().reset_index()
    return [dict({k: str(r[k]) for k in keys}, **{c: R(r[c]) for c in cols}) for _, r in t.iterrows()]

region = table("agg_region.csv", ["banner", "region_name"])
cluster = table("agg_region.csv", ["cluster_group_name"])
material = table("agg_material.csv", ["main_material_description"])
origin = [o for o in table("agg_origin.csv", ["country_of_origin"]) if o["su"] >= 5000]
price = table("agg_price.csv", ["price_group", "channel"])
cross = table("agg_cross.csv", ["channel", "in_store_return_indicator"], ["ru", "rv", "rm"])
rea = pd.read_csv(D / "agg_reason.csv", dtype={"return_reason": str})
rea = rea[~rea.return_reason.str.upper().isin(CANCEL) & (rea.channel != "(blank)")]
rea["src"] = rea.channel.map({"STR": "store", "INSTORE": "store", "WEB": "web", "WCC": "web"})
# The same reason is spelled two ways ("Lost in transit" / "LOST IN TRANSIT"): fold them under the common spelling.
rea["key"] = rea.return_reason.str.upper().str.replace("RETURN WITHOUT MERCHANDISE", "RETURN WITHOUT MERCH")
spell = rea.groupby(["key", "return_reason"]).ru.sum().reset_index().sort_values("ru").drop_duplicates("key", keep="last").set_index("key").return_reason
rea["return_reason"] = rea.key.map(spell).replace({"(blank)": "No reason given"})
reasons = []
for src in ("store", "web"):
    t = rea[rea.src == src].groupby("return_reason")[["ru", "rv", "rm"]].sum().sort_values("ru", ascending=False).head(14)
    reasons += [dict(src=src, reason=k, ru=R(r.ru), rv=R(r.rv), rm=R(r.rm)) for k, r in t.iterrows()]
canc = pd.read_csv(D / "agg_reason.csv", dtype={"return_reason": str})
canc = canc[canc.return_reason.str.upper().isin(CANCEL)].groupby("return_reason")[["ru", "rv"]].sum()
cancels = [dict(reason=k, units=R(-0 + r.ru), value=R(r.rv)) for k, r in canc.iterrows()]

out = dict(source="ALDO Group transaction detail, ALDO CA and US, fiscal 2025 (Feb 2, 2025 to Jan 31, 2026)", rows=8701520,
           start=str(d0.date()), months=months, banners=banners, channels=channels, cats=cats, prices=prices,
           cube=cube_cols, day=day_cols, styles=styles, sizes=sizes, region=region, cluster=cluster, material=material,
           origin=origin, price=price, cross=cross, reasons=reasons, cancels=cancels)
p = ROOT / "src" / "txn.json"
p.write_text(json.dumps(out, separators=(",", ":")))
print(f"{p.stat().st_size/1024:,.0f} KB · {len(cube)} cube rows · {len(day)} day rows · {len(styles)} styles")
