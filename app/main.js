// app/main.js
import {
  LS_KEYS, saveJSON, owned, read
} from './state.js';

import {
  render, renderFiltersOptions
} from './ui.js';

import { renderStatsTab } from './stats.js';
import { renderAchievementsTab } from './achievements.js';

// Tabs
function setTab(targetSel){
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('block');
  });
  const target = document.querySelector(targetSel);
  if (!target) return;
  target.classList.remove('hidden');
  target.classList.add('block');

  document.querySelectorAll('.tab-btn').forEach(b=>{
    const on = b.getAttribute('data-target')===targetSel;
    b.setAttribute('aria-selected', on ? 'true':'false');
    b.classList.toggle('active', on);
    b.classList.toggle('inactive', !on);
  });

  // Lazy refresh Achievements when tab is shown
  if (targetSel === '#tab-achievements') {
    renderAchievementsTab();
  }
}

function wireTabs(){
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=> setTab(b.getAttribute('data-target')));
  });
}

// Global expand/collapse controls (Overview + Stats)
function wireGlobalExpanders(){
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  if (btnExpandAll) btnExpandAll.addEventListener('click', ()=> {
    const ev = new CustomEvent('bq:expandAll', { detail: { scope: 'all' }});
    document.dispatchEvent(ev);
  });
  if (btnCollapseAll) btnCollapseAll.addEventListener('click', ()=> {
    const ev = new CustomEvent('bq:collapseAll', { detail: { scope: 'all' }});
    document.dispatchEvent(ev);
  });

  const btnStatsExpandAll = document.getElementById('btnStatsExpandAll');
  const btnStatsCollapseAll = document.getElementById('btnStatsCollapseAll');
  if (btnStatsExpandAll) btnStatsExpandAll.addEventListener('click', ()=> {
    const ev = new CustomEvent('bq:expandAll', { detail: { scope: 'sagasOnly' }});
    document.dispatchEvent(ev);
  });
  if (btnStatsCollapseAll) btnStatsCollapseAll.addEventListener('click', ()=> {
    const ev = new CustomEvent('bq:collapseAll', { detail: { scope: 'sagasOnly' }});
    document.dispatchEvent(ev);
  });
}

// Hook invoked by UI on checkbox toggle
function onAfterCardHook(kind, id, checked){
  const set = (kind === 'own') ? owned : read;
  if (checked) set.add(id); else set.delete(id);
  saveJSON(kind === 'own' ? LS_KEYS.OWNED : LS_KEYS.READ, [...set]);

  // Refresh dependent views
  renderStatsTab();
  renderAchievementsTab();
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  wireTabs();
  wireGlobalExpanders();

  renderFiltersOptions();
  render(onAfterCardHook);
  renderStatsTab();
  renderAchievementsT
