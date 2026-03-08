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
  username: 'adwaitharun2005@gmail.com',
  password: 'adwaith2005',
};

let tbJwt = null;

const POLL_MS = 5000;   // poll interval (ms)

const ITEM = { id: 'scanned', emoji: '🥦', name: 'Scanned Item' };

// ── Demo fallback seed data ──────────────────────
const DEMO = {
  status: 'fresh', freshScore: 92, rottenScore: 8
};

// ── State ────────────────────────────────────────
let state = JSON.parse(JSON.stringify(DEMO));
let log = [];
let lastScan = null;
let timer = null;
let liveMode = false;   // true once ThingsBoard responds

// Single item logic

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
async function getThingsBoardJWT() {
  const res = await fetch(`${TB_CONFIG.host}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TB_CONFIG.username,
      password: TB_CONFIG.password
    })
  });
  if (!res.ok) throw new Error(`ThingsBoard Auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function fetchTB() {
  if (!tbJwt) {
    tbJwt = await getThingsBoardJWT();
  }

  const keys = 'fresh_score,rotten_score,status,temperature,humidity';
  const url  = `${TB_CONFIG.host}/api/plugins/telemetry/DEVICE/${TB_CONFIG.deviceId}/values/timeseries?keys=${keys}`;
  
  let res = await fetch(url, {
    headers: { 'X-Authorization': `Bearer ${tbJwt}` }
  });

  if (res.status === 401) {
    tbJwt = await getThingsBoardJWT();
    res = await fetch(url, {
      headers: { 'X-Authorization': `Bearer ${tbJwt}` }
    });
  }

  if (!res.ok) throw new Error(`ThingsBoard HTTP ${res.status}`);
  
  const raw = await res.json();
  const getVal = k => raw[k]?.length ? raw[k][0].value : null;
  const getTs = k => raw[k]?.length ? raw[k][0].ts : null;

  const rawStatus = getVal('status');
  if (!rawStatus) throw new Error('No telemetry yet — waiting for ESP32 scan');

  const freshRaw = parseFloat(getVal('fresh_score') ?? 0);
  const rottenRaw = parseFloat(getVal('rotten_score') ?? 0);

  // ESP32 Edge Impulse outputs 0–1; scale to 0–100
  const freshScore = Math.round(freshRaw * (freshRaw <= 1 ? 100 : 1));
  const rottenScore = Math.round(rottenRaw * (rottenRaw <= 1 ? 100 : 1));

  return {
    status: rawStatus.toLowerCase(),
    freshScore,
    rottenScore,
    temperature: getVal('temperature'),
    humidity: getVal('humidity'),
    lastScan: getTs('status') || getTs('fresh_score')
  };
}

function applyTBData(d) {
  const prev = state;
  // If status changed, push to log
  if (prev && (prev.status !== d.status || prev.freshScore !== d.freshScore)) {
    pushLog(ITEM, d.status, d.freshScore, d.rottenScore);
  }
  
  state = {
    status: d.status,
    freshScore: d.freshScore,
    rottenScore: d.rottenScore,
  };

  if (d.lastScan) lastScan = d.lastScan;

  if (d.temperature) set('tempChip', `🌡 ${parseFloat(d.temperature).toFixed(1)} °C`);
  if (d.humidity) set('humChip', `💧 ${Math.round(d.humidity)}%`);
}

// ══════════════════════════════════════════════════
//  POLLING LOOP
// ══════════════════════════════════════════════════
async function poll() {
  setConn('connecting');
  try {
    const d = await fetchTB();
    applyTBData(d);
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
      state.freshScore = Math.round(clamp(state.freshScore + (Math.random() * 4 - 2), 0, 100));
      state.rottenScore = Math.round(clamp(state.rottenScore + (Math.random() * 4 - 2), 0, 100));
    }
  }
  render();
}

function startPolling() {
  timer = setInterval(poll, POLL_MS);
}

// ══════════════════════════════════════════════════
//  (Removed fruit selector logic)
// ══════════════════════════════════════════════════

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
  const isFresh = state.status === 'fresh';
  const freshScore = Math.round(state.freshScore);
  const rottenScore = Math.round(state.rottenScore);

  set('freshNum', freshScore + '%');
  set('rottenNum', rottenScore + '%');
  set('arcPct', freshScore + '%');

  const arc = $('arcFill');
  if (arc) {
    const len = Math.round((freshScore / 100) * 251);
    arc.setAttribute('stroke-dasharray', `${len} 251`);
    arc.style.stroke = freshScore >= 67 ? '#4ADE80' : freshScore >= 34 ? '#FBBF24' : '#F87171';
  }

  const pill = $('overviewStatus');
  if (pill) {
    pill.textContent = isFresh ? '✓ Fresh item' : `⚠ Rotten item`;
    pill.style.background = isFresh ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.18)';
  }

  const ts = lastScan ? timeAgo(lastScan) : '—';
  set('overviewUpdated', lastScan ? `Updated ${ts}` : 'Awaiting scan');
  set('lastUpdated', lastScan ? `Updated ${ts}` : '—');

  if (lastScan) {
    const d = new Date(lastScan);
    const hm = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    set('lastScanTime', hm);
    set('lastScanDetail', `${d.toLocaleDateString()}`);
  }

  // Scanned item card
  const dot = $(`dot-scanned`);
  if (dot) dot.className = `bf-dot ${state.status}`;
  set(`status-scanned`, state.status.charAt(0).toUpperCase() + state.status.slice(1));
  requestAnimationFrame(() => {
    const fb = $(`fresh-bar-scanned`); if (fb) fb.style.width = freshScore + '%';
    const rb = $(`rotten-bar-scanned`); if (rb) rb.style.width = rottenScore + '%';
  });
  set(`fresh-val-scanned`, `${freshScore}%`);
  set(`rotten-val-scanned`, `${rottenScore}%`);

  // Rotten alert banner
  const alertEl = $('dashAlert');
  if (alertEl) {
    if (!isFresh) {
      set('alertNames', 'Scanned Item');
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
  pushLog(ITEM, state.status, state.freshScore, state.rottenScore);
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
