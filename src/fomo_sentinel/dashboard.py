DASHBOARD_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>memeeee live scanner</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#080a0f;color:#f5f7fb}
body{margin:0;padding:24px;background:radial-gradient(circle at top,#17203b,#080a0f 45%)}
main{max-width:1180px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}
h1{margin:0;font-size:clamp(26px,5vw,46px)}.live{color:#6dff9a}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}
.card,.panel{background:#111622;border:1px solid #26304a;border-radius:16px;padding:16px}.metric{font-size:28px;font-weight:800}
.label{color:#9ca8be;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.feeds{color:#b9c3d6;margin:12px 0 18px;font-size:13px}
button{border:1px solid #34415e;background:#161d2c;color:white;padding:9px 13px;border-radius:999px;cursor:pointer}button.on{background:#5d6cff}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #242c3d}th{color:#9ca8be}
.qualified{color:#6dff9a}.rejected{color:#ff7f87}.watching{color:#ffd56d}.mono{font-family:ui-monospace,monospace}
@media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr)}.panel{overflow:auto}body{padding:14px}}
</style></head><body><main><div class="top"><div><div class="label">24/7 market intelligence</div><h1>memeeee <span class="live">● LIVE</span></h1></div><div id="last">Connecting…</div></div>
<section class="grid"><div class="card"><div class="label">Scans</div><div class="metric" id="scans">0</div></div><div class="card"><div class="label">Candidates</div><div class="metric" id="candidates">0</div></div><div class="card"><div class="label">Alerts</div><div class="metric" id="alerts">0</div></div><div class="card"><div class="label">Health</div><div class="metric" id="health">—</div></div></section>
<div class="filters" id="filters"></div><div class="feeds" id="feeds">Loading feed coverage…</div><section class="panel"><table><thead><tr><th>Time</th><th>Feed</th><th>Chain</th><th>Coin</th><th>Score</th><th>Status</th><th>Liquidity</th><th>1h volume</th><th>Reason</th></tr></thead><tbody id="rows"></tbody></table></section>
</main><script>
let selected='all';const money=n=>'$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
async function refresh(){const [s,r]=await Promise.all([fetch('/status').then(x=>x.json()),fetch('/recent?limit=150').then(x=>x.json())]);
document.querySelector('#scans').textContent=s.scans;document.querySelector('#candidates').textContent=s.candidates_seen;document.querySelector('#alerts').textContent=s.alerts_sent;document.querySelector('#health').textContent=s.ok?'Healthy':'Check';document.querySelector('#last').textContent=s.last_scan_at?new Date(s.last_scan_at).toLocaleTimeString():'Waiting';
const chains=['all',...s.configured_chains];document.querySelector('#filters').innerHTML=chains.map(c=>`<button class="${c===selected?'on':''}" onclick="selected='${c}';refresh()">${c.toUpperCase()}</button>`).join('');
const gt=s.feeds.geckoterminal;document.querySelector('#feeds').textContent=`DEX Screener: fast polling · GeckoTerminal: new-pool rotation · Last networks: ${gt.last_polled.join(', ')||'waiting'} · Birdeye: adapter pending`;
document.querySelector('#rows').innerHTML=r.filter(x=>selected==='all'||x.chain===selected).map(x=>`<tr><td>${new Date(x.observed_at).toLocaleTimeString()}</td><td>${x.source}</td><td>${x.chain}</td><td class="mono">${x.symbol}<br><small>${x.address.slice(0,8)}…</small></td><td>${x.score}</td><td class="${x.status}">${x.status}</td><td>${money(x.liquidity_usd)}</td><td>${money(x.volume_h1_usd)}</td><td>${JSON.parse(x.reasons_json||'[]')[0]||'passed gates'}</td></tr>`).join('');}
refresh();setInterval(refresh,3000);
</script></body></html>"""
