import { STARTER_BOOKS } from './data.js';

export const LS_KEYS = { BOOKS: 'bq:books', OWNED: 'bq:owned', READ: 'bq:read', COLLAPSED: 'bq:collapsedSeries' };

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

/** Collapse all series by default on first run, and collapse any newly-seen series after imports. */
export function ensureDefaultCollapsedForCurrentBooks(){
  const stored = localStorage.getItem(LS_KEYS.COLLAPSED);
  const allKeys = allSeriesKeysFromBooks(books);
  if (stored == null){
    collapsedSeries = new Set(allKeys);
    saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
  } else {
    let changed = false;
    for (const key of allKeys){ if (!collapsedSeries.has(key)){ collapsedSeries.add(key); changed = true; } }
    if (changed) saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
  }
}
