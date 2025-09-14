// Orchestrates rendering, tabs, filters, import/export, and global expand/collapse
import {
  LS_KEYS, books, owned, read,
  setBooks, setOwned, setRead,
  ensureDefaultCollapsedForCurrentBooks
} from './state.js';
import {
  render, renderFiltersOptions,
  setAllSagasCollapsed, setAllSeriesCollapsed
} from './ui.js';
import { renderStatsTab } from './stats.js';

// ---------- Tabs ----------
function setTab(targetSel){
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.add('hidden'); p.classList.remove('block');
  });
  const target = document.querySelector(targetSel);
  if (target){ target.classList.remove('hidden'); target.classList.add('block'); }
  document.querySelectorAll('.tab-btn').forEach(b=>{
    const on = b.getAttribute('data-target')===targetSel;
    b.setAttribute('aria-selected', on ? 'true':'false');
    b.classList.toggle('active', on);
    b.classList.toggle('inactive', !on);
  });
}
document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click', ()=> setTab(b.getAttribute('data-target')));
});

// ---------- Filters re-render ----------
const elSearch = document.getElementById('search');
const elSaga   = document.getElementById('filterSaga');
const elSeries = document.getElementById('filterSeries');
const elStatus = document.getElementById('filterStatus');

function handleCardToggle(type, id, on){
  if (type === 'own'){
    const next = new Set(owned); on ? next.add(id) : next.delete(id); setOwned(next);
  } else if (type === 'read'){
    const next = new Set(read); on ? next.add(id) : next.delete(id); setRead(next);
  }
  render(handleCardToggle);
  renderStatsTab();
}

for (const el of [elSearch, elSaga, elSeries, elStatus]){
  if (!el) continue;
  el.addEventListener('input', () => { render(handleCardToggle); renderStatsTab(); });
  el.addEventListener('change', () => { render(handleCardToggle); renderStatsTab(); });
}

// ---------- Global expand/collapse (Overview) ----------
const btnExpandAll    = document.getElementById('btnExpandAll');
const btnCollapseAll  = document.getElementById('btnCollapseAll');

if (btnExpandAll) btnExpandAll.addEventListener('click', ()=>{
  setAllSagasCollapsed(false);
  setAllSeriesCollapsed(false);
  render(handleCardToggle);
});

if (btnCollapseAll) btnCollapseAll.addEventListener('click', ()=>{
  setAllSagasCollapsed(true);
  setAllSeriesCollapsed(true);
  render(handleCardToggle);
});

// ---------- Global expand/collapse (Stats sagas) ----------
const btnStatsExpandAll   = document.getElementById('btnStatsExpandAll');
const btnStatsCollapseAll = document.getElementById('btnStatsCollapseAll');

if (btnStatsExpandAll) btnStatsExpandAll.addEventListener('click', ()=>{
  setAllSagasCollapsed(false);
  renderStatsTab();
});

if (btnStatsCollapseAll) btnStatsCollapseAll.addEventListener('click', ()=>{
  setAllSagasCollapsed(true);
  renderStatsTab();
});

// ---------- Import/Export ----------
const btnImportBooks     = document.getElementById('btnImportBooks');
const btnImportBooksCSV  = document.getElementById('btnImportBooksCSV');
const btnExportBooks     = document.getElementById('btnExportBooks');
const btnImportState     = document.getElementById('btnImportState');
const btnExportState     = document.getElementById('btnExportState');
const btnClearState      = document.getElementById('btnClearState');
const hiddenFile         = document.getElementById('hiddenFile');

if (btnImportBooks)    btnImportBooks.addEventListener('click', () => chooseFile('books'));
if (btnImportBooksCSV) btnImportBooksCSV.addEventListener('click', () => chooseFile('books_csv'));
if (btnImportState)    btnImportState.addEventListener('click', () => chooseFile('state'));
if (btnExportBooks)    btnExportBooks.addEventListener('click', () => downloadJSON('beast-quest-books.json', books));
if (btnExportState)    btnExportState.addEventListener('click', () => downloadJSON('beast-quest-state.json', { owned:[...owned], read:[...read] }));
if (btnClearState)     btnClearState.addEventListener('click', () => {
  const ok = confirm('Are you sure you want to clear ALL Owned/Read state?\n\nThis cannot be undone.');
  if (!ok) return;
  setOwned(new Set());
  setRead(new Set());
  render(handleCardToggle);
  renderStatsTab();
});

function chooseFile(kind){
  if (!hiddenFile) return;
  hiddenFile.value = '';
  if (kind === 'books_csv') hiddenFile.accept = '.csv,text/csv';
  else hiddenFile.accept = 'application/json,application/JSON,.json';

  hiddenFile.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      if (kind === 'books') {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Books JSON must be an array');
        const normalized = parsed.map(x => ({
          id: String(x.id),
          number: Number(x.number ?? 0) || undefined,
          title: String(x.title ?? '').trim(),
          saga: String(x.saga ?? '').trim(),
          series: String(x.series ?? '').trim(),
          seriesIndex: Number(x.seriesIndex ?? x.number ?? 0) || undefined,
        })).filter(x => x.id && x.title);
        if (!normalized.length) throw new Error('No valid books after parsing');
        setBooks(normalized);
        ensureDefaultCollapsedForCurrentBooks();
        renderFiltersOptions();
        render(handleCardToggle);
        renderStatsTab();
      } else if (kind === 'books_csv') {
        const normalized = csvToBooks(text);
        if (!normalized.length) throw new Error('No valid books after parsing');
        setBooks(normalized);
        ensureDefaultCollapsedForCurrentBooks();
        renderFiltersOptions();
        render(handleCardToggle);
        renderStatsTab();
      } else if (kind === 'state') {
        const parsed = JSON.parse(text);
        const o = new Set(Array.isArray(parsed.owned) ? parsed.owned : []);
        const r = new Set(Array.isArray(parsed.read)  ? parsed.read  : []);
        setOwned(o); setRead(r);
        render(handleCardToggle);
        renderStatsTab();
      }
    } catch (err) {
      alert('Import failed: ' + (err?.message || err));
    }
  };
  hiddenFile.click();
}

function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------- CSV helpers ----------
function detectDelimiter(text){
  const sample = text.slice(0, 10000);
  const lines = sample.split(/\r\n|\n|\r/).slice(0, 10);
  const cands = [',',';','\t','|'];
  let best = ',', bestScore = -1;
  for (const cand of cands){
    let score = 0;
    for (const line of lines){
      let inQ = false, cnt = 0;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (ch === '"'){
          if (inQ && line[i+1] === '"'){ i++; continue; }
          inQ = !inQ;
        } else if (!inQ && ch === cand){ cnt++; }
      }
      score += cnt;
    }
    if (score > bestScore){ bestScore = score; best = cand; }
  }
  return best;
}

function parseCSV(text, delimiter=','){
  text = text.replace(/^\uFEFF/, ''); // BOM
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i];
    if (inQ){
      if (ch === '"'){
        if (text[i+1] === '"'){ field += '"'; i++; }
        else { inQ = false; }
      } else field += ch;
    } else {
      if (ch === '"'){ inQ = true; }
      else if (ch === delimiter){ row.push(field); field = ''; }
      else if (ch === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r'){ if (text[i+1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

function csvToBooks(text){
  const delim = detectDelimiter(text);
  const rows = parseCSV(text, delim);
  if (!rows.length) throw new Error('CSV is empty');
  const headerRaw = rows.shift();
  const headerLen = headerRaw.length;
  if (!headerLen) throw new Error('Header row is empty');

  // Every row must have EXACTLY same number of cols as header
  rows.forEach((r, i) => {
    if (r.length !== headerLen) throw new Error(`Row ${i+2} has ${r.length} columns; expected ${headerLen}`);
  });

  const norm = (h)=> String(h||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  const headers = headerRaw.map(norm);
  const allowed = new Set([
    'id','bookid',
    'title','name',
    'number','no','booknumber','bookno','num',
    'saga',
    'series',
    'seriesindex','series_idx','seriesnumber','seriesno','seriesnum','idx'
  ]);
  for (const h of headers){
    if (!allowed.has(h)) throw new Error(`Unknown column: "${h}"`);
  }

  const find = (names)=>{ for(const n of names){ const i = headers.indexOf(n); if(i!==-1) return i; } return -1; };
  const idxId     = find(['id','bookid']);
  const idxTitle  = find(['title','name']);
  if (idxId === -1 || idxTitle === -1) throw new Error('CSV must include columns: id, title');
  const idxNum    = find(['number','no','booknumber','bookno','num']);
  const idxSaga   = find(['saga']);
  const idxSeries = find(['series']);
  const idxSIdx   = find(['seriesindex','series_idx','seriesnumber','seriesno','seriesnum','idx']);

  const out = [];
  rows.forEach((row, i) => {
    const g = (ix)=> (ix>=0 && ix<row.length) ? String(row[ix]).trim() : '';
    const id    = g(idxId);
    const title = g(idxTitle);
    if (!id) throw new Error(`Row ${i+2} has empty id`);
    if (!title) throw new Error(`Row ${i+2} has empty title`);
    const saga  = g(idxSaga);
    const series= g(idxSeries);
    const nStr  = g(idxNum);
    const siStr = g(idxSIdx);
    const number = nStr === '' ? undefined : Number(nStr);
    const seriesIndex = siStr !== '' ? Number(siStr) : (Number(nStr) || undefined);
    out.push({
      id,
      number: Number.isFinite(number) ? number : undefined,
      title,
      saga,
      series,
      seriesIndex: Number.isFinite(seriesIndex) ? seriesIndex : undefined,
    });
  });
  return out;
}

// ---------- Bootstrap ----------
ensureDefaultCollapsedForCurrentBooks();
renderFiltersOptions();
render(handleCardToggle);
renderStatsTab();

// Default to Overview tab on first load
setTab('#tab-overview');
