/* ═══════════════════════════════════════
   SmartFridge AI — app.js
   Reasonal-style marketing site build
═══════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Fruit data ───────────────────────────
const FRUITS = [
  { id: 'apple',      emoji: '🍎', name: 'Apple',       status: 'fresh',  conf: 94 },
  { id: 'banana',     emoji: '🍌', name: 'Banana',      status: 'rotten', conf: 87 },
  { id: 'orange',     emoji: '🍊', name: 'Orange',      status: 'fresh',  conf: 91 },
  { id: 'strawberry', emoji: '🍓', name: 'Strawberry',  status: 'fresh',  conf: 78 },
  { id: 'grape',      emoji: '🍇', name: 'Grapes',      status: 'fresh',  conf: 83 },
  { id: 'mango',      emoji: '🥭', name: 'Mango',       status: 'rotten', conf: 79 },
];

// ── Render fruit cards ────────────────────
function renderCards(data) {
  const grid = document.getElementById('fruitCards');
  if (!grid) return;
  grid.innerHTML = '';

  data.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = `fruit-card ${f.status}`;
    card.style.animationDelay = `${i * 55}ms`;
    card.innerHTML = `
      <span class="fc-emoji">${f.emoji}</span>
      <span class="fc-name">${f.name}</span>
      <span class="fc-badge">${f.status === 'fresh' ? '✓ Fresh' : '✗ Rotten'}</span>
      <div style="width:100%">
        <div class="fc-conf-label">Confidence · ${f.conf}%</div>
        <div class="fc-bar"><div class="fc-fill" id="fcf-${f.id}" style="width:0%"></div></div>
      </div>`;
    grid.appendChild(card);
    // Animate bar fill after render
    setTimeout(() => {
      const el = document.getElementById(`fcf-${f.id}`);
      if (el) el.style.width = f.conf + '%';
    }, 350 + i * 55);
  });

  updateStats(data);
}

// ── Update dashboard stats ────────────────
function updateStats(data) {
  const fresh  = data.filter(f => f.status === 'fresh').length;
  const rotten = data.filter(f => f.status === 'rotten').length;
  const total  = data.length;
  const score  = Math.round((fresh / total) * 100);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('freshNum',  fresh);
  set('rottenNum', rotten);
  set('totalNum',  total);
  const sf = document.getElementById('scoreFill');
  if (sf) sf.style.width = score + '%';

  // Alert
  const rottenItems = data.filter(f => f.status === 'rotten');
  const alertEl = document.getElementById('dbAlert');
  if (!alertEl) return;
  if (rottenItems.length) {
    const el = document.getElementById('alertNames');
    if (el) el.textContent = rottenItems.map(f => f.name).join(', ');
    alertEl.style.display = 'flex';
  } else {
    alertEl.style.display = 'none';
  }
}

// ── Scan simulation ───────────────────────
function triggerScan() {
  const overlay = document.getElementById('scanOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  setTimeout(() => {
    FRUITS.forEach(f => {
      if (Math.random() < 0.2) f.status = f.status === 'fresh' ? 'rotten' : 'fresh';
      f.conf = clamp(f.conf + Math.floor(Math.random() * 8 - 4), 62, 99);
    });
    overlay.classList.remove('active');
    renderCards(FRUITS);
  }, 2200);
}

// ── Sticky nav shadow on scroll ──────────
function onScroll() {
  const nav = document.getElementById('siteNav');
  if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 1px 24px rgba(0,0,0,0.06)' : 'none';
}
window.addEventListener('scroll', onScroll, { passive: true });

// ── Smooth scroll for nav links ───────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Init ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCards(FRUITS);
  onScroll();
});
