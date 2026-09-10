#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this helper with sudo." >&2
  exit 1
fi

ENV_FILE=/etc/memeeee/memeeee.env
if [[ ! -f ${ENV_FILE} ]]; then
  echo "Missing ${ENV_FILE}; run install.sh first." >&2
  exit 1
fi

read_hidden() {
  local prompt=$1 variable=$2 value
  read -r -s -p "${prompt}: " value
  echo
  printf -v "${variable}" '%s' "${value}"
}

MEMEEEE_SLACK_WEBHOOK=""
read_hidden "Slack incoming webhook URL" MEMEEEE_SLACK_WEBHOOK
if [[ -z ${MEMEEEE_SLACK_WEBHOOK} ]]; then
  echo "A Slack webhook is required." >&2
  exit 1
fi

read_hidden "Brave Search API key (press Enter to skip web enrichment)" MEMEEEE_BRAVE_KEY
read_hidden "Birdeye API key (press Enter until streaming adapter is activated)" MEMEEEE_BIRDEYE_KEY
export MEMEEEE_SLACK_WEBHOOK MEMEEEE_BRAVE_KEY MEMEEEE_BIRDEYE_KEY

python3 - "${ENV_FILE}" <<'PY'
import os
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
replacements = {
    "SLACK_WEBHOOK_URL": os.environ["MEMEEEE_SLACK_WEBHOOK"],
    "BRAVE_SEARCH_API_KEY": os.environ.get("MEMEEEE_BRAVE_KEY", ""),
    "BIRDEYE_API_KEY": os.environ.get("MEMEEEE_BIRDEYE_KEY", ""),
}
lines = path.read_text().splitlines()
seen = set()
updated = []
for line in lines:
    key = line.split("=", 1)[0]
    if key in replacements:
        updated.append(f"{key}={replacements[key]}")
        seen.add(key)
    else:
        updated.append(line)
for key in replacements.keys() - seen:
    updated.append(f"{key}={replacements[key]}")
path.write_text("\n".join(updated) + "\n")
PY

chmod 600 "${ENV_FILE}"
unset MEMEEEE_SLACK_WEBHOOK MEMEEEE_BRAVE_KEY MEMEEEE_BIRDEYE_KEY
echo "memeeee secrets saved securely. No wallet credentials are used."
