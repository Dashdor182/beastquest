// app/main.js
import { LS_KEYS, saveJSON, owned, read } from './state.js';
import { render, renderFiltersOptions, setAllSagasCollapsed, setAllSeriesCollapsed } from './ui.js';
import { renderStatsTab } from './stats.js';
import { renderAchievementsTab } from './achievements.js';
import { initSettings } from './settings.js';

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
  });
  if (btnCollapseAll) btnCollapseAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(true); setAllSeriesCollapsed(true);
    render(onAfterCardHook);
  });

  const btnStatsExpandAll = document.getElementById('btnStatsExpandAll');
  const btnStatsCollapseAll = document.getElementById('btnStatsCollapseAll');
  if (btnStatsExpandAll) btnStatsExpandAll.addEventListener('click', ()=>{
    setAllSagasCollapsed(false);
    re
