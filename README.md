# Perfect Pair

ALDO returns hackathon prototype: resolve customer returns, support store decisions, investigate return patterns and preview approved product guidance. This repository now contains the final demo interface and persistent backend; earlier versions remain in Git history.

## Run locally

Install Node.js 24 or newer, then:

```sh
npm ci
npm start
```

Open http://127.0.0.1:8789/. The macOS launcher also works when `node` is on PATH. The frontend is already built. To rebuild it after editing `app/source/src`, run `npm run build` (Python 3 required).

The server owns case state, tool execution, approval checks and saved replays. It saves to `local_data/workspace.sqlite`; keep this file when updating. Use `PORT` and `PP_STATE_PATH` for a separate test instance. Do not run two servers against the same state file.

## Live AI

Open `/connect` and supply an authorized AWS session or use a configured AWS credential provider. Region and model/profile IDs must be available to your account. Defaults are `us-east-1` and `us.anthropic.claude-opus-5-5`; override with `AWS_REGION`, `BEDROCK_MODEL_ID` and `BEDROCK_THOROUGH_MODEL_ID`. Temporary workshop credentials expire. macOS Keychain can remember them but cannot extend their validity. Other platforms can connect for the running session. No credentials are committed.

The October 16 hackathon copy was hosted on EC2 with an IAM role and encrypted EBS, behind an SSH tunnel. That temporary deployment's availability has not been reverified for this release. The localhost tunnel URL is not a public deployment URL. This repository is a local demo, not a multi-user production service: role switching is a demonstration control, not authenticated identity.

## Data

- `app/data/` and `app/source/src/data.json`: synthetic operational scenarios.
- `app/source/src/real.json` and `txn.json`: supplied-data aggregates bundled with the demo. Preserve their source/coverage limitations; they are not a live inventory feed.
- Original-record investigations require separately supplied, confidential evidence databases. Raw ALDO files, SQLite databases and saved session data are excluded from Git.

Place `history.sqlite` and `transactions.sqlite` in `local_data/`, or set `PP_HISTORY_PATH` and `PP_TRANSACTIONS_PATH` to their locations. Without them, synthetic workflows and embedded dashboards work; source-record investigation reports that evidence is unavailable.

To build databases from authorized source files:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-data.txt
.venv/bin/python tools/import_evidence.py /path/to/returns-files
.venv/bin/python tools/import_transactions.py /path/to/transactions.csv
```

`tools/gen_real.py` retains the validated historical aggregate pipeline; `app/source/gen_real.py` is the final interface's separate aggregate format. Do not interchange their output files.

## Validation

```sh
npm test
npm run test:actions
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm audit --omit=dev
```

See `audit/2026-10-30.md` for this release's checks and limits. Financial, inventory and publication actions remain simulated. Product-page previews are illustrative; margin projections depend on labelled assumptions and are not guaranteed savings.
