#!/bin/zsh
cd "$(dirname "$0")"
exec node backend/server.mjs
