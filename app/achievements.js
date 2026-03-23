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

/* ── Next Quest card ─────────────────────────────────── */
function renderNextQuestCard(items){
  const el = document.getElementById('achNextQuest');
  if (!el) return;

  // Find the first unachieved Read milestone (lowest threshold not yet unlocked)
  const next = items.find(it => it.group === 'Read' && !it.achieved);

  if (!next){
    // All read milestones done — show a celebration instead
    el.innerHTML = `
      <div class="next-quest-card panel rounded-xl p-5 text-center">
        <div class="text-4xl mb-2">🏆</div>
        <div class="text-lg font-bold">All reading quests complete!</div>
        <div class="muted text-sm mt-1">You've conquered every beast. Truly legendary!</div>
      </div>`;
    return;
  }

  const total   = books.length;
  const readCount = read.size;
  const target  = next.id === `read-All` ? total : Number(next.id.replace('read-', ''));
  const current = Math.min(readCount, target);
  const pct     = target > 0 ? Math.round(current / target * 100) : 0;
  const left    = target - current;

  el.innerHTML = `
    <div class="next-quest-card panel rounded-xl p-4 sm:p-5">
      <div class="text-xs font-bold muted uppercase tracking-widest mb-1">⚡ Your Next Quest</div>
      <div class="text-xl font-bold mb-1">${escapeHtml(READ_NAMES.get(THRESHOLDS.find(t => `read-${t === 'All' ? 'All' : t}` === next.id) ?? next.id.replace('read-','')) ?? next.id)}</div>
      <div class="muted text-sm mb-3">
        Read <strong style="color:var(--accent2)">${left}</strong> more ${left === 1 ? 'book' : 'books'} to unlock this achievement!
      </div>
      <div class="flex items-center gap-3">
        <div class="flex-1 progress-track next-quest-progress overflow-hidden rounded-full">
          <div class="next-quest-progress" style="width:${pct}%;background:var(--accent2);border-radius:9999px;transition:width .5s cubic-bezier(.34,1.56,.64,1);"></div>
        </div>
        <span class="text-sm font-bold shrink-0" style="color:var(--accent2)">${current}/${target}</span>
      </div>
    </div>`;
}

/* ── Main render ─────────────────────────────────────── */
export function renderAchievementsTab(){
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  grid.className = 'grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  const total      = books.length;
  const readCount  = read.size;
  const ownedCount = owned.size;

  const items = [];

  // Read milestones
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

  // Owned milestones
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

  // Series Finisher
  const bySeries = aggregateBySeries();
  for (const [key, info] of bySeries){
    const { saga, series, total: t, readCount: r } = info;
    if (!t) continue;
    items.push({
      id: `series-finish:${key}`,
      group: 'Series',
      label: `Series Finisher — ${seriesTitle(saga, series)}`,
      slug: 'series-finish',
      achieved: r === t,
      progressText: `${r}/${t}`
    });
  }

  // Saga Conqueror
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

  // Unlock detection & toasts
  const prevRaw  = localStorage.getItem(ACH_UNLOCKED_KEY);
  const firstRun = prevRaw == null;
  const prev     = new Set(prevRaw ? JSON.parse(prevRaw) : []);
  const currentUnlocked = items.filter(i => i.achieved).map(i => i.id);
  const newly = currentUnlocked.filter(id => !prev.has(id));
  localStorage.setItem(ACH_UNLOCKED_KEY, JSON.stringify(currentUnlocked));

  if (!firstRun && newly.length){
    for (const id of newly){
      const it = items.find(x => x.id === id);
      if (!it) continue;
      const { src } = badgeSrc(it.slug, true);
      showAchievementToast({ label: it.label, src });
    }
    try { navigator?.vibrate?.([50, 30, 50]); } catch {}
  }

  // Render next quest card
  renderNextQuestCard(items);

  // Sort & render grid
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
    const imgClass = it.achieved ? '' : 'ach-badge-locked';
    const sub = it.achieved
      ? '<span class="badge badge-own">🏆 Unlocked!</span>'
      : `<span class="muted text-[11px]">${escapeHtml(it.progressText)}</span>`;
    const fallback = fallbackDataUrl();
    return `
      <div class="ach-item ${it.achieved ? 'achieved' : ''}">
        <div class="ach-badge-frame">
          <img
            src="${src}"
            alt="${escapeHtml(it.label)} badge"
            class="${imgClass}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${fallback}'" />
        </div>
        <div class="text-[0.75rem] sm:text-sm font-semibold leading-tight cinzel">
          ${escapeHtml(it.label)}
        </div>
        ${sub}
      </div>`;
  }).join('');

  grid.innerHTML = html || '<div class="muted">No achievements configured.</div>';
}

/* ── Toast notification ─────────────────────────────── */
function showAchievementToast({ label, src }){
  let root = document.getElementById('achToastRoot');
  if (!root){
    root = document.createElement('div');
    root.id = 'achToastRoot';
    // Position above bottom nav on mobile
    root.className = 'fixed inset-x-0 bottom-20 sm:bottom-4 z-50 flex flex-col items-center gap-3 sm:items-end sm:pr-4 pointer-events-none';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  el.className = 'pointer-events-auto px-4 py-3 flex items-center gap-4 w-[min(90vw,26rem)] rounded-2xl shadow-2xl';
  el.style.cssText = [
    'background:var(--panel2)',
    'border:2px solid var(--gold)',
    'box-shadow:0 0 32px color-mix(in oklab,var(--gold) 28%,transparent)',
    'transition:transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s ease',
    'transform:translateY(16px) scale(.95)',
    'opacity:0',
  ].join(';');

  const fallback = fallbackDataUrl();
  el.innerHTML = `
    <div class="ach-badge-frame flex-none" style="width:52px;height:52px;border-color:var(--gold)">
      <img src="${src}" alt="" onerror="this.onerror=null;this.src='${fallback}'" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-bold uppercase tracking-widest cinzel" style="color:var(--gold)">🏆 Achievement Unlocked!</div>
      <div class="text-sm font-bold leading-tight mt-0.5">${escapeHtml(label)}</div>
    </div>
    <button type="button" aria-label="Dismiss" class="text-lg muted hover:text-[color:var(--text)] shrink-0">✕</button>
  `;

  const dismiss = () => {
    el.style.transform = 'translateY(12px) scale(.95)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  };

  el.querySelector('button')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);

  root.prepend(el);
  requestAnimationFrame(()=> requestAnimationFrame(()=>{
    el.style.transform = 'translateY(0) scale(1)';
    el.style.opacity = '1';
  }));
}

/* ── Helpers ─────────────────────────────────────────── */
function thresholdSlug(t){ return (t === 'All') ? 'all' : String(t); }

function badgeSrc(baseSlug, achieved){
  const base = BADGE_ASSETS.BASE;
  const ext  = BADGE_ASSETS.EXT;
  if (!achieved && BADGE_ASSETS.USE_LOCKED_VARIANTS){
    return { src: `${base}/${baseSlug}-locked${ext}`, usesLockedVariant: true };
  }
  return { src: `${base}/${baseSlug}${ext}`, usesLockedVariant: false };
}

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
          <stop offset='0' stop-color='#1e3a6e'/>
          <stop offset='1' stop-color='#0f1520'/>
        </linearGradient>
      </defs>
      <rect width='96' height='96' rx='16' fill='url(#g)'/>
      <circle cx='48' cy='44' r='20' fill='#f5c518'/>
      <rect x='36' y='64' width='24' height='12' rx='3' fill='#22d3ee'/>
    </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
