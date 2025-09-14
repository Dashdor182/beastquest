import {
  books, owned, read,
  LS_KEYS, collapsedSagas, saveJSON
} from './state.js';
import { escapeHtml, elStatTotal, elStatOwned, elStatRead, elStatPct, elStatBar } from './ui.js';

function aggregateBySaga(){
  // Map<saga, { total, owned, read }>
  const map = new Map();
  for (const b of books){
    const key = b.saga || 'Unknown';
    if (!map.has(key)) map.set(key, { total:0, owned:0, read:0 });
    const m = map.get(key);
    m.total++;
    if (owned.has(b.id)) m.owned++;
    if (read.has(b.id))  m.read++;
  }
  return map;
}

function aggregateSeriesWithinSaga(saga){
  // Map<seriesLabel, { total, owned, read, order, idSeed }>
  const map = new Map();
  for (const b of books){
    if (b.saga !== saga) continue;
    const label = b.series || 'Unknown';
    if (!map.has(label)) map.set(label, { total:0, owned:0, read:0, order: Number.POSITIVE_INFINITY, idSeed: null });
    const m = map.get(label);
    m.total++;
    if (owned.has(b.id)) m.owned++;
    if (read.has(b.id))  m.read++;
    // infer numeric order from id Sxx
    const mm = String(b.id||'').match(/S(\d+)/i);
    if (mm){
      const n = parseInt(mm[1],10);
      if (n < m.order) m.order = n;
    }
    if (!m.idSeed) m.idSeed = b.id;
  }
  return map;
}

function seriesNumberFromAnyId(id){
  const m = String(id||'').match(/S(\d+)/i);
  return m ? parseInt(m[1],10) : null;
}

function renderSagaBreakdown(){
  const container = document.getElementById('sagaBreakdown');
  const bySaga = aggregateBySaga();

  const parts = [];

  // Sort sagas alphabetically
  for (const [saga, m] of [...bySaga.entries()].sort((a,b)=> a[0].localeCompare(b[0]))){
    const pctRead = m.total ? Math.round((m.read/m.total)*100) : 0;
    const pctOwn  = m.total ? Math.round((m.owned/m.total)*100) : 0;

    const bodyId = 'sg-' + btoa(unescape(encodeURIComponent(String(saga)))).replace(/[^a-z0-9]/gi,'');
    const seriesMap = aggregateSeriesWithinSaga(saga);

    const isCollapsed = collapsedSagas.has(saga);

    // Per-series rows with micro spark bars (read & owned)
    const seriesRows = [...seriesMap.entries()]
      .sort((a,b)=>{
        const oa = a[1].order ?? Number.POSITIVE_INFINITY;
        const ob = b[1].order ?? Number.POSITIVE_INFINITY;
        if (oa !== ob) return oa - ob;
        return a[0].localeCompare(b[0]);
      })
      .map(([seriesName, mm])=>{
        const pctR = mm.total ? Math.round((mm.read/mm.total)*100) : 0;
        const pctO = mm.total ? Math.round((mm.owned/mm.total)*100) : 0;
        const sn = seriesNumberFromAnyId(mm.idSeed);
        const label = sn != null ? `Series ${sn}: ${escapeHtml(seriesName)}` : `Series: ${escapeHtml(seriesName)}`;
        return `
          <div class="p-3 border brand-border rounded-lg">
            <div class="flex justify-between items-center text-sm gap-3">
              <div class="flex items-center gap-3">
                <div class="inline-flex items-center gap-2">
                  <div class="spark"><div class="fill read" style="width:${pctR}%"></div></div>
                  <div class="spark"><div class="fill own"  style="width:${pctO}%"></div></div>
                </div>
                <div class="font-medium">${label}</div>
              </div>
              <div class="text-xs muted whitespace-nowrap">${mm.read}/${mm.total} read • ${mm.owned}/${mm.total} owned</div>
            </div>
          </div>
        `;
      }).join('');

    // Saga header: chips only + collapse toggle, persisted across tabs
    parts.push(`
      <section class="panel rounded-xl border brand-border shadow-sm">
        <div class="px-4 py-3 rounded-t-xl header-grad flex items-center gap-3 flex-wrap series-header-click" data-toggle="${bodyId}" data-saga-name="${escapeHtml(saga)}" aria-expanded="${!isCollapsed}">
          <h4 class="text-lg font-semibold">Saga: ${escapeHtml(saga)}</h4>
          <div class="flex items-center gap-2 text-xs">
            <span class="badge">Read ${m.read}/${m.total} (${pctRead}%)</span>
            <span class="badge">Owned ${m.owned}/${m.total} (${pctOwn}%)</span>
          </div>
          <span class="ml-auto muted text-sm">${isCollapsed ? 'Expand' : 'Collapse'}</span>
        </div>
        <div id="${bodyId}" class="p-4 ${isCollapsed ? 'hidden':''}">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            ${seriesRows || '<div class="muted">No series data.</div>'}
          </div>
        </div>
      </section>
    `);
  }

  container.innerHTML = parts.join('') || '<div class="muted">No data.</div>';

  // Toggle handlers (whole header surface is clickable)
  container.querySelectorAll('[data-toggle]').forEach(header=>{
    const id = header.getAttribute('data-toggle');
    const saga = header.getAttribute('data-saga-name');
    const body = container.querySelector('#'+CSS.escape(id));
    const label = header.querySelector('.muted.ml-auto, .ml-auto.muted, .ml-auto');

    header.addEventListener('click', ()=>{
      const hidden = body.classList.toggle('hidden');
      header.setAttribute('aria-expanded', String(!hidden));
      if (label) label.textContent = hidden ? 'Expand' : 'Collapse';
      if (hidden) collapsedSagas.add(saga); else collapsedSagas.delete(saga);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    });
  });
}

export function renderStatsTab(){
  // Global stats
  const total = books.length;
  let ownedCount = 0, readCount = 0;
  for (const b of books){
    if (owned.has(b.id)) ownedCount++;
    if (read.has(b.id))  readCount++;
  }
  const pct = total ? Math.round((readCount/total)*100) : 0;
  elStatTotal().textContent = String(total);
  elStatOwned().textContent = String(ownedCount);
  elStatRead().textContent  = String(readCount);
  elStatPct().textContent   = pct + '%';
  elStatBar().style.width   = pct + '%';

  // Saga sections
  renderSagaBreakdown();
}
