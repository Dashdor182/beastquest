// app/achievements.js
import { books, owned, read } from './state.js';
import { escapeHtml } from './ui.js';

const BADGE_ASSETS = {
  BASE: './assets/achievements',
  EXT:  '.png',
  USE_LOCKED_VARIANTS: false,
};

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

/* ── Next Quest card ────────────────────────────────────── */
function renderNextQuestCard(items) {
  const el = document.getElementById('achNextQuest');
  if (!el) return;

  const next = items.find(it => it.group === 'Read' && !it.achieved);

  if (!next) {
    el.innerHTML = `
      <div class="ach-next-celebrate">
        <div class="ach-next-celebrate-icon">🏆</div>
        <div class="ach-next-celebrate-title">All reading quests complete!</div>
        <div class="ach-next-celebrate-sub">You've conquered every beast. Truly legendary!</div>
      </div>`;
    return;
  }

  const total     = books.length;
  const readCount = read.size;
  const target    = next.id === 'read-All' ? total : Number(next.id.replace('read-', ''));
  const current   = Math.min(readCount, target);
  const pct       = target > 0 ? Math.round(current / target * 100) : 0;
  const left      = target - current;

  const achName = READ_NAMES.get(THRESHOLDS.find(t => `read-${t === 'All' ? 'All' : t}` === next.id) ?? '') ?? next.id;

  el.innerHTML = `
    <div class="ach-next-card">
      <div class="ach-next-eyebrow">⚡ Your Next Quest</div>
      <div class="ach-next-title">${escapeHtml(achName)}</div>
      <div class="ach-next-desc">
        Read <strong>${left}</strong> more ${left === 1 ? 'book' : 'books'} to unlock this trophy!
      </div>
      <div class="ach-next-progress">
        <div class="ach-next-bar">
          <div class="ach-next-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="ach-next-count">${current}/${target}</span>
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

  /* Read milestones */
  for (const t of THRESHOLDS) {
    items.push({
      id:           `read-${t}`,
      group:        'Read',
      label:        `${READ_NAMES.get(t)} — Read ${t === 'All' ? 'All' : t}`,
      slug:         `read-${thresholdSlug(t)}`,
      achieved:     t === 'All' ? (readCount >= total && total > 0) : (readCount >= t),
      progressText: `${Math.min(readCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  /* Owned milestones */
  for (const t of THRESHOLDS) {
    items.push({
      id:           `own-${t}`,
      group:        'Owned',
      label:        `${OWN_NAMES.get(t)} — Own ${t === 'All' ? 'All' : t}`,
      slug:         `own-${thresholdSlug(t)}`,
      achieved:     t === 'All' ? (ownedCount >= total && total > 0) : (ownedCount >= t),
      progressText: `${Math.min(ownedCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  /* Series Finisher */
  const bySeries = aggregateBySeries();
  for (const [key, info] of bySeries) {
    const { saga, series, total: t, readCount: r } = info;
    if (!t) continue;
    items.push({
      id:           `series-finish:${key}`,
      group:        'Series',
      label:        `Series Finisher — ${seriesTitle(saga, series)}`,
      slug:         'series-finish',
      achieved:     r === t,
      progressText: `${r}/${t}`,
    });
  }

  /* Saga Conqueror */
  const bySaga = aggregateBySaga();
  for (const [saga, info] of bySaga) {
    const { total: t, readCount: r } = info;
    if (!t) continue;
    items.push({
      id:           `saga-conquer:${saga}`,
      group:        'Saga',
      label:        `Saga Conqueror — ${saga}`,
      slug:         'saga-conquer',
      achieved:     r === t,
      progressText: `${r}/${t}`,
    });
  }

  /* Unlock detection & toasts */
  const prevRaw  = localStorage.getItem(ACH_UNLOCKED_KEY);
  const firstRun = prevRaw == null;
  const prev     = new Set(prevRaw ? JSON.parse(prevRaw) : []);
  const currentUnlocked = items.filter(i => i.achieved).map(i => i.id);
  const newly    = currentUnlocked.filter(id => !prev.has(id));
  localStorage.setItem(ACH_UNLOCKED_KEY, JSON.stringify(currentUnlocked));

  if (!firstRun && newly.length) {
    for (const id of newly) {
      const it = items.find(x => x.id === id);
      if (!it) continue;
      const { src } = badgeSrc(it.slug, true);
      showAchievementToast({ label: it.label, src });
    }
    try { navigator?.vibrate?.([50, 30, 50]); } catch {}
  }

  renderNextQuestCard(items);

  /* Sort grid */
  const order = ['Read', 'Owned', 'Series', 'Saga'];
  items.sort((a, b) => {
    const ga = order.indexOf(a.group), gb = order.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    const pa = priorityOfSlug(a.slug), pb = priorityOfSlug(b.slug);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  const fallback = fallbackDataUrl();

  grid.innerHTML = items.map(it => {
    const { src } = badgeSrc(it.slug, it.achieved);
    const cardClass = 'ach-card' + (it.achieved ? ' ach-card--unlocked' : '');
    const imgClass  = it.achieved ? 'ach-badge-img' : 'ach-badge-img ach-badge-img--locked';
    const sub = it.achieved
      ? `<span class="ach-unlocked-chip">🏆 Unlocked!</span>`
      : `<span class="ach-progress-text">${escapeHtml(it.progressText)}</span>`;

    return `
      <div class="${cardClass}">
        <div class="ach-badge-wrap">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(it.label)}"
               class="${imgClass}" loading="lazy" decoding="async"
               onerror="this.onerror=null;this.src='${fallback}'" />
        </div>
        <div class="ach-card-label">${escapeHtml(it.label)}</div>
        ${sub}
      </div>`;
  }).join('') || '<div style="color:var(--ink3);padding:12px;">No trophies configured.</div>';
}

/* ── Toast notification ─────────────────────────────────── */
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
  el.className = 'ach-toast-item';
  el.style.cssText = 'transform:translateY(20px) scale(.96);opacity:0;';

  const fallback = fallbackDataUrl();
  el.innerHTML = `
    <div class="ach-toast-badge">
      <img src="${escapeHtml(src)}" alt="" onerror="this.onerror=null;this.src='${fallback}'" />
    </div>
    <div class="ach-toast-text">
      <div class="ach-toast-eyebrow">🏆 Trophy Unlocked!</div>
      <div class="ach-toast-label">${escapeHtml(label)}</div>
    </div>
    <button type="button" class="ach-toast-dismiss" aria-label="Dismiss">✕</button>
  `;

  const dismiss = () => {
    el.style.transform = 'translateY(12px) scale(.96)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('.ach-toast-dismiss')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);

  root.prepend(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = 'translateY(0) scale(1)';
    el.style.opacity = '1';
    el.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease';
  }));
}

/* ── Helpers ────────────────────────────────────────────── */
function thresholdSlug(t) { return t === 'All' ? 'all' : String(t); }

function badgeSrc(baseSlug, achieved) {
  const { BASE, EXT, USE_LOCKED_VARIANTS } = BADGE_ASSETS;
  if (!achieved && USE_LOCKED_VARIANTS) {
    return { src: `${BASE}/${baseSlug}-locked${EXT}` };
  }
  return { src: `${BASE}/${baseSlug}${EXT}` };
}

function priorityOfSlug(slug) {
  if (/^(read|own)-(5|10|25|50|100|200|all)$/.test(slug)) {
    return ['5','10','25','50','100','200','all'].indexOf(slug.split('-')[1]);
  }
  if (slug === 'series-finish') return 40;
  if (slug === 'saga-conquer')  return 50;
  return 99;
}

function aggregateBySeries() {
  const map = new Map();
  for (const b of books) {
    const key = `${b.saga}::${b.series}`;
    if (!map.has(key)) map.set(key, { saga: b.saga, series: b.series, total: 0, readCount: 0 });
    const m = map.get(key);
    m.total++;
    if (read.has(b.id)) m.readCount++;
  }
  return map;
}

function aggregateBySaga() {
  const map = new Map();
  for (const b of books) {
    const key = b.saga || 'Unknown';
    if (!map.has(key)) map.set(key, { total: 0, readCount: 0 });
    const m = map.get(key);
    m.total++;
    if (read.has(b.id)) m.readCount++;
  }
  return map;
}

function seriesTitle(saga, series) {
  return `${saga ? saga + ' — ' : ''}${series || 'Unknown Series'}`;
}

function fallbackDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>
    <defs><linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
      <stop offset='0' stop-color='#3d2010'/><stop offset='1' stop-color='#1a0c04'/>
    </linearGradient></defs>
    <rect width='96' height='96' rx='48' fill='url(#g)'/>
    <text x='48' y='62' text-anchor='middle' font-size='48' fill='%23c9950a'>🏆</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
