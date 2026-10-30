"""Assemble the Perfect Pair demo into one self-contained HTML page.

Inputs (src/): index.html template, styles.css, data.json, core.js, agents.js, ui.js
Outputs (dist/):
  perfect_pair_demo.html  the artifact page (no doctype: the Artifact tool adds the skeleton)
  test.html               the same page inside a minimal skeleton, for local browser tests
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
SRC, DIST = ROOT / "src", ROOT / "dist"
DIST.mkdir(exist_ok=True)

template = (SRC / "index.html").read_text()
styles = (SRC / "styles.css").read_text()
scripts = "\n".join((SRC / f).read_text() for f in ("core.js", "agents.js", "queue.js", "photos.js", "charts.js", "chat.js", "replay.js", "roles.js", "ui.js", "compare.js", "satisfaction.js", "routing.js", "learning.js", "dashreal.js", "dashtxn.js", "state.js", "workspace.js"))

# Compact the data and make it safe inside <script>: in JSON a "<" can only sit
# inside a string, so writing it as < can never end the script block early.
obj = json.loads((SRC / "data.json").read_text())
# Aggregates of the real returns extract (from gen_real.py), when present.
if (SRC / "real.json").exists():
    obj["real"] = json.loads((SRC / "real.json").read_text())
# Aggregates of the 2025 transaction detail (from gen_txn.py), when present.
if (SRC / "txn.json").exists():
    obj["txn"] = json.loads((SRC / "txn.json").read_text())
data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
data = data.replace("<", "\\u003c")

for bad in ("</script", "<!--"):
    assert bad not in scripts.lower(), f"{bad} inside the scripts would break the page"

page = (template.replace("/*STYLES*/", styles)
                .replace("/*DATA*/", data)
                .replace("/*SCRIPTS*/", scripts))
(DIST / "perfect_pair_demo.html").write_text(page)

# The skeleton the Artifact tool wraps around a page, reproduced for testing.
skeleton = ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
            'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
            '</head><body>')
(DIST / "test.html").write_text(skeleton + page + "</body></html>")

kb = len(page.encode()) / 1024
print(f"perfect_pair_demo.html  {kb:,.0f} KB  (data {len(data.encode())/1024:,.0f} KB, scripts {len(scripts.encode())/1024:,.0f} KB, css {len(styles.encode())/1024:,.0f} KB)")
