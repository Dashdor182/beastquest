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

function renderSagaBreakdown(container){
  const bySaga = aggregateBy(b=> b.saga || 'Unknown');
  const rows = [...bySaga.entries()].sort((a,b)=> a[0].localeCompare(b[0])).map(([name, m])=>{
    const pctRead = m.total ? Math.round((m.read/m.total)*100) : 0;
    const pctOwn  = m.total ? Math.round((m.owned/m.total)*100) : 0;

    return `
    <section class="panel rounded-xl border brand-border">
      <div class="px-4 py-3 rounded-t-xl header-grad flex items-center justify-between">
        <h3 class="text-lg font-semibold">Saga: ${escapeHtml(name)}</h3>
        <div class="flex gap-2">
          <span class="badge">Read ${m.read}/${m.total} (${pctRead}%)</span>
          <span class="badge">Owned ${m.owned}/${m.total} (${pctOwn}%)</span>
        </div>
      </div>
      <div class="p-3 grid gap-2" aria-label="Series stats for ${escapeHtml(name)}" ></div>
    </section>`;
  }).join('');
  container.innerHTML = rows || '<div class="muted">No data.</div>';
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
  const elSagaBreakdown = document.getElementById('sagaBreakdown');
  if (elSagaBreakdown) renderSagaBreakdown(elSagaBreakdown);
}
