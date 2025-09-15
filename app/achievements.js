import { books, owned, read } from './state.js';
import { escapeHtml } from './ui.js';

const PALETTE = {
  chip:  '#4c546d',
  read:  '#a58d89',
  own:   '#b59e90'
};
const THRESHOLDS = [5, 10, 25, 50, 100, 200, 'All'];

export function renderAchievementsTab(){
  const grid = document.getElementById('achGrid');
  if (!grid) return;

  const total = books.length;
  const readCount = read.size;
  const ownedCount = owned.size;

  const items = [];
  for (const t of THRESHOLDS){
    items.push({ id:`read-${t}`, type:'read', label:`Read: ${t}`, threshold: t==='All' ? total : t, current: readCount });
  }
  for (const t of THRESHOLDS){
    items.push({ id:`own-${t}`, type:'own', label:`Owned: ${t}`, threshold: t==='All' ? total : t, current: ownedCount });
  }
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
  const number = (item.threshold === Infinity) ? 'All' : String(item.label.endsWith(': All') ? 'All' : item.threshold);
  const imgSrc = badgeDataUrl({ type:item.type, number, achieved });
  const sub = achieved
    ? '<span class="badge">Unlocked</span>'
    : `<span class="muted text-xs">${Math.min(item.current, item.threshold)}/${item.threshold}</span>`;
  const lockedStyle = achieved ? '' : 'filter: grayscale(1) opacity(.7);';

  return `
    <div class="panel rounded-xl border brand-border p-3 text-center flex flex-col items-center gap-2">
      <img src="${imgSrc}" width="96" height="96" alt="${escapeHtml(item.label)} badge" style="${lockedStyle}" />
      <div class="text-sm font-semibold">${escapeHtml(item.label)}</div>
      ${sub}
    </div>
  `;
}

function badgeDataUrl({ type, number, achieved }){
  const color = type === 'read' ? PALETTE.read : PALETTE.own;
  const ring  = achieved ? color : PALETTE.chip;
  const txt   = achieved ? '#1b1c26' : '#cfd3df';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${ring}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${ring}" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <circle cx="48" cy="48" r="44" fill="url(#g)"/>
  <circle cx="48" cy="48" r="42" fill="none" stroke="${achieved ? '#e8e9ee' : '#3a415a'}" stroke-opacity="${achieved?'.25':'.35'}" stroke-width="2"/>
  ${type === 'read'
    ? `<path d="M20 34c0-3 2-5 5-5h23c3 0 5 2 5 5v33c0 3-2 5-5 5H25c-3 0-5-2-5-5V34z" fill="#ffffff22"/>
       <path d="M43 32l3-3h18c2 0 4 2 4 4v33c0 3-2 5-5 5H49c-3 0-5-2-5-5V32z" fill="#ffffff33"/>`
    : `<path d="M24 61l8-27h32l8 27H24z" fill="#ffffff22"/>
       <path d="M32 34l-8 27h4l6-21h20l6 21h4l-8-27H32z" fill="#ffffff33"/>`}
  <text x="50%" y="56%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif"
        font-size="${String(number).length > 3 ? 18 : 22}" font-weight="800" fill="${txt}">
    ${number}
  </text>
  <text x="50%" y="72%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif"
        font-size="10" font-weight="600" fill="${txt}" opacity=".9">
    ${type === 'read' ? 'READ' : 'OWNED'}
  </text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
