// app/stats.js
import {
  books, owned, read,
  collapsedSagas, saveJSON, LS_KEYS
} from './state.js';
import { elStatTotal, elStatOwned, elStatRead, elStatPct, elStatBar, escapeHtml } from './ui.js';

function aggregateBy(keyFn){
  const map = new Map();
  for (const b of books){
    const key = keyFn(b);
    if (!map.has(key)) map.set(key, { total:0, owned:0, read:0 });
    const m = map.get(key);
    m.total++;
    if (owned.has(b.id)) m.owned++;
    if (read.has(b.id))  m.read++;
  }
  return map;
}

function inferSeriesOrderMapForSaga(saga){
  const order = new Map(); // series -> min series number inferred from id
  for (const b of books.filter(x=>x.saga===saga)){
    const name = b.series || 'Unknown';
    const m = String(b.id||'').match(/S(\d+)/i);
    const v = m ? parseInt(m[1],10) : Number.MAX_SAFE_INTEGER;
    order.set(name, Math.min(order.get(name) ?? v, v));
  }
  return order;
}

function renderSagaBreakdown(container){
  const bySaga = aggregateBy(b=> b.saga || 'Unknown');
  const sagasSorted = [...bySaga.entries()].sort((a,b)=> a[0].localeCompare(b[0]));

  const html = sagasSorted.map(([sagaName, mSaga])=>{
    const pctRead = mSaga.total ? Math.round((mSaga.read/mSaga.total)*100) : 0;
    const pctOwn  = mSaga.total ? Math.round((mSaga.owned/mSaga.total)*100) : 0;

    const orderMap = inferSeriesOrderMapForSaga(sagaName);
    const bySeries = aggregateBy(b=> (b.saga===sagaName ? (b.series || 'Unknown') : null));
    bySeries.delete(null);

    const seriesRows = [...bySeries.entries()]
      .sort((a,b)=>{
        const oa = orderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const ob = orderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return a[0].localeCompare(b[0]);
      })
      .map(([seriesName, m])=>{
        const pctR = m.total ? Math.round((m.read/m.total)*100) : 0;
        const pctO = m.total ? Math.round((m.owned/m.total)*100) : 0;

        // two micro spark bars (Read & Owned), 60×6 each, stacked
        const sparks = `
          <div class="flex flex-col gap-1">
            <div class="inline-block align-middle" style="width:60px;height:6px;border-radius:9999px;background:color-mix(in oklab, var(--border) 75%, black);">
              <div style="width:${pctR}%;height:6px;border-radius:9999px;background:var(--accent2);" title="Read ${pctR}%"></div>
            </div>
            <div class="inline-block align-middle" style="width:60px;height:6px;border-radius:9999px;background:color-mix(in oklab, var(--border) 75%, black);">
              <div style="width:${pctO}%;height:6px;border-radius:9999px;background:var(--accent);" title="Owned ${pctO}%"></div>
            </div>
          </div>
        `;

        return `
          <div class="flex items-center justify-between p-2 rounded border brand-border">
            <div class="flex items-center gap-3">
              ${sparks}
              <div class="text-sm font-medium">${escapeHtml(seriesName)}</div>
            </div>
            <div class="text-xs muted">${m.read}/${m.total} read • ${m.owned}/${m.total} owned</div>
          </div>
        `;
      }).join('');

    // collapsible saga section (persist to collapsedSagas; same as Overview)
    const bodyId = 'stats-sbody-' + btoa(unescape(encodeURIComponent(String(sagaName)))).replace(/[^a-z0-9]/gi,'');
    const isCollapsed = collapsedSagas.has(sagaName);

    return `
      <section class="panel rounded-xl border brand-border">
        <div class="px-4 py-3 rounded-t-xl header-grad flex items-center justify-between cursor-pointer"
             role="button" tabindex="0"
             aria-expanded="${!isCollapsed}" aria-controls="${bodyId}"
             data-saga-toggle="${escapeHtml(sagaName)}">
          <h3 class="text-lg font-semibold">Saga: ${escapeHtml(sagaName)}</h3>
          <div class="flex gap-2">
            <span class="badge">Read ${mSaga.read}/${mSaga.total} (${pctRead}%)</span>
            <span class="badge">Owned ${mSaga.owned}/${mSaga.total} (${pctOwn}%)</span>
          </div>
        </div>
        <div id="${bodyId}" class="p-3 grid gap-2 ${isCollapsed ? 'hidden' : ''}" aria-label="Series stats for ${escapeHtml(sagaName)}">
          ${seriesRows || '<div class="muted text-sm">No series found for this saga.</div>'}
        </div>
      </section>
    `;
  }).join('');

  container.innerHTML = html || '<div class="muted">No data.</div>';

  // wire toggles for all saga headers (click entire header area)
  container.querySelectorAll('[data-saga-toggle]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const sagaName = el.getAttribute('data-saga-toggle');
      const body = document.getElementById('stats-sbody-' + btoa(unescape(encodeURIComponent(String(sagaName)))).replace(/[^a-z0-9]/gi,''));
      const nowHidden = body.classList.toggle('hidden');
      el.setAttribute('aria-expanded', String(!nowHidden));
      if (nowHidden) collapsedSagas.add(sagaName); else collapsedSagas.delete(sagaName);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    });
    el.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });
}

export function renderStatsTab(){
  // Global stats
  const total = books.length;
  let ownedCount = 0, readCount = 0;
  for (const b of books){ if (owned.has(b.id)) ownedCount++; if (read.has(b.id)) readCount++; }
  const pct = total ? Math.round((readCount/total)*100) : 0;
  elStatTotal().textContent = String(total);
  elStatOwned().textContent = String(ownedCount);
  elStatRead().textContent  = String(readCount);
  elStatPct().textContent   = pct + '%';
  elStatBar().style.width   = pct + '%';

  // Saga → Series breakdown (collapsible, persisted)
  const elSagaBreakdown = document.getElementById('sagaBreakdown');
  if (elSagaBreakdown) renderSagaBreakdown(elSagaBreakdown);
}
