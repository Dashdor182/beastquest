// app/settings.js
import {
    books, owned, read,
    replaceBooks, replaceState, saveJSON, LS_KEYS
  } from './state.js';
  import { render, renderFiltersOptions } from './ui.js';
  import { renderStatsTab } from './stats.js';
  import { renderAchievementsTab } from './achievements.js';
  
  export function initSettings({ onDataChanged } = {}){
    const btnImportBooks = document.getElementById('btnImportBooks');
    const btnImportBooksCSV = document.getElementById('btnImportBooksCSV');
    const btnExportBooks = document.getElementById('btnExportBooks');
    const btnImportState = document.getElementById('btnImportState');
    const btnExportState = document.getElementById('btnExportState');
    const btnClearState  = document.getElementById('btnClearState');
    const hiddenFile     = document.getElementById('hiddenFile');
  
    const safeRefresh = ()=> {
      try {
        if (typeof onDataChanged === 'function') onDataChanged();
        else {
          renderFiltersOptions(); render(()=>{}); renderStatsTab(); renderAchievementsTab();
        }
      } catch(e){ console.warn('Refresh error', e); }
    };
  
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
          if (kind === 'books_json'){
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error('Books JSON must be an array');
            const normalized = normalizeBooks(parsed);
            if (!normalized.length) throw new Error('No valid books after parsing');
            replaceBooks(normalized);
            safeRefresh();
          } else if (kind === 'books_csv'){
            const normalized = csvToBooksStrict(text);
            if (!normalized.length) throw new Error('No valid books after parsing');
            replaceBooks(normalized);
            safeRefresh();
          } else if (kind === 'state'){
            const parsed = JSON.parse(text);
            const o = Array.isArray(parsed.owned) ? parsed.owned : [];
            const r = Array.isArray(parsed.read)  ? parsed.read  : [];
            replaceState(o, r);
            safeRefresh();
          }
        } catch (err) {
          alert('Import failed: ' + (err?.message || err));
        }
      };
      hiddenFile.click();
    }
  
    if (btnImportBooks)    btnImportBooks.addEventListener('click', ()=> chooseFile('books_json'));
    if (btnImportBooksCSV) btnImportBooksCSV.addEventListener('click', ()=> chooseFile('books_csv'));
    if (btnImportState)    btnImportState.addEventListener('click', ()=> chooseFile('state'));
    if (btnExportBooks)    btnExportBooks.addEventListener('click', ()=> downloadJSON('beast-quest-books.json', books));
    if (btnExportState)    btnExportState.addEventListener('click', ()=> downloadJSON('beast-quest-state.json', { owned:[...owned], read:[...read] }));
    if (btnClearState)     btnClearState.addEventListener('click', ()=>{
      if (!confirm('Are you sure you want to clear Owned/Read state?')) return;
      replaceState([], []);
      safeRefresh();
    });
  }
  
  /* ---------- Helpers ---------- */
  function downloadJSON(filename, data){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  
  function normalizeBooks(arr){
    return arr.map(x => ({
      id: String(x.id),
      number: Number.isFinite(+x.number) ? +x.number : undefined,
      title: String(x.title ?? '').trim(),
      saga: String(x.saga ?? '').trim(),
      series: String(x.series ?? '').trim(),
      seriesIndex: Number.isFinite(+x.seriesIndex) ? +x.seriesIndex
                  : (Number.isFinite(+x.number) ? +x.number : undefined),
    })).filter(x => x.id && x.title);
  }
  
  /* CSV strict: exact columns (no extra/fewer). Column names allowed:
     id, title, number, saga, series, seriesIndex
     (Any order is fine, but must be exactly this set.)
  */
  function csvToBooksStrict(text){
    const delim = detectDelimiter(text);
    const rows = parseCSV(text, delim);
    if (!rows.length) throw new Error('CSV is empty');
  
    const headerRaw = rows.shift();
    const norm = s => String(s||'').trim();
    const header = headerRaw.map(norm);
    const expectedSet = new Set(['id','title','number','saga','series','seriesIndex']);
  
    if (header.length !== expectedSet.size) {
      throw new Error(`Header must have exactly ${expectedSet.size} columns`);
    }
    for (const h of header){
      if (!expectedSet.has(h)) throw new Error(`Unexpected column "${h}". Expected: id,title,number,saga,series,seriesIndex`);
    }
  
    rows.forEach((r,i)=>{
      if (r.length !== header.length) throw new Error(`Row ${i+2} has ${r.length} columns; expected ${header.length}`);
    });
  
    const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
  
    const out = rows.map((row, i) => {
      const get = name => String(row[idx[name]] ?? '').trim();
      const id = get('id');
      const title = get('title');
      if (!id) throw new Error(`Row ${i+2} has empty id`);
      if (!title) throw new Error(`Row ${i+2} has empty title`);
      const number = get('number'); const sIdx = get('seriesIndex');
      return {
        id,
        title,
        number: number === '' ? undefined : (Number.isFinite(+number) ? +number : undefined),
        saga: get('saga'),
        series: get('series'),
        seriesIndex: sIdx === '' ? (Number.isFinite(+number) ? +number : undefined) : (Number.isFinite(+sIdx) ? +sIdx : undefined),
      };
    });
    return out;
  }
  
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
    text = text.replace(/^\uFEFF/, ''); // strip BOM
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i=0;i<text.length;i++){
      const ch = text[i];
      if (inQ){
        if (ch === '"'){
          if (text[i+1] === '"'){ field += '"'; i++; }
          else { inQ = false; }
        } else { field += ch; }
      } else {
        if (ch === '"'){ inQ = true; }
        else if (ch === delimiter){ row.push(field); field = ''; }
        else if (ch === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r'){ if (text[i+1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
        else { field += ch; }
      }
    }
    if (field.length || row.length){ row.push(field); rows.push(row); }
    return rows;
  }
  