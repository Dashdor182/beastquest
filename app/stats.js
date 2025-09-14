import { books, owned, read } from './state.js';
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
  // Map<seriesLabel, { total, owned, read, order }>
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

  const fragments = [];

  // Sort sagas alphabetically for consistency
  for (const [saga, m] of [...bySaga.entries()].sort((a,b)=> a[0].localeCompare(b[0]))){
    const pctRead = m.total ? Math.round((m.read/m.total)*100) : 0;
    const pctOwn  = m.total ? Math.round((m.owned/m.total)*100) : 0;

    const bodyId = 'sg-' + btoa(unescape(encodeURIComponent(String(saga)))).replace(/[^a-z0-9]/gi,'');
    const seriesMap = aggregateSeriesWithinSaga(saga);

    // Build per-series rows (sorted by inferred series number ASC, then name)
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
            <div class="flex justify-between items-center text-sm">
              <div class="font-medium">${label}</div>
              <div class="text-xs muted">${mm.read}/${mm.total} read • ${mm.owned}/${mm.total} owned</div>
            </div>
            <div class="mt-2">
              <div class="text-xs muted">Read ${pctR}%</div>
              <div class="progress progress-track"><div class="progress progress-read" style="width:${pctR}%"></div></div>
            </div>
            <div class="mt-2">
              <div class="text-xs muted">Owned ${pctO}%</div>
              <div class="progress progress-track"><div class="progress progress-own" style="width:${pctO}%"></div></div>
            </div>
          </div>
        `;
      }).join('');

    fragments.push(`
      <section class="panel rounded-xl border brand-border shadow-sm mb-4">
        <div class="px-4 py-3 rounded-t-xl header-grad flex items-center justify-between">
          <h4 class="text-lg font-semibold">Saga: ${escapeHtml(saga)}</h4>
          <button type="button" class="inline-flex items-center gap-2 muted hover:text-[color:var(--text)]" data-bt="${bodyId}" aria-expanded="false">
            <span class="text-sm">Expand</span>
            <svg class="chev w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
        <div class="px-4 pb-3 text-sm muted">
          <span>${m.read}/${m.total} read</span> • <span>${m.owned}/${m.total} owned</span>
        </div>
        <div id="${bodyId}" class="p-4 hidden">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            ${seriesRows || '<div class="muted">No series data.</div>'}
          </div>
        </div>
      </section>
    `);
  }

  container.innerHTML = fragments.join('') || '<div class="muted">No data.</div>';

  // Wire up toggles
  container.querySelectorAll('button[data-bt]').forEach(btn=>{
    const id = btn.getAttribute('data-bt');
    const body = container.querySelector('#'+CSS.escape(id));
    btn.addEventListener('click', ()=>{
      const hidden = body.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(!hidden));
      btn.querySelector('span').textContent = hidden ? 'Expand' : 'Collapse';
      btn.querySelector('svg').style.transform = hidden ? 'rotate(-180deg)' : 'rotate(0deg)';
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

  // Saga breakdown
  renderSagaBreakdown();
}
