import { books, owned, read } from './state.js';
import { escapeHtml, elStatTotal, elStatOwned, elStatRead, elStatPct, elStatBar } from './ui.js';

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

function computeSeriesOrderMap(){
  const map = new Map();
  for (const b of books){
    const label = (b.saga ? b.saga + ' — ' : '') + (b.series || 'Unknown');
    const m = String(b.id || '').match(/S([0-9]+)/i);
    let candidate = Number.POSITIVE_INFINITY;
    if (m) candidate = parseInt(m[1], 10);
    else if (typeof b.number === 'number' && !Number.isNaN(b.number)) candidate = b.number;
    const prev = map.get(label);
    map.set(label, Math.min(prev ?? candidate, candidate));
  }
  for (const [k,v] of map){ if (!Number.isFinite(v)) map.set(k, 0); }
  return map;
}

function renderAggTable(container, map){
  const rows = [...map.entries()].sort((a,b)=> a[0].localeCompare(b[0])).map(([name, m])=>{
    const pctRead = m.total ? Math.round((m.read/m.total)*100) : 0;
    const pctOwn  = m.total ? Math.round((m.owned/m.total)*100) : 0;
    return `
    <div class="p-3 border brand-border rounded-lg">
      <div class="flex justify-between items-center text-sm">
        <div class="font-medium">${escapeHtml(name)}</div>
        <div class="text-xs muted">${m.read}/${m.total} read • ${m.owned}/${m.total} owned</div>
      </div>
      <div class="mt-2">
        <div class="text-xs muted">Read ${pctRead}%</div>
        <div class="progress progress-track"><div class="progress progress-read" style="width:${pctRead}%"></div></div>
      </div>
      <div class="mt-2">
        <div class="text-xs muted">Owned ${pctOwn}%</div>
        <div class="progress progress-track"><div class="progress progress-own" style="width:${pctOwn}%"></div></div>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = rows || '<div class="muted">No data.</div>';
}

function renderSeriesAggTable(container, map){
  const orderMap = computeSeriesOrderMap();
  const entries = [...map.entries()]
    .sort((a,b)=>{
      const oa = orderMap.get(a[0]) ?? 0;
      const ob = orderMap.get(b[0]) ?? 0;
      if (oa !== ob) return ob - oa; // numerical DESC
      return a[0].localeCompare(b[0]);
    })
    .reverse(); // reversed per your earlier request

  const rows = entries.map(([name, m])=>{
    const pctRead = m.total ? Math.round((m.read/m.total)*100) : 0;
    const pctOwn  = m.total ? Math.round((m.owned/m.total)*100) : 0;
    return `
    <div class="p-3 border brand-border rounded-lg">
      <div class="flex justify-between items-center text-sm">
        <div class="font-medium">${escapeHtml(name)}</div>
        <div class="text-xs muted">${m.read}/${m.total} read • ${m.owned}/${m.total} owned</div>
      </div>
      <div class="mt-2">
        <div class="text-xs muted">Read ${pctRead}%</div>
        <div class="progress progress-track"><div class="progress progress-read" style="width:${pctRead}%"></div></div>
      </div>
      <div class="mt-2">
        <div class="text-xs muted">Owned ${pctOwn}%</div>
        <div class="progress progress-track"><div class="progress progress-own" style="width:${pctOwn}%"></div></div>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = rows || '<div class="muted">No data.</div>';
}

export function renderStatsTab(){
  const total = books.length;
  let ownedCount = 0, readCount = 0;
  for (const b of books){ if (owned.has(b.id)) ownedCount++; if (read.has(b.id)) readCount++; }
  const pct = total ? Math.round((readCount/total)*100) : 0;
  elStatTotal().textContent = String(total);
  elStatOwned().textContent = String(ownedCount);
  elStatRead().textContent  = String(readCount);
  elStatPct().textContent   = pct + '%';
  elStatBar().style.width   = pct + '%';

  const elSagaStats   = document.getElementById('sagaStats');
  const elSeriesStats = document.getElementById('seriesStats');
  const bySaga   = aggregateBy(b=> b.saga || 'Unknown');
  const bySeries = aggregateBy(b=> (b.saga? b.saga+ ' — ' : '') + (b.series || 'Unknown'));
  renderAggTable(elSagaStats, bySaga);
  renderSeriesAggTable(elSeriesStats, bySeries);
}
