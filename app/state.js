// Central app state + persistence

export const LS_KEYS = {
  BOOKS: 'bq:books',
  OWNED: 'bq:owned',
  READ: 'bq:read',
  COLLAPSED: 'bq:collapsedSeries',       // keys: `${saga}::${series}`
  COLLAPSED_SAGAS: 'bq:collapsedSagas',  // values: 'saga name'
  ACH_UNLOCKED: 'bq:achievementsUnlocked', // NEW: store unlocked achievement IDs
};

// Tiny starter dataset (replace via Import later)
const STARTER_BOOKS = [
  { id:'S01-01', number:1,  title:'Ferno the Fire Dragon', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:1 },
  { id:'S01-02', number:2,  title:'Sepron the Sea Serpent', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:2 },
  { id:'S01-03', number:3,  title:'Arcta the Mountain Giant', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:3 },
  { id:'S01-04', number:4,  title:'Tagus the Horse-Man', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:4 },
  { id:'S01-05', number:5,  title:'Nanook the Snow Monster', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:5 },
  { id:'S01-06', number:6,  title:'Epos the Flame Bird', saga:'Tom and Elenna', series:'Where It All Began', seriesIndex:6 },
  { id:'S02-07', number:7,  title:'Zepha the Monster Squid', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:1 },
  { id:'S02-08', number:8,  title:'Claw the Giant Monkey', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:2 },
  { id:'S02-09', number:9,  title:'Soltra the Stone Charmer', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:3 },
  { id:'S02-10', number:10, title:'Vipero the Snake Man', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:4 },
  { id:'S02-11', number:11, title:'Arachnid the King of Spiders', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:5 },
  { id:'S02-12', number:12, title:'Trillion the Three-Headed Lion', saga:'Tom and Elenna', series:'The Golden Armour', seriesIndex:6 },
];

export function loadJSON(key, fallback){
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
export function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

export let books           = loadJSON(LS_KEYS.BOOKS, STARTER_BOOKS);
export let owned           = new Set(loadJSON(LS_KEYS.OWNED, []));
export let read            = new Set(loadJSON(LS_KEYS.READ,  []));
export let collapsedSeries = new Set(loadJSON(LS_KEYS.COLLAPSED, []));        // `${saga}::${series}`
export let collapsedSagas  = new Set(loadJSON(LS_KEYS.COLLAPSED_SAGAS, []));  // `sagaName`

export function seriesKey(saga, series){ return `${saga}::${series}`; }
export function allSeriesKeysFromBooks(list = books){
  const s = new Set(); for (const b of list){ s.add(seriesKey(b.saga, b.series)); } return s;
}
export function allSagaNamesFromBooks(list = books){
  const s = new Set(); for (const b of list){ if (b.saga) s.add(b.saga); } return s;
}

/**
 * Default-collapse behavior:
 * - First run: collapse all sagas & all series.
 * - Imports/new data: any new saga/series defaults to collapsed.
 */
export function ensureDefaultCollapsedForCurrentBooks(){
  const allSeriesKeys = allSeriesKeysFromBooks(books);
  const allSagaNames  = allSagaNamesFromBooks(books);

  // SERIES
  let changedSeries = false;
  if (!localStorage.getItem(LS_KEYS.COLLAPSED)){
    collapsedSeries = new Set(allSeriesKeys);
    changedSeries = true;
  } else {
    for (const key of allSeriesKeys){
      if (!collapsedSeries.has(key)){ collapsedSeries.add(key); changedSeries = true; }
    }
  }
  if (changedSeries) saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);

  // SAGAS
  let changedSagas = false;
  if (!localStorage.getItem(LS_KEYS.COLLAPSED_SAGAS)){
    collapsedSagas = new Set(allSagaNames);
    changedSagas = true;
  } else {
    for (const s of allSagaNames){
      if (!collapsedSagas.has(s)){ collapsedSagas.add(s); changedSagas = true; }
    }
  }
  if (changedSagas) saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
}
ensureDefaultCollapsedForCurrentBooks();

// Replacers (used by imports)
export function replaceBooks(newBooks){
  books = Array.isArray(newBooks) ? newBooks : [];
  saveJSON(LS_KEYS.BOOKS, books);
  ensureDefaultCollapsedForCurrentBooks();
}
export function replaceState(newOwnedIds = [], newReadIds = []){
  owned = new Set(newOwnedIds);
  read  = new Set(newReadIds);
  saveJSON(LS_KEYS.OWNED, [...owned]);
  saveJSON(LS_KEYS.READ,  [...read]);
}
