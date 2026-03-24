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
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    const on = b.getAttribute('data-target') === targetSel;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.classList.toggle('active', on);
  });

  if (targetSel === '#tab-trophies') renderAchievementsTab();
}

function wireTabs() {
  document.querySelectorAll('.nav-btn').forEach(b => {
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
    setAllSagasCollapsed(false); render(onAfterCardHook); renderStatsTab();
  });
  document.getElementById('btnStatsCollapseAll')?.addEventListener('click', () => {
    setAllSagasCollapsed(true); render(onAfterCardHook); renderStatsTab();
  });
}

function saveFilterState() {
  try {
    sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify({
      search:       document.getElementById('search')?.value ?? '',
      filterSaga:   document.getElementById('filterSaga')?.value ?? '',
      filterSeries: document.getElementById('filterSeries')?.value ?? '',
      filterStatus: document.getElementById('filterStatus')?.value ?? 'all',
    }));
  } catch { /* unavailable */ }
}

function restoreFilterState() {
  try {
    const raw = sessionStorage.getItem(FILTER_SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const q = id => document.getElementById(id);
    if (q('search')       && s.search)       q('search').value       = s.search;
    if (q('filterSaga')   && s.filterSaga)   q('filterSaga').value   = s.filterSaga;
    if (q('filterSeries') && s.filterSeries) q('filterSeries').value = s.filterSeries;
    if (q('filterStatus') && s.filterStatus) q('filterStatus').value = s.filterStatus;
  } catch { /* ignore */ }
}

function wireFilters() {
  const onChange = () => {
    saveFilterState();
    render(onAfterCardHook);
    renderStatsTab();
    renderAchievementsTab();
  };
  ['search', 'filterSaga', 'filterSeries', 'filterStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  onChange);
    el.addEventListener('change', onChange);
  });
}

function onAfterCardHook(kind, id, checked) {
  const set = kind === 'own' ? owned : read;
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
