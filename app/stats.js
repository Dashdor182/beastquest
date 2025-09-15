// app/stats.js
import { books, owned, read } from './state.js';
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
  // Saga totals
  const bySaga = aggregateBy(b=> b.saga || 'Unknown');

  // Build per-saga sections with per-series rows
  const sagasSorted = [...bySaga.entries()].sort((a,b)=> a[0].localeCompare(b[0]));
  const html = sagasSorted.map(([sagaName, mSaga])=>{
    const pctRead = mSaga.total ? Math.round((mSaga.read/mSaga.total)*100) : 0;
    const pctOwn  = mSaga.total ? Math.round((mSaga.owned/mSaga.total)*100) : 0;

    // series rows for this saga
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
        // tiny spark bar (read%)
        const spark = `
          <div class="inline-block align-middle" style="width:60px;height:8px;border-radius:9999px;background:color-mix(in oklab, var(--border) 75%, black);">
            <div style="width:${pctR}%;height:8px;border-radius:9999px;background:var(--accent2);"></div>
          </div>
        `;
        return `
          <div class="flex items-center justify-between p-2 rounded border brand-border">
            <div class="flex items-center gap-3">
              ${spark}
              <div class="text-sm font-medium">${escapeHtml(seriesName)}</div>
            </div>
            <div class="text-xs muted">${m.read}/${m.total} read • ${m.owned}/${m.total} owned</div>
          </div>
        `;
      }).join('');

    return `
      <section class="panel rounded-xl border brand-border">
        <div class="px-4 py-3 rounded-t-xl header-grad flex items-center justify-between">
          <h3 class="text-lg font-semibold">Saga: ${escapeHtml(sagaName)}</h3>
          <div class="flex gap-2">
            <span class="badge">Read ${mSaga.read}/${mSaga.total} (${pctRead}%)</span>
            <span class="badge">Owned ${mSaga.owned}/${mSaga.total} (${pctOwn}%)</span>
          </div>
        </div>
        <div class="p-3 grid gap-2" aria-label="Series stats for ${escapeHtml(sagaName)}">
          ${seriesRows || '<div class="muted text-sm">No series found for this saga.</div>'}
        </div>
      </section>
    `;
  }).join('');

  container.innerHTML = html || '<div class="muted">No data.</div>';
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

  // Saga → Series breakdown
  const elSagaBreakdown = document.getElementById('sagaBreakdown');
  if (elSagaBreakdown) renderSagaBreakdown(elSagaBreakdown);
}
