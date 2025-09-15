import {
  LS_KEYS, books, owned, read,
  collapsedSeries, collapsedSagas,
  saveJSON, seriesKey, allSeriesKeysFromBooks
} from './state.js';

const elResults = () => document.getElementById('results');
const tplSeries = () => document.getElementById('tpl-series');
const tplCard   = () => document.getElementById('tpl-card');

const elSearch = () => document.getElementById('search');
const elSaga   = () => document.getElementById('filterSaga');
const elSeries = () => document.getElementById('filterSeries');
const elStatus = () => document.getElementById('filterStatus');

export const elStatTotal = () => document.getElementById('statTotal');
export const elStatOwned = () => document.getElementById('statOwned');
export const elStatRead  = () => document.getElementById('statRead');
export const elStatPct   = () => document.getElementById('statPct');
export const elStatBar   = () => document.getElementById('statBar');

export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s) => (
    s === '&' ? '&amp;' :
    s === '<' ? '&lt;' :
    s === '>' ? '&gt;' :
    s === '"' ? '&quot;' : '&#39;'
  ));
}
const uniq = (arr)=> [...new Set(arr)];

/* -------- Collapse helpers (exported for global controls) -------- */
export function setAllSagasCollapsed(collapsed){
  const all = new Set(books.map(b=>b.saga));
  collapsedSagas.clear();
  if (collapsed) for (const s of all) collapsedSagas.add(s);
  saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
}

export function setAllSeriesCollapsed(collapsed){
  const all = allSeriesKeysFromBooks(books);
  collapsedSeries.clear();
  if (collapsed) for (const k of all) collapsedSeries.add(k);
  saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
}

export function setSagaSeriesCollapsed(saga, collapsed){
  const keys = books.filter(b=>b.saga===saga).map(b=>seriesKey(b.saga, b.series));
  let changed = false;
  for (const k of keys){
    if (collapsed && !collapsedSeries.has(k)){ collapsedSeries.add(k); changed = true; }
    if (!collapsed && collapsedSeries.has(k)){ collapsedSeries.delete(k); changed = true; }
  }
  if (changed) saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
}

/* ---------------- Filtering & grouping ---------------- */
export function applyFilters(list) {
  const q  = elSearch()?.value?.trim().toLowerCase() || '';
  const fs = elSaga()?.value; const fr = elSeries()?.value; const st = elStatus()?.value;
  return list.filter(b => {
    if (q && !b.title.toLowerCase().includes(q)) return false;
    if (fs && b.saga !== fs) return false;
    if (fr && b.series !== fr) return false;
    if (st === 'owned'   && !owned.has(b.id)) return false;
    if (st === 'read'    && !read.has(b.id))  return false;
    if (st === 'unowned' && owned.has(b.id))  return false;
    if (st === 'unread'  && read.has(b.id))   return false;
    return true;
  });
}

export function groupBySagaSeries(list){
  const map = new Map();
  for (const b of list){
    if (!map.has(b.saga)) map.set(b.saga, new Map());
    const sMap = map.get(b.saga);
    if (!sMap.has(b.series)) sMap.set(b.series, []);
    sMap.get(b.series).push(b);
  }
  for (const [, sMap] of map){
    for (const [series, arr] of sMap){
      arr.sort((a,b)=> (a.seriesIndex ?? a.number ?? 0) - (b.seriesIndex ?? b.number ?? 0));
      sMap.set(series, arr);
    }
  }
  return map;
}

export function renderFiltersOptions() {
  const sagas = uniq(books.map(b=>b.saga)).filter(Boolean).sort();
  const seriesOrder = new Map();
  for (const b of books){
    const name = b.series || 'Unknown';
    let num = Number.POSITIVE_INFINITY;
    const m = String(b.id||'').match(/S(\d+)/i);
    if (m) num = parseInt(m[1], 10);
    else if (typeof b.seriesIndex === 'number' && Number.isFinite(b.seriesIndex)) num = b.seriesIndex;
    else if (typeof b.number === 'number' && Number.isFinite(b.number)) num = b.number;
    const prev = seriesOrder.get(name);
    seriesOrder.set(name, Math.min(prev ?? num, num));
  }
  const seriesNames = [...new Set(books.map(b=>b.series).filter(Boolean))]
    .sort((a,b)=>{
      const na = seriesOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const nb = seriesOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });

  if (elSaga())   elSaga().innerHTML   = '<option value="">All sagas</option>' + sagas.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
  if (elSeries()) elSeries().innerHTML = '<option value="">All series</option>' + seriesNames.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
}

export function getSeriesAgg(sagaName, seriesName){
  const arr = books.filter(b => b.saga === sagaName && b.series === seriesName);
  const total = arr.length;
  let own=0, rd=0; for(const b of arr){ if(owned.has(b.id)) own++; if(read.has(b.id)) rd++; }
  return { total, own, rd, pctOwn: total? Math.round(own/total*100):0, pctRead: total? Math.round(rd/total*100):0 };
}

function inferSeriesNumberFromItems(items){
  let best = Number.POSITIVE_INFINITY;
  for (const b of items){
    const m = String(b.id||'').match(/S(\d+)/i);
    if (m) best = Math.min(best, parseInt(m[1],10));
  }
  return Number.isFinite(best) ? best : null;
}

/* ---------------- Render Overview ---------------- */
export function render(onAfterCardHook){
  const filtered = applyFilters(books);
  const container = elResults();
  container.innerHTML = '';
  const grouped = groupBySagaSeries(filtered);

  if (!filtered.length){
    container.innerHTML = '<div class="muted text-center">No books match your filters.</div>';
    return;
  }

  for (const [saga, seriesMap] of grouped){
    const sagaSection = document.createElement('section');
    sagaSection.className = 'panel rounded-xl border brand-border shadow-sm';

    const sagaBodyId = 'sbody-' + btoa(unescape(encodeURIComponent(String(saga)))).replace(/[^a-z0-9]/gi,'');
    const isSagaCollapsed = collapsedSagas.has(saga);

    sagaSection.innerHTML = `
      <div class="px-4
