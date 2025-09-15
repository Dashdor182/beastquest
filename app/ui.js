// app/ui.js
// Overview tab rendering, filters, and collapse/expand helpers

import {
  books, owned, read,
  collapsedSeries, collapsedSagas,
  saveJSON, LS_KEYS,
  seriesKey, allSeriesKeysFromBooks, allSagaNamesFromBooks
} from './state.js';

/* ========= shared helpers ========= */
export function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
}

// Stats tab element getters (imported by stats.js)
export const elStatTotal = () => document.getElementById('statTotal');
export const elStatOwned = () => document.getElementById('statOwned');
export const elStatRead  = () => document.getElementById('statRead');
export const elStatPct   = () => document.getElementById('statPct');
export const elStatBar   = () => document.getElementById('statBar');

/* ========= filters ========= */
const elSearch = () => document.getElementById('search');
const elSaga   = () => document.getElementById('filterSaga');
const elSeries = () => document.getElementById('filterSeries');
const elStatus = () => document.getElementById('filterStatus');

function uniq(arr){ return [...new Set(arr)]; }

function applyFilters(list){
  const q  = elSearch()?.value?.trim().toLowerCase() || '';
  const fs = elSaga()?.value || '';
  const fr = elSeries()?.value || '';
  const st = elStatus()?.value || 'all';
  return list.filter(b => {
    if (q && !b.title.toLowerCase().includes(q)) return false;
    if (fs && b.saga !== fs) return false;
    if (fr && b.series !== fr) return false;
    if (st === 'owned'   && !owned.has(b.id)) return false;
    if (st === 'read'    && !read.has(b.id))  return false;
    if (st === 'unowned' &&  owned.has(b.id)) return false;
    if (st === 'unread'  &&  read.has(b.id))  return false;
    return true;
  });
}

export function renderFiltersOptions(){
  if (!books?.length) return;
  // Sagas alphabetical
  const sagas = uniq(books.map(b=>b.saga)).filter(Boolean).sort();
  if (elSaga()){
    elSaga().innerHTML = '<option value="">All sagas</option>' +
      sagas.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
  }

  // Series dropdown: sort by inferred series number (from id `S(\d+)`) ascending
  const seriesOrder = new Map();
  for (const b of books){
    const name = b.series || 'Unknown';
    let num = Number.POSITIVE_INFINITY;
    const m = String(b.id||'').match(/S(\d+)/i);
    if (m) num = parseInt(m[1], 10);
    else if (typeof b.seriesIndex === 'number') num = b.seriesIndex;
    else if (typeof b.number === 'number') num = b.number;
    seriesOrder.set(name, Math.min(seriesOrder.get(name) ?? num, num));
  }
  const seriesNames = [...new Set(books.map(b=>b.series).filter(Boolean))]
    .sort((a,b)=>{
      const na = seriesOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const nb = seriesOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });

  if (elSeries()){
    elSeries().innerHTML = '<option value="">All series</option>' +
      seriesNames.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
  }
}

/* ========= overview rendering ========= */
const elResults = () => document.getElementById('results');

function groupBySagaSeries(list){
  // Map<saga, Map<series, Book[]>>
  const map = new Map();
  for (const b of list){
    if (!map.has(b.saga)) map.set(b.saga, new Map());
    const sMap = map.get(b.saga);
    if (!sMap.has(b.series)) sMap.set(b.series, []);
    sMap.get(b.series).push(b);
  }
  // sort inside series by seriesIndex or number
  for (const [, sMap] of map){
    for (const [series, arr] of sMap){
      arr.sort((a,b)=> (a.seriesIndex ?? a.number ?? 0) - (b.seriesIndex ?? b.number ?? 0));
      sMap.set(series, arr);
    }
  }
  return map;
}

function seriesOrderForSaga(saga){
  // returns map seriesName -> min inferred series number for labels "Series X: Name"
  const map = new Map();
  for (const b of books.filter(x=>x.saga===saga)){
    const name = b.series || 'Unknown';
    const m = String(b.id || '').match(/S([0-9]+)/i);
    let n = m ? parseInt(m[1], 10) : (Number.isFinite(b.seriesIndex) ? b.seriesIndex : b.number ?? 0);
    if (!Number.isFinite(n)) n = 0;
    map.set(name, Math.min(map.get(name) ?? n, n));
  }
  return map;
}

function encodeId(key){
  return 'id-' + btoa(unescape(encodeURIComponent(String(key)))).replace(/[^a-z0-9]/gi,'');
}

function getSeriesAgg(saga, series){
  const arr = books.filter(b => b.saga === saga && b.series === series);
  const total = arr.length;
  let own=0, rd=0; for(const b of arr){ if(owned.has(b.id)) own++; if(read.has(b.id)) rd++; }
  return { total, own, rd, pctOwn: total? Math.round(own/total*100):0, pctRead: total? Math.round(rd/total*100):0 };
}

function sagaAgg(saga){
  const arr = books.filter(b => b.saga === saga);
  const total = arr.length;
  let own=0, rd=0; for(const b of arr){ if(owned.has(b.id)) own++; if(read.has(b.id)) rd++; }
  return { total, own, rd, pctOwn: total? Math.round(own/total*100):0, pctRead: total? Math.round(rd/total*100):0 };
}

/**
 * Render Overview
 * @param {(kind:'own'|'read', id:string, checked:boolean)=>void} onAfterCardHook
 */
export function render(onAfterCardHook){
  const container = elResults();
  if (!container) return;

  const filtered = applyFilters(books);
  container.innerHTML = '';
  if (!filtered.length){
    container.innerHTML = '<div class="muted text-center">No books match your filters.</div>';
    return;
  }

  const grouped = groupBySagaSeries(filtered);

  // build each saga section
  for (const [saga, seriesMap] of grouped){
    const sagaKey = saga;
    const isSagaCollapsed = collapsedSagas.has(sagaKey);

    // sticky saga header with chips and per-saga expand/collapse series controls
    const sAgg = sagaAgg(saga);
    const bodyId = encodeId(`saga-body::${sagaKey}`);

    const sagaSection = document.createElement('section');
    sagaSection.className = 'space-y-4 sm:space-y-5';

    const header = document.createElement('div');
    header.className = 'px-4 py-3 rounded-t-xl header-grad flex items-center justify-between sticky top-0 sm:top-2 z-20 cursor-pointer';
    header.setAttribute('role','button');
    header.setAttribute('tabindex','0');
    header.setAttribute('aria-controls', bodyId);
    header.setAttribute('aria-expanded', String(!isSagaCollapsed));
    header.dataset.sagaToggle = sagaKey;

    const chips = `
      <div class="flex gap-2">
        <span class="badge">Read ${sAgg.rd}/${sAgg.total} (${sAgg.pctRead}%)</span>
        <span class="badge">Owned ${sAgg.own}/${sAgg.total} (${sAgg.pctOwn}%)</span>
      </div>`;

    // per-saga expand/collapse series buttons (hidden when saga collapsed)
    const perSagaBtns = `
      <div class="flex items-center gap-2 ${isSagaCollapsed ? 'invisible' : ''}" data-saga-series-controls>
        <button type="button" class="btn px-2 py-1 text-xs" data-saga-expand="${escapeHtml(sagaKey)}">Expand series</button>
        <button type="button" class="btn px-2 py-1 text-xs" data-saga-collapse="${escapeHtml(sagaKey)}">Collapse series</button>
      </div>`;

    header.innerHTML = `
      <h2 class="text-lg sm:text-xl font-semibold">Saga: ${escapeHtml(saga)}</h2>
      <div class="flex items-center gap-3">${chips}${perSagaBtns}</div>
    `;

    const body = document.createElement('div');
    body.id = bodyId;
    body.className = `p-4 panel rounded-b-xl border brand-border shadow-sm ${isSagaCollapsed ? 'hidden' : ''}`;

    // wire saga toggle (entire header clickable)
    const toggleSaga = ()=>{
      const nowHidden = body.classList.toggle('hidden');
      header.setAttribute('aria-expanded', String(!nowHidden));
      const ctrl = header.querySelector('[data-saga-series-controls]');
      if (ctrl) ctrl.classList.toggle('invisible', nowHidden);
      if (nowHidden) collapsedSagas.add(sagaKey); else collapsedSagas.delete(sagaKey);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    };
    header.addEventListener('click', toggleSaga);
    header.addEventListener('keydown', (e)=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggleSaga(); }});

    // per-saga expand/collapse series listeners
    header.querySelector(`[data-saga-expand="${CSS.escape(sagaKey)}"]`)?.addEventListener('click', (e)=>{
      e.stopPropagation();
      for (const series of seriesMap.keys()){ collapsedSeries.delete(seriesKey(sagaKey, series)); }
      saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      // reflect immediately
      body.querySelectorAll('[data-series-body]').forEach(n => n.classList.remove('hidden'));
    });
    header.querySelector(`[data-saga-collapse="${CSS.escape(sagaKey)}"]`)?.addEventListener('click', (e)=>{
      e.stopPropagation();
      for (const series of seriesMap.keys()){ collapsedSeries.add(seriesKey(sagaKey, series)); }
      saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      body.querySelectorAll('[data-series-body]').forEach(n => n.classList.add('hidden'));
    });

    // render each series in saga
    const orderMap = seriesOrderForSaga(saga);
    const seriesEntries = [...seriesMap.entries()].sort((a,b)=>{
      const oa = orderMap.get(a[0]) ?? 0;
      const ob = orderMap.get(b[0]) ?? 0;
      if (oa !== ob) return oa - ob;
      return a[0].localeCompare(b[0]);
    });

    for (const [series, items] of seriesEntries){
      const sKey = seriesKey(saga, series);
      const isSeriesCollapsed = collapsedSeries.has(sKey);
      const sBodyId = encodeId(`series-body::${sKey}`);
      const seriesNum = orderMap.get(series) ?? 0;

      const section = document.createElement('section');
      section.className = 'rounded-xl border brand-border shadow-sm';

      // header (whole bar clickable)
      const sHeader = document.createElement('div');
      sHeader.className = 'px-4 py-3 rounded-t-xl header-grad flex items-center justify-between cursor-pointer';
      sHeader.setAttribute('role','button');
      sHeader.setAttribute('tabindex','0');
      sHeader.dataset.seriesToggle = sKey;
      sHeader.setAttribute('aria-controls', sBodyId);
      sHeader.setAttribute('aria-expanded', String(!isSeriesCollapsed));

      // per-series mini progress (bars for Read & Owned)
      const agg = getSeriesAgg(saga, series);
      const miniBars = `
        <div class="grid sm:grid-cols-2 gap-2 text-sm">
          <div>
            <div class="flex justify-between muted"><span>Read</span><span>${agg.rd}/${agg.total} (${agg.pctRead}%)</span></div>
            <div class="progress progress-track"><div class="progress progress-read" style="width:${agg.pctRead}%"></div></div>
          </div>
          <div>
            <div class="flex justify-between muted"><span>Owned</span><span>${agg.own}/${agg.total} (${agg.pctOwn}%)</span></div>
            <div class="progress progress-track"><div class="progress progress-own" style="width:${agg.pctOwn}%"></div></div>
          </div>
        </div>`;

      sHeader.innerHTML = `
        <h3 class="text-base sm:text-lg font-semibold">Series ${seriesNum || ''}: ${escapeHtml(series)}</h3>
        <span class="badge">${escapeHtml(sKey)}</span>
      `;

      const sBody = document.createElement('div');
      sBody.id = sBodyId;
      sBody.dataset.seriesBody = '1';
      sBody.className = `p-4 panel rounded-b-xl ${isSeriesCollapsed ? 'hidden' : ''}`;

      // mini bars show above the grid within the body
      const miniWrap = document.createElement('div');
      miniWrap.className = 'mb-3';
      miniWrap.innerHTML = miniBars;
      sBody.appendChild(miniWrap);

      const grid = document.createElement('div');
      grid.className = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
      sBody.appendChild(grid);

      // cards
      for (const b of items){
        const card = document.createElement('article');
        card.className = 'card rounded-lg border brand-border p-3 sm:p-4';

        const top = document.createElement('div');
        top.className = 'flex items-start justify-between gap-3';
        top.innerHTML = `
          <h4 class="font-medium">${escapeHtml(`${b.number ? b.number + '. ' : ''}${b.title}`)}</h4>
          <span class="badge">${escapeHtml(b.id)}</span>
        `;
        card.appendChild(top);

        const controls = document.createElement('div');
        controls.className = 'mt-3 flex items-center gap-4';
        const ownId = `own-${encodeId(b.id)}`;
        const readId = `read-${encodeId(b.id)}`;
        controls.innerHTML = `
          <label class="inline-flex items-center gap-2" for="${ownId}">
            <input id="${ownId}" type="checkbox" ${owned.has(b.id) ? 'checked':''}
              class="h-6 w-6 sm:h-5 sm:w-5 rounded brand-border" style="accent-color: var(--accent)">
            <span>Own</span>
          </label>
          <label class="inline-flex items-center gap-2" for="${readId}">
            <input id="${readId}" type="checkbox" ${read.has(b.id) ? 'checked':''}
              class="h-6 w-6 sm:h-5 sm:w-5 rounded brand-border" style="accent-color: var(--accent2)">
            <span>Read</span>
          </label>
        `;
        card.appendChild(controls);
        grid.appendChild(card);

        // wire card checkboxes
        controls.querySelector(`#${CSS.escape(ownId)}`)?.addEventListener('change', (e)=>{
          onAfterCardHook?.('own', b.id, e.currentTarget.checked);
        });
        controls.querySelector(`#${CSS.escape(readId)}`)?.addEventListener('change', (e)=>{
          onAfterCardHook?.('read', b.id, e.currentTarget.checked);
        });
      }

      // wire series toggle
      const toggleSeries = ()=>{
        const nowHidden = sBody.classList.toggle('hidden');
        sHeader.setAttribute('aria-expanded', String(!nowHidden));
        if (nowHidden) collapsedSeries.add(sKey); else collapsedSeries.delete(sKey);
        saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      };
      sHeader.addEventListener('click', toggleSeries);
      sHeader.addEventListener('keydown', (e)=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggleSeries(); }});

      section.appendChild(sHeader);
      section.appendChild(sBody);
      body.appendChild(section);
    }

    sagaSection.appendChild(header);
    sagaSection.appendChild(body);
    container.appendChild(sagaSection);
  }
}

/* ========= expand/collapse helpers used by main.js ========= */
export function setAllSagasCollapsed(collapsed){
  const all = allSagaNamesFromBooks(books);
  if (collapsed) { for (const s of all) collapsedSagas.add(s); }
  else           { for (const s of all) collapsedSagas.delete(s); }
  saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
}

export function setAllSeriesCollapsed(collapsed){
  const all = allSeriesKeysFromBooks(books);
  if (collapsed) { for (const k of all) collapsedSeries.add(k); }
  else           { for (const k of all) collapsedSeries.delete(k); }
  saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
}
