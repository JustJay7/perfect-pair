# Perfect Pair · team kit

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 16, 2026.
**Team only. Do not share outside the team.** The return stories (customers, orders, photos, reviews, the policy text) are synthetic. The dashboards and a few figures use totals computed from ALDO Group's hackathon data: no customer, order, transaction or store numbers are in any file here.

## What's inside

| File or folder | What it is |
|---|---|
| `perfect_pair_demo.html` | The whole app in one file. Open it in Chrome. The scripted backup works anywhere, even offline. The live agent only runs from the published Claude artifact. |
| `source/` | The app's source: one JS file per feature, `build.py` to rebuild, and the scripts that made the data |
| `agent/tools.json`, `tool_sets.json` | The agent's tools and which step gets which. Each becomes a Lambda behind AgentCore Gateway. |
| `agent/prompts/` | The prompts the live agent receives |
| `agent/safety_rules.md` | The 15 money rules (R1–R15) and their Cedar policies for AgentCore Policy |
| `data/` | The synthetic tables the agent reads (stores, stock, orders, reviews, history, policy) |

## The app, view by view

Pick a view from **Viewing as** at the top left.

| View | Who | What it shows |
|---|---|---|
| Return | Customer | The customer's phone next to the agent's live reasoning: every tool call, safety check and re-plan. Below: the value receipt (what ALDO keeps per option, after every cost), where the return goes (drop-off and resale routing), and the agent against a rules engine. |
| Store counter | Store associate | Grade the pair at drop-off. The agent's learning loop says where to look first. Mismatches go to the right approvals queue. |
| Approvals | Store associate | Returns within $1,000, unclear photos, store-check mismatches. The customer section, what the pair is worth, satisfaction vs profit, then the agent's recommendation. |
| Approvals and audit | Store manager | Suspected abuse, policy exceptions, reputation risk, over $1,000, plus an audit of every associate decision. |
| Dashboard | Analyst | ALDO 2025 sales and margin (8.7M lines, real totals), ALDO returns 2024–26, and the pilot simulation. |
| Prevention agent | Merchandiser | Styles that keep coming back, the cause, and a product-page fix to approve. |
| Evaluations | Team and judges | Scenario tests (pass^k), fairness, red team, and the self-feedback loop on photo grading. |

## The five demo customers

| Customer | Story | Goes to |
|---|---|---|
| Maya | Boots too tight; reviews say they run narrow | The agent settles it: exchange for 8 wide |
| Elena | $289 boots, sole peeling | Store associate (over the agent's $250 limit) |
| Noah | Heel "coming apart", photos don't show it | Store associate (checks before money moves) |
| Jordan | "Never worn", photo shows wear, TikTok threat | Store manager (suspected abuse + reputation risk) |
| Bianca | Final sale, Instagram threat | Store manager (policy appeal + reputation risk) |

Priya, Leo, Ana, Sam and Kai (the prompt-injection test) are still in the data and run in Evaluations.

## Who decides what

- **Agent:** up to $250, inside the 15 rules.
- **Store associate:** up to $1,000, including high-value returns and pairs the store found worse than their photo.
- **Store manager:** suspected abuse, policy exceptions, over $1,000, and any reputation-risk threat (half the usual time to act).
- **Merchandiser:** product page changes.

## Pitch setup (same browser tab, before presenting)

1. Reset demo, choose Scripted backup, light mode.
2. Pre-run Elena (choose the exchange), Jordan, and Bianca (then Ask a person to review).
3. Leave Maya ready on the Customer view; run her live during the pitch.

## Rebuilding

From `source/`: `python3 build.py` writes `dist/perfect_pair_demo.html`. `add_cases.py` adds Elena and Noah to `src/data.json`; `gen_real.py` and `gen_txn.py` rebuild the ALDO totals from the aggregate files (the raw ALDO files are not in this kit).
