// app/stats.js
import {
  books, owned, read,
  collapsedSagas, saveJSON, LS_KEYS
} from './state.js';
import { elStatTotal, elStatOwned, elStatRead, elStatPct, escapeHtml } from './ui.js';

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

function inferSeriesOrder(saga) {
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
    const orderMap = inferSeriesOrder(sagaName);
    const bySeries = aggregateBy(b => b.saga === sagaName ? (b.series || 'Unknown') : null);
    bySeries.delete(null);

    const isCollapsed = collapsedSagas.has(sagaName);
    const bodyId = 'sb-' + btoa(unescape(encodeURIComponent(String(sagaName)))).replace(/[^a-z0-9]/gi, '');

    const card = document.createElement('div');
    card.className = 'breakdown-card';

    const head = document.createElement('div');
    head.className = 'breakdown-card-head';
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', String(!isCollapsed));
    head.setAttribute('aria-controls', bodyId);
    head.dataset.sagaToggle = sagaName;

    head.innerHTML = `
      <span class="breakdown-card-name">${escapeHtml(sagaName)}</span>
      <div class="breakdown-chips">
        <span class="saga-chip saga-chip--gold">🛡 ${mSaga.owned}/${mSaga.total}</span>
        <span class="saga-chip saga-chip--red">⚔ ${mSaga.read}/${mSaga.total}</span>
      </div>
    `;

    const body = document.createElement('div');
    body.id = bodyId;
    body.className = 'breakdown-card-body' + (isCollapsed ? ' breakdown-card-body--hidden' : '');

    const seriesEntries = [...bySeries.entries()].sort((a, b) => {
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
        <div class="breakdown-sparkbars">
          <div class="sparkbar"><div class="sparkbar-fill bar-fill--red"  style="width:${pctR}%"></div></div>
          <div class="sparkbar"><div class="sparkbar-fill bar-fill--gold" style="width:${pctO}%"></div></div>
        </div>
        <span class="breakdown-series-name">${escapeHtml(seriesName)}</span>
        <span class="breakdown-series-counts">⚔ ${m.read}/${m.total} · 🛡 ${m.owned}/${m.total}</span>
      `;
      body.appendChild(row);
    }

    const toggle = () => {
      const nowHidden = body.classList.toggle('breakdown-card-body--hidden');
      head.setAttribute('aria-expanded', String(!nowHidden));
      if (nowHidden) collapsedSagas.add(sagaName); else collapsedSagas.delete(sagaName);
      saveJSON(LS_KEYS.COLLAPSED_SAGAS, [...collapsedSagas]);
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    card.appendChild(head);
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

  const ringFill = document.getElementById('statRingFill');
  if (ringFill) {
    requestAnimationFrame(() => {
      ringFill.style.strokeDashoffset = String(Math.round(314 * (1 - pct / 100)));
    });
  }

  const motEl = document.getElementById('statMotivation');
  if (motEl) motEl.textContent = motivationText(pct, readCount);

  const bd = document.getElementById('sagaBreakdown');
  if (bd) renderSagaBreakdown(bd);
}
