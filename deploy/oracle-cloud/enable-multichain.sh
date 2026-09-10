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

python3 - "${ENV_FILE}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
values = {
    "CHAINS": "solana,robinhoodchain,base,ethereum,polygon",
    "GECKOTERMINAL_ENABLED": "true",
    "GECKOTERMINAL_NETWORKS_PER_SCAN": "2",
}
lines = path.read_text().splitlines()
seen = set()
updated = []
for line in lines:
    key = line.split("=", 1)[0]
    if key in values:
        updated.append(f"{key}={values[key]}")
        seen.add(key)
    else:
        updated.append(line)
for key in values.keys() - seen:
    updated.append(f"{key}={values[key]}")
path.write_text("\n".join(updated) + "\n")
PY

chmod 600 "${ENV_FILE}"
systemctl restart memeeee
sleep 3
curl --fail --silent --show-error http://127.0.0.1:8081/status
echo
