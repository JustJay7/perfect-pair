# Perfect Pair

Team Code Reapers · BSRM × ALDO Retail Gen AI Hackathon, October 2026.
An agentic returns prototype: a Return agent that turns returns into exchanges or store credit, a Prevention agent that finds mis-sized styles, a store-counter check that gates every refund, and approvals for the people in the loop.

> **Confidential.** The Dashboard is built from aggregates of ALDO Group's returns extract (`source/src/real.json`, also baked into the HTML). Keep this zip inside the team. Everything else (customers, orders, photos, costs, policy text) is synthetic.

## Open the demo
Double-click `perfect_pair_demo_offline.html` and open it in Chrome. The **Scripted backup** runs with no internet. For Amazon Bedrock, use the local app below. Claude-hosted pages can still use the original Claude connection.

## Connect Amazon Bedrock

On this Mac, double-click **Start Perfect Pair.command**. It uses the bundled
Node runtime when available. For other computers, install Node.js 22 or newer
(Node.js 24 recommended), then run `npm ci` and `npm start` in the project folder.

1. Open **http://127.0.0.1:8787/connect**.
2. Enter the organizer-approved region and Haiku model/inference profile ID.
   The default is `us-east-1` / `us.anthropic.claude-haiku-5-5`.
3. Enter the workshop's temporary access key ID, secret access key and session
   token in the local form. Do not put credentials in chat, HTML, or GitHub.
   In the workshop event dashboard, look under **AWS account access → Get AWS CLI
   credentials**. Copy only the three values, not the shell commands or quotes.
   Alternatively, leave all three blank to use an existing local AWS profile or
   standard AWS SDK credentials. The browser console login does not sign in the
   local server.
4. Click **Connect and test**. This makes one small paid model request. The page
   only says Connected after Bedrock returns a complete text response.
5. Open **http://127.0.0.1:8787**, then select **Live agent**. Start with Maya's
   Return scenario. Switching the dataset does not switch the AI model.

The connection screen holds entered credentials in server memory only. Disconnect
or stop the server to clear them. Reconnect when workshop credentials expire.
The server listens only on this Mac, and must remain running. Reloading the app
starts in Scripted backup and Synthetic data; it never starts inference by itself.

Both model-speed options use the same Haiku unless a second model is configured.
The selector is disabled when there is only one model. Configure another approved
model on the connection screen, or use the non-secret settings in `.env.example`.
An optional `.env` is ignored by Git. Changing models requires another connection
check and scenario testing; image/tool support and parameters can differ.

If AWS reports **private marketplace eligibility**, the workshop account's
Marketplace policy blocks the model subscription. Ask the organizers to enable
the selected Haiku model for the account. Listing a model or an ACTIVE inference
profile does not establish invocation access. Even a greeting can succeed while
AWS attempts subscription in the background and later calls can be denied;
see [AWS model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).
The connection test alone does not verify a full agent workflow.

### Architecture and current boundary

Browser interface → local Node backend → Bedrock Converse → requested demo tools
in the browser → tool results through the backend → final model response.

The backend keeps the model transcript, supplies the tool schemas from our source,
validates tool names/arguments and matching results, handles cancellation, and limits
runs to 8 model calls / 16,000 output tokens. Each call allows at most 4,096 output
tokens. There is also a 120-call hourly limit and a five-minute run expiry. These
are usage controls, not a dollar spending cap. No automatic SDK retries are used.
No raw credentials, prompts or tool results are logged by this server. The local
form and API reject other web origins; only the demo and connection page are served.

**This is a local model integration, not a deployed operational backend.** The
existing simulated tools, business rules, approvals and session state still run
in the browser. Refunds do not move money. Bedrock receives only the current prompt,
attached photos and requested tool outputs; the entire dataset is not uploaded.
Actual aggregates can be used by the existing `real_returns_stats` assistant tool.
Raw ALDO source files remain local and are not served by the backend.

Shared AWS hosting is a separate step: move authoritative rules/tools and durable
state into the backend, add teammate authentication for both the interface and API,
then deploy to AgentCore Runtime. Do not expose this local demo through a public
tunnel. A private GitHub repository does not make a hosted website private.

### Verification

- `npm test`: model transport, tool validation, cancellation, limits, credential
  handling and local HTTP access checks, with fake AWS responses and no AWS costs.
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
[Haiku model configuration](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html),
[Workshop credentials](https://catalog.us-east-1.prod.workshops.aws/v2/workshops/63320e83-6abc-493d-83d8-f822584fb3cb/en-US/getting-started/aws-hosted),
[AgentCore Node.js deployment](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-code-deploy-node.html).

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
