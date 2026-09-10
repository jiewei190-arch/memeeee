#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

SOURCE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
INSTALL_ROOT=/opt/memeeee
DATA_ROOT=/var/lib/memeeee
CONFIG_ROOT=/etc/memeeee
ENV_FILE=${CONFIG_ROOT}/memeeee.env

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install --yes ca-certificates curl docker.io git rsync
systemctl enable --now docker

install -d -m 0755 "${INSTALL_ROOT}" "${CONFIG_ROOT}"
install -d -m 0750 -o 10001 -g 10001 "${DATA_ROOT}"
rsync -a --delete --exclude .git --exclude .env "${SOURCE_ROOT}/" "${INSTALL_ROOT}/"

if [[ ! -f ${ENV_FILE} ]]; then
  install -m 0600 "${INSTALL_ROOT}/.env.example" "${ENV_FILE}"
fi

docker build --tag memeeee-oracle:latest "${INSTALL_ROOT}"
install -m 0644 "${INSTALL_ROOT}/deploy/oracle-cloud/memeeee.service" \
  /etc/systemd/system/memeeee.service
systemctl daemon-reload

echo "memeeee installed. Run configure.sh, then start.sh."
