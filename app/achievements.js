// app/achievements.js
import { books, owned, read } from './state.js';
import { escapeHtml } from './ui.js';

const PALETTE = {
  bg:    '#181923',
  panel: '#292d41',
  chip:  '#4c546d',
  read:  '#a58d89',   // accent2
  own:   '#b59e90'    // accent
};

const THRESHOLDS = [5, 10, 25, 50, 100, 200, 'All'];

export function renderAchievementsTab(){
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  const total = books.length;
  const readCount = read.size;
  const ownedCount = owned.size;

  const items = [];

  // Read achievements
  for (const t of THRESHOLDS){
    const threshold = (t === 'All') ? total : t;
    items.push({
      id: `read-${t}`,
      type: 'read',
      label: `Read: ${t}`,
      threshold,
      current: readCount
    });
  }
  // Owned achievements
  for (const t of THRESHOLDS){
    const threshold = (t === 'All') ? total : t;
    items.push({
      id: `own-${t}`,
      type: 'own',
      label: `Owned: ${t}`,
      threshold,
      current: ownedCount
    });
  }

  // Sort by type group (Read first), then by threshold numeric asc with All last
  items.sort((a,b)=>{
    if (a.type !== b.type) return a.type === 'read' ? -1 : 1;
    const av = (a.threshold === total) ? Number.MAX_SAFE_INTEGER : a.threshold;
    const bv = (b.threshold === total) ? Number.MAX_SAFE_INTEGER : b.threshold;
    return av - bv;
  });

  grid.innerHTML = items.map(it => renderTile(it)).join('');
}

function renderTile(item){
  const achieved = item.current >= item.threshold && item.threshold > 0;
  const numberText = (item.threshold === Infinity) ? 'All' : String(item.threshold);
  const isAll = !Number.isFinite(item.threshold) || item.label.includes(': All');

  const imgSrc = makeBadgeDataUrl({
    type: item.type,
    number: (item.threshold === Infinity) ? 'All' :
            (item.label.endsWith(': All') ? 'All' : String(item.threshold)),
    achieved
  });

  const sub = achieved
    ? '<span class="badge" style="background: color-mix(in oklab, var(--accent) 25%, white);">Unlocked</span>'
    : `<span class="muted text-xs">${Math.min(item.current, item.threshold)}/${item.threshold === Infinity ? 'All' : item.threshold}</span>`;

  const lockedStyle = achieved ? '' : 'filter: grayscale(1) opacity(.7);';

  return `
    <div class="panel rounded-xl border brand-border p-3 text-center flex flex-col items-center gap-2">
      <img src="${imgSrc}" width="96" height="96" alt="${escapeHtml(item.label)} badge" style="${lockedStyle}" />
      <div class="text-sm font-semibold">${escapeHtml(item.label)}</div>
      ${sub}
    </div>
  `;
}

function makeBadgeDataUrl({ type, number, achieved }){
  const color = type === 'read' ? PALETTE.read : PALETTE.own;
  const ring  = achieved ? color : PALETTE.chip;
  const txt   = achieved ? '#1b1c26' : '#cfd3df';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
