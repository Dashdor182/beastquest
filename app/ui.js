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

/* ---------- Collapse helpers (exported for global controls) ---------- */
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

/* ---------- Filtering & grouping ---------- */
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
  // Map<saga, Map<series, Book[]>>
  const map = new Map();
  for (const b of list){
    if (!map.has(b.saga)) map.set(b.saga, new Map());
    const sMap = map.get(b.saga);
    if (!sMap.has(b.series)) sMap.set(b.series, []);
    sMap.get(b.series).push(b);
  }
  // sort inside each series by seriesIndex or number as fallback
  for (const [, sMap] of map){
    for (const [series, arr] of sMap){
      arr.sort((a,b)=> (a.seriesIndex ?? a.number ?? 0) - (b.seriesIndex ?? b.number ?? 0));
      sMap.set(series, arr);
    }
  }
  return map;
}

export function renderFiltersOptions() {
  // Sagas alphabetical
  const sagas = uniq(books.map(b=>b.saga)).filter(Boolean).sort();

  // Series dropdown in numerical order
  const seriesOrder = new Map(); // name -> min inferred number
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

  if (elSaga())   elSaga().innerHTML = '<option value="">All sagas</option>' + sagas.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
  if (elSeries()) elSeries().innerHTML = '<option value="">All series</option>' + seriesNames.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
}

export function getSeriesAgg(sagaName, seriesName){
  const arr = books.filter(b => b.saga === sagaName && b.series === seriesName);
  const total = arr.length;
  let own=0, rd=0; for(const b of arr){ if(owned.has(b.id)) own++; if(read.has(b.id)) rd++; }
  return { total, own, rd, pctOwn: total? Math.round(own/total*100):0, pctRead: total? Math.round(rd/total*100):0 };
}

function inferSeriesNumberFromItems(items){
  // Use min Sxx from id like "S02-07"
  let best = Number.POSITIVE_INFINITY;
  for (const b of items){
    const m = String(b.id||'').match(/S(\d+)/i);
    if (m) best = Math.min(best, parseInt(m[1],10));
  }
  return Number.isFinite(best) ? best : null;
}

/* ---------- Render Overview (with sticky saga headers & big click targets) ---------- */
export function render(onAfterCardHook){
  const filtered = applyFilters(books);
  const container = elResults();
  container.innerHTML = '';
  const grouped = groupBySagaSeries(filtered);

  if (!filtered.length){
    container.innerHTML = '<div class="muted text-center">No books match your filters.</div>';
    return;
  }

  // Build collapsible saga sections
  for (const [saga, seriesMap] of grouped){
    // Wrapper panel for saga
    const sagaSection = document.createElement('section');
    sagaSection.className = 'panel rounded-xl border brand-border shadow-sm';

    // Header
    const sagaBodyId = 'sbody-' + btoa(unescape(encodeURIComponent(String(saga)))).replace(/[^a-z0-9]/gi,'');
    const isSagaCollapsed = collapsedSagas.has(saga);

    // NOTE: per-saga controls wrapper gets `hidden` when collapsed
    sagaSection.innerHTML = `
      <div class="px-4 py-3 rounded-t-xl header-grad saga-sticky">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl sm:text-2xl font-bold">Saga: ${escapeHtml(saga)}</h2>
          <div class="flex items-center gap-2 text-xs ${isSagaCollapsed ? 'hidden' : ''}" data-saga-controls>
            <button type="button" class="btn" data-saga-expand-series>Expand series</button>
            <button type="button" class="btn" data-saga-collapse-series>Collapse series</button>
          </div>
          <button type="button" aria-expanded="${!isSagaCollapsed}" aria-controls="${sagaBodyId}" class="inline-flex items-center gap-2 muted hover:text-[color:var(--text)]" data-saga-toggle>
            <span class="text-sm">${isSagaCollapsed ? 'Expand' : 'Collapse'}</span>
            <svg class="chev w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
      </div>
      <div class="p-4" id="${sagaBodyId}"></div>
    `;

    const sagaBody = sagaSection.querySelector('#' + sagaBodyId);
    const sagaToggleBtn = sagaSection.querySelector('[data-saga-toggle]');
    const btnExpandSeries = sagaSection.querySelector('[data-saga-expand-series]');
    const btnCollapseSeries = sagaSection.querySelector('[data-saga-collapse-series]');
    const controlsWrapper = sagaSection.querySelector('[data-saga-controls]');

    if (isSagaCollapsed){
      sagaBody.classList.add('hidden');
      sagaToggleBtn.querySelector('svg').style.transform = 'rotate(-180deg)';
      if (controlsWrapper) controlsWrapper.classList.add('hidden');
    }

    sagaToggleBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const hidden = sagaBody.classList.toggle('hidden');
      sagaToggleBtn.setAttribute('aria-expanded', String(!hidden));
      sagaToggleBtn.querySelector('span').textContent = hidden ? 'Expand' : 'Collapse';
      sagaToggleBtn.querySelector('svg').style.transform = hidden ? 'rotate(-180deg)' : 'rotate(0deg)';
      if (hidden) {
        collapsedSagas.add(saga);
        if (controlsWrapper) controlsWrapper.classList.add('hidden');
      } else {
        collapsedSagas.delete(saga);
        if (controlsWrapper) controlsWrapper.classList.remove('hidden');
      }
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    });

    btnExpandSeries.addEventListener('click', (e)=>{ e.stopPropagation(); setSagaSeriesCollapsed(saga, false); render(onAfterCardHook); });
    btnCollapseSeries.addEventListener('click', (e)=>{ e.stopPropagation(); setSagaSeriesCollapsed(saga, true);  render(onAfterCardHook); });

    // Add all series inside saga body (each series independently collapsible)
    for (const [series, items] of seriesMap){
      const node = tplSeries().content.cloneNode(true);
      const header = node.querySelector('[data-series-header]');
      const body   = node.querySelector('[data-series-body]');

      const key = seriesKey(saga, series);
      const collapsed = collapsedSeries.has(key);
      const bodyId = 'body-' + btoa(unescape(encodeURIComponent(key))).replace(/[^a-z0-9]/gi,'');

      const sNum = inferSeriesNumberFromItems(items);
      const niceSeriesTitle = sNum != null
        ? `Series ${sNum}: ${escapeHtml(series)}`
        : `Series: ${escapeHtml(series)}`;

      header.innerHTML = `
        <div class="rounded-t-xl px-4 py-2 header-grad flex items-center justify-between">
          <h3 class="text-lg font-semibold">${niceSeriesTitle}</h3>
          <span class="muted text-sm">${collapsed ? 'Expand' : 'Collapse'}</span>
        </div>`;
      header.setAttribute('aria-controls', bodyId);
      header.setAttribute('aria-expanded', String(!collapsed));

      body.id = bodyId;
      if (collapsed) { body.classList.add('hidden'); }

      // Click entire header to toggle
      header.addEventListener('click', (e)=>{
        e.stopPropagation();
        const isHidden = body.classList.toggle('hidden');
        header.setAttribute('aria-expanded', String(!isHidden));
        const label = header.querySelector('span'); if (label) label.textContent = isHidden ? 'Expand' : 'Collapse';
        if (isHidden) collapsedSeries.add(key); else collapsedSeries.delete(key);
        saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      });

      // Per-series mini progress
      const agg = getSeriesAgg(saga, series);
      const mini = node.querySelector('[data-series-mini]');
      mini.innerHTML = `
        <div class="grid sm:grid-cols-2 gap-2 text-sm">
          <div>
            <div class="flex justify-between muted"><span>Read</span><span>${agg.rd}/${agg.total} (${agg.pctRead}%)</span></div>
            <div class="progress-xs progress-track"><div class="progress-xs progress-read" style="width:${agg.pctRead}%"></div></div>
          </div>
          <div>
            <div class="flex justify-between muted"><span>Owned</span><span>${agg.own}/${agg.total} (${agg.pctOwn}%)</span></div>
            <div class="progress-xs progress-track"><div class="progress-xs progress-own" style="width:${agg.pctOwn}%"></div></div>
          </div>
        </div>`;

      const grid = node.querySelector('[data-series-grid]');
      for (const b of items){
        const card = tplCard().content.cloneNode(true);
        card.querySelector('[data-title]').textContent = `${b.number ? b.number + '. ' : ''}${b.title}`;
        card.querySelector('[data-number]').textContent = b.id;
        const ownEl = card.querySelector('[data-own]');
        const rdEl  = card.querySelector('[data-read]');
        ownEl.checked = owned.has(b.id);
        rdEl.checked  = read.has(b.id);
        ownEl.addEventListener('change', () => { onAfterCardHook('own', b.id, ownEl.checked); });
        rdEl .addEventListener('change', () => { onAfterCardHook('read', b.id, rdEl.checked); });
        grid.appendChild(card);
      }

      sagaBody.appendChild(node);
    }

    container.appendChild(sagaSection);
  }
}
