import { STARTER_BOOKS } from './data.js';

export const LS_KEYS = {
  BOOKS: 'bq:books',
  OWNED: 'bq:owned',
  READ: 'bq:read',
  COLLAPSED: 'bq:collapsedSeries',
  COLLAPSED_SAGAS: 'bq:collapsedSagas', // NEW
};

export function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
export function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// Live bindings (mutable)
export let books = loadJSON(LS_KEYS.BOOKS, STARTER_BOOKS);
export let owned = new Set(loadJSON(LS_KEYS.OWNED, []));
export let read  = new Set(loadJSON(LS_KEYS.READ,  []));
export let collapsedSeries = new Set(loadJSON(LS_KEYS.COLLAPSED, []));
export let collapsedSagas  = new Set(loadJSON(LS_KEYS.COLLAPSED_SAGAS, [])); // NEW

export function setBooks(next){
  books = next;
  saveJSON(LS_KEYS.BOOKS, books);
}
export function setOwned(nextSet){
  owned = nextSet;
  saveJSON(LS_KEYS.OWNED, [...owned]);
}
export function setRead(nextSet){
  read = nextSet;
  saveJSON(LS_KEYS.READ, [...read]);
}

export function seriesKey(saga, series){ return `${saga}::${series}`; }
export function allSeriesKeysFromBooks(list = books){
  const set = new Set();
  for (const b of list){ set.add(seriesKey(b.saga, b.series)); }
  return set;
}
export function allSagaKeysFromBooks(list = books){
  const set = new Set();
  for (const b of list){ set.add(b.saga); }
  return set;
}

/** Collapse all series AND sagas by default on first run; collapse any newly-seen ones after imports. */
export function ensureDefaultCollapsedForCurrentBooks(){
  // Series
  const allSeries = allSeriesKeysFromBooks(books);
  const storedSeries = localStorage.getItem(LS_KEYS.COLLAPSED);
  if (storedSeries == null){
    collapsedSeries = new Set(allSeries);
    saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
  } else {
    let changed = false;
    for (const key of allSeries){ if (!collapsedSeries.has(key)){ collapsedSeries.add(key); changed = true; } }
    if (changed) saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
  }

  // Sagas (NEW)
  const allSagas = allSagaKeysFromBooks(books);
  const storedSagas = localStorage.getItem(LS_KEYS.COLLAPSED_SAGAS);
  if (storedSagas == null){
    // default collapsed for sagas too
    collapsedSagas = new Set(allSagas);
    saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
  } else {
    let changed = false;
    for (const s of allSagas){ if (!collapsedSagas.has(s)){ collapsedSagas.add(s); changed = true; } }
    if (changed) saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
  }
}
