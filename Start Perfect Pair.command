#!/bin/zsh
set -eu
cd -- "$(dirname -- "$0")"
bundled_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if [[ -x "$bundled_node/node" ]]; then
  export PATH="$bundled_node:$PATH"
fi
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  print 'Install Node.js 24 LTS from https://nodejs.org, then open this launcher again.'
  read '?Press Enter to close.'
  exit 1
fi
if [[ ! -d node_modules/@aws-sdk/client-bedrock-runtime ]]; then
  npm ci --ignore-scripts --no-fund --no-audit
fi
exec node backend/server.mjs
