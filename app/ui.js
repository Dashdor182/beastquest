// UI helpers
import { collapsedSagas, collapsedSeries, saveJSON, LS_KEYS } from './state.js';

// … existing exports from your file (render, renderFiltersOptions, etc.) remain unchanged …
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
}

/* ---------- Achievement toast ---------- */

let toastRoot = null;
function getToastRoot(){
  if (toastRoot) return toastRoot;
  const root = document.createElement('div');
  root.id = 'toast-root';
  root.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 px-2';
  root.setAttribute('role','status');
  root.setAttribute('aria-live','polite');
  document.body.appendChild(root);
  toastRoot = root;
  return root;
}

/**
 * Show a small toast for a newly unlocked achievement.
 * @param {Object} p
 * @param {string} p.label - Achievement label to show
 * @param {string} p.slug  - Asset slug (e.g., "read-25")
 * @param {string} [p.ext] - Defaults to ".png"
 */
export function showAchievementToast({ label, slug, ext = '.png' }){
  const root = getToastRoot();
  const wrap = document.createElement('div');
  wrap.className = 'panel rounded-xl border brand-border shadow-lg p-3 flex items-center gap-3';
  wrap.style.opacity = '0';
  wrap.style.transform = 'translateY(8px)';

  const img = document.createElement('img');
  img.src = `./assets/achievements/${slug}${ext}`;
  img.width = 32; img.height = 32;
  img.className = 'w-8 h-8 rounded';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';

  const text = document.createElement('div');
  text.className = 'text-sm';
  text.innerHTML = `
    <div class="font-semibold">Achievement unlocked!</div>
    <div class="muted text-xs">${escapeHtml(label)}</div>
  `;

  wrap.appendChild(img);
  wrap.appendChild(text);
  root.appendChild(wrap);

  // Animate in
  requestAnimationFrame(()=>{
    wrap.style.transition = 'opacity .2s ease, transform .2s ease';
    wrap.style.opacity = '1';
    wrap.style.transform = 'translateY(0)';
  });

  // Auto-dismiss
  setTimeout(()=>{
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(8px)';
    setTimeout(()=> wrap.remove(), 220);
  }, 3200);
}

/* ---------- (keep the rest of your ui.js as-is) ---------- */

// NOTE: Ensure you still export the functions/components used elsewhere:
// - render, renderFiltersOptions, setAllSagasCollapsed, setAllSeriesCollapsed
// - elStatTotal, elStatOwned, elStatRead, elStatPct, elStatBar
// If they were in this file originally, keep them unchanged.
