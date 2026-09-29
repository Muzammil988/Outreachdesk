/* ================= Write: posts, comments, InMail, profile ================= */
const ANGLES = { lessons: 'Lessons learned', story: 'Short story', myth: 'Myth vs. reality', howto: 'How-to steps', question: 'Question to your audience' };
const LENGTHS = { short: 'Short (about 600 characters)', medium: 'Medium (about 1,200)', long: 'Long (about 2,000)' };
const FRAMEWORKS = [
  ['Lessons learned', 'Hook: one surprising result or mistake.\nThree short lessons, one line each.\nWhat you would do differently.\nQuestion: “What would you add?”'],
  ['Myth vs. reality', 'Myth: a belief common in your audience.\nReality: what you have actually seen.\nOne example.\nTakeaway in one sentence.'],
  ['How-to', 'Promise: “How we cut X in half.”\n3 to 5 numbered steps.\nOne warning.\nInvite people to ask for details.'],
];
function promptPost(w, icp) {
  return `Write a LinkedIn post for the sender below.

${senderBlock()}

${icpBlock(icp)}

Topic: ${w.topic || 'something useful for the target segment'}
Angle: ${ANGLES[w.angle] || ANGLES.lessons}
Length: ${LENGTHS[w.length] || LENGTHS.medium}

RULES
- First line is a hook under 140 characters that makes the target reader stop scrolling.
- Short paragraphs of 1 or 2 lines. Plain words, first person, specific.
- Don't invent statistics, clients or results. Mark anything the sender must fill in with [brackets].
- No hashtag spam: at most 3 relevant hashtags at the very end. At most 1 emoji, or none.
- End with a question that invites comments. No links.

Reply with only the post text.`;
}
function promptPostIdeas(icp) {
  return `Suggest 8 LinkedIn post topics the sender below could write to attract the target segment. Mix practical tips, common mistakes, behind-the-scenes and opinions. Each topic under 90 characters.

${senderBlock()}

${icpBlock(icp)}

Reply with only a JSON array of 8 strings.`;
}
function promptComments(post) {
  return `Suggest 3 different comments the sender could leave on this LinkedIn post. Each is 1 to 3 sentences, specific to the post, adds a perspective, experience or a real question. No generic praise, no pitch, no links, no emojis.

${senderBlock()}

POST
"""${trunc(post, 6000)}"""

Reply with only a JSON array of 3 strings.`;
}
function promptInMail(lead) {
  return `Write a LinkedIn InMail from the sender to this person. They are not connected yet.

${senderBlock()}

${icpBlock(icpFor(lead))}

PERSON (JSON)
${JSON.stringify(personData(lead))}

RULES
- Subject: under 60 characters, specific, no clickbait.
- Body: 350 to 700 characters. Open with something relevant to them (only facts from the data), one line on why you're writing, one easy question as the call to action.
- No invented facts, statistics or clients. Mark anything to fill in with [brackets]. No emojis.

Reply with only JSON: {"subject": "", "body": ""}`;
}
function promptProfile(headline, about, icp) {
  return `Review this LinkedIn profile for the sender below, whose goal is to attract the target segment.

${senderBlock()}

${icpBlock(icp)}

Current headline: """${headline}"""
Current About section: """${trunc(about, 3000)}"""

Return:
- headlines: 3 alternative headlines, each under 220 characters, clear about who they help and how
- about: a rewritten About section under 2,000 characters, first person, scannable, ending with a simple call to action; keep only facts present above and mark gaps with [brackets]
- fixes: 5 short, specific improvements

Reply with only JSON: {"headlines": [], "about": "", "fixes": []}`;
}
VIEW_FN.write = function () {
  if (!S.meta) return VIEW_FN.today();
  const w = ui.write; const icp = icps()[0];
  const tabs = [['post', 'Post'], ['comment', 'Comment'], ['inmail', 'InMail'], ['profile', 'Profile']]
    .map(([k, v]) => `<button class="tab" role="tab" data-act="write-tab" data-tab="${k}" aria-selected="${ui.writeTab === k}">${v}</button>`).join('');
  let body = '';
  if (ui.writeTab === 'post') {
    body = `<div class="grid2" style="align-items:start">
      <section class="panel pad stack">
        <div class="field"><label for="w-topic">Topic</label><input class="input" id="w-topic" data-input="write" data-k="topic" value="${esc(w.topic)}" placeholder="Example: why small agencies lose leads after 5 PM"></div>
        <div class="grid2">
          <div class="field"><label for="w-angle">Angle</label>${selectHtml('w-angle', 'data-change="write" data-k="angle"', ANGLES, w.angle)}</div>
          <div class="field"><label for="w-length">Length</label>${selectHtml('w-length', 'data-change="write" data-k="length"', LENGTHS, w.length)}</div>
        </div>
        ${busyHtml('post')}
        ${AI.on ? `<div class="row"><button class="btn btn-send" data-act="ai-post" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Draft post</button><button class="btn" data-act="ai-ideas" ${ui.busy ? 'disabled' : ''}>Suggest topics</button></div>` : aiStatusLine()}
        ${w.ideas.length ? `<div class="stack" style="gap:6px"><span class="lbl">Topic ideas</span>${w.ideas.map((t, i) => `<button class="btn btn-ghost btn-sm" style="justify-content:flex-start;white-space:normal;text-align:left;height:auto;padding:6px 9px" data-act="use-idea" data-i="${i}">${esc(t)}</button>`).join('')}</div>` : ''}
        ${!AI.on ? `<div class="stack" style="gap:8px"><span class="lbl">Frameworks</span>${FRAMEWORKS.map(([n, t]) => `<div class="callout" style="display:grid;gap:4px"><b>${esc(n)}</b><span style="white-space:pre-wrap">${esc(t)}</span></div>`).join('')}</div>` : ''}
      </section>
      <section class="panel pad stack">
        <div class="composer"><label class="sr-only" for="w-post">Post</label><textarea id="w-post" data-input="write" data-k="post" style="min-height:300px" placeholder="Your post appears here. Edit freely.">${esc(w.post)}</textarea>
          <div class="composer-bar">${w.post && AI.on ? `<button class="btn btn-sm btn-ghost" data-act="ai-rewrite-post" data-how="shorter" ${ui.busy ? 'disabled' : ''}>Shorter</button><button class="btn btn-sm btn-ghost" data-act="ai-rewrite-post" data-how="hook" ${ui.busy ? 'disabled' : ''}>Stronger hook</button>` : ''}${countHtml('w-post', w.post.length, 3000)}</div></div>
        <div class="row">${sendLink(LI.post, 'copy-open', 'w-post', 'Copy & open LinkedIn', !w.post.trim())}<span class="hint">LinkedIn opens its post box. Paste, review, post.</span></div>
      </section></div>`;
  } else if (ui.writeTab === 'comment') {
    body = `<div class="grid2" style="align-items:start">
      <section class="panel pad stack">
        <div class="field"><label for="w-postin">Paste the post you want to comment on</label><textarea class="textarea" id="w-postin" data-input="write" data-k="postIn" style="min-height:220px">${esc(w.postIn)}</textarea></div>
        ${busyHtml('comment')}
        ${AI.on ? `<div class="row"><button class="btn btn-send" data-act="ai-comments" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Suggest 3 comments</button></div>` : aiStatusLine()}
        <p class="hint">Commenting on a prospect's posts a few days before you invite them makes your name familiar.</p>
      </section>
      <section class="stack">${w.comments.length ? w.comments.map((t, i) => `<div class="panel pad stack" style="gap:8px"><div style="white-space:pre-wrap">${esc(t)}</div><div class="row"><button class="btn btn-sm" data-act="copy" data-text="${esc(t)}">${ic('copy')} Copy</button></div></div>`).join('')
        : emptyHtml('Comment ideas appear here', 'Good comments add a perspective or ask a real question. Write your own, or get three starting points.')}</section></div>`;
  } else if (ui.writeTab === 'inmail') {
    const cands = S.leads().filter((l) => ['new', 'queued', 'invited'].includes(l.stage)).sort((a, b) => (scoreLead(b).score ?? 0) - (scoreLead(a).score ?? 0)).slice(0, 200);
    const lead = S.lead(w.inmailLead);
    body = `<div class="grid2" style="align-items:start">
      <section class="panel pad stack">
        <div class="field"><label for="w-inlead">Who is it for?</label><select class="select" id="w-inlead" data-change="write" data-k="inmailLead"><option value="">Pick a lead…</option>${cands.map((l) => `<option value="${l.id}" ${l.id === w.inmailLead ? 'selected' : ''}>${esc(cleanName(l.name))}${l.company ? ' · ' + esc(l.company) : ''}</option>`).join('')}</select><span class="hint">InMail reaches people you are not connected to. It uses Sales Navigator or Premium credits.</span></div>
        ${busyHtml('inmail')}
        <div class="row">${AI.on ? `<button class="btn btn-send" data-act="ai-inmail" ${!lead || ui.busy ? 'disabled' : ''}>${ic('sparkle')} Draft InMail</button>` : ''}<button class="btn" data-act="tpl-inmail" ${lead ? '' : 'disabled'}>Use template</button></div>
      </section>
      <section class="panel pad stack">
        <div class="field"><label for="w-subj">Subject</label><input class="input" id="w-subj" data-input="write" data-k="inmailSubject" value="${esc(w.inmailSubject)}">${countHtml('w-subj', w.inmailSubject.length, 200)}</div>
        <div class="composer"><label class="sr-only" for="w-body">InMail message</label><textarea id="w-body" data-input="write" data-k="inmailBody" style="min-height:220px">${esc(w.inmailBody)}</textarea><div class="composer-bar">${countHtml('w-body', w.inmailBody.length, 1900)}</div></div>
        <div class="row"><button class="btn btn-sm" data-act="copy-field" data-src="w-subj">${ic('copy')} Copy subject</button>${lead ? sendLink(leadLink(lead).href, 'copy-open', 'w-body', 'Copy message & open profile', !w.inmailBody.trim()) : ''}</div>
      </section></div>`;
  } else {
    const pr = w.prof;
    body = `<div class="grid2" style="align-items:start">
      <section class="panel pad stack">
        <div class="field"><label for="w-headline">Your current headline</label><input class="input" id="w-headline" data-input="write" data-k="headline" value="${esc(w.headline)}">${countHtml('w-headline', w.headline.length, 220)}</div>
        <div class="field"><label for="w-about">Your About section</label><textarea class="textarea" id="w-about" data-input="write" data-k="about" style="min-height:220px">${esc(w.about)}</textarea>${countHtml('w-about', w.about.length, 2600)}</div>
        ${busyHtml('profile')}
        ${AI.on ? `<div class="row"><button class="btn btn-send" data-act="ai-profile" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Review my profile</button></div>` : aiStatusLine()}
        <p class="hint">People check your profile before accepting. A clear headline that names who you help raises acceptance.</p>
      </section>
      <section class="stack">${pr ? `
        <div class="panel pad stack" style="gap:8px"><span class="lbl">Headline options</span>${(pr.headlines || []).map((h) => `<div class="callout" style="justify-content:space-between"><span>${esc(h)}</span><button class="btn btn-sm btn-ghost" data-act="copy" data-text="${esc(h)}">${ic('copy')}</button></div>`).join('')}</div>
        ${pr.about ? `<div class="panel pad stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="lbl">About section</span><button class="btn btn-sm" data-act="copy" data-text="${esc(pr.about)}">${ic('copy')} Copy</button></div><div style="white-space:pre-wrap">${esc(pr.about)}</div></div>` : ''}
        ${(pr.fixes || []).length ? `<div class="panel pad stack" style="gap:8px"><span class="lbl">Quick fixes</span><ul class="steps">${pr.fixes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}`
        : emptyHtml('Suggestions appear here', 'Paste your headline and About section, then get three headline options, a tighter About section and five quick fixes.')}</section></div>`;
  }
  return `${pageHead('Write', 'Posts, comments and <em>InMail</em>', 'Drafts to review and post yourself. Being visible on LinkedIn makes cold invites warmer.')}
  <div class="tabs" role="tablist">${tabs}</div>${body}`;
};
