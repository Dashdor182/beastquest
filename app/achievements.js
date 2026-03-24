// app/achievements.js
import { books, owned, read } from './state.js';
import { escapeHtml } from './ui.js';

const BADGE_ASSETS = { BASE: './assets/achievements', EXT: '.png', USE_LOCKED_VARIANTS: false };
const ACH_UNLOCKED_KEY = 'bq:achUnlocked';

const READ_NAMES = new Map([
  [5,     'Apprentice Adventurer'],
  [10,    'Beast Tracker'],
  [25,    'Quest Knight'],
  [50,    'Realm Ranger'],
  [100,   'Master Beastbreaker'],
  [200,   'Saga Sentinel'],
  ['All', 'The Complete Bestiary'],
]);

const OWN_NAMES = new Map([
  [5,     "Collector's Pouch"],
  [10,    'Keeper of Scrolls'],
  [25,    'Lore Archivist'],
  [50,    'Vault Curator'],
  [100,   'Grand Librarian'],
  [200,   'Warden of the Vault'],
  ['All', 'The Grand Codex'],
]);

const THRESHOLDS = [5, 10, 25, 50, 100, 200, 'All'];

/* ── Next quest card ────────────────────────────────────── */
function renderNextQuestCard(items) {
  const el = document.getElementById('achNextQuest');
  if (!el) return;

  const next = items.find(it => it.group === 'Read' && !it.achieved);

  if (!next) {
    el.innerHTML = `
      <div class="next-quest-celebrate">
        <div class="next-quest-celebrate-icon">🏆</div>
        <div class="next-quest-celebrate-title">All reading quests complete!</div>
        <div class="next-quest-celebrate-sub">You've conquered every beast. Truly legendary!</div>
      </div>`;
    return;
  }

  const total     = books.length;
  const readCount = read.size;
  const target    = next.id === 'read-All' ? total : Number(next.id.replace('read-', ''));
  const current   = Math.min(readCount, target);
  const pct       = target > 0 ? Math.round(current / target * 100) : 0;
  const left      = target - current;
  const achName   = READ_NAMES.get(THRESHOLDS.find(t => `read-${t === 'All' ? 'All' : t}` === next.id) ?? '') ?? next.id;

  el.innerHTML = `
    <div class="next-quest-card">
      <div class="next-quest-eyebrow">⚡ Your Next Quest</div>
      <div class="next-quest-title">${escapeHtml(achName)}</div>
      <div class="next-quest-desc">
        Read <strong>${left}</strong> more ${left === 1 ? 'book' : 'books'} to unlock this trophy!
      </div>
      <div class="next-quest-progress">
        <div class="next-quest-bar">
          <div class="next-quest-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="next-quest-count">${current}/${target}</span>
      </div>
    </div>`;
}

/* ── Main render ────────────────────────────────────────── */
export function renderAchievementsTab() {
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  const total      = books.length;
  const readCount  = read.size;
  const ownedCount = owned.size;

  const items = [];

  for (const t of THRESHOLDS) {
    items.push({
      id: `read-${t}`, group: 'Read',
      label: `${READ_NAMES.get(t)} — Read ${t === 'All' ? 'All' : t}`,
      slug: `read-${slug(t)}`,
      achieved: t === 'All' ? (readCount >= total && total > 0) : readCount >= t,
      progressText: `${Math.min(readCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  for (const t of THRESHOLDS) {
    items.push({
      id: `own-${t}`, group: 'Owned',
      label: `${OWN_NAMES.get(t)} — Own ${t === 'All' ? 'All' : t}`,
      slug: `own-${slug(t)}`,
      achieved: t === 'All' ? (ownedCount >= total && total > 0) : ownedCount >= t,
      progressText: `${Math.min(ownedCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  for (const [key, info] of aggregateBySeries()) {
    if (!info.total) continue;
    items.push({
      id: `series-finish:${key}`, group: 'Series',
      label: `Series Finisher — ${info.saga ? info.saga + ' — ' : ''}${info.series || 'Unknown'}`,
      slug: 'series-finish',
      achieved: info.readCount === info.total,
      progressText: `${info.readCount}/${info.total}`,
    });
  }

  for (const [sagaName, info] of aggregateBySaga()) {
    if (!info.total) continue;
    items.push({
      id: `saga-conquer:${sagaName}`, group: 'Saga',
      label: `Saga Conqueror — ${sagaName}`,
      slug: 'saga-conquer',
      achieved: info.readCount === info.total,
      progressText: `${info.readCount}/${info.total}`,
    });
  }

  // Unlock detection
  const prevRaw  = localStorage.getItem(ACH_UNLOCKED_KEY);
  const firstRun = prevRaw == null;
  const prev     = new Set(prevRaw ? JSON.parse(prevRaw) : []);
  const currentUnlocked = items.filter(i => i.achieved).map(i => i.id);
  const newly = currentUnlocked.filter(id => !prev.has(id));
  localStorage.setItem(ACH_UNLOCKED_KEY, JSON.stringify(currentUnlocked));

  if (!firstRun && newly.length) {
    for (const id of newly) {
      const it = items.find(x => x.id === id);
      if (it) showAchievementToast({ label: it.label, src: badgeSrc(it.slug) });
    }
    try { navigator?.vibrate?.([50, 30, 50]); } catch {}
  }

  renderNextQuestCard(items);

  // Sort
  const order = ['Read', 'Owned', 'Series', 'Saga'];
  items.sort((a, b) => {
    const gd = order.indexOf(a.group) - order.indexOf(b.group);
    if (gd !== 0) return gd;
    const pd = priority(a.slug) - priority(b.slug);
    if (pd !== 0) return pd;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  const fb = fallback();

  grid.innerHTML = items.map(it => `
    <div class="trophy-card ${it.achieved ? 'trophy-card--unlocked' : ''}">
      <div class="trophy-badge">
        <img src="${escapeHtml(badgeSrc(it.slug))}" alt="${escapeHtml(it.label)}"
             class="${it.achieved ? '' : 'locked'}" loading="lazy" decoding="async"
             onerror="this.onerror=null;this.src='${fb}'" />
      </div>
      <div class="trophy-label">${escapeHtml(it.label)}</div>
      ${it.achieved
        ? `<span class="trophy-chip">🏆 Unlocked!</span>`
        : `<span class="trophy-progress">${escapeHtml(it.progressText)}</span>`}
    </div>
  `).join('') || '<div style="color:var(--text-muted);padding:12px;">No trophies configured.</div>';
}

/* ── Toast ──────────────────────────────────────────────── */
function showAchievementToast({ label, src }) {
  let root = document.getElementById('achToastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'achToastRoot';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.style.cssText = 'transform:translateY(20px) scale(.95);opacity:0;';

  const fb = fallback();
  el.innerHTML = `
    <div class="ach-toast-badge">
      <img src="${escapeHtml(src)}" alt="" onerror="this.onerror=null;this.src='${fb}'" />
    </div>
    <div class="ach-toast-body">
      <div class="ach-toast-eyebrow">🏆 Trophy Unlocked!</div>
      <div class="ach-toast-name">${escapeHtml(label)}</div>
    </div>
    <button type="button" class="ach-toast-close" aria-label="Dismiss">✕</button>
  `;

  const dismiss = () => {
    el.style.transform = 'translateY(12px) scale(.95)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('.ach-toast-close')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);

  root.prepend(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease';
    el.style.transform  = 'translateY(0) scale(1)';
    el.style.opacity    = '1';
  }));
}

/* ── Helpers ────────────────────────────────────────────── */
function slug(t) { return t === 'All' ? 'all' : String(t); }
function badgeSrc(baseSlug) { return `${BADGE_ASSETS.BASE}/${baseSlug}${BADGE_ASSETS.EXT}`; }

function priority(s) {
  if (/^(read|own)-(5|10|25|50|100|200|all)$/.test(s)) {
    return ['5','10','25','50','100','200','all'].indexOf(s.split('-')[1]);
  }
  return s === 'series-finish' ? 40 : s === 'saga-conquer' ? 50 : 99;
}

function aggregateBySeries() {
  const map = new Map();
  for (const b of books) {
    const key = `${b.saga}::${b.series}`;
    if (!map.has(key)) map.set(key, { saga: b.saga, series: b.series, total: 0, readCount: 0 });
    map.get(key).total++;
    if (read.has(b.id)) map.get(key).readCount++;
  }
  return map;
}

function aggregateBySaga() {
  const map = new Map();
  for (const b of books) {
    const key = b.saga || 'Unknown';
    if (!map.has(key)) map.set(key, { total: 0, readCount: 0 });
    map.get(key).total++;
    if (read.has(b.id)) map.get(key).readCount++;
  }
  return map;
}

function fallback() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>
    <rect width='96' height='96' rx='48' fill='%23141e2c'/>
    <text x='48' y='65' text-anchor='middle' font-size='50'>🏆</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
