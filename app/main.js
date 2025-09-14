import { ensureDefaultCollapsedForCurrentBooks } from './state.js';
import { render, renderFiltersOptions } from './ui.js';
import { renderStatsTab } from './stats.js';
import { wireControls } from './controls.js';
import { initTabs } from './tabs.js';

function wireFilters() {
  const elSearch = document.getElementById('search');
  const elSaga   = document.getElementById('filterSaga');
  const elSeries = document.getElementById('filterSeries');
  const elStatus = document.getElementById('filterStatus');
  const rerender = () => { render(handleCardToggle); renderStatsTab(); };
  for (const el of [elSearch, elSaga, elSeries, elStatus]){
    el.addEventListener('input', rerender);
    el.addEventListener('change', rerender);
  }
}

let handleCardToggle = null;

window.addEventListener('DOMContentLoaded', () => {
  ensureDefaultCollapsedForCurrentBooks();
  const controls = wireControls(); // returns handleCardToggle
  handleCardToggle = controls.handleCardToggle;
  renderFiltersOptions();
  render(handleCardToggle);
  renderStatsTab();
  wireFilters();
  initTabs();
});
