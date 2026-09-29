/* ================= Lead qualification =================
   The AI only reads facts off each search-result card. These rules decide,
   so the same person always gets the same answer, with a reason. */
const US_STATES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey',
  NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};
const US_METROS = ['bay area', 'new york city', 'nyc', 'los angeles', 'chicagoland', 'dallas fort worth', 'dfw', 'greater houston', 'greater boston', 'greater seattle', 'greater phoenix', 'miami fort lauderdale', 'twin cities', 'silicon valley', 'washington dc', 'baltimore', 'atlanta', 'denver', 'austin', 'san diego', 'tampa', 'orlando', 'nashville', 'charlotte', 'las vegas', 'philadelphia', 'detroit'];
const US_TARGET = /^(usa?|united states( of america)?|america)$/i;
const icpWantsUS = (icp) => (icp?.locations || []).some((l) => US_TARGET.test(String(l).trim()));
/* true = in the USA, false = clearly elsewhere, null = can't tell */
function isUS(loc) {
  const raw = String(loc || '').trim(); if (!raw) return null;
  const n = norm(raw);
  if (/\b(united states|usa|u s a)\b/.test(n)) return true;
  if (/\b(pakistan|india|canada|united kingdom|england|uk|uae|united arab emirates|dubai|australia|germany|france|spain|mexico|brazil|nigeria|philippines|saudi|qatar|ireland|south africa|singapore|netherlands|italy|turkey|egypt|kenya|bangladesh|sri lanka|new zealand)\b/.test(n)) return false;
  if (Object.values(US_STATES).some((s) => hasPhrase(n, s))) return true;
  const ab = raw.match(/,\s*([A-Z]{2})\b/); if (ab && US_STATES[ab[1]]) return true;
  if (US_METROS.some((m) => hasPhrase(n, m))) return true;
  return null;
}
const BIG_BRANDS = ['keller williams', 'kw', 're max', 'remax', 'coldwell banker', 'century 21', 'exp realty', 'compass', 'sothebys', 'sotheby s international realty', 'berkshire hathaway', 'bhhs', 'better homes and gardens', 'era real estate', 'redfin', 'zillow', 'realty one group', 'real brokerage', 'fathom realty', 'howard hanna', 'douglas elliman', 'engel volkers', 'weichert', 'united real estate', 'lpt realty', 'epique realty', 'corcoran'];
function bigBrand(company, brandHint) {
  const n = norm([brandHint, company].join(' '));
  return BIG_BRANDS.find((b) => b.length > 3 ? hasPhrase(n, b) : hasPhrase(norm(brandHint || ''), b)) || '';
}
const TIER_OK = ['brokerage', 'property_management', 'developer', 'commercial', 'team'];
const MIN_PRIORITY = 35;

/* Account health: LinkedIn restricts accounts whose invites mostly go unanswered. */
function acceptHealth() {
  return derived('acceptHealth', () => {
    const cutoff = Date.now() - 7 * DAY;
    const sent = S.leads().filter((l) => !l.existing && l.t.invited && new Date(l.t.invited).getTime() < cutoff)
      .sort((a, b) => String(b.t.invited).localeCompare(String(a.t.invited))).slice(0, 50);
    const acc = sent.filter((l) => l.t.connected || ['connected', 'messaged', 'replied', 'meeting', 'won'].includes(l.stage)).length;
    const n = sent.length; const rate = n ? acc / n : null;
    return { n, acc, rate, strict: n >= 30 && rate < 0.25, low: n >= 30 && rate < 0.35 };
  });
}

/* f: facts from the AI (or from keywords when AI is off). ctx: { icp, dup, inbox, health } */
function qualify(f, ctx) {
  const icp = ctx.icp; const why = []; let pri = 0;
  const out = (reason, verdict = 'skip') => ({ verdict, reason, tier: '', pri: 0, why });
  if (ctx.dup) return out(`Already in your leads (${STAGE[ctx.dup.stage]?.label || ctx.dup.stage})`);
  if (ctx.inbox) return out('You already have a conversation');
  if (f.pending) return out('Invite already pending');
  if (f.open_to_work) return out('Open to work, so between businesses');
  const title = norm(f.title);
  const skip = (icp?.excludes || []).find((x) => hasPhrase(title, x));
  if (skip) return out(`Title says “${skip}”`);
  const us = f.country === 'US' ? true : f.country === 'other' ? false : isUS(f.location);
  if (icpWantsUS(icp) && us === false) return out('Outside the USA');
  const ct = f.company_type || 'unknown';
  if (ct === 'investor') return out('Individual investor, not a firm');
  if (ct === 'vendor') return out('Sells to real estate firms (vendor or competitor)');
  if (ct === 'adjacent') return out('Mortgage, title, insurance or inspection, not a brokerage');
  const role = f.role || 'other';
  if (['agent', 'staff', 'other'].includes(role)) return out(role === 'agent' ? 'Agent, not the owner' : 'Not a decision maker');
  if (role === 'manager') return out('Manager, not the owner');
  const brand = bigBrand(f.company, f.brand);
  if (brand && !f.franchise_owner && role !== 'team_lead' && f.owns_company !== 'yes') return out(`Works under ${f.brand || f.company}, a national brand`);
  let tier = '';
  if (f.franchise_owner || (['owner', 'exec'].includes(role) && TIER_OK.includes(ct))) tier = 'A';
  else if (role === 'team_lead' || (role === 'owner' && ct === 'solo') || (['owner', 'exec'].includes(role) && ct === 'unknown')) tier = 'B';
  else if (['owner', 'exec'].includes(role) && ct === 'other') {
    const hay = norm([f.title, f.company, f.industry, f.about].join(' '));
    if (!(icp?.industries || []).some((x) => hasPhrase(hay, x))) return out('Company doesn’t look like real estate');
    tier = 'B';
  }
  if (!tier) return out('Not a decision maker');
  pri = tier === 'A' ? 50 : 32;
  why.push(tier === 'A' ? (f.franchise_owner ? 'Owns a franchise office' : 'Decision maker at a small firm') : role === 'team_lead' ? 'Leads a team' : ct === 'solo' ? 'Runs their own brand' : 'Owner, firm type unclear');
  // Need: signs they want a new brand or website
  if (f.new_firm) { pri += 18; why.push('New firm, needs a brand'); }
  else if (f.years_in_role != null && f.years_in_role < 2) { pri += 8; why.push('Under 2 years in role'); }
  if (f.changed_job) { pri += 10; why.push('Recently changed jobs'); }
  if (f.luxury) { pri += 8; why.push('Luxury or boutique, brand matters'); }
  if (ct === 'team' || role === 'team_lead') { pri += 5; why.push('Growing team'); }
  // Odds of accepting
  if (f.posted_recently) { pri += 10; why.push('Posted recently'); }
  const mutual = Math.max(0, +f.mutual || 0);
  if (mutual) { pri += Math.min(9, mutual * 3); why.push(plural(mutual, 'mutual connection')); }
  if (f.degree === '2nd') pri += 6;
  else if (f.degree === '3rd') { pri -= 4; why.push('3rd degree'); }
  if (f.open_profile) pri += 3;
  if (icpWantsUS(icp) && us == null) pri -= 5;
  pri = Math.max(0, Math.min(100, pri));
  const res = { verdict: 'invite', reason: '', tier, pri, why };
  if (f.degree === '1st') return { ...res, verdict: 'message', reason: 'Already connected, message them instead' };
  if (ctx.health?.strict && (tier !== 'A' || pri < 55)) return { ...res, verdict: 'skip', reason: 'Held back while your acceptance rate recovers' };
  if (pri < MIN_PRIORITY) return { ...res, verdict: 'skip', reason: 'Low odds: no activity, shared connections or need signals' };
  return res;
}
/* When the AI is off, derive rough facts from keywords. */
function keywordFacts(p, icp) {
  const t = norm(p.title);
  const role = /\b(owner|founder|co founder|ceo|president|principal|managing (director|broker|partner)|broker owner)\b/.test(t) ? 'owner'
    : /\b(team lead(er)?|team owner)\b/.test(t) ? 'team_lead' : /\b(agent|realtor|associate|salesperson)\b/.test(t) ? 'agent' : /\b(assistant|coordinator|admin)\b/.test(t) ? 'staff' : 'other';
  const hay = norm([p.title, p.company, p.industry].join(' '));
  const ct = /\binvestor|wholesal/.test(hay) ? 'investor' : /\b(mortgage|lending|title|escrow|insurance|inspection)\b/.test(hay) ? 'adjacent'
    : /\b(marketing|agency|software|digital|media|web|seo|leads?)\b/.test(norm(p.company)) ? 'vendor'
    : /\bproperty management\b/.test(hay) ? 'property_management' : /\bteam\b|\bgroup\b/.test(norm(p.company)) ? 'team'
    : (icp?.industries || []).some((x) => hasPhrase(hay, x)) ? 'brokerage' : 'unknown';
  return { ...p, role, company_type: ct, owns_company: 'unknown', degree: (String(p.degree || '').match(/1st|2nd|3rd/) || [''])[0] };
}
const companyKey = (c) => norm(shortCompany(c || '')).replace(/\b(llc|inc|the|group|realty|real estate|properties|team)\b/g, '').trim();

/* Search lanes: warmest first. Each is one saved Sales Navigator search. */
const LANES = [
  { id: 'warm', name: 'Warm', odds: 'Best odds', why: 'They already know of you, so they accept 2 to 3 times as often.', filters: ['Spotlights: Viewed your profile recently', 'Or: Following your company (Arhamsoft LLC)', 'Or: Leads who engaged with your posts'] },
  { id: 'new', name: 'New firms', odds: 'Most need', why: 'Started or joined their firm in the last 2 years. A new firm needs a brand and a website.', filters: ['Years at current company: Less than 1 year, 1 to 2 years', 'Years in current position: Less than 1 year, 1 to 2 years'] },
  { id: 'active', name: 'Active posters', odds: 'High odds', why: 'People who post read their invites. 2nd-degree connections accept far more often.', filters: ['Spotlights: Posted on LinkedIn in past 30 days', 'Connection: 2nd degree'] },
  { id: 'changed', name: 'Job changers', odds: 'Good timing', why: 'New role, new plans. Often rethinking their brand.', filters: ['Spotlights: Changed jobs in past 90 days'] },
  { id: 'base', name: 'Everyone else', odds: 'Cold', why: 'Only the base filters. Use it when the others run dry.', filters: [] },
];
const LANE_BASE = ['Geography: United States', 'Industry: Real Estate, Real Estate Agents and Brokers, Commercial Real Estate, Leasing Residential Real Estate', 'Company headcount: 1-10, 11-50', 'Seniority: Owner / Partner, CXO', 'Current job title, exclude: Agent, Associate, Realtor, Loan Officer, Investor, Assistant'];
function lanesOf(icp) {
  if (!icp) return {};
  if (!icp.lanes || typeof icp.lanes !== 'object') icp.lanes = {};
  if (icp.searchUrl && !Object.values(icp.lanes).some((l) => l && l.url)) { icp.lanes.active = { url: icp.searchUrl, page: icp.searchPage || 1 }; }
  return icp.lanes;
}
function laneFor(icp, id) { const ls = lanesOf(icp); if (!ls[id]) ls[id] = { url: '', page: 1 }; return ls[id]; }
function defaultLane(icp) { const ls = lanesOf(icp); return (LANES.find((l) => ls[l.id]?.url) || LANES[0]).id; }
