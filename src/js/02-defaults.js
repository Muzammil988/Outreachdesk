/* ================= Constants & defaults ================= */
const ACCOUNT = {
  free: { label: 'Free', note: 200 },
  premium: { label: 'Premium', note: 300 },
  salesnav: { label: 'Sales Navigator', note: 300 },
};
const TONES = { friendly: 'friendly and plain', professional: 'professional and concise', direct: 'direct and brief' };
const AI_TIERS = { quick: 'Fast', default: 'Balanced', complex: 'Best' };

const STAGES = [
  { id: 'new', label: 'New', tone: 'grey' },
  { id: 'queued', label: 'Invite queued', tone: 'sky' },
  { id: 'invited', label: 'Invited', tone: 'teal' },
  { id: 'connected', label: 'Connected', tone: 'mint' },
  { id: 'messaged', label: 'Messaged', tone: 'mint' },
  { id: 'replied', label: 'Replied', tone: 'coral' },
  { id: 'meeting', label: 'Meeting', tone: 'lilac' },
  { id: 'won', label: 'Won', tone: 'mint' },
  { id: 'lost', label: 'Not interested', tone: 'grey' },
  { id: 'nurture', label: 'Nurture', tone: 'butter' },
];
const GROUP_TONE = { priority: 'coral', people: 'lilac', review: 'butter', thanks: 'mint', job: 'sky', pitch: 'grey', fyi: 'grey' };
const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const STAGE_TS = { queued: 'queued', invited: 'invited', connected: 'connected', messaged: 'welcomed', replied: 'replied', meeting: 'meeting', won: 'closed', lost: 'closed', nurture: 'nurtured' };

const CATS = {
  warm: { label: 'Warm lead', group: 'priority', pr: 1 },
  meeting: { label: 'Meeting request', group: 'priority', pr: 1 },
  lead: { label: 'Possible lead', group: 'priority', pr: 1 },
  network: { label: 'Networking', group: 'people', pr: 2 },
  partner: { label: 'Partnership', group: 'people', pr: 2 },
  personal: { label: 'Personal', group: 'people', pr: 2 },
  declined: { label: 'Said no before', group: 'people', pr: 2 },
  review: { label: 'Needs a look', group: 'review', pr: 2 },
  congrats: { label: 'Congrats', group: 'thanks', pr: 3 },
  job: { label: 'Job seeker', group: 'job', pr: 3 },
  pitch: { label: 'Sales pitch', group: 'pitch', pr: 3 },
  event: { label: 'Event invite', group: 'pitch', pr: 3 },
  content: { label: 'Shared content', group: 'fyi', pr: 3 },
  thanks: { label: 'Short reply', group: 'fyi', pr: 3 },
  info: { label: 'FYI', group: 'fyi', pr: 3 },
  sponsored: { label: 'Sponsored', group: 'fyi', pr: 3 },
};
const HOT_CATS = ['warm', 'meeting', 'lead'];
const INBOX_FILTERS = [
  { id: 'reply', label: 'Needs a reply' },
  { id: 'priority', label: 'Leads' },
  { id: 'people', label: 'People' },
  { id: 'review', label: 'Needs a look' },
  { id: 'thanks', label: 'Congrats' },
  { id: 'job', label: 'Job seekers' },
  { id: 'pitch', label: 'Pitches & events' },
  { id: 'fyi', label: 'No reply needed' },
  { id: 'waiting', label: 'Waiting on them' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

const NOTE_STYLES = {
  peer: { label: 'Peer to peer', prompt: 'Connect as a fellow operator in their world. Mention their role or company and a shared interest in how small firms run.' },
  specific: { label: 'Specific detail', prompt: 'Open with one concrete detail from their title, company, location or profile notes, then say why you want to connect.' },
  question: { label: 'Light question', prompt: 'Ask one easy, relevant question they could answer in a line. Never ask for a meeting.' },
  short: { label: 'Ultra short', prompt: 'Under 110 characters in total. Greeting, one reason, done.' },
  value: { label: 'Give first', prompt: 'Offer one small, useful idea relevant to their business (no link, no pitch), then connect.' },
};

const MSG_KINDS = {
  invite: 'Connection note', welcome: 'Welcome message', fu1: 'Follow-up', fu2: 'Final follow-up',
  reconnect: 'Reconnect message', inmail: 'InMail', nudge: 'Nudge',
};
const TPL_TYPES = [
  ['invite', 'Connection note'], ['welcome', 'Welcome after accept'], ['fu1', 'Follow-up 1'], ['fu2', 'Final follow-up'],
  ['reconnect', 'Reconnect (existing connection)'], ['inmail', 'InMail'], ['nudge', 'Nudge (no answer yet)'],
  ['reply:warm', 'Reply · warm lead'], ['reply:meeting', 'Reply · meeting request'], ['reply:lead', 'Reply · possible lead'],
  ['reply:network', 'Reply · networking'], ['reply:partner', 'Reply · partnership'], ['reply:personal', 'Reply · personal'],
  ['reply:declined', 'Reply · said no before'], ['reply:review', 'Reply · unclear message'], ['reply:congrats', 'Reply · congrats'],
  ['reply:job', 'Reply · job seeker'], ['reply:pitch', 'Reply · sales pitch'], ['reply:event', 'Reply · event invite'],
  ['reply:content', 'Reply · shared content'], ['reply:thanks', 'Reply · short reply'],
];
const TPL_VARS = ['first', 'name', 'title', 'company', 'industry', 'city', 'my_first', 'my_company', 'offer', 'cta', 'calendar', 'careers', 'sorry'];

const DEFAULT_TEMPLATES = [
  { id: 't-inv-1', type: 'invite', name: 'Fellow operator', body: 'Hi {first}, I connect with {industry} owners who run lean teams[[, and {company} stood out]]. Always good to know people building in this space. Happy to connect. {my_first}' },
  { id: 't-inv-2', type: 'invite', name: 'Role first', body: "Hi {first}[[, as {title} at {company}]] you probably wear a few hats at once. I'm connecting with {industry} leaders to learn how small teams run. Glad to connect. {my_first}" },
  { id: 't-inv-3', type: 'invite', name: 'Short', body: "Hi {first}, I'm growing my network of {industry} founders[[ and {company} caught my eye]]. Would be great to connect. {my_first}" },
  { id: 't-wel-1', type: 'welcome', name: 'Thanks + question', body: 'Thanks for connecting, {first}! Quick question: what takes up most of your week[[ at {company}]] right now: new leads, listings, or keeping the team in sync?' },
  { id: 't-wel-2', type: 'welcome', name: 'Curious peer', body: "Thanks for accepting, {first}. I'm always curious how {industry} teams handle follow-up when things get busy. What has worked best for you[[ at {company}]]?" },
  { id: 't-fu1-1', type: 'fu1', name: 'Value nudge', body: 'Hi {first}, a pattern I keep seeing with small {industry} teams: good leads go cold because follow-up depends on one busy person.[[ {offer}]] Would {cta} be useful to compare notes?[[ Here is my calendar: {calendar}]]' },
  { id: 't-fu2-1', type: 'fu2', name: 'Polite close', body: "Hi {first}, I'll leave it here so I don't crowd your inbox. If lead follow-up becomes a priority[[ at {company}]], I'm one message away. All the best!" },
  { id: 't-rec-1', type: 'reconnect', name: 'It has been a while', body: "Hi {first}, it's been a while since we connected here. I've been spending time with {industry} teams lately and thought of you[[ at {company}]]. How are things going on your side?" },
  { id: 't-inm-1', type: 'inmail', name: 'Short InMail', body: "Subject: Quick question about {company}\n\nHi {first},\n\nI work with small {industry} teams on [the problem you solve].[[ {offer}]]\n\nIs this on your list at {company} this quarter? If useful, happy to share what has worked for similar firms over {cta}.\n\nBest,\n{my_first}" },
  { id: 't-ndg-1', type: 'nudge', name: 'Bump', body: 'Hi {first}, bumping this in case it got buried.[[ Happy to find a time here: {calendar}|| Does [day, time] work for you?]]' },
  { id: 't-r-warm', type: 'reply:warm', name: 'Move to a call', body: 'Hi {first}, thanks for getting back to me.[[ {sorry}]] Happy to explain what we do[[: {offer}]]. Would {cta} this week work?[[ You can pick a time here: {calendar}]]' },
  { id: 't-r-meet', type: 'reply:meeting', name: 'Find a time', body: 'Hi {first}, thanks for following up.[[ {sorry}]] Happy to find a time. What would you like to cover?[[ You can grab any slot here: {calendar}|| Does [day, time] work for you?]]' },
  { id: 't-r-lead', type: 'reply:lead', name: 'Qualify', body: "Hi {first}, thanks for reaching out.[[ {sorry}]] To point you the right way: what's the main thing you're trying to solve right now? Happy to set up {cta}." },
  { id: 't-r-net', type: 'reply:network', name: 'Friendly', body: 'Hi {first}, thanks for the note, and good to connect![[ {sorry}]] What are you focused on these days?' },
  { id: 't-r-part', type: 'reply:partner', name: 'Ask for specifics', body: 'Hi {first}, thanks for thinking of us.[[ {sorry}]] Could you share a bit more about what the partnership would look like and who it has worked for? Then I can tell if it fits.' },
  { id: 't-r-pers', type: 'reply:personal', name: 'Catch up', body: 'Hey {first}! Doing well, thanks.[[ {sorry}]] How have you been?' },
  { id: 't-r-decl', type: 'reply:declined', name: 'New budget check-in', body: "Hi {first}, hope the year is going well. Last time the timing wasn't right on budget. Has anything changed on your side for the coming quarter?" },
  { id: 't-r-rev', type: 'reply:review', name: 'Ask for more', body: 'Hi {first}, thanks for your message.[[ {sorry}]] Could you tell me a bit more about what you had in mind?' },
  { id: 't-r-cg1', type: 'reply:congrats', name: 'Thanks 1', body: 'Thanks a lot, {first}! Really appreciate you remembering.' },
  { id: 't-r-cg2', type: 'reply:congrats', name: 'Thanks 2', body: 'Thank you, {first}! Means a lot. Hope things are going well on your side.' },
  { id: 't-r-cg3', type: 'reply:congrats', name: 'Thanks 3', body: 'Appreciate it, {first}! Hope all is well with you.' },
  { id: 't-r-job', type: 'reply:job', name: 'Kind no', body: "Hi {first}, thanks for your interest in {my_company}.[[ {sorry}]] We don't have a matching opening right now[[, but please send your CV to {careers} so the team has it||, but I'll keep your profile in mind]]. Best of luck!" },
  { id: 't-r-pitch', type: 'reply:pitch', name: 'Polite no', body: "Hi {first}, thanks for reaching out. We're all set on this for now, but I appreciate you thinking of us. All the best!" },
  { id: 't-r-event', type: 'reply:event', name: 'Decline', body: "Thanks for the invite, {first}! I can't make this one, but please keep me in mind for future sessions." },
  { id: 't-r-cont', type: 'reply:content', name: 'Thanks for sharing', body: 'Thanks for sharing, {first}! Appreciate you thinking of me.' },
  { id: 't-r-thx', type: 'reply:thanks', name: 'Short', body: 'Anytime, {first}!' },
];

function guessTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
function newProfile(over = {}) {
  return Object.assign({
    id: uid('p-'), name: '', first: '', title: '', company: '', url: '', accountType: 'premium',
    offer: '', audience: '', proof: '', cta: 'a quick 15-minute call', calendar: '', careers: '',
    tone: 'friendly', language: 'English',
    limits: { day: 20, week: 100, workdays: [1, 2, 3, 4, 5], time: '15:00', tz: guessTz() },
    cadence: { fu1: 4, fu2: 7, nurture: 14, withdraw: 21, waiting: 3 },
    checks: [
      { id: uid('c-'), label: 'Focused inbox', note: 'Unread messages', url: 'https://www.linkedin.com/messaging/', until: '', doneOn: '' },
      { id: uid('c-'), label: 'Sales Navigator inbox', note: 'InMail replies', url: 'https://www.linkedin.com/sales/inbox', until: '', doneOn: '' },
    ],
    createdAt: nowISO(),
  }, over);
}
function newMeta(profile) {
  const p = profile || newProfile();
  return { v: 1, active: p.id, profiles: [p], icps: [], templates: null, ai: { tier: 'default', ab: false, style: 'peer' }, createdAt: nowISO() };
}
function newIcp(profileId, over = {}) {
  return Object.assign({
    id: uid('icp-'), profileId, name: 'New segment', industries: [], sizes: ['1-10', '11-50'], titles: [], excludes: ['intern', 'student', 'assistant', 'recruiter'],
    locations: [], pains: '', value: '', cta: '', style: 'peer', notes: '', createdAt: nowISO(),
  }, over);
}
const SIZE_BANDS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];
function migrateMeta(m) {
  if (!m || typeof m !== 'object') return m;
  m.profiles = Array.isArray(m.profiles) ? m.profiles : [];
  m.profiles = m.profiles.map((p) => {
    const base = newProfile({ id: p.id });
    const out = Object.assign(base, p);
    out.limits = Object.assign(base.limits, p.limits || {});
    out.cadence = Object.assign(base.cadence, p.cadence || {});
    out.checks = Array.isArray(p.checks) ? p.checks : base.checks;
    return out;
  });
  m.icps = Array.isArray(m.icps) ? m.icps.map((i) => Object.assign(newIcp(i.profileId), i)) : [];
  m.ai = Object.assign({ tier: 'default', ab: false, style: 'peer' }, m.ai || {});
  if (!m.active || !m.profiles.some((p) => p.id === m.active)) m.active = m.profiles[0]?.id || '';
  return m;
}
function normLead(l) {
  const base = {
    id: uid('l-'), profileId: '', icpId: '', name: '', first: '', title: '', company: '', companySize: '', industry: '', location: '',
    url: '', email: '', about: '', notes: '', tags: [], source: 'manual', stage: 'new', style: '', existing: false,
    drafts: {}, t: {}, snoozeUntil: '', skipUntil: '', convoId: '', inviteStyle: '', inviteNote: '',
  };
  const out = Object.assign(base, l || {});
  out.drafts = Object.assign({}, out.drafts || {});
  out.t = Object.assign({}, out.t || {});
  out.tags = Array.isArray(out.tags) ? out.tags : splitList(out.tags);
  if (!out.t.added) out.t.added = nowISO();
  if (!STAGE[out.stage]) out.stage = 'new';
  return out;
}
function normConvo(c) {
  const base = {
    id: uid('cv-'), profileId: '', name: '', company: '', headline: '', url: '', thread: '', category: 'review', priority: 0,
    status: 'open', lastAt: '', lastFrom: 'them', msgCount: 1, preview: '', messages: [], partial: true, inmail: false,
    draft: '', draftNote: '', notes: '', snoozeUntil: '', followUpAt: '', sent: [], leadId: '', source: 'manual', updatedAt: '',
  };
  const out = Object.assign(base, c || {});
  if (!CATS[out.category]) out.category = 'review';
  out.messages = Array.isArray(out.messages) ? out.messages.slice(-30) : [];
  out.sent = Array.isArray(out.sent) ? out.sent.slice(-20) : [];
  return out;
}
