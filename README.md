# Perfect Pair

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 2026.
An agentic returns prototype: a Return agent that turns returns into exchanges or store credit, a Prevention agent that investigates potential product issues, a store-counter check that gates every refund, and approvals for the people in the loop.

> **Private team project.** Supplied ALDO data is shared with invited teammates. Historical investigations use actual records; operational cases use synthetic missing inputs and clearly display their provenance. Source files and local SQLite databases stay out of Git.

## Open the demo
Double-click `perfect_pair_demo_offline.html` and open it in Chrome. The **Scripted backup** runs with no internet. For Amazon Bedrock, use the local app below. Claude-hosted pages can still use the original Claude connection.

## Three focused workspaces

Use **Viewing as** in the top right. The workspace is remembered; reloading opens its working page, with no separate home dashboard.

| Workspace | Sidebar pages | Details inside those pages |
|---|---|---|
| Customer | My return · Demo use cases | Options, progress and help; all eight demonstrations. |
| Store Manager | Work queue · Process returns | Flagged customers and approval requests; receiving/inspection followed by item destination. |
| Customer Service | Cases · Prevention · Insights | Saved cases, Return agent, approvals and follow-ups; product analysis and historical investigations; analytics and secondary evidence tools. |

### Page audit and consolidation

| Previous page | Decision and current location |
|---|---|
| Role dashboards | Removed: duplicated case queues and shortcuts. Each role opens its working page. |
| My return / Return agent | Customer's main journey; staff assessment opens within Cases with a back link. |
| Demo use cases | Retained for choosing and presenting customer scenarios. |
| Cases | Customer Service's main operational workspace, with search and saved replays. |
| Needs attention | Renamed Work queue for Store Manager; customer follow-ups open within Customer Service Cases. |
| Approvals | Removed from the sidebar; requests and history open from Work queue or Cases. Actionable flagged cases link directly to their approval. |
| Drop-off & grading | First step of Process returns: Receive & inspect. |
| Item destination | Second step of Process returns; follows the selected inspection case. Available as a case detail for Customer Service. |
| Prevention agent | Retained: investigates product/store patterns rather than individual customer decisions. |
| Historical investigations | One location under Prevention, instead of repeated navigation under both agents and Insights. |
| Insights analytics | Retained: aggregate performance is distinct from operational case handling. |
| Source data | Secondary Evidence & demo tools selector under Insights. |
| Audit & fairness | Secondary Evidence & demo tools selector under Insights. |
| Scenario tests | Secondary Evidence & demo tools selector under Insights. |
| Architecture & setup | Secondary Evidence & demo tools selector under Insights. |

Customer Service can select **View as customer** to preview that customer's journey. Staff case browsing does not change the selected customer. Agent activity, financials, source assumptions and replays expand on demand. **Demo settings** contains dataset, model and AWS controls. Consolidation changes navigation, not approval authority or business calculations.

The dropdown previews user workspaces, **not authenticated access control**. Service approval authority is selected within Approvals; product changes require the Merchandiser authority. Existing server action and role checks remain enforced. Real sign-in and multi-user authorization would be a separate deployment step.

## Connect Amazon Bedrock

On this Mac, double-click **Start Perfect Pair.command**. It uses the bundled
Node runtime when available. For other computers, install Node.js 24 or newer, then run `npm ci` and `npm start` in the project folder.

1. Open **http://127.0.0.1:8787/connect**.
2. Enter the organizer-approved region and model/inference profile ID.
   The default is `us-east-1` / `us.anthropic.claude-sonnet-5-5`.
3. Enter the workshop's temporary access key ID, secret access key and session
   token in the local form. Do not put credentials in chat, HTML, or GitHub.
   In the workshop event dashboard, look under **AWS account access → Get AWS CLI
   credentials**. Copy only the three values, not the shell commands or quotes.
   Alternatively, leave all three blank to use an existing local AWS profile or
   standard AWS SDK credentials. The browser console login does not sign in the
   local server.
4. Click **Connect and test**. This makes one small paid model request. The page
   only says Connected after Bedrock returns a complete text response.
5. Open **http://127.0.0.1:8787**, choose **Customer Service**, then open
   **Demo settings → Live agent**. Close settings and open **Return agent** for Maya's scenario. Switching the dataset does not switch the AI model.

The connection screen holds entered credentials in server memory only. Disconnect
or stop the server to clear them. Reconnect when workshop credentials expire.
The server listens only on this Mac, and must remain running. Reloading the app
starts in Scripted backup and Synthetic data; it never starts inference by itself.

Both model-speed options use the same Sonnet 5.5 unless a second model is configured.
The selector is disabled when there is only one model. Configure another approved
model on the connection screen, or use the non-secret settings in `.env.example`.
An optional `.env` is ignored by Git. Changing models requires another connection
check and scenario testing; image/tool support and parameters can differ.

If AWS reports **private marketplace eligibility**, the workshop account's
Marketplace policy blocks the model subscription. Ask the organizers to enable
the selected model for the account. Listing a model or an ACTIVE inference
profile does not establish invocation access. Even a greeting can succeed while
AWS attempts subscription in the background and later calls can be denied;
see [AWS model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).
The connection test alone does not verify a full agent workflow.

### Demo navigation and customer context

- **Customer → Demo use cases** presents all eight original scenarios; the saved-customer selector also opens queued, custom and hybrid cases. Selecting a journey preserves its progress. Customer Service retains the operational case inbox.
- **Store Manager → Work queue → flagged case or approval** shows the customer first: lifetime profile counts, return rate, recent history, new/returning status and a separate color-coded agent assessment. Grey means not assessed, blue means in progress, green means no flag raised, amber means review/incomplete, and red means an active evidence flag. Text labels accompany every color. All operational customer profiles are synthetic, including hybrid cases.
- History does not automatically reject a customer. Existing policy uses Gold/Silver status and a return rate ≤20% for early refund eligibility, with inspection required. An agent evidence flag routes financial actions to supervisor review; new customers receive the same eligibility assessment, with ordinary receipt/inspection timing. The card shows the saved decision or review reason, not an invented explanation.
- **Store Manager customer overview** uses individual shaded cards for membership, lifetime orders, profile return rate, past returns, tenure and recent damage claims. Gold, Silver, Platinum and Bronze have readable tier-colored text; styling does not assign a tier or change eligibility.
- **Customer Service → Insights** puts summary metrics before the reason heatmap and other charts, for both datasets. Actual heatmap rows honor the selected banner, channel and dates. Selecting a reason narrows the columns while keeping all reasons in that scope as the percentage denominator. Empty combinations show an explicit no-records message; zero reason quantities show 0%. Full-period product/customer context is collapsed separately and labels its filter limitations.
- **Prevention agent** has dataset, company, market and all-products/single-product controls. Actual company/market choices follow the imported banners (ALDO, Call It Spring and Sperry). Actual analysis is read-only and source-linked; all-products totals cover the entire selected market, while the ranked product list is a sample. The synthetic network is fixed to Canada and supports all demo products or one style, with the existing approval and measurement flow.

### Manager decisions and return-network planning

The latest manager layout was developed with a completed `us.anthropic.claude-opus-5-5` design request through AWS Bedrock. The operational app model remains configurable; design assistance does not establish a live ALDO integration.

- **Work queue** contains customer information, tier cards, eligible remedy combinations and a saved staff recommendation. **Drop-off & grading** contains physical receipt and condition checks, with links back to the customer and routing workspaces.
- Negative service/return-review comments in the return description, customer Help conversation or staff-recorded comment are screened into a persistent **service concern**. The quoted evidence and manager follow-up are saved separately from abuse flags. This is deterministic screening for human confirmation, not public social-media monitoring. A manager can recommend only an existing eligible remedy or personal follow-up. This does not choose for the customer or execute a financial action.
- **Item destination** compares synthetic SKU sales rates and 28-day sale probabilities at stores/outlets with an e-commerce scenario. An assumed matching online order must match the exact SKU and delivery deadline; the receiving store must support fulfillment. Grade A is required for online resale as new. Recorded inspection overrides planning grade/store.
- The first proposed destination is the feasible route with the highest expected contribution among those preserving both original unit gross-profit dollars and margin percentage. If none qualifies, no margin-preserving route is recommended. Recovery alternatives remain visible with their shortfall. These are planning results; existing simulated settlement/inspection policy is separate and no new transfer, stock reservation or e-commerce shipment is created.
- Each route has an expandable breakdown of sale price, product cost, handling, transfer, fulfillment, contribution, margin gap and required price. The customer can drop off at the nearest assumed store without traveling to the resale destination. A separate comparison checks bringing the eligible exchange variant to that nearest store, including stock, transfer cost, time and margin.
- All network inputs are **synthetic**. Region-to-store distances are example distances, not customer-home geocoding. E-commerce forecast defaults use synthetic DC-inventory sales as an explicitly labeled proxy; matching-order mode is an assumption, not a connected order feed. No live addresses, exact outlet sales, carrier quotes, ship-from-store capability, or open-order data were supplied. Missing transfer quotes/demand stay unknown and block a feasible recommendation.
- Original benchmark = original price paid − unit cost. Resale contribution = resale price − unit cost − handling − transfer − fulfillment. Expected contribution = sale probability × (resale price − unit cost − fulfillment) − handling − transfer. A forecast cannot guarantee total original-order profit after a refund. Remedy estimates and returned-stock resale belong to separate ledgers; they must not be summed into claimed savings.

The **Work queue** queue is derived automatically from pending service comments, unresolved agent assessments and approval requests. Routine assessed cases are excluded. Prevention handles product/store patterns; the Return workflow handles individual requests. Managers open a flagged case to see its handoff reason and preferred remedy; alternatives, history and policy detail are expandable. Service-review flags are comment-screening signals requiring confirmation, not fraud findings. Customer Service approval requests remain subject to their existing role controls.

**Item destination** presents a result, a next step and three comparison cards. Demo inputs, full destination calculations and replacement collection are expandable. This remains a planning view: it does not book a shipment, promise a sale or guarantee margin. Both synthetic and actual transaction views preserve their source labels and existing financial checks.

To rehearse: open **Store Manager → Work queue → Demo / previously reviewed cases**, choose Maya, run the return assessment if needed, then expand **Record a customer comment → Use a synthetic example** and save it. Record the manager's reason and recommendation. Open **Item destination**, expand **Demo setup & cost assumptions**, and compare normal forecast demand with an assumed exact matching online order. Save / explain records the scenario; Live mode adds a bounded model explanation whose route/remedy IDs must pass server checks.

### New transaction data: individual stores and online sales

The additional `Transaction_Detail_ALDO_CA_US_2025.csv` is integrated separately from OMS history. It contains **8,701,520 lines**, February 2, 2025 through January 31, 2026, for **303 site IDs** across ALDO Canada and ALDO US. Sites include regular stores, outlets, e-commerce, customer service and unclassified locations. All rows are imported; no sample is substituted for the full totals. The earlier six files are byte-identical to the previous delivery.

- **Customer Service → Prevention → Dataset → Actual store & online sales**: select market, individual location, recorded channel and months, then all products or one descriptive variant. Recorded reasons appear first. Sales, signed net amounts, recorded gross margins and period return-to-sale event ratios follow. These ratios are not matched-purchase or customer return rates. Numeric reason codes have no supplied dictionary and remain unmapped. Top products/reasons are explicitly ranked subsets.
- **Store Manager → Process returns → Item destination → Routing evidence → Actual store & online sales**: choose the real product's colour/size and a convenient receiving store. Compare recorded sales per calendar week and weighted selling prices by store/outlet and online site. Routing uses one common returned-pair cost proxy across all destinations (selected-product sales cost / units, or an explicit override). Historical destination costs remain available as context; moving the pair does not change its product cost. Enter handling, transfer, packing and shipping assumptions, then recalculate. Blank costs remain unknown. The transfer estimate applies uniformly to other stores; it is not a route quote. Online rows model fulfillment from the receiving store using historical online demand evidence.
- The default financial benchmark is the selected product/period/channel's recorded weighted-average sale, **not a verified original customer order**. Optional benchmark overrides are assumptions. A financial candidate must preserve benchmark gross-profit dollars and margin percentage after entered costs. Condition constraints apply, but inspection, current demand/capacity, shipping capability, delivery times and exact product identification still need verification. No operational recommendation, shipment, reservation or financial action is created.
- Product identity includes market, brand, style, colour, size, category and materials. No explicit SKU or width is supplied. No automatic join is made to synthetic customers or the older OMS returns, preventing false matches and double-counting. Store postal codes are not customer addresses. Missing size stays unknown. Customer GUIDs are absent on 97.48% of source lines and are not used to construct customer histories.
- Costs and margins are recorded historical product amounts, not full logistics profit. Amounts stay in one market's unspecified source currency; there is no FX conversion or Canada/US monetary total. Consistent positive sale and negative return/adjustment lines supply comparison measures. **1,145 inconsistent-sign lines** remain in net totals and are excluded from these comparison measures. Source sales minus cost reconciles to margin within one cent per row.
- **Run Prevention analysis / Save & explain comparison** saves findings, exact scope and observed evidence. Scripted mode is deterministic. Live mode uses the configured Bedrock model with a read-only, server-bound transaction tool and requires valid source citations. Saved replays retain the original observations. Actual logistics and replacement stock are not inferred from this historical file.

Import on each teammate's computer (Python dependencies from `source/requirements-data.txt`):

```sh
python3 -m pip install -r source/requirements-data.txt
npm run import:transactions -- "/path/to/Transaction_Detail_ALDO_CA_US_2025.csv"
npm start
```

The importer creates `local_data/transactions.sqlite` atomically, verifies source totals, retains a source SHA-256 and builds indexed summaries. Restart an already-running server after importing. `PP_TRANSACTIONS_PATH` can select another database. The raw 3.1 GB CSV and local database are excluded from Git and never sent wholesale to Bedrock or the browser. Standalone HTML keeps the synthetic demo and prior OMS aggregates; the new full transaction views require the local server/database. This computer already has the complete import.

### Architecture and current boundary

Browser → local Node server → Resolution / Prevention workflow → Bedrock Converse
→ server tools and policy checks → SQLite checkpoint → browser view.

- Resolution can review one historical return, or operate a separate simulated
  case after a customer chooses a remedy. Payments and exchanges stay held until
  inspection, except an eligible keep-it refund.
- Prevention can investigate all products in one actual brand/market or a selected SKU with source-linked observations, or
  run the existing synthetic product-fix workflow. A hybrid product is also selectable in the synthetic operational analysis, scoped to that simulated product. A demo merchandiser approves
  page changes; measurement uses explicitly synthetic test data.
- Historical agents have only read tools, bound to the selected brand/market, product or return.
  Each finding must cite evidence actually returned by a tool. They cannot issue
  a second refund for a past return. Citation validation establishes provenance,
  not the correctness of every model interpretation.
- Operational tools run the existing policy rules on the server. A version check
  rejects stale clients, one workflow runs at a time, and tool mutations are
  serialized. Actions and state commit together; retries reuse the original
  result, and one original order line cannot receive competing settlements.
- SQLite stores cases, choices, approvals, inspections, traces and actions in
  `local_data/workspace.sqlite`. Restarted work is marked interrupted; it is
  never automatically rerun. One server may open this file at a time.
- Replays keep original observations and policy snapshots, with an integrity
  checksum. Reading them neither calls a model nor changes operational state.
  Reset demo clears the working rehearsal; saved replays remain.

The backend controls the Bedrock transcript and tool schemas, with at most 8
model calls / 16,000 output tokens per model run, 4,096 tokens per call,
120 calls per hour, and a five-minute transcript expiry. A case also has a
60-tool budget. These are usage controls, not a dollar spending cap. Credentials
remain in memory; case data and tool observations are deliberately saved locally.
The model receives only the current prompt, relevant tool results and any photo,
not the complete raw dataset. Raw files are not directly served by the backend.

All refunds, reservations, exchanges and published notes remain simulations.
The workspace dropdown and Approvals authority selector exercise demo role
checks but are not user identity verification. Shared hosting and authenticated teammate roles have not
been deployed. SQLite persistence is local to this computer, not shared through
GitHub. Standalone HTML retains browser-only simulation without persistence or
server action guarantees. The customer/policy chat assistants remain read-only;
customer handoffs are saved server-side with the submitted conversation excerpt.

### Verification

- `npm test`: transport, access checks, durable cases, concurrency, duplicate
  actions, roles, source joins, scoped investigations and replay integrity. AWS
  responses are mocked; no inference costs.
- `npm run test:manager-browser`: separate customer/inspection/routing pages, customer-chat service flags, saved staff decisions, exact-SKU and margin checks, inspection locks and mobile layouts.
- `npm run test:transactions-import`: chunk consolidation, full-source reconciliation, original preservation and atomic failure checks.
- `npm run test:transactions-browser`: actual market/location/product filters, saved analyses/replay, margin assumptions, source evidence, synthetic switching and mobile layouts. Backend tests include fixed-scope mocked live transaction tools.
- `npm run test:insights-browser`: independently recomputed actual filter totals and reason shares, no-data and zero-quantity cases, date ranges, reset and mobile layouts.
- `npm run test:journeys-browser`: scenario selection, customer status and history cards, heatmap ordering, actual market/product isolation, synthetic product scoping and mobile layouts.
- `npm run test:navigation-browser`: all 14 retained views, role landing pages, nested-page selection, case back links and mobile layout.
- `npm run test:experience-browser`: three role views, guarded navigation, a
  customer exchange, store inspection, specialist approval, saved workspace and
  customer selection, expandable evidence, mobile pages and dark mode.
- `npm run test:workspace-browser`: both historical agents, source evidence, a
  hybrid refund, saved-case search, inspection after refresh, replay and mobile layout.
- `npm run test:bedrock-browser`: browser flow through a mocked AWS SDK, including
  a Return investigation, source toggle, expired credentials and disconnect.
- `npm run check:aws`: one real model request using locally configured AWS
  credentials. It does not share the connection screen's in-memory credentials.
- `PP_LIVE_TEST=1 npm run test:bedrock-live`: an opt-in real Maya investigation
  and simulated exchange, using the running app's connected workshop session.
  This uses paid inference and checks the decision, stock re-planning and held
  exchange. It stops on failures; it never substitutes a scripted result.
  Optionally set `PP_LIVE_REPORT` to save synthetic scenario evidence and
  `PP_BASE_URL` if the local app uses another port.
- The browser checks require Playwright and Chrome. The local launcher requires
  network access on first run to install dependencies.

Passing mocked checks does not establish model access or live decision quality.
Before a pitch, run a Return investigation and action against the actual workshop
model, inspect the tool/audit trace, and rerun the scripted scenario evaluations.

AWS references: [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html),
[Sonnet model configuration](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html),
[Workshop credentials](https://catalog.us-east-1.prod.workshops.aws/v2/workshops/63320e83-6abc-493d-83d8-f822584fb3cb/en-US/getting-started/aws-hosted),
[AgentCore Node.js deployment](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html).

## Choose the dataset
The **Demo settings → Synthetic / Actual** toggle switches Insights analytics and Data together.
Every page load starts in Synthetic mode. Selecting Actual from an agent screen
opens the actual Analytics page in Insights. Switching back preserves saved cases.

Actual mode uses all rows of the five supplied CSVs to build return, order,
product, final-sale, restocking-fee and exchange aggregates. Data also shows
source row counts and join coverage. Filters search all aggregate rows; tables
display the first 200 matches. No raw order, customer or return IDs are embedded.

The standard agent scenarios remain synthetic. **Actual investigations** lets you
select a brand/market and SKU, inspect original return records, and run either
agent in Live or Scripted mode. Recorded amounts have no assumed source currency;
unknown flags and conflicting matches remain unknown. Financial what-if estimates
show separate assumptions and formulas. Their controls affect the what-if table
only; they do not change an existing simulated case's financial rules.

**Create simulated new case** makes a new case linked to the selected history.
The original row stays unchanged. SKU, reason, refund amount and unambiguous
matched size/flag are actual context. Customer, current dates, product attributes,
reviews, inventory, costs, logistics, photo and policy are synthetic. The new-case
price is an assumption based on refund/quantity when available. CAD is an explicit
simulation assumption, not an inference about the historical source currency.

Use **Saved cases** to search and reopen work. In a case, **Save recorded replay**
preserves a read-only demonstration. Prevention and historical runs also have
replay controls. Staff handoffs go through Approvals or Drop-off & grading; choose the
Store Manager workspace for inspections, or the appropriate **Approval authority**
in Customer Service before deciding. These controls do not authenticate an actual staff member.

Import source records for investigations (Python 3.11+, standard library only):
```sh
npm run import:history -- "/path/to/Dataset McGill"
```
This reads all five CSVs into `local_data/history.sqlite`, records source SHA-256
hashes, and atomically replaces the database only after successful import. Stop
and restart the server after an import. Source row numbers are one-based data
record ordinals, excluding the header. Source files are never modified. On this
Mac the supplied files have already been imported. A teammate needs the approved
source files locally and must run this import after cloning.

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
the app does not infer a population return rate. The source does not specify currency. No FX conversion is performed; the
dashboard suppresses cross-banner monetary totals. `Book.xlsx` is empty and supplies no product master.

## What's inside
| Path | What it is |
|---|---|
| `perfect_pair_demo_offline.html` | The whole demo in one file |
| `source/src/` | The code: `core.js` (data, rules, tools), `agents.js` (Return agent, store check, approvals logic), `queue.js` (seeded approval queue), `photos.js`, `charts.js`, `chat.js` (customer and policy chatbots), `ui.js` (every tab), `dashreal.js` (Dashboard on the real data), `styles.css`, `index.html`, `data.json` (synthetic data), `real.json` (real-data aggregates) |
| `source/build.py` | Builds `src/` into `dist/perfect_pair_demo.html`, `dist/test.html` and the root offline demo |
| `source/gen_data.py` | Regenerates the synthetic data (`src/data.json` and `data/*.csv`); seeded, so the output is identical each run |
| `backend/workspace.mjs`, `store.mjs`, `evidence.mjs` | Authoritative simulated workflows, local persistence and read-only historical queries |
| `source/import_evidence.py` | Full source-record SQLite importer with source hashes; local database excluded from Git |
| `source/src/workspace.js`, `history.js`, `state.js`, `hybrid.js` | Saved-case interface, source investigations, shared snapshots and labelled synthetic supplementation |
| `source/gen_real.py` | Rebuilds `src/real.json` from the five supplied CSVs, with source hashes and join coverage |
| `source/src/experience.js`, `experience.css`, `journeys.js`, `prevention_scope.js` | Three workspace views, task-focused navigation, progressive disclosure and responsive layout |
| `source/src/data_source.js` | Synthetic / Actual selection and the actual-data explorer |
| `data/` | The synthetic tables as CSV, for loading into DynamoDB / S3 / Athena |
| `agent/` | `tools.json` (original tool schemas for a possible AgentCore/Lambda deployment), `tool_sets.json`, `prompts/`, `safety_rules.md` (rules R1 to R13 and the Cedar policies) |

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

### Item destination calculation audit

The visible **Follow the money for one pair** table provides a destination selector, substituted equation, input sources and both margin checks in the Store Manager and Customer Service views.

- Margin if sold = resale price − the same pair’s product cost − handling − transfer − fulfillment.
- Cash recovered if sold = resale price − handling − transfer − fulfillment. The already-paid product cost is excluded from this cash measure; this is not profit or savings.
- Synthetic expected product contribution = p × (price − product cost − fulfillment) − handling − transfer. Expected cash recovery excludes the product-cost term. The 28-day probability is an unvalidated scenario heuristic, not a calibrated forecast.
- Actual data provides historical unit sales per calendar week, not a resale probability. Weighted amounts are computed before display rounding; currency remains unspecified in the source.
- The benchmark is pre-return gross profit, so selling at the same price after additional return costs normally fails that target. Both dollar profit and percentage margin must pass. None of these calculations includes the customer refund, replacement remedy, original outbound shipping, taxes or later returns.

Example using the current synthetic Maya seed: price 130, cost 58 and handling 6 give 66 if sold locally. Packing 2 and shipping 8 give 56 online. Original pre-return gross profit is 72. These amounts are CAD scenario inputs, not observed ALDO results. The teammate ZIP uses different seed values and a separate decision-onward comparison against a refund baseline, so its absolute and incremental remedy values are not directly interchangeable with these routing margins.

The audit corrected a destination-cost inconsistency: earlier actual routing substituted each destination’s historical cost for the same returned pair. It now holds the pair cost constant, with a separate optional override that does not silently change the benchmark. Calculation version 2 evidence rejects earlier routing references instead of recalculating them under new assumptions; saved replay observations remain unchanged. Edited inputs now explicitly mark displayed calculations as stale until recalculated.

### Connection and manager status clarity

The app remembers an explicitly selected Live/Scripted mode in this browser. Refreshing checks the running server without making a model call; Live is restored only while that server reports a working connection. AWS credentials remain in server memory and are cleared by disconnect or shutdown. Expired workshop sessions require fresh credentials; saved mode is not a saved credential.

Store Manager Work queue includes service concerns, inspection exceptions and assessment failures without an assigned approval. Customer Service-only approvals remain in Customer Service Cases. A manager opening such a case through the demo selector sees the waiting status and its reason, not an empty remedy prompt. Follow-up notes are optional and collapsed when there is no remedy or service concern.
