# Perfect Pair

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 2026.
An agentic returns prototype: a Return agent that turns returns into exchanges or store credit, a Prevention agent that finds mis-sized styles, a store-counter check that gates every refund, and approvals for the people in the loop.

> **Confidential.** The Dashboard is built from aggregates of ALDO Group's returns extract (`source/src/real.json`, also baked into the HTML). Keep this zip inside the team. Everything else (customers, orders, photos, costs, policy text) is synthetic.

## Open the demo
Double-click `perfect_pair_demo_offline.html` and open it in Chrome. The **Scripted backup** runs with no internet. The **Live agent** only works from the published link inside Claude.

## Choose the dataset
The header's **Synthetic / Actual** toggle switches Dashboard and Data together.
Every page load starts in Synthetic mode. Selecting Actual from an agent screen
opens the actual Dashboard. Switching back preserves the demo's session state.

Actual mode uses all rows of the five supplied CSVs to build return, order,
product, final-sale, restocking-fee and exchange aggregates. Data also shows
source row counts and join coverage. Filters search all aggregate rows; tables
display the first 200 matches. No raw order, customer or return IDs are embedded.

Return, Store counter, Approvals, Prevention agent, Evaluations and Audit keep
their existing synthetic scenarios and rules. The supplied files do not contain
the inventory, product costs, policies, photos or review data required to replace
those scenarios. The current screen's data source is stated below the controls.

Import the actual files and rebuild with:
```sh
python3 -m pip install -r source/requirements-data.txt
python3 source/gen_real.py "/path/to/Dataset McGill"
python3 source/build.py
```
The importer accepts the original supplied filenames (including spaces) and the
legacy names for the returns, flags, fees and exchange files. It requires the
full orders CSV too. Raw files stay outside Git; the private repository contains
the resulting aggregates and rebuilt demos.

Joins follow `Notes.docx`: flags and original orders use Order Number + SKU;
fees use Return Order Number and are counted once per transaction; exchanges
use Original Order Number. Missing flags stay unknown and missing fee records
are reported separately. Zero quantities remain zero. Conflicting duplicate
lookup keys stop the import. Exchange links are associations, with CONFIRMED
and ASSUMED source records reported separately; they are not one-to-one item
matches. The supplied orders and flags only cover part of the return lines, so
the app does not infer a population return rate. Amounts retain source currency,
without FX conversion. `Book.xlsx` is empty and supplies no product master.

## What's inside
| Path | What it is |
|---|---|
| `perfect_pair_demo_offline.html` | The whole demo in one file |
| `source/src/` | The code: `core.js` (data, rules, tools), `agents.js` (Return agent, store check, approvals logic), `queue.js` (seeded approval queue), `photos.js`, `charts.js`, `chat.js` (customer and policy chatbots), `ui.js` (every tab), `dashreal.js` (Dashboard on the real data), `styles.css`, `index.html`, `data.json` (synthetic data), `real.json` (real-data aggregates) |
| `source/build.py` | Builds `src/` into `dist/perfect_pair_demo.html`, `dist/test.html` and the root offline demo |
| `source/gen_data.py` | Regenerates the synthetic data (`src/data.json` and `data/*.csv`); seeded, so the output is identical each run |
| `source/gen_real.py` | Rebuilds `src/real.json` from the five supplied CSVs, with source hashes and join coverage |
| `source/src/data_source.js` | Synthetic / Actual selection and the actual-data explorer |
| `data/` | The synthetic tables as CSV, for loading into DynamoDB / S3 / Athena |
| `agent/` | `tools.json` (22 tools with input schemas, one Lambda each behind AgentCore Gateway), `tool_sets.json`, `prompts/`, `safety_rules.md` (rules R1 to R13 and the Cedar policies) |

## Rebuild after a change
```
cd source
python3 build.py          # needs Python 3 only
```
Then open `source/dist/test.html` in Chrome.

Data integration checks: `python3 -m unittest discover -s tests -p 'test_*.py'`.
With Node.js, Playwright and Chrome available, `node tests/browser_smoke.cjs`
checks both modes, filters, all eight actual-data tables, mobile layout and the
existing scripted scenario evaluations. It blocks external page requests.
