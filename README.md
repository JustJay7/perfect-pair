# Perfect Pair

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 2026.
An agentic returns prototype: a Return agent that turns returns into exchanges or store credit, a Prevention agent that finds mis-sized styles, a store-counter check that gates every refund, and approvals for the people in the loop.

> **Confidential.** The Dashboard is built from aggregates of ALDO Group's returns extract (`source/src/real.json`, also baked into the HTML). Keep this zip inside the team. Everything else (customers, orders, photos, costs, policy text) is synthetic.

## Open the demo
Double-click `perfect_pair_demo_offline.html` and open it in Chrome. The **Scripted backup** runs with no internet. The **Live agent** only works from the published link inside Claude.

## What's inside
| Path | What it is |
|---|---|
| `perfect_pair_demo_offline.html` | The whole demo in one file |
| `source/src/` | The code: `core.js` (data, rules, tools), `agents.js` (Return agent, store check, approvals logic), `queue.js` (seeded approval queue), `photos.js`, `charts.js`, `chat.js` (customer and policy chatbots), `ui.js` (every tab), `dashreal.js` (Dashboard on the real data), `styles.css`, `index.html`, `data.json` (synthetic data), `real.json` (real-data aggregates) |
| `source/build.py` | Builds `src/` into one page: `python3 build.py` → `dist/perfect_pair_demo.html` and `dist/test.html` |
| `source/gen_data.py` | Regenerates the synthetic data (`src/data.json` and `data/*.csv`); seeded, so the output is identical each run |
| `source/gen_real.py` | Rebuilds `src/real.json` from ALDO's raw CSVs: `python3 gen_real.py /folder/with/the/csvs` (the raw files are not in this zip) |
| `data/` | The synthetic tables as CSV, for loading into DynamoDB / S3 / Athena |
| `agent/` | `tools.json` (22 tools with input schemas, one Lambda each behind AgentCore Gateway), `tool_sets.json`, `prompts/`, `safety_rules.md` (rules R1 to R13 and the Cedar policies) |

## Rebuild after a change
```
cd source
python3 build.py          # needs Python 3 only
```
Then open `source/dist/test.html` in Chrome.
