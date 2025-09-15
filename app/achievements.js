// app/achievements.js
import { books, owned, read } from './state.js';
import { escapeHtml } from './ui.js';

/**
 * PNG assets; locked variants not used (grayscale via CSS).
 */
const BADGE_ASSETS = {
  BASE: './assets/achievements',
  EXT:  '.png',
  USE_LOCKED_VARIANTS: false,
};

// Persist which achievements are unlocked so we can toast only new ones
const ACH_UNLOCKED_KEY = 'bq:achUnlocked';

// Themed names for thresholds
const READ_NAMES = new Map([
  [5,   'Apprentice Adventurer'],
  [10,  'Beast Tracker'],
  [25,  'Quest Knight'],
  [50,  'Realm Ranger'],
  [100, 'Master Beastbreaker'],
  [200, 'Saga Sentinel'],
  ['All', 'The Complete Bestiary'],
]);

const OWN_NAMES = new Map([
  [5,   "Collector's Pouch"],
  [10,  'Keeper of Scrolls'],
  [25,  'Lore Archivist'],
  [50,  'Vault Curator'],
  [100, 'Grand Librarian'],
  [200, 'Warden of the Vault'],
  ['All', 'The Grand Codex'],
]);

const THRESHOLDS = [5, 10, 25, 50, 100, 200, 'All'];

// Render the Achievements tab
export function renderAchievementsTab(){
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  // dense, responsive grid
  grid.className = '';
  grid.classList.add(
    'grid',
    'gap-2', 'sm:gap-3',
    'grid-cols-2',
    'sm:grid-cols-3',
    'lg:grid-cols-4',
    'xl:grid-cols-5'
  );

  const total = books.length;
  const readCount = read.size;
  const ownedCount = owned.size;

  const items = [];

  // --- Read milestones ---
  for (const t of THRESHOLDS){
    items.push({
      id: `read-${t}`,
      group: 'Read',
      label: `${READ_NAMES.get(t)} — Read ${t === 'All' ? 'All' : t}`,
      slug: `read-${thresholdSlug(t, total)}`,
      achieved: (t === 'All') ? (readCount >= total && total > 0) : (readCount >= t),
      progressText: `${Math.min(readCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  // --- Owned milestones ---
  for (const t of THRESHOLDS){
    items.push({
      id: `own-${t}`,
      group: 'Owned',
      label: `${OWN_NAMES.get(t)} — Own ${t === 'All' ? 'All' : t}`,
      slug: `own-${thresholdSlug(t, total)}`,
      achieved: (t === 'All') ? (ownedCount >= total && total > 0) : (ownedCount >= t),
      progressText: `${Math.min(ownedCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  // --- Series Finisher (per series) ---
  const bySeries = aggregateBySeries();
  for (const [key, info] of bySeries){
    const { saga, series, total: t, readCount: r } = info;
    if (!t) continue;
    const readAll = (r === t);
    items.push({
      id: `series-finish:${key}`,
      group: 'Series',
      label: `Series Finisher — ${seriesTitle(saga, series)}`,
      slug: 'series-finish',
      achieved: readAll,
      progressText: `${r}/${t}`
    });
  }

  // --- Saga Conqueror (per saga) ---
  const bySaga = aggregateBySaga();
  for (const [saga, info] of bySaga){
    const { total: t, readCount: r } = info;
    if (!t) continue;
    items.push({
      id: `saga-conquer:${saga}`,
      group: 'Saga',
      label: `Saga Conqueror — ${saga}`,
      slug: 'saga-conquer',
      achieved: r === t,
      progressText: `${r}/${t}`
    });
  }

  // --- Unlock detection & toasts ---
  const prevRaw = localStorage.getItem(ACH_UNLOCKED_KEY);
  const firstRun = prevRaw == null;
  const prev = new Set(prevRaw ? JSON.parse(prevRaw) : []);
  const currentUnlocked = items.filter(i => i.achieved).map(i => i.id);
  const newly = currentUnlocked.filter(id => !prev.has(id));
  localStorage.setItem(ACH_UNLOCKED_KEY, JSON.stringify(currentUnlocked));

  if (!firstRun && newly.length){
    for (const id of newly){
      const it = items.find(x => x.id === id);
      if (!it) continue;
      const { src } = badgeSrc(it.slug, true);
      showAchievementToast({ title: 'Achievement unlocked!', label: it.label, src });
    }
    try { navigator?.vibrate?.(10); } catch {}
  }

  // --- Sort & render ---
  const order = ['Read','Owned','Series','Saga'];
  items.sort((a,b)=>{
    const ga = order.indexOf(a.group); const gb = order.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    const pa = priorityOfSlug(a.slug);
    const pb = priorityOfSlug(b.slug);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, undefined, { numeric:true });
  });

  const html = items.map(it => {
    const { src } = badgeSrc(it.slug, it.achieved);
    const lockedStyle = it.achieved ? '' : 'filter: grayscale(1) opacity(.8);';
    const sub = it.achieved
      ? '<span class="badge">Unlocked</span>'
      : `<span class="muted text-[11px]">${escapeHtml(it.progressText)}</span>`;
    const fallback = fallbackDataUrl();
    return `
      <div class="panel rounded-xl border brand-border p-2 sm:p-3 text-center flex flex-col items-center gap-1 sm:gap-2">
        <img
          src="${src}"
          alt="${escapeHtml(it.label)} badge"
          class="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20"
          style="${lockedStyle}"
          loading="lazy"
          decoding="async"
          onerror="this.onerror=null;this.src='${fallback}'" />
        <div class="text-[0.82rem] sm:text-sm font-semibold leading-tight">
          ${escapeHtml(it.label)}
        </div>
        ${sub}
      </div>
    `;
  }).join('');

  grid.innerHTML = html || '<div class="muted">No achievements configured.</div>';
}

/* ---------------- Toast ---------------- */

function showAchievementToast({ title, label, src }){
  let root = document.getElementById('achToastRoot');
  if (!root){
    root = document.createElement('div');
    root.id = 'achToastRoot';
    root.className = 'fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 sm:items-end sm:pr-4 pointer-events-none';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  el.className = 'panel border brand-border rounded-xl shadow-lg pointer-events-auto px-3 py-2 flex items-center gap-3 w-[min(92vw,22rem)]';
  el.style.transition = 'transform .2s ease, opacity .2s ease';
  el.style.transform = 'translateY(8px)';
  el.style.opacity = '0';

  el.innerHTML = `
    <img src="${src}" alt="" class="w-10 h-10 rounded-md flex-none" />
    <div class="min-w-0">
      <div class="text-xs muted">${escapeHtml(title)}</div>
      <div class="text-sm font-semibold truncate">${escapeHtml(label)}</div>
    </div>
    <button type="button" aria-label="Dismiss"
      class="ml-auto text-sm muted hover:text-[color:var(--text)]">✕</button>
  `;

  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 200);
  };

  el.querySelector('button')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 4000);

  root.prepend(el);
  requestAnimationFrame(()=>{
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

/* ---------------- helpers ---------------- */

function thresholdSlug(t, total){
  return (t === 'All') ? 'all' : String(t);
}

function badgeSrc(baseSlug, achieved){
  const base = BADGE_ASSETS.BASE;
  const ext  = BADGE_ASSETS.EXT;
  if (!achieved && BADGE_ASSETS.USE_LOCKED_VARIANTS){
    return { src: `${base}/${baseSlug}-locked${ext}`, usesLockedVariant: true };
  }
  return { src: `${base}/${baseSlug}${ext}`, usesLockedVariant: false };
}

// Only the slugs we still use
function priorityOfSlug(slug){
  if (/^(read|own)-(5|10|25|50|100|200|all)$/.test(slug)){
    const order = ['5','10','25','50','100','200','all'];
    const key = slug.split('-')[1];
    return order.indexOf(key);
  }
  if (slug === 'series-finish') return 40;
  if (slug === 'saga-conquer')  return 50;
  return 99;
}

function aggregateBySeries(){
  // key => { saga, series, total, readCount }
  const map = new Map();
  for (const b of books){
    const key = `${b.saga}::${b.series}`;
    if (!map.has(key)) map.set(key, { saga:b.saga, series:b.series, total:0, readCount:0 });
    const m = map.get(key);
    m.total++;
    if (read.has(b.id)) m.readCount++;
  }
  return map;
}

function aggregateBySaga(){
  // saga => { total, readCount }
  const map = new Map();
  for (const b of books){
    const key = b.saga || 'Unknown';
    if (!map.has(key)) map.set(key, { total:0, readCount:0 });
    const m = map.get(key);
    m.total++;
    if (read.has(b.id)) m.readCount++;
  }
  return map;
}

function seriesTitle(saga, series){
  return `${saga ? saga + ' — ' : ''}${series || 'Unknown Series'}`;
}

function fallbackDataUrl(){
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>
      <defs>
        <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0' stop-color='#6f687a'/>
          <stop offset='1' stop-color='#292d41'/>
        </linearGradient>
      </defs>
      <rect width='96' height='96' rx='16' fill='url(#g)'/>
      <circle cx='48' cy='44' r='20' fill='#b59e90'/>
      <rect x='36' y='64' width='24' height='12' rx='3' fill='#a58d89'/>
    </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
