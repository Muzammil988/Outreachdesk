/* ================= Boot ================= */
function start(hot) {
  const saved = hot && hot.ui;
  if (saved && typeof saved === 'object') for (const k of ['view', 'inboxF', 'sel', 'invCur', 'settingsTab', 'writeTab', 'tplType', 'days', 'icpSel']) if (saved[k] !== undefined) ui[k] = saved[k];
  const v = location.hash.slice(1); if (VIEWS[v]) ui.view = v;
  applyTheme();
  try { window.claude?.hot?.snapshot?.(() => ({ ui: { view: ui.view, inboxF: ui.inboxF, sel: ui.sel, invCur: ui.invCur, settingsTab: ui.settingsTab, writeTab: ui.writeTab, tplType: ui.tplType, days: ui.days, icpSel: ui.icpSel } })); } catch { /* optional */ }
  renderNow();
  AI.init();
  initStore().catch((e) => { console.error(e); S.adapter = MemoryAdapter(); S.mode = 'memory'; S.ready = true; bump(); });
  setInterval(() => { if (document.visibilityState === 'visible' && ui.view === 'today' && !ui.modal && !ui.drawer) render(); }, 60000);
}
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
