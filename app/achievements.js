// app/achievements.js
import { books, owned, read, LS_KEYS, loadJSON, saveJSON } from './state.js';
import { escapeHtml, showAchievementToast } from './ui.js';

/** PNG assets; locked variants disabled (use grayscale filter for locked). */
const BADGE_ASSETS = {
  BASE: './assets/achievements',
  EXT:  '.png',
  USE_LOCKED_VARIANTS: false,
};

// Themed names
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

/* --------- Build items (shared by renderer and notifier) --------- */
function buildAchievementItems(){
  const total = books.length;
  const readCount = read.size;
  const ownedCount = owned.size;

  const items = [];

  // Read milestones
  for (const t of THRESHOLDS){
    items.push({
      id: `read-${t}`,
      group: 'Read',
      label: `${READ_NAMES.get(t)} — Read ${t === 'All' ? 'All' : t}`,
      slug: `read-${t === 'All' ? 'all' : String(t)}`,
      achieved: (t === 'All') ? (total > 0 && readCount >= total) : (readCount >= t),
      progressText: `${Math.min(readCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  // Owned milestones
  for (const t of THRESHOLDS){
    items.push({
      id: `own-${t}`,
      group: 'Owned',
      label: `${OWN_NAMES.get(t)} — Own ${t === 'All' ? 'All' : t}`,
      slug: `own-${t === 'All' ? 'all' : String(t)}`,
      achieved: (t === 'All') ? (total > 0 && ownedCount >= total) : (ownedCount >= t),
      progressText: `${Math.min(ownedCount, t === 'All' ? total : t)}/${t === 'All' ? 'All' : t}`,
    });
  }

  // Extra global
  items.push(
    {
      id:'read-50pct', group:'Read', label:'Halfway There — Read ≥ 50%', slug:'read-50pct',
      achieved: total ? (readCount / total >= 0.5) : false, progressText: `${readCount}/${total || 0}`
    },
    {
      id:'read-75pct', group:'Read', label:'Three Quarters — Read ≥ 75%', slug:'read-75pct',
      achieved: total ? (readCount / total >= 0.75) : false, progressText: `${readCount}/${total || 0}`
    },
    {
      id:'own-50pct', group:'Owned', label:"Collector’s Majority — Own ≥ 50%", slug:'own-50pct',
      achieved: total ? (ownedCount / total >= 0.5) : false, progressText: `${ownedCount}/${total || 0}`
    },
    {
      id:'double-mastery', group:'Mastery', label:'Double Mastery — Own & Read 100%', slug:'double-mastery',
      achieved: total ? (readCount === total && ownedCount === total) : false, progressText: `${readCount}/${total}`
    },
    {
      id:'first-read', group:'Firsts', label:'First Steps — First book read', slug:'first-read',
      achieved: readCount >= 1, progressText: `${readCount}/1`
    },
    {
      id:'first-owned', group:'Firsts', label:'First Find — First book owned', slug:'first-owned',
      achieved: ownedCount >= 1, progressText: `${ownedCount}/1`
    },
    {
      id:'first-six', group:'Read', label:'All First Six — Read #1–6', slug:'first-six',
      achieved: haveReadNumbers([1,2,3,4,5,6]), progressText: progressNumbers([1,2,3,4,5,6])
    }
  );

  // Per-series
  const bySeries = aggregateBySeries();
  let anyOwnAllSeries = false;
  let anyPerfectSeries = false;

  for (const [key, info] of bySeries){
    const { saga, series, total: t, readCount: r, ownedCount: o } = info;
    if (!t) continue;
    const readAll = (r === t);
    const ownAll  = (o === t);
    const perfect = readAll && ownAll;

    if (ownAll) anyOwnAllSeries = true;
    if (perfect) anyPerfectSeries = true;

    items.push({
      id: `series-finish:${key}`,
      group: 'Series',
      label: `Series Finisher — ${seriesTitle(saga, series)}`,
      slug: 'series-finish',
      achieved: readAll,
      progressText: `${r}/${t}`
    });
  }

  items.push(
    {
      id: 'gap-hunter', group:'Owned', label:'Gap Hunter — Own all books in any series', slug:'gap-hunter',
      achieved: anyOwnAllSeries, progressText: anyOwnAllSeries ? '1/1' : '0/1'
    },
    {
      id: 'perfect-series', group:'Mastery', label:'Perfect Series — Own & read all books in a series', slug:'perfect-series',
      achieved: anyPerfectSeries, progressText: anyPerfectSeries ? '1/1' : '0/1'
    }
  );

  // Per-saga
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

  // Sort (stable)
  const order = ['Mastery','Read','Owned','Series','Saga','Firsts'];
  items.sort((a,b)=>{
    const ga = order.indexOf(a.group); const gb = order.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    const pa = priorityOfSlug(a.slug);
    const pb = priorityOfSlug(b.slug);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, undefined, { numeric:true });
  });

  return items;
}

/* --------- Public: render tab --------- */
export function renderAchievementsTab(){
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  grid.classList.add('grid','gap-2','sm:gap-3','grid-cols-2','sm:grid-cols-3','lg:grid-cols-4','xl:grid-cols-5');

  const items = buildAchievementItems();

  const html = items.map(it => {
    const { src } = badgeSrc(it.slug, it.achieved);
    const lockedStyle = it.achieved ? '' : 'filter: grayscale(1) opacity(.8);';
    const sub = it.achieved
      ? '<span class="badge">Unlocked</span>'
      : `<span class="muted text-[11px]">${escapeHtml(it.progressText)}</span>`;
    const fallback = fallbackDataUrl();

    return `
      <div class="panel rounded-xl border brand-border p-2 sm:p-3 text-center flex flex-col items-center gap-1 sm:gap-2">
        <img src="${src}" alt="${escapeHtml(it.label)} badge"
             class="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20"
             style="${lockedStyle}" loading="lazy" decoding="async"
             onerror="this.onerror=null;this.src='${fallback}'" />
        <div class="text-[0.82rem] sm:text-sm font-semibold leading-tight">${escapeHtml(it.label)}</div>
        ${sub}
      </div>
    `;
  }).join('');

  grid.innerHTML = html || '<div class="muted">No achievements configured.</div>';
}

/* --------- Public: sync + notify new unlocks --------- */
export function syncAchievementsUnlocked({ silent = false } = {}){
  const items = buildAchievementItems();
  const currentUnlocked = items.filter(i => i.achieved).map(i => i.id);

  const prev = loadJSON(LS_KEYS.ACH_UNLOCKED, []);
  const
