/* ================= AI drafting (sample capability) =================
   Every draft is shown for review. Nothing is ever sent from here. */
const AI = {
  fn: null, state: 'checking', // checking | ready | off | denied
  get on() { return this.state === 'ready'; },
  async init() {
    this.fn = await capUse('sample');
    this.state = this.fn ? 'ready' : 'off';
    render();
  },
  opts(extra = {}) {
    const o = { modelTier: extra.tier || S.meta?.ai?.tier || 'default' };
    if (extra.signal) o.signal = extra.signal;
    if (extra.onText) o.onText = extra.onText;
    if (extra.fresh) o.cache = false;
    return o;
  },
  async json(prompt, extra) {
    if (!this.fn) throw { code: 'off', message: 'AI unavailable' };
    try { return await this.fn.json(prompt, this.opts(extra)); } catch (e) { this.fail(e); throw e; }
  },
  async text(prompt, extra) {
    if (!this.fn) throw { code: 'off', message: 'AI unavailable' };
    try { const r = await this.fn(prompt, this.opts(extra)); return String(r.text || '').trim(); } catch (e) { this.fail(e); throw e; }
  },
  fail(e) {
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) { this.state = 'denied'; render(); }
  },
};
function aiErrorText(e) {
  switch (e?.code) {
    case 'cancelled': return '';
    case 'off': case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed':
      return 'AI drafting is off for this page, so templates are used instead.';
    case 'rate_limited': return 'Claude is busy or your usage limit is reached. Try again in a minute.';
    case 'session_expired': return 'Sign in to Claude again, then retry.';
    case 'refused': return 'Claude declined this one. Change the input and try again.';
    case 'prompt_too_large': return 'Too much text at once. Draft fewer items at a time.';
    case 'invalid_json': case 'empty_completion': return 'The draft came back incomplete. Try again, or draft fewer at once.';
    default: return 'Drafting failed because of a connection problem. Try again.';
  }
}
const stripQuotes = (s) => String(s || '').trim().replace(/^["“](.*)["”]$/s, '$1').trim();
function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') { const arr = Object.values(x).find(Array.isArray); if (arr) return arr; }
  return [];
}

/* ---------- Prompt blocks ---------- */
function senderBlock() {
  const p = P();
  return [
    'SENDER',
    `Name: ${p.name || 'the sender'}${myFirst() ? ` (goes by ${myFirst()})` : ''}`,
    p.title ? `Role: ${p.title}` : '',
    p.company ? `Company: ${p.company}` : '',
    `What they offer: ${p.offer ? p.offer : 'not specified. Do not describe, invent or pitch any offer.'}`,
    p.audience ? `Who they help: ${p.audience}` : '',
    p.proof ? `Proof points they may mention (only these): ${p.proof}` : 'Proof points: none given. Never invent clients, numbers or results.',
    `Preferred call to action: ${p.cta || 'a quick 15-minute call'}`,
    safeHttp(p.calendar) ? `Calendar link: ${p.calendar}` : 'Calendar link: none. If a time is needed, write [propose two times].',
    p.careers ? `Careers contact for job seekers: ${p.careers}` : '',
    `Tone: ${TONES[p.tone] || TONES.friendly}. Language: ${p.language || 'English'}.`,
  ].filter(Boolean).join('\n');
}
function icpBlock(icp) {
  if (!icp) return '';
  return [
    `TARGET SEGMENT: ${icp.name}`,
    icp.industries?.length ? `Industries: ${icp.industries.join(', ')}` : '',
    icp.sizes?.length ? `Company size: ${icp.sizes.join(', ')} employees` : '',
    icp.titles?.length ? `Roles: ${icp.titles.join(', ')}` : '',
    icp.pains ? `Common problems for them: ${icp.pains}` : '',
    icp.value ? `How the sender helps them: ${icp.value}` : '',
  ].filter(Boolean).join('\n');
}
function personData(l) {
  return {
    id: l.id, name: cleanName(l.name), first_name: l.first || firstName(l.name), title: l.title || '', company: l.company || '',
    industry: l.industry || '', location: l.location || '', company_size: l.companySize || '',
    profile_notes: trunc(l.about || '', 700), sender_notes: trunc(l.notes || '', 300),
  };
}

function promptInvites(items, limit) {
  const target = limit <= 200 ? '110 to 180' : '140 to 240';
  const people = items.map(({ lead, style }) => ({ ...personData(lead), style }));
  return `You write LinkedIn connection-request notes that people accept.

${senderBlock()}

${icpBlock(icpFor(items[0].lead))}

STYLES
${Object.entries(NOTE_STYLES).map(([k, v]) => `- ${k}: ${v.prompt}`).join('\n')}

RULES
- Hard limit: ${limit} characters per note, counting spaces. Aim for ${target}.
- Start with "Hi <first_name>,". Write each note in the style given for that person.
- Use only facts in the person's data. Never invent mutual connections, events, posts, numbers or compliments.
- No pitch, no links, no emojis, no hashtags. Avoid "I came across your profile", "pick your brain", "synergy", and meeting requests.
- Plain, warm and specific. One or two short sentences, then an easy reason to connect.
- You may end with the sender's first name on its own.

PEOPLE (JSON)
${JSON.stringify(people)}

Reply with only a JSON array with one object per person, in the same order: [{"id": "...", "note": "..."}]`;
}

const MSG_SPECS = {
  welcome: 'They just accepted the connection request. Thank them in a few words, then ask one easy question about their business that fits their role. No pitch. At most 400 characters.',
  reconnect: 'They are an existing connection the sender has not talked to in a while. Reconnect warmly, mention something relevant to their role or company, and ask one easy question. No pitch. At most 400 characters.',
  fu1: 'They accepted and got a welcome message some days ago but have not replied. Add value: one specific observation about a common problem for firms like theirs, then (only if an offer is given) one line on how the sender helps, then a soft ask using the preferred call to action. At most 500 characters.',
  fu2: 'Final follow-up after no reply. Respectful, easy to say no to, leaves the door open. At most 300 characters.',
  nudge: 'The sender replied in an ongoing conversation and the other person went quiet. Write a short, friendly bump that restates the one open question. At most 250 characters.',
};
function promptMessages(kind, leads) {
  const people = leads.map((l) => ({
    ...personData(l), days_since_last_touch: Math.floor(daysSince(l.t.fu1 || l.t.welcomed || l.t.connected || l.t.invited) || 0),
    invite_note_sent: l.inviteNote || '', welcome_sent: kind === 'welcome' ? '' : (l.drafts.welcomeSent || ''),
  }));
  return `You write LinkedIn direct messages for a busy founder. The sender reviews and sends each one by hand.

${senderBlock()}

${icpBlock(icpFor(leads[0]))}

TASK
${MSG_SPECS[kind] || MSG_SPECS.welcome}

RULES
- Only use facts from the data. Put anything the sender must fill in inside [brackets].
- Sound like a person: short sentences, no buzzwords, no emojis, no "I hope this finds you well".
- Start with "Hi <first_name>," (a welcome may start with "Thanks for connecting, <first_name>").

PEOPLE (JSON)
${JSON.stringify(people)}

Reply with only a JSON array: [{"id": "...", "text": "..."}]`;
}

const REPLY_GOALS = {
  warm: 'They engaged with the sender\'s outreach. Answer their question simply and move toward a short call.',
  meeting: 'They asked for a meeting. If it is unclear who they are or what they want, ask what they would like to cover; otherwise offer times or the calendar link.',
  lead: 'Possible opportunity. Show interest, ask one qualifying question, offer a short call.',
  network: 'Genuine networking. Reply warmly and specifically; suggest a light next step only if natural.',
  partner: 'Partnership proposal. Ask for specifics (what, for whom, results) before committing, or decline politely if clearly irrelevant.',
  personal: 'Personal message from someone the sender knows. Warm, personal, short.',
  declined: 'They declined earlier for budget or timing reasons. It has been a while: a light check-in asking whether priorities changed. Not pushy.',
  review: 'Only part of the message is known. Write a neutral, friendly reply that invites them to share more.',
  congrats: 'They congratulated the sender (work anniversary or new role). A short, warm thank-you. Vary the wording.',
  job: 'Job seeker or freelancer. Kind reply; promise nothing; if a careers contact is given, point them to it.',
  pitch: 'Unsolicited sales pitch. A brief, polite no-thanks.',
  event: 'Event or community invite. Polite decline unless clearly relevant; if the date has passed, a short thanks.',
  content: 'They shared content. A brief, genuine thanks.',
  thanks: 'A short acknowledgement. If replying at all, one friendly line.',
  info: 'An informational update. A short acknowledgement.',
  sponsored: 'A sponsored message. A one-line polite decline.',
};
function threadText(c) {
  if (c.messages?.length) return c.messages.slice(-12).map((m) => `${m.me ? 'SENDER' : 'THEM'}${m.at ? ` (${fmtDate(m.at, true)})` : ''}: ${trunc(m.text, 1500)}`).join('\n');
  return `THEM (preview only): ${c.preview}`;
}
function promptReplies(convos) {
  const items = convos.map((c) => ({
    id: c.id, their_name: cleanName(c.name), their_first_name: firstName(c.name), their_company: c.company || '',
    category: CATS[c.category]?.label || 'Unknown', goal: REPLY_GOALS[c.category] || REPLY_GOALS.review,
    days_since_last_message: Math.floor(daysSince(c.lastAt) || 0), only_preview_available: !!c.partial && !c.messages?.length,
    thread: threadText(c), sender_notes: trunc(c.notes || '', 300),
  }));
  return `You draft replies to LinkedIn messages for the sender below. The sender reviews every draft and sends it by hand.

${senderBlock()}

RULES
- Follow each conversation's goal.
- If days_since_last_message is over 21, start with a short, natural apology for the slow reply (one clause, no grovelling).
- If only a preview is available, keep the reply general and safe. Don't pretend to know details you can't see.
- 1 to 4 short sentences. Plain and human. No emojis unless they used them. Reply in their language.
- Never invent facts, prices, availability, clients or promises. Put anything the sender must fill in inside [brackets].
- Address them by first name.

CONVERSATIONS (JSON)
${JSON.stringify(items)}

Reply with only a JSON array: [{"id": "...", "reply": "...", "note": "one short line on the approach"}]`;
}
function promptClassify(convos) {
  const items = convos.map((c) => ({ id: c.id, from: cleanName(c.name), thread: trunc(threadText(c), 1800) }));
  return `Classify each LinkedIn conversation for the sender below.

${senderBlock()}

CATEGORIES
warm (replied to the sender's own outreach with interest or a question), meeting (asks to schedule a call), lead (a potential customer or opportunity), network (genuine networking), partner (partnership proposal), personal (a friend or acquaintance), declined (said no or not now), congrats (anniversary, new role or birthday wishes), job (job seeker or freelancer looking for work), pitch (selling something to the sender), event (event, webinar or community invite), content (shared an article or post), thanks (short acknowledgement like "thanks"), info (FYI update), sponsored (an ad), review (can't tell).

Priority: 1 = reply today, 2 = this week, 3 = optional.

CONVERSATIONS (JSON)
${JSON.stringify(items)}

Reply with only a JSON array: [{"id": "...", "category": "...", "priority": 1, "summary": "under 90 characters"}]`;
}
function promptRewrite(text, instruction, kind, limit, who) {
  return `Rewrite this LinkedIn ${kind} following the instruction. Keep the facts; add no new claims. ${limit ? `Hard limit: ${limit} characters.` : ''}

${senderBlock()}

Instruction: ${instruction}
${who ? `Recipient: ${who}` : ''}

Text:
"""${text}"""

Reply with only the rewritten text.`;
}
function promptParseLeads(text) {
  return `Extract the people from this text. It may be a copied list, spreadsheet rows, event attendees or a profile.
For each person return name, title, company, location, url (a linkedin.com URL if present), industry and company_size (as written). Use "" when unknown. Don't invent anything. Skip anything that isn't a person.

TEXT
"""${trunc(text, 60000)}"""

Reply with only a JSON array: [{"name": "", "title": "", "company": "", "location": "", "url": "", "industry": "", "company_size": ""}]`;
}
