#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this helper with sudo." >&2
  exit 1
fi

systemctl enable --now memeeee
sleep 3
systemctl --no-pager --full status memeeee
curl --fail --silent --show-error http://127.0.0.1:8081/health
echo

