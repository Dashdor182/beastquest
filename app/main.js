// app/main.js
import { LS_KEYS, saveJSON, owned, read, ensureDefaultCollapsedForCurrentBooks } from './state.js';
import { render, renderFiltersOptions, setAllSagasCollapsed, setAllSeriesCollapsed } from './ui.js';
import { renderStatsTab } from './stats.js';
import { renderAchievementsTab } from './achievements.js';
import { initSettings } from './settings.js';

const FILTER_SESSION_KEY = 'bq:filters';

function setTab(targetSel) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const target = document.querySelector(targetSel);
  if (!target) return;
  target.classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(b => {
    const on = b.getAttribute('data-target') === targetSel;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.classList.toggle('active', on);
  });

  if (targetSel === '#tab-achievements') renderAchievementsTab();
}

function wireTabs() {
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.addEventListener('click', () => setTab(b.getAttribute('data-target')));
  });
}

function wireGlobalExpanders() {
  document.getElementById('btnExpandAll')?.addEventListener('click', () => {
    setAllSagasCollapsed(false); setAllSeriesCollapsed(false);
    render(onAfterCardHook); renderStatsTab();
  });
  document.getElementById('btnCollapseAll')?.addEventListener('click', () => {
    setAllSagasCollapsed(true); setAllSeriesCollapsed(true);
    render(onAfterCardHook); renderStatsTab();
  });
  document.getElementById('btnStatsExpandAll')?.addEventListener('click', () => {
    setAllSagasCollapsed(false);
    render(onAfterCardHook); renderStatsTab();
  });
  document.getElementById('btnStatsCollapseAll')?.addEventListener('click', () => {
    setAllSagasCollapsed(true);
    render(onAfterCardHook); renderStatsTab();
  });
}

function saveFilterState() {
  try {
    const state = {
      search:       document.getElementById('search')?.value ?? '',
      filterSaga:   document.getElementById('filterSaga')?.value ?? '',
      filterSeries: document.getElementById('filterSeries')?.value ?? '',
      filterStatus: document.getElementById('filterStatus')?.value ?? 'all',
    };
    sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(state));
  } catch { /* unavailable */ }
}

function restoreFilterState() {
  try {
    const raw = sessionStorage.getItem(FILTER_SESSION_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const el = id => document.getElementById(id);
    if (el('search')       && state.search)       el('search').value       = state.search;
    if (el('filterSaga')   && state.filterSaga)   el('filterSaga').value   = state.filterSaga;
    if (el('filterSeries') && state.filterSeries) el('filterSeries').value = state.filterSeries;
    if (el('filterStatus') && state.filterStatus) el('filterStatus').value = state.filterStatus;
  } catch { /* ignore */ }
}

function wireFilters() {
  const ids = ['search', 'filterSaga', 'filterSeries', 'filterStatus'];
  const onChange = () => {
    saveFilterState();
    render(onAfterCardHook);
    renderStatsTab();
    renderAchievementsTab();
  };
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', onChange);
    el.addEventListener('change', onChange);
  });
}

function onAfterCardHook(kind, id, checked) {
  const set = (kind === 'own') ? owned : read;
  if (checked) set.add(id); else set.delete(id);
  saveJSON(kind === 'own' ? LS_KEYS.OWNED : LS_KEYS.READ, [...set]);

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

  initSettings({
    onDataChanged: () => {
      renderFiltersOptions();
      render(onAfterCardHook);
      renderStatsTab();
      renderAchievementsTab();
    }
  });
});
