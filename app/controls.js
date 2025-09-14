import { csvToBooks } from './csv.js';
import { books, owned, read, LS_KEYS, saveJSON, setBooks, setOwned, setRead, ensureDefaultCollapsedForCurrentBooks } from './state.js';
import { render, renderFiltersOptions } from './ui.js';
import { renderStatsTab } from './stats.js';

export function wireControls(){
  const btnImportBooks    = document.getElementById('btnImportBooks');
  const btnImportBooksCSV = document.getElementById('btnImportBooksCSV');
  const btnExportBooks    = document.getElementById('btnExportBooks');
  const btnImportState    = document.getElementById('btnImportState');
  const btnExportState    = document.getElementById('btnExportState');
  const btnClearState     = document.getElementById('btnClearState');
  const hiddenFile        = document.getElementById('hiddenFile');

  function downloadJSON(filename, data){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function chooseFile(kind){
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
          renderFiltersOptions(); render(handleCardToggle); renderStatsTab();
        } else if (kind === 'books_csv') {
          const normalized = csvToBooks(text);
          if (!normalized.length) throw new Error('No valid books after parsing');
          setBooks(normalized);
          ensureDefaultCollapsedForCurrentBooks();
          renderFiltersOptions(); render(handleCardToggle); renderStatsTab();
        } else if (kind === 'state') {
          const parsed = JSON.parse(text);
          setOwned(new Set(Array.isArray(parsed.owned) ? parsed.owned : []));
          setRead (new Set(Array.isArray(parsed.read ) ? parsed.read  : []));
          render(handleCardToggle); renderStatsTab();
        }
      } catch (err) { alert('Import failed: ' + (err?.message || err)); }
    };
    hiddenFile.click();
  }

  function handleCardToggle(kind, id, on){
    if (kind === 'own'){ on ? owned.add(id) : owned.delete(id); saveJSON(LS_KEYS.OWNED, [...owned]); }
    if (kind === 'read'){ on ? read.add(id)  : read.delete(id);  saveJSON(LS_KEYS.READ,  [...read]); }
    render(handleCardToggle); renderStatsTab();
  }

  if (btnImportBooks   ) btnImportBooks.addEventListener('click', () => chooseFile('books'));
  if (btnImportBooksCSV) btnImportBooksCSV.addEventListener('click', () => chooseFile('books_csv'));
  if (btnExportBooks   ) btnExportBooks.addEventListener('click', () => downloadJSON('beast-quest-books.json', books));
  if (btnImportState   ) btnImportState.addEventListener('click', () => chooseFile('state'));
  if (btnExportState   ) btnExportState.addEventListener('click', () => downloadJSON('beast-quest-state.json', { owned:[...owned], read:[...read] }));
  if (btnClearState    ) btnClearState.addEventListener('click', () => {
    if (!confirm('Clear Owned/Read state?')) return;
    owned.clear(); read.clear();
    saveJSON(LS_KEYS.OWNED, [...owned]);
    saveJSON(LS_KEYS.READ,  [...read]);
    render(handleCardToggle); renderStatsTab();
  });

  // expose to other modules
  return { handleCardToggle };
}
