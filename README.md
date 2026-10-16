# Perfect Pair

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 2026.
An agentic returns prototype: a Return agent that turns returns into exchanges or store credit, a Prevention agent that investigates potential product issues, a store-counter check that gates every refund, and approvals for the people in the loop.

> **Private team project.** Supplied ALDO data is shared with invited teammates. Historical investigations use actual records; operational cases use synthetic missing inputs and clearly display their provenance. Source files and local SQLite databases stay out of Git.

## Open the demo
Double-click `perfect_pair_demo_offline.html` and open it in Chrome. The **Scripted backup** runs with no internet. For Amazon Bedrock, use the local app below. Claude-hosted pages can still use the original Claude connection.

## Three focused workspaces

Use **Viewing as** in the top right. The selected workspace is remembered on this browser; each reload opens its dashboard.

| Workspace | Pages |
|---|---|
| Customer | Dashboard, My return and Demo use cases. Select a demonstration, then follow its customer journey with options, progress and Help. |
| Store Manager | Dashboard, Store returns and Approvals filtered to store inspection exceptions. |
| Customer Service | Dashboard, Cases, Return agent, Prevention agent, Approvals and Insights. |

Customer Service can select a case and use **View as customer** to preview that customer's journey. Browsing other cases as staff does not change the selected customer. **Cases → Store handoffs** opens inspections; **Insights** contains analytics, actual investigations, data, audit, evaluations and the architecture explanation. Both agent pages also link directly to actual evidence.

Agent activity, financials, source assumptions and replays expand on demand. **Demo settings** contains Synthetic / Actual, Live / Scripted, model speed, stock-conflict rehearsal, reset and AWS setup. Dashboard counts describe saved simulated operations; actual historical analytics stay in Insights.

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
- **Store Manager → Store returns / Approvals** shows the customer first: lifetime profile counts, return rate, recent history, new/returning status and a separate color-coded agent assessment. Grey means not assessed, blue means in progress, green means no flag raised, amber means review/incomplete, and red means an active evidence flag. Text labels accompany every color. All operational customer profiles are synthetic, including hybrid cases.
- History does not automatically reject a customer. Existing policy uses Gold/Silver status and a return rate ≤20% for early refund eligibility, with inspection required. An agent evidence flag routes financial actions to supervisor review; new customers receive the same eligibility assessment, with ordinary receipt/inspection timing. The card shows the saved decision or review reason, not an invented explanation.
- **Customer Service → Insights** puts the reason heatmap before the metrics and other charts, for both datasets.
- **Prevention agent** has dataset, company, market and all-products/single-product controls. Actual company/market choices follow the imported banners (ALDO, Call It Spring and Sperry). Actual analysis is read-only and source-linked; all-products totals cover the entire selected market, while the ranked product list is a sample. The synthetic network is fixed to Canada and supports all demo products or one style, with the existing approval and measurement flow.

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
- `npm run test:journeys-browser`: scenario selection, customer status and history, heatmap ordering, actual market/product isolation, synthetic product scoping and mobile layouts.
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
replay controls. Staff handoffs go through Approvals or Store returns; choose the
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
| `source/src/experience.js`, `experience.css`, `journeys.js`, `prevention_scope.js` | Three workspace views, focused dashboards, navigation, progressive disclosure and responsive layout |
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
