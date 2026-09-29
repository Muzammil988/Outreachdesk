/* ================= Templates ================= */
function sampleCtxLead() {
  const l = S.leads().find((x) => x.stage === 'queued') || S.leads()[0];
  return l || { id: 'sample', name: 'Sample Person', first: 'Alex', title: 'Owner', company: 'Sample Realty', industry: '', location: 'Austin, TX' };
}
function ensureOwnTemplates() {
  if (!Array.isArray(S.meta.templates) || !S.meta.templates.length) S.meta.templates = clone(DEFAULT_TEMPLATES);
  return S.meta.templates;
}
VIEW_FN.templates = function () {
  if (!S.meta) return VIEW_FN.today();
  const type = ui.tplType;
  const list = templates().filter((t) => t.type === type);
  const lim = type === 'invite' ? noteLimit() : type === 'inmail' ? 1900 : 8000;
  const lead = sampleCtxLead();
  const ctx = tplCtx(lead, { sorry: 'Sorry for the slow reply.' });
  const groups = [['Outreach', TPL_TYPES.filter(([k]) => !k.startsWith('reply:'))], ['Replies', TPL_TYPES.filter(([k]) => k.startsWith('reply:'))]];
  const nav = groups.map(([g, items]) => `<div class="stack" style="gap:6px"><span class="lbl">${g}</span><div class="chips">${items.map(([k, v]) => `<button class="chip" data-act="tpl-type" data-type="${k}" aria-pressed="${type === k}">${esc(v.replace('Reply · ', '').replace(/^./, (c) => c.toUpperCase()))} <span class="n">${templates().filter((t) => t.type === k).length}</span></button>`).join('')}</div></div>`).join('');
  const cards = list.map((t) => {
    const preview = fillTpl(t.body, ctx);
    return `<article class="panel template-card">
      <div class="row"><label class="sr-only" for="tn-${t.id}">Template name</label><input class="input" id="tn-${t.id}" data-input="tpl-field" data-field="name" data-id="${t.id}" value="${esc(t.name)}" style="max-width:320px">
        <label class="toggle" for="ta-${t.id}"><input type="checkbox" id="ta-${t.id}" data-change="tpl-active" data-id="${t.id}" ${t.active !== false ? 'checked' : ''}> In rotation</label>
        <span class="spacer"></span><button class="btn btn-sm btn-ghost btn-danger" data-act="tpl-delete" data-id="${t.id}" aria-label="Delete template">${ic('trash')}</button></div>
      <div class="composer"><label class="sr-only" for="tb-${t.id}">Template text</label><textarea id="tb-${t.id}" data-input="tpl-field" data-field="body" data-id="${t.id}" style="min-height:96px">${esc(t.body)}</textarea>
        <div class="composer-bar"><span class="hint">Preview length</span>${countHtml('tp-' + t.id, preview.length, lim)}</div></div>
      <div class="callout" style="display:grid;gap:4px"><span class="hint">Preview with ${esc(lead.id === 'sample' ? 'sample values' : cleanName(lead.name))}</span><span id="tp-${t.id}" style="white-space:pre-wrap">${esc(preview)}</span></div>
    </article>`;
  }).join('');
  return `${pageHead('Templates', 'Message <em>templates</em>', 'Used when AI drafting is off, or when you pick “Template”. Several templates of one type take turns, so messages don\'t all read the same.', `${Array.isArray(S.meta.templates) && S.meta.templates.length ? `<button class="btn btn-ghost" data-act="tpl-reset">${ic('refresh')} Restore defaults</button>` : ''}<button class="btn btn-send" data-act="tpl-add" data-type="${type}">${ic('plus')} Add template</button>`)}
  <div class="panel pad stack" style="margin-bottom:16px">${nav}</div>
  <div class="callout" style="margin-bottom:16px;display:grid;gap:8px"><span><b>Variables:</b> click to copy. Wrap optional parts in <code class="mono">[[ ]]</code> so they drop out when a value is missing, and give a fallback after <code class="mono">||</code>.</span>
    <div class="vars">${TPL_VARS.map((v) => `<button class="kbd" style="cursor:pointer" data-act="copy" data-text="{${v}}">{${v}}</button>`).join('')}</div></div>
  <div class="stack">${cards || emptyHtml('No templates of this type', 'Add one to use it for drafts.', `<button class="btn" data-act="tpl-add" data-type="${type}">${ic('plus')} Add template</button>`)}</div>`;
};
