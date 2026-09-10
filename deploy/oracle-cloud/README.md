# Oracle deployment

memeeee runs on its own Oracle Cloud VM as a Docker container managed by
systemd. It uses `/opt/memeeee`, `/etc/memeeee/memeeee.env`,
`/var/lib/memeeee`, and localhost port `8081`.

Create an Ubuntu 24.04 Always Free VM with a public IPv4 address and your SSH
public key. Keep port 8081 closed in Oracle networking; use an SSH tunnel for
the dashboard. On the VM:

```bash
sudo apt-get update && sudo apt-get install --yes git
git clone https://github.com/jiewei190-arch/memeeee.git
cd memeeee
sudo bash deploy/oracle-cloud/install.sh
sudo bash deploy/oracle-cloud/configure.sh
sudo bash deploy/oracle-cloud/start.sh
```

Configuration prompts for the Slack webhook and optional provider keys without
printing them or storing them in shell history. The bot never requests a wallet
seed phrase or private key.

Check the service:

```bash
sudo systemctl status memeeee
sudo journalctl -u memeeee -f
curl http://127.0.0.1:8081/status
```

From a computer with SSH access, open the live dashboard securely without making
it public:

```bash
ssh -L 8081:127.0.0.1:8081 ubuntu@YOUR_ORACLE_IP
```

Then visit `http://127.0.0.1:8081/dashboard` locally.

Stop or restart only this bot:

```bash
sudo systemctl stop memeeee
sudo systemctl restart memeeee
```

Upgrade an existing VM to the free multi-source feed:

```bash
cd ~/memeeee
git pull --ff-only
sudo bash deploy/oracle-cloud/install.sh
sudo bash deploy/oracle-cloud/enable-multichain.sh
```
