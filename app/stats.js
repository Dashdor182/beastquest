// app/stats.js
import {
  books, owned, read,
  collapsedSagas, saveJSON, LS_KEYS
} from './state.js';
import { elStatTotal, elStatOwned, elStatRead, elStatPct, escapeHtml } from './ui.js';

/* Animate a number element from current to target */
function animateCount(el, to) {
  if (!el) return;
  const from = parseInt(el.textContent) || 0;
  if (from === to) { el.textContent = String(to); return; }
  const duration = 420;
  const start = performance.now();
  const step = now => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(from + (to - from) * ease));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function motivationText(pct, readCount) {
  if (pct === 100) return '🏆 All beasts vanquished! You\'re a legend!';
  if (pct >= 75)   return `🔥 So close! Only ${100 - pct}% left!`;
  if (pct >= 50)   return `⚡ Over halfway there — keep going!`;
  if (pct >= 25)   return `💪 Great progress, adventurer!`;
  if (readCount > 0) return `🗡️ Every beast read is a victory!`;
  return `🐉 Your quest begins… read your first beast!`;
}

function aggregateBy(keyFn) {
  const map = new Map();
  for (const b of books) {
    const key = keyFn(b);
    if (!map.has(key)) map.set(key, { total: 0, owned: 0, read: 0 });
    const m = map.get(key);
    m.total++;
    if (owned.has(b.id)) m.owned++;
    if (read.has(b.id))  m.read++;
  }
  return map;
}

function inferSeriesOrderMapForSaga(saga) {
  const order = new Map();
  for (const b of books.filter(x => x.saga === saga)) {
    const name = b.series || 'Unknown';
    const m = String(b.id || '').match(/S(\d+)/i);
    const v = m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    order.set(name, Math.min(order.get(name) ?? v, v));
  }
  return order;
}

function renderSagaBreakdown(container) {
  const bySaga = aggregateBy(b => b.saga || 'Unknown');
  const sagasSorted = [...bySaga.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  container.innerHTML = '';

  for (const [sagaName, mSaga] of sagasSorted) {
    const pctRead = mSaga.total ? Math.round((mSaga.read  / mSaga.total) * 100) : 0;
    const pctOwn  = mSaga.total ? Math.round((mSaga.owned / mSaga.total) * 100) : 0;

    const orderMap = inferSeriesOrderMapForSaga(sagaName);
    const bySeries = aggregateBy(b => (b.saga === sagaName ? (b.series || 'Unknown') : null));
    bySeries.delete(null);

    const isCollapsed = collapsedSagas.has(sagaName);
    const bodyId = 'sbody-' + btoa(unescape(encodeURIComponent(String(sagaName)))).replace(/[^a-z0-9]/gi, '');

    /* Saga card */
    const card = document.createElement('div');
    card.className = 'breakdown-saga';

    /* Header */
    const hdr = document.createElement('div');
    hdr.className = 'breakdown-saga-header';
    hdr.setAttribute('role', 'button');
    hdr.setAttribute('tabindex', '0');
    hdr.setAttribute('aria-expanded', String(!isCollapsed));
    hdr.setAttribute('aria-controls', bodyId);
    hdr.dataset.sagaToggle = sagaName;

    hdr.innerHTML = `
      <span class="breakdown-saga-title">⚔ ${escapeHtml(sagaName)}</span>
      <div class="breakdown-saga-chips">
        <span class="saga-chip saga-chip--gold">🛡 ${mSaga.owned}/${mSaga.total}</span>
        <span class="saga-chip saga-chip--crimson">⚔ ${mSaga.read}/${mSaga.total}</span>
      </div>
    `;

    /* Body */
    const body = document.createElement('div');
    body.id = bodyId;
    body.className = 'breakdown-saga-body' + (isCollapsed ? ' breakdown-saga-body--hidden' : '');

    /* Series rows */
    const seriesEntries = [...bySeries.entries()]
      .sort((a, b) => {
        const oa = orderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
        const ob = orderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
        return oa !== ob ? oa - ob : a[0].localeCompare(b[0]);
      });

    for (const [seriesName, m] of seriesEntries) {
      const pctR = m.total ? Math.round((m.read  / m.total) * 100) : 0;
      const pctO = m.total ? Math.round((m.owned / m.total) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'breakdown-series-row';
      row.innerHTML = `
        <div class="breakdown-series-bars">
          <div class="breakdown-series-bar">
            <div class="breakdown-series-bar-fill quest-bar-fill--crimson" style="width:${pctR}%" title="Read ${pctR}%"></div>
          </div>
          <div class="breakdown-series-bar">
            <div class="breakdown-series-bar-fill quest-bar-fill--gold" style="width:${pctO}%" title="Got ${pctO}%"></div>
          </div>
        </div>
        <span class="breakdown-series-name">${escapeHtml(seriesName)}</span>
        <span class="breakdown-series-counts">⚔ ${m.read}/${m.total} · 🛡 ${m.owned}/${m.total}</span>
      `;
      body.appendChild(row);
    }

    if (!seriesEntries.length) {
      body.innerHTML = '<div style="color:var(--ink3);font-size:0.82rem;padding:6px 4px;">No series data.</div>';
    }

    /* Toggle */
    const toggle = () => {
      const nowHidden = body.classList.toggle('breakdown-saga-body--hidden');
      hdr.setAttribute('aria-expanded', String(!nowHidden));
      if (nowHidden) collapsedSagas.add(sagaName); else collapsedSagas.delete(sagaName);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    };
    hdr.addEventListener('click', toggle);
    hdr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    card.appendChild(hdr);
    card.appendChild(body);
    container.appendChild(card);
  }
}

export function renderStatsTab() {
  const total = books.length;
  let ownedCount = 0, readCount = 0;
  for (const b of books) {
    if (owned.has(b.id)) ownedCount++;
    if (read.has(b.id))  readCount++;
  }
  const pct = total ? Math.round((readCount / total) * 100) : 0;

  animateCount(elStatTotal(), total);
  animateCount(elStatOwned(), ownedCount);
  animateCount(elStatRead(),  readCount);

  const pctEl = elStatPct();
  if (pctEl) pctEl.textContent = pct + '%';

  /* Animate circular ring (circumference of r=50 ≈ 314) */
  const ringFill = document.getElementById('statRingFill');
  if (ringFill) {
    requestAnimationFrame(() => {
      ringFill.style.strokeDashoffset = String(Math.round(314 * (1 - pct / 100)));
    });
  }

  const motEl = document.getElementById('statMotivation');
  if (motEl) motEl.textContent = motivationText(pct, readCount);

  const breakdown = document.getElementById('sagaBreakdown');
  if (breakdown) renderSagaBreakdown(breakdown);
}
