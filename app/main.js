// app/main.js
import { LS_KEYS, saveJSON, owned, read, ensureDefaultCollapsedForCurrentBooks } from './state.js';
import { render, renderFiltersOptions, setAllSagasCollapsed, setAllSeriesCollapsed } from './ui.js';
import { renderStatsTab } from './stats.js';
import { renderAchievementsTab } from './achievements.js';
import { initSettings } from './settings.js';

const FILTER_SESSION_KEY = 'bq:filters';

function setTab(targetSel){
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.add('hidden'); p.classList.remove('block');
  });
  const target = document.querySelector(targetSel);
  if (!target) return;
  target.classList.remove('hidden'); target.classList.add('block');

  document.querySelectorAll('.tab-btn').forEach(b=>{
    const on = b.getAttribute('data-target')===targetSel;
    b.setAttribute('aria-selected', on ? 'true':'false');
    b.classList.toggle('active', on);
    b.classList.toggle('inactive', !on);
  });

  if (targetSel === '#tab-achievements') renderAchievementsTab();
}

function wireTabs(){
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=> setTab(b.getAttribute('data-target')));
  });
}

function wireGlobalExpanders(){
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  if (btnExpandAll) btnExpandAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(false); setAllSeriesCollapsed(false);
    render(onAfterCardHook);
    renderStatsTab();
  });
  if (btnCollapseAll) btnCollapseAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(true); setAllSeriesCollapsed(true);
    render(onAfterCardHook);
    renderStatsTab();
  });

  // Stats page buttons
  const btnStatsExpandAll = document.getElementById('btnStatsExpandAll');
  const btnStatsCollapseAll = document.getElementById('btnStatsCollapseAll');
  if (btnStatsExpandAll) btnStatsExpandAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(false);
    render(onAfterCardHook);
    renderStatsTab();
  });
  if (btnStatsCollapseAll) btnStatsCollapseAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(true);
    render(onAfterCardHook);
    renderStatsTab();
  });
}

function saveFilterState(){
  try {
    const state = {
      search: document.getElementById('search')?.value ?? '',
      filterSaga: document.getElementById('filterSaga')?.value ?? '',
      filterSeries: document.getElementById('filterSeries')?.value ?? '',
      filterStatus: document.getElementById('filterStatus')?.value ?? 'all',
    };
    sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(state));
  } catch { /* sessionStorage unavailable */ }
}

function restoreFilterState(){
  try {
    const raw = sessionStorage.getItem(FILTER_SESSION_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const search = document.getElementById('search');
    const filterSaga = document.getElementById('filterSaga');
    const filterSeries = document.getElementById('filterSeries');
    const filterStatus = document.getElementById('filterStatus');
    if (search && state.search) search.value = state.search;
    if (filterSaga && state.filterSaga) filterSaga.value = state.filterSaga;
    if (filterSeries && state.filterSeries) filterSeries.value = state.filterSeries;
    if (filterStatus && state.filterStatus) filterStatus.value = state.filterStatus;
  } catch { /* ignore corrupt session state */ }
}

function wireFilters(){
  const ids = ['search','filterSaga','filterSeries','filterStatus'];
  const onChange = ()=>{
    saveFilterState();
    render(onAfterCardHook);
    renderStatsTab();
    renderAchievementsTab();
  };
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', onChange);
    el.addEventListener('change', onChange);
  });
}

function onAfterCardHook(kind, id, checked){
  const set = (kind === 'own') ? owned : read;
  if (checked) set.add(id); else set.delete(id);
  saveJSON(kind === 'own' ? LS_KEYS.OWNED : LS_KEYS.READ, [...set]);

  // Preserve scroll position to avoid jumpiness on mobile
  const y = window.scrollY;
  render(onAfterCardHook);
  window.scrollTo(0, y);

  renderStatsTab();
  renderAchievementsTab();
}

document.addEventListener('DOMContentLoaded', () => {
  ensureDefaultCollapsedForCurrentBooks();

  wireTabs();
  wireGlobalExpanders();

  renderFiltersOptions();
  restoreFilterState();
  wireFilters();

  render(onAfterCardHook);
  renderStatsTab();
  renderAchievementsTab();

  // Settings (import/export/reset)
  initSettings({
    onDataChanged: () => { renderFiltersOptions(); render(onAfterCardHook); renderStatsTab(); renderAchievementsTab(); }
  });
});
