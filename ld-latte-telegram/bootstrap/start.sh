#!/bin/sh
set -eu
MARKER=/home/node/.n8n/.ld-latte-bootstrap-v1
if [ ! -f "$MARKER" ]; then
  n8n import:credentials --input=/bootstrap/credentials.local.json
  n8n import:workflow --input=/bootstrap/workflow.json
  n8n publish:workflow --id=ldLatteDynamicMenu
  touch "$MARKER"
fi
exec n8n start
