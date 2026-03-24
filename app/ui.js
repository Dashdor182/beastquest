// app/ui.js  — Book collection rendering (card grid layout)

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

// Element getters consumed by stats.js
export const elStatTotal = () => document.getElementById('statTotal');
export const elStatOwned = () => document.getElementById('statOwned');
export const elStatRead  = () => document.getElementById('statRead');
export const elStatPct   = () => document.getElementById('statPct');
export const elStatBar   = () => null; // not used in new design

/* ── Filter helpers ─────────────────────────────────────── */
function applyFilters(list) {
  const q  = document.getElementById('search')?.value?.trim().toLowerCase() || '';
  const fs = document.getElementById('filterSaga')?.value   || '';
  const fr = document.getElementById('filterSeries')?.value || '';
  const st = document.getElementById('filterStatus')?.value || 'all';
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

  const sagas = [...new Set(books.map(b => b.saga))].filter(Boolean).sort();
  const sagaEl = document.getElementById('filterSaga');
  if (sagaEl) {
    sagaEl.innerHTML = '<option value="">All Sagas</option>' +
      sagas.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  }

  // Build series order map
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

  const seriesEl = document.getElementById('filterSeries');
  if (seriesEl) {
    seriesEl.innerHTML = '<option value="">All Series</option>' +
      seriesNames.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  }
}

/* ── Grouping & aggregation ─────────────────────────────── */
function groupBySagaSeries(list) {
  const map = new Map();
  for (const b of list) {
    if (!map.has(b.saga)) map.set(b.saga, new Map());
    const sm = map.get(b.saga);
    if (!sm.has(b.series)) sm.set(b.series, []);
    sm.get(b.series).push(b);
  }
  for (const [, sm] of map) {
    for (const [, arr] of sm) {
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
  return { total, own, rd,
    pctOwn:  total ? Math.round(own / total * 100) : 0,
    pctRead: total ? Math.round(rd  / total * 100) : 0,
  };
}

function sagaAgg(saga) {
  const arr = books.filter(b => b.saga === saga);
  const total = arr.length;
  let own = 0, rd = 0;
  for (const b of arr) { if (owned.has(b.id)) own++; if (read.has(b.id)) rd++; }
  return { total, own, rd };
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
        <div class="empty-icon">🐉</div>
        <div class="empty-title">No beasts found!</div>
        <div class="empty-sub">Try a different search or filter.</div>
      </div>`;
    return;
  }

  const grouped = groupBySagaSeries(filtered);

  for (const [saga, seriesMap] of grouped) {
    const isSagaCollapsed = collapsedSagas.has(saga);
    const agg = sagaAgg(saga);

    // ── Saga section wrapper ──
    const sagaSection = document.createElement('div');
    sagaSection.className = 'saga-section';

    // ── Saga header ──
    const sagaHeader = document.createElement('div');
    sagaHeader.className = `saga-header saga-header--${isSagaCollapsed ? 'closed' : 'open'}`;
    sagaHeader.setAttribute('role', 'button');
    sagaHeader.setAttribute('tabindex', '0');
    sagaHeader.setAttribute('aria-expanded', String(!isSagaCollapsed));

    sagaHeader.innerHTML = `
      <span class="saga-chevron ${isSagaCollapsed ? 'saga-chevron--closed' : ''}">▼</span>
      <span class="saga-name">${escapeHtml(saga)}</span>
      <div class="saga-chips">
        <span class="saga-chip saga-chip--gold">🛡 ${agg.own}/${agg.total}</span>
        <span class="saga-chip saga-chip--red">⚔ ${agg.rd}/${agg.total}</span>
      </div>
    `;

    // ── Saga body ──
    const sagaBody = document.createElement('div');
    sagaBody.className = 'saga-body' + (isSagaCollapsed ? ' saga-body--hidden' : '');

    const toggleSaga = () => {
      const nowCollapsed = sagaBody.classList.toggle('saga-body--hidden');
      sagaHeader.setAttribute('aria-expanded', String(!nowCollapsed));
      sagaHeader.classList.toggle('saga-header--open',   !nowCollapsed);
      sagaHeader.classList.toggle('saga-header--closed', nowCollapsed);
      const chev = sagaHeader.querySelector('.saga-chevron');
      if (chev) chev.classList.toggle('saga-chevron--closed', nowCollapsed);
      if (nowCollapsed) collapsedSagas.add(saga); else collapsedSagas.delete(saga);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    };
    sagaHeader.addEventListener('click', toggleSaga);
    sagaHeader.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSaga(); }
    });

    // ── Series sections ──
    const orderMap = seriesOrderForSaga(saga);
    const seriesEntries = [...seriesMap.entries()].sort((a, b) => {
      const oa = orderMap.get(a[0]) ?? 0, ob = orderMap.get(b[0]) ?? 0;
      return oa !== ob ? oa - ob : a[0].localeCompare(b[0]);
    });

    for (const [series, items] of seriesEntries) {
      const sKey = seriesKey(saga, series);
      const isCollapsed = collapsedSeries.has(sKey);
      const sAgg = getSeriesAgg(saga, series);
      const seriesNum = orderMap.get(series) ?? 0;

      const seriesSection = document.createElement('div');
      seriesSection.className = 'series-section';

      // ── Series header ──
      const seriesHeader = document.createElement('div');
      seriesHeader.className = 'series-header';
      seriesHeader.setAttribute('role', 'button');
      seriesHeader.setAttribute('tabindex', '0');
      seriesHeader.setAttribute('aria-expanded', String(!isCollapsed));

      seriesHeader.innerHTML = `
        <span class="series-name">Series ${seriesNum || ''}: ${escapeHtml(series)}</span>
        <div class="series-meta">
          <span class="series-count">${sAgg.rd}/${sAgg.total} read</span>
          <span class="series-chevron ${isCollapsed ? 'series-chevron--closed' : ''}">▼</span>
        </div>
      `;

      // ── Series body ──
      const seriesBody = document.createElement('div');
      seriesBody.className = 'series-body' + (isCollapsed ? ' series-body--hidden' : '');
      seriesBody.setAttribute('data-series-body', '1');

      // Progress bars
      const barsDiv = document.createElement('div');
      barsDiv.className = 'series-bars';
      barsDiv.innerHTML = `
        <div class="series-bar-item">
          <div class="series-bar-label">
            <span>🛡 Got It</span><span>${sAgg.own}/${sAgg.total} (${sAgg.pctOwn}%)</span>
          </div>
          <div class="bar-track"><div class="bar-fill bar-fill--gold" style="width:${sAgg.pctOwn}%"></div></div>
        </div>
        <div class="series-bar-item">
          <div class="series-bar-label">
            <span>⚔ Read It</span><span>${sAgg.rd}/${sAgg.total} (${sAgg.pctRead}%)</span>
          </div>
          <div class="bar-track"><div class="bar-fill bar-fill--red" style="width:${sAgg.pctRead}%"></div></div>
        </div>
      `;
      seriesBody.appendChild(barsDiv);

      // ── Book card grid ──
      const grid = document.createElement('div');
      grid.className = 'book-grid';

      for (const b of items) {
        const isOwned = owned.has(b.id);
        const isRead  = read.has(b.id);
        const both    = isOwned && isRead;

        const card = document.createElement('div');
        card.className = 'book-card'
          + (both ? ' book-card--complete' : isOwned ? ' book-card--owned' : isRead ? ' book-card--read' : '');

        const numLabel = b.number ? `#${b.number}` : b.id;

        card.innerHTML = `
          <span class="book-num">${escapeHtml(numLabel)}</span>
          ${both ? '<span class="book-star">⭐</span>' : ''}
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-btns">
            <button type="button" class="toggle-btn toggle-own ${isOwned ? 'on' : ''}" aria-pressed="${isOwned}">
              🛡 ${isOwned ? 'Got!' : 'Got?'}
            </button>
            <button type="button" class="toggle-btn toggle-read ${isRead ? 'on' : ''}" aria-pressed="${isRead}">
              ⚔ ${isRead ? 'Read!' : 'Read?'}
            </button>
          </div>
        `;

        const ownBtn  = card.querySelector('.toggle-own');
        const readBtn = card.querySelector('.toggle-read');

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

        grid.appendChild(card);
      }

      seriesBody.appendChild(grid);

      // Toggle series
      const toggleSeries = () => {
        const nowCollapsed = seriesBody.classList.toggle('series-body--hidden');
        seriesHeader.setAttribute('aria-expanded', String(!nowCollapsed));
        const chev = seriesHeader.querySelector('.series-chevron');
        if (chev) chev.classList.toggle('series-chevron--closed', nowCollapsed);
        if (nowCollapsed) collapsedSeries.add(sKey); else collapsedSeries.delete(sKey);
        saveJSON(LS_KEYS.COLLAPSED, [...collapsedSeries]);
      };
      seriesHeader.addEventListener('click', toggleSeries);
      seriesHeader.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSeries(); }
      });

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
