/* ════════════════════════════════════════════════════
   SmartFridge AI — app.js
   ThingsBoard live data  +  demo fallback  +  scroll reveal
════════════════════════════════════════════════════ */

// ══════════════════════════════════════
//  ⚙  CONFIG  ← your ThingsBoard credentials
// ══════════════════════════════════════
const TB_CONFIG = {
  host:     'https://thingsboard.cloud',
  deviceId: 'f99fdac0-10a4-11f1-b5a7-93241ed57bdc',
  jwtToken: '60iIEYd7Dt1HSR2tCNLD',
};

const POLL_MS = 5000;   // poll interval (ms)

// ── Fruit definitions ────────────────────────────
const FRUITS = [
  { id: 'apple',  emoji: '🍎', name: 'Apple'  },
  { id: 'banana', emoji: '🍌', name: 'Banana' },
  { id: 'orange', emoji: '🍊', name: 'Orange' },
];

// ── Demo fallback seed data ──────────────────────
const DEMO = {
  apple:  { status: 'fresh',  freshScore: 92, rottenScore: 8  },
  banana: { status: 'rotten', freshScore: 18, rottenScore: 82 },
  orange: { status: 'fresh',  freshScore: 87, rottenScore: 13 },
};

// ── State ────────────────────────────────────────
let state       = JSON.parse(JSON.stringify(DEMO));
let log         = [];
let lastScan    = null;
let timer       = null;
let liveMode    = false;   // true once ThingsBoard responds

// Which fruit card does the current scan update?
let ACTIVE_FRUIT = 'apple';

// ── DOM helpers ──────────────────────────────────
const $   = id => document.getElementById(id);
const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ══════════════════════════════════════════════════
//  SCROLL REVEAL
// ══════════════════════════════════════════════════
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ══════════════════════════════════════════════════
//  THINGSBOARD API
//  ESP32 publishes: fresh_score (0–1), rotten_score (0–1), status
//  Result is applied to the fruit selected in the topbar
// ══════════════════════════════════════════════════
async function fetchTB() {
  const keys = 'fresh_score,rotten_score,status,temperature,humidity';
  const url  = `${TB_CONFIG.host}/api/plugins/telemetry/DEVICE/${TB_CONFIG.deviceId}/values/timeseries?keys=${keys}`;
  const res  = await fetch(url, {
    headers: { 'X-Authorization': `Bearer ${TB_CONFIG.jwtToken}` }
  });
  if (!res.ok) throw new Error(`ThingsBoard HTTP ${res.status}`);
  const raw = await res.json();
  const get = k => raw[k]?.length ? raw[k][0].value : null;

  const rawStatus = get('status');
  if (!rawStatus) throw new Error('No telemetry yet — waiting for ESP32 scan');

  const freshRaw  = parseFloat(get('fresh_score')  ?? 0);
  const rottenRaw = parseFloat(get('rotten_score') ?? 0);

  // ESP32 Edge Impulse outputs 0–1; scale to 0–100
  const freshScore  = Math.round(freshRaw  * (freshRaw  <= 1 ? 100 : 1));
  const rottenScore = Math.round(rottenRaw * (rottenRaw <= 1 ? 100 : 1));

  return {
    status:      rawStatus.toLowerCase(),
    freshScore,
    rottenScore,
    temperature: get('temperature'),
    humidity:    get('humidity'),
  };
}

function applyTBData(d) {
  const fruit = FRUITS.find(f => f.id === ACTIVE_FRUIT);
  if (!fruit) return;

  const prev = state[fruit.id];
  if (prev && prev.status !== d.status) {
    pushLog(fruit, d.status, d.freshScore, d.rottenScore);
  }
  state[fruit.id] = {
    status:      d.status,
    freshScore:  d.freshScore,
    rottenScore: d.rottenScore,
  };

  if (d.temperature) set('tempChip', `🌡 ${parseFloat(d.temperature).toFixed(1)} °C`);
  if (d.humidity)    set('humChip',  `💧 ${Math.round(d.humidity)}%`);
}

// ══════════════════════════════════════════════════
//  POLLING LOOP
// ══════════════════════════════════════════════════
async function poll() {
  setConn('connecting');
  try {
    const d = await fetchTB();
    applyTBData(d);
    lastScan = Date.now();
    liveMode = true;

    // Hide the setup banner once live
    const bar = $('tbConfigBar');
    if (bar) bar.style.display = 'none';

    setConn('live');
  } catch (e) {
    console.warn('[SmartFridge]', e.message);
    setConn('error');

    // Gently drift demo values so the dashboard doesn't look frozen
    if (!liveMode) {
      for (const f of FRUITS) {
        const d = state[f.id];
        d.freshScore  = Math.round(clamp(d.freshScore  + (Math.random() * 4 - 2), 0, 100));
        d.rottenScore = Math.round(clamp(d.rottenScore + (Math.random() * 4 - 2), 0, 100));
      }
    }
  }
  render();
}

function startPolling() {
  timer = setInterval(poll, POLL_MS);
}

// ══════════════════════════════════════════════════
//  FRUIT SELECTOR (topbar buttons)
// ══════════════════════════════════════════════════
function setFruit(fruitId) {
  ACTIVE_FRUIT = fruitId;
  document.querySelectorAll('.fs-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fruit === fruitId);
  });
  clearInterval(timer);
  poll().finally(startPolling);
}

// ══════════════════════════════════════════════════
//  MANUAL REFRESH (↻ button)
// ══════════════════════════════════════════════════
function manualRefresh() {
  clearInterval(timer);
  poll().finally(startPolling);
}

// ══════════════════════════════════════════════════
//  DETECTION LOG
// ══════════════════════════════════════════════════
function pushLog(fruit, status, freshScore, rottenScore) {
  log.unshift({ fruit, status, freshScore, rottenScore, ts: Date.now() });
  if (log.length > 25) log.pop();
}

// ══════════════════════════════════════════════════
//  CONNECTION INDICATOR
// ══════════════════════════════════════════════════
function setConn(st) {
  const dot   = $('connDot');
  const label = $('connLabel');
  if (!dot || !label) return;
  dot.className = 'dtb-dot';

  if (st === 'live') {
    dot.classList.add('live');
    label.textContent = 'Live · ThingsBoard';
  } else if (st === 'error') {
    dot.classList.add('error');
    label.textContent = liveMode ? 'Connection lost' : 'Demo mode';
  } else {
    label.textContent = 'Connecting…';
  }
}

// ══════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════
function render() {
  const fresh  = FRUITS.filter(f => state[f.id]?.status === 'fresh');
  const rotten = FRUITS.filter(f => state[f.id]?.status === 'rotten');
  const score  = Math.round((fresh.length / FRUITS.length) * 100);

  set('freshNum',  fresh.length);
  set('rottenNum', rotten.length);
  set('totalNum',  FRUITS.length);
  set('arcPct',    score + '%');

  const arc = $('arcFill');
  if (arc) {
    const len = Math.round((score / 100) * 251);
    arc.setAttribute('stroke-dasharray', `${len} 251`);
    arc.style.stroke = score >= 67 ? '#4ADE80' : score >= 34 ? '#FBBF24' : '#F87171';
  }

  const pill = $('overviewStatus');
  if (pill) {
    pill.textContent        = rotten.length === 0 ? '✓ All fresh' : `⚠ ${rotten.length} rotten`;
    pill.style.background   = rotten.length === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.18)';
  }

  const ts = lastScan ? timeAgo(lastScan) : '—';
  set('overviewUpdated', lastScan ? `Updated ${ts}` : 'Awaiting scan');
  set('lastUpdated',     lastScan ? `Updated ${ts}` : '—');

  if (lastScan) {
    const d  = new Date(lastScan);
    const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    set('lastScanTime',   hm);
    set('lastScanDetail', `${d.toLocaleDateString()} · ${FRUITS.length} fruits`);
  }

  // Fruit cards
  for (const f of FRUITS) {
    const d = state[f.id]; if (!d) continue;
    const fresh  = Math.round(d.freshScore);
    const rotten = Math.round(d.rottenScore);
    const dot = $(`dot-${f.id}`);
    if (dot) dot.className = `bf-dot ${d.status}`;
    set(`status-${f.id}`, d.status.charAt(0).toUpperCase() + d.status.slice(1));
    requestAnimationFrame(() => {
      const fb = $(`fresh-bar-${f.id}`);  if (fb) fb.style.width = fresh  + '%';
      const rb = $(`rotten-bar-${f.id}`); if (rb) rb.style.width = rotten + '%';
    });
    set(`fresh-val-${f.id}`,  `${fresh}%`);
    set(`rotten-val-${f.id}`, `${rotten}%`);
  }

  // Rotten alert banner
  const alertEl = $('dashAlert');
  if (alertEl) {
    if (rotten.length) {
      set('alertNames', rotten.map(f => f.name).join(', '));
      alertEl.style.display = 'flex';
    } else {
      alertEl.style.display = 'none';
    }
  }

  renderLog();
}

function renderLog() {
  const ul = $('alertLog'); if (!ul) return;
  set('logCount', log.length || '0');
  if (!log.length) {
    ul.innerHTML = '<li class="blog-empty">No detections yet — all good ✓</li>';
    return;
  }
  ul.innerHTML = log.map(e => `
    <li class="bcl-row ${e.status === 'fresh' ? 'fresh-row' : 'rotten-row'}">
      <span class="bcl-emoji">${e.fruit.emoji}</span>
      <div class="bcl-info">
        <strong>${e.fruit.name}</strong>
        <span>${e.status === 'fresh' ? 'Fresh' : 'Rotten'} · Fresh ${e.freshScore}% / Rotten ${e.rottenScore}%</span>
      </div>
      <time class="bcl-time">${timeAgo(e.ts)}</time>
      <span class="bcl-tag ${e.status === 'fresh' ? 'ft' : 'rt'}">${e.status === 'fresh' ? 'Fresh' : 'Rotten'}</span>
    </li>`).join('');
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initReveal();

  // Show demo data immediately — no blank dashboard while waiting
  for (const f of FRUITS) pushLog(f, state[f.id].status, state[f.id].freshScore, state[f.id].rottenScore);
  lastScan = Date.now();
  render();

  // Start polling ThingsBoard
  poll();
  startPolling();

  // Refresh relative timestamps every 15s
  setInterval(() => {
    set('lastUpdated', lastScan ? `Updated ${timeAgo(lastScan)}` : '—');
    renderLog();
  }, 15000);

  // Nav shadow on scroll
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.site-nav');
    if (nav) nav.style.boxShadow = window.scrollY > 16
      ? '0 4px 30px rgba(0,0,0,0.13)' : '0 2px 20px rgba(0,0,0,0.10)';
  }, { passive: true });

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
});
