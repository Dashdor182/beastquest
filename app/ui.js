// app/ui.js
// Collection tab rendering — The Bestiary redesign

import {
  books, owned, read,
  collapsedSeries, collapsedSagas,
  saveJSON, LS_KEYS,
  seriesKey, allSeriesKeysFromBooks, allSagaNamesFromBooks
} from './state.js';

/* ── Shared helpers ─────────────────────────────────────── */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
  );
}

// Element getters used by stats.js
export const elStatTotal = () => document.getElementById('statTotal');
export const elStatOwned = () => document.getElementById('statOwned');
export const elStatRead  = () => document.getElementById('statRead');
export const elStatPct   = () => document.getElementById('statPct');
export const elStatBar   = () => document.getElementById('statBar');

/* ── Filter helpers ─────────────────────────────────────── */
const elSearch = () => document.getElementById('search');
const elSaga   = () => document.getElementById('filterSaga');
const elSeries = () => document.getElementById('filterSeries');
const elStatus = () => document.getElementById('filterStatus');

function uniq(arr) { return [...new Set(arr)]; }

function applyFilters(list) {
  const q  = elSearch()?.value?.trim().toLowerCase() || '';
  const fs = elSaga()?.value   || '';
  const fr = elSeries()?.value || '';
  const st = elStatus()?.value || 'all';
  return list.filter(b => {
    if (q  && !b.title.toLowerCase().includes(q)) return false;
    if (fs && b.saga   !== fs) return false;
    if (fr && b.series !== fr) return false;
    if (st === 'owned'   && !owned.has(b.id)) return false;
    if (st === 'read'    && !read.has(b.id))  return false;
    if (st === 'unowned' &&  owned.has(b.id)) return false;
    if (st === 'unread'  &&  read.has(b.id))  return false;
    return true;
  });
}

export function renderFiltersOptions() {
  if (!books?.length) return;

  const sagas = uniq(books.map(b => b.saga)).filter(Boolean).sort();
  if (elSaga()) {
    elSaga().innerHTML = '<option value="">All Sagas</option>' +
      sagas.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  }

  const seriesOrder = new Map();
  for (const b of books) {
    const name = b.series || 'Unknown';
    const m = String(b.id || '').match(/S(\d+)/i);
    let num = m ? parseInt(m[1], 10)
      : (typeof b.seriesIndex === 'number' ? b.seriesIndex
        : typeof b.number === 'number' ? b.number : Number.POSITIVE_INFINITY);
    seriesOrder.set(name, Math.min(seriesOrder.get(name) ?? num, num));
  }
  const seriesNames = [...new Set(books.map(b => b.series).filter(Boolean))]
    .sort((a, b) => {
      const na = seriesOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const nb = seriesOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      return na !== nb ? na - nb : a.localeCompare(b);
    });

  if (elSeries()) {
    elSeries().innerHTML = '<option value="">All Series</option>' +
      seriesNames.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  }
}

/* ── Grouping & aggregation ─────────────────────────────── */
function groupBySagaSeries(list) {
  const map = new Map();
  for (const b of list) {
    if (!map.has(b.saga)) map.set(b.saga, new Map());
    const sMap = map.get(b.saga);
    if (!sMap.has(b.series)) sMap.set(b.series, []);
    sMap.get(b.series).push(b);
  }
  for (const [, sMap] of map) {
    for (const [series, arr] of sMap) {
      arr.sort((a, b) => (a.seriesIndex ?? a.number ?? 0) - (b.seriesIndex ?? b.number ?? 0));
    }
  }
  return map;
}

function seriesOrderForSaga(saga) {
  const map = new Map();
  for (const b of books.filter(x => x.saga === saga)) {
    const name = b.series || 'Unknown';
    const m = String(b.id || '').match(/S([0-9]+)/i);
    let n = m ? parseInt(m[1], 10) : (Number.isFinite(b.seriesIndex) ? b.seriesIndex : b.number ?? 0);
    if (!Number.isFinite(n)) n = 0;
    map.set(name, Math.min(map.get(name) ?? n, n));
  }
  return map;
}

function getSeriesAgg(saga, series) {
  const arr = books.filter(b => b.saga === saga && b.series === series);
  const total = arr.length;
  let own = 0, rd = 0;
  for (const b of arr) { if (owned.has(b.id)) own++; if (read.has(b.id)) rd++; }
  return {
    total, own, rd,
    pctOwn:  total ? Math.round(own / total * 100) : 0,
    pctRead: total ? Math.round(rd  / total * 100) : 0,
  };
}

function sagaAgg(saga) {
  const arr = books.filter(b => b.saga === saga);
  const total = arr.length;
  let own = 0, rd = 0;
  for (const b of arr) { if (owned.has(b.id)) own++; if (read.has(b.id)) rd++; }
  return {
    total, own, rd,
    pctOwn:  total ? Math.round(own / total * 100) : 0,
    pctRead: total ? Math.round(rd  / total * 100) : 0,
  };
}

/* ── Main render ────────────────────────────────────────── */
export function render(onAfterCardHook) {
  const container = document.getElementById('results');
  if (!container) return;

  const filtered = applyFilters(books);
  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐉</div>
        <div class="empty-state-title">No beasts found on this quest!</div>
        <div class="empty-state-sub">Try a different search or filter.</div>
      </div>`;
    return;
  }

  const grouped = groupBySagaSeries(filtered);

  for (const [saga, seriesMap] of grouped) {
    const isSagaCollapsed = collapsedSagas.has(saga);
    const sAgg = sagaAgg(saga);

    const sagaSection = document.createElement('div');
    sagaSection.className = 'saga-section';

    /* ── Saga header ── */
    const sagaHeader = document.createElement('div');
    sagaHeader.className = 'saga-header' + (isSagaCollapsed ? ' saga-header--collapsed' : '');
    sagaHeader.setAttribute('role', 'button');
    sagaHeader.setAttribute('tabindex', '0');
    sagaHeader.setAttribute('aria-expanded', String(!isSagaCollapsed));
    sagaHeader.dataset.sagaToggle = saga;

    sagaHeader.innerHTML = `
      <div class="saga-header-left">
        <span class="saga-chevron ${isSagaCollapsed ? 'saga-chevron--up' : ''}">▼</span>
        <span class="saga-title">${escapeHtml(saga)}</span>
      </div>
      <div class="saga-header-right">
        <div class="saga-series-btns" data-saga-sub-btns>
          <button type="button" class="saga-series-btn" data-saga-expand="${escapeHtml(saga)}">↕ Expand series</button>
          <button type="button" class="saga-series-btn" data-saga-collapse="${escapeHtml(saga)}">↕ Collapse series</button>
        </div>
        <span class="saga-chip saga-chip--gold">🛡 ${sAgg.own}/${sAgg.total}</span>
        <span class="saga-chip saga-chip--crimson">⚔ ${sAgg.rd}/${sAgg.total}</span>
      </div>
    `;

    /* ── Saga body ── */
    const sagaBody = document.createElement('div');
    sagaBody.className = 'saga-body' + (isSagaCollapsed ? ' saga-body--hidden' : '');

    /* Toggle saga */
    const toggleSaga = () => {
      const nowCollapsed = !sagaBody.classList.contains('saga-body--hidden');
      sagaBody.classList.toggle('saga-body--hidden', nowCollapsed);
      sagaHeader.setAttribute('aria-expanded', String(!nowCollapsed));
      sagaHeader.classList.toggle('saga-header--collapsed', nowCollapsed);
      const chev = sagaHeader.querySelector('.saga-chevron');
      if (chev) chev.classList.toggle('saga-chevron--up', nowCollapsed);
      if (nowCollapsed) collapsedSagas.add(saga); else collapsedSagas.delete(saga);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    };
    sagaHeader.addEventListener('click', toggleSaga);
    sagaHeader.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSaga(); } });

    /* Expand/collapse series within saga */
    sagaHeader.querySelector(`[data-saga-expand]`)?.addEventListener('click', e => {
      e.stopPropagation();
      for (const series of seriesMap.keys()) collapsedSeries.delete(seriesKey(saga, series));
      saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      sagaBody.querySelectorAll('.series-body').forEach(n => n.classList.remove('series-body--hidden'));
      sagaBody.querySelectorAll('.series-chevron').forEach(c => c.classList.remove('series-chevron--up'));
    });
    sagaHeader.querySelector(`[data-saga-collapse]`)?.addEventListener('click', e => {
      e.stopPropagation();
      for (const series of seriesMap.keys()) collapsedSeries.add(seriesKey(saga, series));
      saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      sagaBody.querySelectorAll('.series-body').forEach(n => n.classList.add('series-body--hidden'));
      sagaBody.querySelectorAll('.series-chevron').forEach(c => c.classList.add('series-chevron--up'));
    });

    /* ── Series sections ── */
    const orderMap = seriesOrderForSaga(saga);
    const seriesEntries = [...seriesMap.entries()].sort((a, b) => {
      const oa = orderMap.get(a[0]) ?? 0;
      const ob = orderMap.get(b[0]) ?? 0;
      return oa !== ob ? oa - ob : a[0].localeCompare(b[0]);
    });

    for (const [series, items] of seriesEntries) {
      const sKey = seriesKey(saga, series);
      const isCollapsed = collapsedSeries.has(sKey);
      const agg = getSeriesAgg(saga, series);
      const seriesNum = orderMap.get(series) ?? 0;

      const seriesSection = document.createElement('div');
      seriesSection.className = 'series-section';

      /* Series header */
      const seriesHeader = document.createElement('div');
      seriesHeader.className = 'series-header';
      seriesHeader.setAttribute('role', 'button');
      seriesHeader.setAttribute('tabindex', '0');
      seriesHeader.setAttribute('aria-expanded', String(!isCollapsed));
      seriesHeader.dataset.seriesToggle = sKey;

      seriesHeader.innerHTML = `
        <span class="series-title">Series ${seriesNum || ''}: ${escapeHtml(series)}</span>
        <div class="series-meta">
          <span class="series-count">${agg.rd}/${agg.total} read</span>
          <span class="series-chevron ${isCollapsed ? 'series-chevron--up' : ''}">▼</span>
        </div>
      `;

      /* Series body */
      const seriesBody = document.createElement('div');
      seriesBody.className = 'series-body' + (isCollapsed ? ' series-body--hidden' : '');
      seriesBody.setAttribute('data-series-body', '1');

      /* Progress bars */
      const progressWrap = document.createElement('div');
      progressWrap.className = 'series-progress-wrap';
      progressWrap.innerHTML = `
        <div class="series-progress-item">
          <div class="series-progress-label">
            <span>🛡 Got It</span>
            <span>${agg.own}/${agg.total} (${agg.pctOwn}%)</span>
          </div>
          <div class="quest-bar">
            <div class="quest-bar-fill quest-bar-fill--gold" style="width:${agg.pctOwn}%"></div>
          </div>
        </div>
        <div class="series-progress-item">
          <div class="series-progress-label">
            <span>⚔ Read It</span>
            <span>${agg.rd}/${agg.total} (${agg.pctRead}%)</span>
          </div>
          <div class="quest-bar">
            <div class="quest-bar-fill quest-bar-fill--crimson" style="width:${agg.pctRead}%"></div>
          </div>
        </div>
      `;
      seriesBody.appendChild(progressWrap);

      /* Book rows */
      const bookList = document.createElement('div');
      bookList.className = 'book-list';

      for (const b of items) {
        const isOwned = owned.has(b.id);
        const isRead  = read.has(b.id);
        const both    = isOwned && isRead;

        let rowClass = 'book-row';
        if (both)    rowClass += ' book-row--complete';
        else if (isOwned) rowClass += ' book-row--owned';
        else if (isRead)  rowClass += ' book-row--read';

        const row = document.createElement('div');
        row.className = rowClass;

        const numLabel = b.number ? `#${b.number}` : b.id;

        row.innerHTML = `
          <span class="book-num">${escapeHtml(numLabel)}</span>
          <span class="book-title">${escapeHtml(b.title)}</span>
          ${both ? '<span class="book-star">⭐</span>' : ''}
          <div class="book-btns">
            <button type="button" class="toggle-btn toggle-own ${isOwned ? 'on' : ''}" aria-pressed="${isOwned}">
              🛡 ${isOwned ? 'Got it!' : 'Got it?'}
            </button>
            <button type="button" class="toggle-btn toggle-read ${isRead ? 'on' : ''}" aria-pressed="${isRead}">
              ⚔ ${isRead ? 'Read it!' : 'Read it?'}
            </button>
          </div>
        `;

        const ownBtn  = row.querySelector('.toggle-own');
        const readBtn = row.querySelector('.toggle-read');

        ownBtn.addEventListener('click', () => {
          ownBtn.classList.add('pop');
          ownBtn.addEventListener('animationend', () => ownBtn.classList.remove('pop'), { once: true });
          onAfterCardHook?.('own', b.id, !owned.has(b.id));
        });

        readBtn.addEventListener('click', () => {
          readBtn.classList.add('pop');
          readBtn.addEventListener('animationend', () => readBtn.classList.remove('pop'), { once: true });
          onAfterCardHook?.('read', b.id, !read.has(b.id));
        });

        bookList.appendChild(row);
      }
      seriesBody.appendChild(bookList);

      /* Toggle series */
      const toggleSeries = () => {
        const nowCollapsed = !seriesBody.classList.contains('series-body--hidden');
        seriesBody.classList.toggle('series-body--hidden', nowCollapsed);
        seriesHeader.setAttribute('aria-expanded', String(!nowCollapsed));
        const chev = seriesHeader.querySelector('.series-chevron');
        if (chev) chev.classList.toggle('series-chevron--up', nowCollapsed);
        if (nowCollapsed) collapsedSeries.add(sKey); else collapsedSeries.delete(sKey);
        saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      };
      seriesHeader.addEventListener('click', toggleSeries);
      seriesHeader.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSeries(); } });

      seriesSection.appendChild(seriesHeader);
      seriesSection.appendChild(seriesBody);
      sagaBody.appendChild(seriesSection);
    }

    sagaSection.appendChild(sagaHeader);
    sagaSection.appendChild(sagaBody);
    container.appendChild(sagaSection);
  }
}

/* ── Collapse/expand helpers ────────────────────────────── */
export function setAllSagasCollapsed(collapsed) {
  const all = allSagaNamesFromBooks(books);
  if (collapsed) { for (const s of all) collapsedSagas.add(s); }
  else           { for (const s of all) collapsedSagas.delete(s); }
  saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
}

export function setAllSeriesCollapsed(collapsed) {
  const all = allSeriesKeysFromBooks(books);
  if (collapsed) { for (const k of all) collapsedSeries.add(k); }
  else           { for (const k of all) collapsedSeries.delete(k); }
  saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
}
