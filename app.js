const scheduleEl = document.getElementById('schedule');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const searchAllChk = document.getElementById('searchAllChk');
const dayLabel = document.getElementById('dayLabel');
const expandAllBtn = document.getElementById('expandAllBtn');
const speakerSelect = document.getElementById('speakerSelect');
const clearSpeakerBtn = document.getElementById('clearSpeaker');
const coordSelect = document.getElementById('coordSelect');
const clearCoordBtn = document.getElementById('clearCoord');
const showCoordChk = document.getElementById('showCoordChk');

let program = null;
let activeDay = 'day1';
let query = '';
let searchAll = false;
let speakerFilter = '';
let coordFilter = '';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const CC3 = {
  AFG:'AF', ALB:'AL', DZA:'DZ', AND:'AD', AGO:'AO', ARG:'AR', ARM:'AM', AUS:'AU', AUT:'AT', AZE:'AZ',
  BHR:'BH', BGD:'BD', BLR:'BY', BEL:'BE', BLZ:'BZ', BEN:'BJ', BTN:'BT', BOL:'BO', BIH:'BA', BWA:'BW',
  BRA:'BR', BRN:'BN', BGR:'BG', BFA:'BF', BDI:'BI', KHM:'KH', CMR:'CM', CAN:'CA', CAF:'CF', TCD:'TD',
  CHL:'CL', CHN:'CN', COL:'CO', COG:'CG', COD:'CD', CRI:'CR', CIV:'CI', HRV:'HR', CUB:'CU', CYP:'CY',
  CZE:'CZ', DNK:'DK', DJI:'DJ', DOM:'DO', ECU:'EC', EGY:'EG', SLV:'SV', GNQ:'GQ', ERI:'ER', EST:'EE',
  ETH:'ET', FJI:'FJ', FIN:'FI', FRA:'FR', GAB:'GA', GMB:'GM', GEO:'GE', DEU:'DE', GHA:'GH', GRC:'GR',
  GTM:'GT', GIN:'GN', GUY:'GY', HTI:'HT', HND:'HN', HUN:'HU', ISL:'IS', IND:'IN', IDN:'ID', IRN:'IR',
  IRQ:'IQ', IRL:'IE', ISR:'IL', ITA:'IT', JAM:'JM', JPN:'JP', JOR:'JO', KAZ:'KZ', KEN:'KE', KOR:'KR',
  KWT:'KW', KGZ:'KG', LAO:'LA', LVA:'LV', LBN:'LB', LSO:'LS', LBR:'LR', LBY:'LY', LTU:'LT', LUX:'LU',
  MKD:'MK', MDG:'MG', MWI:'MW', MYS:'MY', MLT:'MT', MRT:'MR', MUS:'MU', MEX:'MX', MDA:'MD', MNG:'MN',
  MNE:'ME', MAR:'MA', MOZ:'MZ', MMR:'MM', NAM:'NA', NPL:'NP', NLD:'NL', NZL:'NZ', NIC:'NI', NER:'NE',
  NGA:'NG', PRK:'KP', NOR:'NO', OMN:'OM', PAK:'PK', PAN:'PA', PNG:'PG', PRY:'PY', PER:'PE', PHL:'PH',
  POL:'PL', PRT:'PT', QAT:'QA', ROU:'RO', RUS:'RU', RWA:'RW', SAU:'SA', SEN:'SN', SRB:'RS', SLE:'SI',
  SVK:'SK', SVN:'SI', SLB:'SB', SOM:'SO', ZAF:'ZA', SSD:'SS', ESP:'ES', LKA:'LK', SDN:'SD', SWE:'SE',
  CHE:'CH', SYR:'SY', TWN:'TW', TJK:'TJ', TZA:'TZ', THA:'TH', TGO:'TG', TTO:'TT', TUN:'TN', TUR:'TR',
  TKM:'TM', UGA:'UG', UKR:'UA', ARE:'AE', GBR:'GB', USA:'US', URY:'UY', UZB:'UZ', VEN:'VE', VNM:'VN',
  YEM:'YE', ZMB:'ZM', ZWE:'ZW'
};

const ORG_LOGOS = { WHO: 'who', UNFPA: 'unfpa' };

function withFlags(text) {
  let out = String(text ?? '').replace(/\s*\(([A-Za-z]{3})\)\s*(?=\((WHO|UNFPA)\))/g, (m, cc) =>
    (CC3[cc.toUpperCase()] ? '' : m));
  out = out.replace(/\s*\(([A-Za-z]{3})\)/g, (m, cc) => {
    const code = cc.toUpperCase();
    const two = CC3[code];
    if (!two) return m;
    return ` <img class="flag" src="icons/flags/${two.toLowerCase()}.png" alt="${code}" width="16" height="12" loading="lazy">`;
  });
  out = out.replace(/\s*\((WHO|UNFPA)\)/g, (m, org) =>
    ` <img class="org-logo" src="icons/orgs/${ORG_LOGOS[org]}.png" alt="${org}" height="16" loading="lazy">`);
  return out;
}

function stripCountry(s) {
  return String(s ?? '').replace(/\s*\(([A-Za-z]{3})\)/g, (m, cc) => (CC3[cc.toUpperCase()] ? '' : m));
}

function stripModCountry(s) {
  return String(s ?? '').replace(/(moderators?\s*:\s*)([\s\S]*)$/i, (m, head, body) => head + stripCountry(body));
}

function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s*\([a-z]{2,10}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNames(str) {
  return String(str ?? '')
    .split(/[,;/]|—|–/)
    .map(s => s.replace(/^\s*(?:moderator|panel introduction|panel discussion|special lecture)\s*:\s*/i, ''))
    .map(s => s.replace(/\s*\([a-z]{2,10}\)/gi, ''))
    .map(s => s.replace(/\s+—\s+.*$/, ''))
    .map(s => s.trim())
    .filter(s => s.length >= 3 && s.length <= 60)
    .filter(s => !/^(panel discussion|special lecture|talk to be announced|\d)/i.test(s))
    .filter(s => !/^(dean|prof\.|professor|faculty|cultural|moderator|panel)/i.test(s));
}

function samePerson(a, b) {
  const x = normName(a);
  const y = normName(b);
  return x && y && x === y;
}

function nameIn(str, name) {
  const n = normName(name);
  if (!n) return false;
  return normName(str).includes(n);
}

function rolesFromSpeakerField(str, talkTitle) {
  const out = [];
  const s = String(str ?? '');
  if (!s.trim()) return out;
  const isPanel = /panel discussion/i.test(`${talkTitle || ''} ${s}`);
  const defaultRole = isPanel ? 'Panelist' : 'Speaker';
  const modMatch = s.match(/moderators?\s*:\s*(.+)$/i);
  const modNames = modMatch ? splitNames(modMatch[1]) : [];
  modNames.forEach(n => out.push({ name: n, role: 'Moderator' }));
  let before = s;
  if (modMatch) before = s.slice(0, modMatch.index);
  before = before.replace(/\s*[—–]\s*.*$/, '');
  splitNames(before).forEach(n => {
    if (!modNames.some(c => samePerson(c, n))) out.push({ name: n, role: defaultRole });
  });
  return out;
}

function rolesFromNote(str, talkTitle) {
  const out = [];
  const s = String(str ?? '');
  if (!s.trim()) return out;
  const isPanel = /panel discussion/i.test(`${talkTitle || ''} ${s}`);
  const modMatch = s.match(/moderators?\s*:\s*(.+)$/i);
  const modNames = modMatch ? splitNames(modMatch[1]) : [];
  modNames.forEach(n => out.push({ name: n, role: 'Moderator' }));
  let before = s;
  if (modMatch) before = s.slice(0, modMatch.index);
  before = before.replace(/\s*[—–]\s*.*$/, '');
  if (isPanel || modNames.length) {
    splitNames(before).forEach(n => {
      if (!modNames.some(c => samePerson(c, n))) out.push({ name: n, role: 'Panelist' });
    });
  }
  return out;
}

function addRole(map, name, role) {
  const key = normName(name);
  if (!key) return;
  if (!map.has(key)) map.set(key, { name, roles: new Set() });
  const entry = map.get(key);
  if (!entry.name && name) entry.name = name;
  entry.roles.add(role);
}

function personName(v) {
  return typeof v === 'string' ? v : (v && v.name) || '';
}

function talkPanelPairs(t) {
  const out = [];
  (t?.panel?.panelists || []).forEach(n => out.push({ name: personName(n), role: 'Panelist' }));
  (t?.panel?.moderators || []).forEach(n => out.push({ name: personName(n), role: 'Moderator' }));
  (t?.chairpersons || []).forEach(n => out.push({ name: personName(n), role: 'Chairperson' }));
  return out;
}

function collectSpeakers(prog) {
  const byNorm = new Map();
  const addPairs = pairs => pairs.forEach(({ name, role }) => addRole(byNorm, name, role));
  const addNames = (arr, role) => (arr || []).forEach(v => {
    const nm = personName(v);
    if (!nm) return;
    splitNames(nm).forEach(n => addRole(byNorm, n, role));
  });
  const addTalk = t => {
    if (!t) return;
    addPairs(rolesFromSpeakerField(t.speaker, t.title));
    addPairs(rolesFromNote(t.note, t.title));
    addPairs(rolesFromNote(t.speaker, t.title));
    addPairs(talkPanelPairs(t));
  };
  const addSessionModerators = item => {
    addNames(item.moderators, 'Moderator');
    addNames(item.panel?.moderators, 'Moderator');
  };

  for (const day of prog.days) {
    for (const item of day.items) {
      (item.talks || []).forEach(addTalk);
      addNames(item.chairpersons, 'Chairperson');
      addSessionModerators(item);
      addNames(item.panel?.panelists, 'Panelist');
      for (const r of item.rooms || []) {
        (r.talks || []).forEach(addTalk);
        addNames(r.chairpersons, 'Chairperson');
        addNames(r.moderators, 'Moderator');
        addNames(r.panel?.panelists, 'Panelist');
        addNames(r.panel?.moderators, 'Moderator');
      }
    }
  }

  const order = { Speaker: 0, Panelist: 1, Moderator: 2, Chairperson: 3 };
  return [...byNorm.values()]
    .map(e => ({
      name: e.name,
      roles: [...e.roles].sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function rolesInItem(item, name) {
  const roles = new Set();
  const hitName = n => samePerson(personName(n), name);

  const scanTalks = talks => {
    for (const t of talks || []) {
      for (const p of rolesFromSpeakerField(t.speaker, t.title)) {
        if (hitName(p.name)) roles.add(p.role);
      }
      for (const p of rolesFromNote(t.note, t.title)) {
        if (hitName(p.name)) roles.add(p.role);
      }
      for (const p of talkPanelPairs(t)) {
        if (hitName(p.name)) roles.add(p.role);
      }
      if (t.speaker && nameIn(t.speaker, name)) {
        const pairs = rolesFromSpeakerField(t.speaker, t.title);
        if (!pairs.some(p => hitName(p.name)) && !/moderators?\s*:/i.test(t.speaker)) {
          roles.add(/panel discussion/i.test(`${t.title || ''} ${t.speaker}`) ? 'Panelist' : 'Speaker');
        }
      }
    }
  };

  scanTalks(item.talks);
  for (const c of item.chairpersons || []) if (hitName(personName(c))) roles.add('Chairperson');
  for (const m of item.moderators || []) if (hitName(m)) roles.add('Moderator');
  for (const m of item.panel?.moderators || []) if (hitName(m)) roles.add('Moderator');
  for (const p of item.panel?.panelists || []) if (hitName(p)) roles.add('Panelist');
  for (const r of item.rooms || []) {
    scanTalks(r.talks);
    for (const c of r.chairpersons || []) if (hitName(personName(c))) roles.add('Chairperson');
    for (const m of r.moderators || []) if (hitName(m)) roles.add('Moderator');
    for (const m of r.panel?.moderators || []) if (hitName(m)) roles.add('Moderator');
    for (const p of r.panel?.panelists || []) if (hitName(p)) roles.add('Panelist');
  }

  const order = { Speaker: 0, Panelist: 1, Moderator: 2, Chairperson: 3 };
  return [...roles].sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
}

function roleBadgesHtml(item) {
  if (!speakerFilter) return '';
  const roles = rolesInItem(item, speakerFilter);
  return roles.map(r => `<span class="badge role-badge role-${r.toLowerCase()}">${esc(r)}</span>`).join('');
}

function formatBadgesHtml(item) {
  const c = Array.isArray(item.content) ? item.content : item.content ? [item.content] : [];
  return c.filter(v => v !== 'presentations').map(v => `<span class="badge format">${esc(v)}</span>`).join('');
}

function itemHasSpeaker(item, name) {
  if (!name) return true;
  const n = normName(name);
  if (!n) return true;
  return normName(JSON.stringify(item)).includes(n);
}

function itemCoordinators(item) {
  const out = [];
  (item.coordinators || []).forEach(c => { if (!out.includes(c)) out.push(c); });
  (item.rooms || []).forEach(r => (r.coordinators || []).forEach(c => { if (!out.includes(c)) out.push(c); }));
  return out;
}

function itemHasCoord(item, coord) {
  if (!coord) return true;
  return itemCoordinators(item).includes(coord);
}

function coordPill(list) {
  if (!list?.length) return '';
  return `<span class="coord-pill">${list.map(esc).join(' + ')}</span>`;
}

function applyShowCoords(on) {
  document.documentElement.classList.toggle('show-coords', !!on || !!coordFilter);
  try { localStorage.setItem('asogic29.showCoords', on ? '1' : '0'); } catch (e) {}
}

function initShowCoords() {
  let on = false;
  try {
    on = localStorage.getItem('asogic29.showCoords') === '1';
    if (localStorage.getItem('asogic29.showCoords') === null &&
        localStorage.getItem('asogic29.hideCoords') === '0') on = true;
  } catch (e) {}
  showCoordChk.checked = on;
  document.documentElement.classList.toggle('show-coords', on);
}

function collectCoordinators(prog) {
  const set = new Set();
  prog.days.forEach(d => d.items.forEach(i => itemCoordinators(i).forEach(c => set.add(c))));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function timeHtml(hhmm) {
  const m = toMin(hhmm);
  if (m == null) return esc(hhmm);
  const s = toHHMM(m);
  const i = s.indexOf(':');
  return `<span class="th">${s.slice(0, i)}</span>:${s.slice(i + 1)}`;
}

function timeRange(start, end) {
  if (!end) return timeHtml(start);
  return `${timeHtml(start)}<br><span class="end">${timeHtml(end)}</span>`;
}

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return (+m[1]) * 60 + (+m[2]);
}

function toHHMM(mins) {
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function parseDurationMins(...texts) {
  const s = texts.filter(Boolean).join(' ');
  if (!s.trim()) return 15;
  let m = s.match(/(\d+)\s*:\s*(\d+)\s*h\b/i);
  if (m) return (+m[1]) * 60 + (+m[2]);
  m = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*min)?/i);
  if (m) return Math.round((+m[1]) * 60 + (+(m[2] || 0)));
  m = s.match(/(\d+)\s*(?:min|minutes?)\b/i);
  if (m) return +m[1];
  return 15;
}

function talkTimeRanges(talks, sessionStart) {
  const s = toMin(sessionStart);
  if (s == null || !talks?.length) return [];
  let cur = s;
  return talks.map(t => {
    if (t.section || t.noTime) return null;
    const speaker = String(t.speaker || '').trim();
    const isPureDuration = /^\d+\s*(?::\s*\d+\s*)?h(?:ours?)?(?:\s*\d+\s*min)?$/i.test(speaker)
      || /^\d+\s*min(?:utes?)?$/i.test(speaker);
    if (isPureDuration && /session/i.test(t.title || '')) return null;
    const dur = t.duration != null ? +t.duration : parseDurationMins(t.note, t.speaker, t.title);
    let st = cur;
    if (t.start != null) { const m = toMin(t.start); if (m != null) st = m; }
    const range = { start: toHHMM(st), end: toHHMM(st + dur) };
    cur = st + dur;
    return range;
  });
}

function talksHtml(talks, sessionStart) {
  if (!talks?.length) return '';
  const ranges = talkTimeRanges(talks, sessionStart);
  return talks.map((t, i) => {
    const hay = `${t.title} ${t.speaker || ''} ${t.note || ''} ${t.panel ? JSON.stringify(t.panel) : ''}`;
    const hit = speakerFilter && (
      nameIn(t.speaker, speakerFilter) ||
      nameIn(t.note, speakerFilter) ||
      rolesFromSpeakerField(t.speaker, t.title).some(p => samePerson(p.name, speakerFilter)) ||
      rolesFromNote(t.note, t.title).some(p => samePerson(p.name, speakerFilter)) ||
      talkPanelPairs(t).some(p => samePerson(p.name, speakerFilter))
    );
    const hide = speakerFilter && !hit;
    if (t.section) {
      return `
      <div class="talk talk-section${hide ? ' hidden' : ''}" data-search="${esc(hay.toLowerCase())}">
        <div class="talk-time-col">${t.start && t.end ? `${timeHtml(t.start)}<br><span class="end">${timeHtml(t.end)}</span>` : ''}</div>
        <div class="talk-main"><p class="talk-section-title">${esc(t.title)}</p>${chairpersonsHtml(t.chairpersons)}</div>
      </div>`;
    }
    const talkRoles = hit && speakerFilter
      ? (() => {
          const set = new Set();
          for (const p of rolesFromSpeakerField(t.speaker, t.title)) {
            if (samePerson(p.name, speakerFilter)) set.add(p.role);
          }
          for (const p of rolesFromNote(t.note, t.title)) {
            if (samePerson(p.name, speakerFilter)) set.add(p.role);
          }
          for (const p of talkPanelPairs(t)) {
            if (samePerson(p.name, speakerFilter)) set.add(p.role);
          }
          if (!set.size && nameIn(t.speaker, speakerFilter) && !/moderators?\s*:/i.test(t.speaker || '')) {
            set.add(/panel discussion/i.test(`${t.title || ''} ${t.speaker}`) ? 'Panelist' : 'Speaker');
          }
          return [...set];
        })()
      : [];
    const tr = ranges[i];
    const isPanelTalk = !!t.panel || /panel discussion/i.test(`${t.title || ''} ${t.speaker || ''}`);
    return `
    <div class="talk${hit ? ' speaker-hit' : ''}${hide ? ' hidden' : ''}${t.noTime ? ' talk-notime' : ''}" data-search="${esc(hay.toLowerCase())}">
      <div class="talk-time-col">${tr ? `${timeHtml(tr.start)}<br><span class="end">${timeHtml(tr.end)}</span>` : ''}</div>
      <div class="talk-main">
        <p class="talk-title">${esc(t.title)}${isPanelTalk ? ' <span class="badge format">panel discussion</span>' : ''}${talkRoles.length ? ` <span class="inline-role">${talkRoles.map(esc).join(' · ')}</span>` : ''}</p>
        ${t.speaker ? `<p class="talk-speaker">${withFlags(esc(t.speaker))}<span class="talk-aff">${esc(t.aff || '')}</span></p>` : ''}
        ${t.badge ? `<p class="talk-note"><span class="badge gold">${esc(t.badge)}</span></p>` : ''}
        ${t.note ? `<p class="talk-note">${withFlags(esc(stripModCountry(t.note)))}</p>` : ''}
        ${t.panel ? panelHtml(t.panel) : ''}
      </div>
    </div>`;
  }).join('');
}

function personChip(text, role) {
  const hit = speakerFilter && nameIn(text, speakerFilter);
  const label = hit && role ? `${role}: ${text}` : text;
  return `<span class="chip${hit ? ' speaker-hit' : ''}">${withFlags(esc(label))}</span>`;
}

function chairpersonsHtml(list, affiliation) {
  if (!list?.length) return '';
  return `
    <p class="section-label">Chairpersons <span class="label-note">(arranged alphabetically)</span></p>
    <div class="chair-list">${list.map(c => `
      <div class="chair-line">${personChip(personName(c), 'Chairperson')}<span class="chair-aff">${esc((c && c.aff) || '')}</span></div>`).join('')}</div>
    ${affiliation ? `<p class="chair-affil">${esc(affiliation)}</p>` : ''}`;
}

function panelHtml(panel) {
  if (!panel) return '';
  const modLabel = panel.moderators?.length === 1 ? 'Moderator' : 'Moderators';
  const personLine = (p, role) => `<div class="chair-line">${personChip(personName(p), role)}<span class="chair-aff">${esc((p && p.aff) || '')}</span></div>`;
  return `
    ${panel.panelists?.length ? `
    <p class="section-label">Panelists <span class="label-note">(arranged alphabetically)</span></p>
    <div class="chair-list">${panel.panelists.map(p => personLine(p, 'Panelist')).join('')}</div>` : ''}
    ${panel.moderators?.length ? `
    <p class="section-label">${modLabel}</p>
    <div class="chair-list">${panel.moderators.map(m => personLine(m, 'Moderator')).join('')}</div>` : ''}
    ${panel.topics?.length ? `
    <p class="section-label">Topics</p>
    <ul class="topic-list">
      ${panel.topics.map(t => `<li>${esc(t)}</li>`).join('')}
    </ul>` : ''}`;
}

function sessionModeratorsHtml(list) {
  if (!list?.length) return '';
  return `
    <p class="section-label">Moderators</p>
    <div class="chair-list">${list.map(m => `<div class="chair-line">${personChip(stripCountry(personName(m)), 'Moderator')}<span class="chair-aff">${esc((m && m.aff) || '')}</span></div>`).join('')}</div>`;
}

function searchText(item) {
  let s = JSON.stringify(item).toLowerCase();
  if (item.start) s += ' ' + toHHMM(toMin(item.start));
  if (item.end) s += ' ' + toHHMM(toMin(item.end));
  return s;
}

function sessionHtml(item) {
  const search = searchText(item);

  if (item.type === 'info' || item.type === 'break') {
    return `
      <article class="session compact" data-id="${esc(item.id)}" data-search="${esc(search)}">
        <div class="compact-row">
          <div class="time-col">${timeRange(item.start, item.end)}</div>
          <div class="head-main"><p class="session-title">${esc(item.title)}</p></div>
        </div>
      </article>`;
  }

  if (item.type === 'block') {
    return `
      <article class="session" data-id="${esc(item.id)}" data-search="${esc(search)}">
        <button class="session-head" aria-expanded="false">
          <div class="time-col">${timeRange(item.start, item.end)}</div>
          <div class="head-main">
            <div class="kicker">
              ${item.badge ? `<span class="badge gold">${esc(item.badge)}</span>` : `<span class="badge soft">Ceremony</span>`}
              ${roleBadgesHtml(item)}
            </div>
            <h2 class="session-title">${esc(item.title)}</h2>
          </div>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="session-body">
          <ul class="sub-list">
            ${(item.sub || []).map(s => `
              <li><span class="t">${esc(s.title)}</span>${s.note ? `<span class="n">${esc(s.note)}</span>` : ''}</li>`).join('')}
          </ul>
        </div>
      </article>`;
  }

  if (item.type === 'concurrent') {
    let rooms = item.rooms || [];
    if (speakerFilter) {
      rooms = rooms.filter(r => itemHasSpeaker(r, speakerFilter));
    }
    if (coordFilter && !item.coordinators?.includes(coordFilter)) {
      rooms = rooms.filter(r => (r.coordinators || []).includes(coordFilter));
    }
    if (!rooms.length) return '';
    const hallNames = rooms.map(r => {
      const m = /([A-Za-z])\s*$/.exec(String(r.id || ''));
      return m ? `Hall ${m[1].toUpperCase()}` : String(r.id);
    });
    return `
      <article class="session concurrent" data-id="${esc(item.id)}" data-search="${esc(search)}">
        <div class="session-head concurrent-head">
          <div class="time-col">${timeRange(item.start, item.end)}</div>
          <div class="head-main">
            <div class="kicker"><span class="badge">${esc(item.label)}</span>${formatBadgesHtml(item)}${roleBadgesHtml(item)}</div>
            <div class="hall-row">
              ${rooms.map((r, i) => `
              <button type="button" class="hall-cell" data-room="${esc(r.id)}">
                <span class="session-sub">${esc(hallNames[i])}</span>
                <span class="session-title">${esc(r.title)}</span>
                ${coordPill(r.coordinators)}
              </button>`).join('')}
            </div>
          </div>
        </div>
        <div class="session-body" style="padding-top:4px">
          ${rooms.map((r, i) => {
            const titleLine = `<p class="room-title">${esc(r.id)} — ${esc(r.title)} ${formatBadgesHtml(r)}</p>`;
            return `
            <div class="room-panel" data-room-panel="${esc(r.id)}">
              ${r.talksFirst ? '' : titleLine}
              ${r.subtitle ? `<p class="room-sub">${esc(r.subtitle)}</p>` : ''}
              ${r.badge ? `<p class="room-sub"><span class="badge soft">${esc(r.badge)}</span></p>` : ''}
              ${chairpersonsHtml(r.chairpersons, r.chairAffiliation)}
              ${sessionModeratorsHtml(r.moderators)}
              ${r.talksFirst ? talksHtml(r.talks, item.start) + titleLine + panelHtml(r.panel) : panelHtml(r.panel) + talksHtml(r.talks, item.start)}
            </div>`;
          }).join('')}
        </div>
      </article>`;
  }

  // plenary
  return `
    <article class="session" data-id="${esc(item.id)}" data-search="${esc(search)}">
      <button class="session-head" aria-expanded="false">
        <div class="time-col">${timeRange(item.start, item.end)}</div>
          <div class="head-main">
            <div class="kicker">
              <span class="badge">${esc(item.label)}</span>
              ${formatBadgesHtml(item)}
              ${item.badge ? `<span class="badge gold">${esc(item.badge)}</span>` : ''}
              ${roleBadgesHtml(item)}
              ${coordPill(item.coordinators)}
            </div>
            <h2 class="session-title">${esc(item.title)}</h2>
            ${item.subtitle ? `<p class="session-sub">${esc(item.subtitle)}</p>` : ''}
          </div>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <div class="session-body">
        ${chairpersonsHtml(item.chairpersons, item.chairAffiliation)}
        ${sessionModeratorsHtml(item.moderators)}
        ${panelHtml(item.panel)}
        ${talksHtml(item.talks, item.start)}
      </div>
    </article>`;
}

function formatDate(day) {
  return new Date(day.date + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function render() {
  if (!program) return;

  const qAll = searchAll ? query.trim().toLowerCase() : '';
  if (speakerFilter || coordFilter || qAll) {
    const person = speakerFilter ? collectSpeakers(program).find(p => samePerson(p.name, speakerFilter)) : null;
    const roleTxt = speakerFilter && person?.roles?.length ? ` (${person.roles.join(' · ')})` : '';
    let html = '';
    let count = 0;
    for (const day of program.days) {
      const items = day.items.filter(it =>
        (!speakerFilter || itemHasSpeaker(it, speakerFilter)) &&
        itemHasCoord(it, coordFilter) &&
        (!qAll || searchText(it).includes(qAll)));
      if (!items.length) continue;
      count += items.length;
      html += `<div class="filter-day">${esc(day.weekday)} · ${esc(formatDate(day))}</div>`;
      html += `<div class="timeline">${items.map(sessionHtml).join('')}</div>`;
    }
    const parts = [];
    if (speakerFilter) parts.push(`${speakerFilter}${roleTxt}`);
    if (coordFilter) parts.push(`Coordinated by ${coordFilter}`);
    if (qAll) parts.push(count ? `Whole program · ${count}` : 'Whole program');
    dayLabel.textContent = parts.join(' · ');
    scheduleEl.innerHTML = html;
    noResults.hidden = count > 0;
    bindSessionEvents();
    expandableCards().forEach(c => setCardOpen(c, true));
    highlightSpeakerChips();
    updateExpandBtn();
    return;
  }

  const day = program.days.find(d => d.id === activeDay);
  if (!day) return;
  dayLabel.textContent = `${day.weekday} · ${formatDate(day)}`;
  scheduleEl.innerHTML = `<div class="timeline">${day.items.map(sessionHtml).join('')}</div>`;
  noResults.hidden = true;
  applyFilter();
  bindSessionEvents();
  updateExpandBtn();
}

function highlightSpeakerChips() {
  if (!speakerFilter) return;
  const n = normName(speakerFilter);
  scheduleEl.querySelectorAll('.chip').forEach(chip => {
    if (normName(chip.textContent).includes(n)) {
      chip.style.background = 'rgba(232, 200, 120, 0.35)';
      chip.style.borderColor = 'var(--gold-400)';
      chip.style.fontWeight = '700';
    }
  });
}

function setCardOpen(card, open) {
  card.classList.toggle('open', open);
  const head = card.querySelector('button.session-head');
  if (head) head.setAttribute('aria-expanded', String(open));
  if (open) ensureHallActive(card);
  else clearHalls(card);
}

function activateHall(cell) {
  const card = cell.closest('.session');
  const roomId = cell.dataset.room;
  card.querySelectorAll('.hall-cell').forEach(c => c.classList.toggle('active', c === cell));
  card.querySelectorAll('.room-panel').forEach(p =>
    p.classList.toggle('active', p.dataset.roomPanel === roomId));
}

function ensureHallActive(card) {
  const cells = [...card.querySelectorAll('.hall-cell')];
  if (!cells.length || cells.some(c => c.classList.contains('active'))) return;
  activateHall(cells[0]);
}

function clearHalls(card) {
  if (!card.querySelector('.hall-cell')) return;
  card.querySelectorAll('.hall-cell').forEach(c => c.classList.remove('active'));
  card.querySelectorAll('.room-panel').forEach(p => p.classList.remove('active'));
}

function expandableCards() {
  return [...scheduleEl.querySelectorAll('.session')].filter(c => c.querySelector('.session-head'));
}

function lastOpenIndex(cards) {
  let lastOpen = -1;
  cards.forEach((c, i) => {
    if (c.classList.contains('open')) lastOpen = i;
  });
  return lastOpen;
}

function updateExpandBtn() {
  const cards = expandableCards().filter(c => !c.classList.contains('hidden'));
  expandAllBtn.hidden = cards.length === 0;
  const lastOpen = lastOpenIndex(cards);
  const hasAfter = cards.some((c, i) => i > lastOpen && !c.classList.contains('open'));
  const anyOpen = lastOpen >= 0;
  if (hasAfter || !anyOpen) {
    expandAllBtn.textContent = 'Expand ↓';
  } else {
    expandAllBtn.textContent = 'Collapse ↑';
  }
}

function withStableView(mutate) {
  const cards = expandableCards().filter(c => !c.classList.contains('hidden'));
  let el = null;
  let top = 0;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (r.bottom > 0) {
      el = c.querySelector('.session-head') || c;
      top = el.getBoundingClientRect().top;
      break;
    }
  }
  const scrollBefore = window.scrollY;
  mutate();
  if (el) {
    const delta = el.getBoundingClientRect().top - top;
    if (Math.abs(delta) >= 0.5) {
      window.scrollTo(0, scrollBefore + delta);
    }
  }
}

expandAllBtn.addEventListener('click', () => {
  const cards = expandableCards().filter(c => !c.classList.contains('hidden'));
  if (!cards.length) return;
  const lastOpen = lastOpenIndex(cards);
  const hasAfter = cards.some((c, i) => i > lastOpen && !c.classList.contains('open'));
  const anyOpen = lastOpen >= 0;
  if (!hasAfter && anyOpen) {
    withStableView(() => cards.forEach(c => setCardOpen(c, false)));
  } else {
    const start = lastOpen + 1;
    withStableView(() => {
      for (let i = start; i < cards.length; i++) setCardOpen(cards[i], true);
    });
  }
  updateExpandBtn();
});

function bindSessionEvents() {
  scheduleEl.querySelectorAll('button.session-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.session');
      setCardOpen(card, !card.classList.contains('open'));
      updateExpandBtn();
    });
  });

  scheduleEl.querySelectorAll('.hall-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      activateHall(cell);
      setCardOpen(cell.closest('.session'), true);
      updateExpandBtn();
    });
  });

  scheduleEl.querySelectorAll('.concurrent-head').forEach(head => {
    head.addEventListener('click', e => {
      if (e.target.closest('.hall-cell')) return;
      const card = head.closest('.session');
      if (!card.classList.contains('open')) return;
      setCardOpen(card, false);
      updateExpandBtn();
    });
  });
}

function applyFilter() {
  const q = query.trim().toLowerCase();
  let visible = 0;
  scheduleEl.querySelectorAll('.session').forEach(card => {
    if (!q) {
      card.classList.remove('hidden');
      card.style.display = '';
      visible++;
      return;
    }
    const own = card.dataset.search || '';
    const talkHit = [...card.querySelectorAll('.talk')].some(t => {
      const hit = (t.dataset.search || '').includes(q);
      t.classList.toggle('hidden', !hit);
      return hit;
    });
    const match = own.includes(q) || talkHit;
    card.classList.toggle('hidden', !match);
    card.style.display = match ? '' : 'none';
    if (match) {
      visible++;
      if (talkHit) setCardOpen(card, true);
    }
  });
  noResults.hidden = visible > 0;
  updateExpandBtn();
}

document.querySelectorAll('.day-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeDay = tab.dataset.day;
    document.querySelectorAll('.day-tab').forEach(t => {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    render();
  });
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  if (searchAll) {
    render();
    return;
  }
  applyFilter();
});

searchAllChk.addEventListener('change', () => {
  searchAll = searchAllChk.checked;
  searchInput.placeholder = searchAll ? 'whole program' : 'this day';
  render();
});

function populateSpeakers() {
  const people = collectSpeakers(program);
  const frag = document.createDocumentFragment();
  for (const person of people) {
    const opt = document.createElement('option');
    opt.value = person.name;
    opt.textContent = person.roles.length
      ? `${person.name} — ${person.roles.join(' · ')}`
      : person.name;
    frag.appendChild(opt);
  }
  speakerSelect.appendChild(frag);
}

function populateCoordinators() {
  const frag = document.createDocumentFragment();
  for (const coord of collectCoordinators(program)) {
    const opt = document.createElement('option');
    opt.value = coord;
    opt.textContent = coord;
    frag.appendChild(opt);
  }
  coordSelect.appendChild(frag);
}

speakerSelect.addEventListener('change', () => {
  speakerFilter = speakerSelect.value;
  speakerSelect.classList.toggle('active', !!speakerFilter);
  clearSpeakerBtn.hidden = !speakerFilter;
  query = '';
  searchInput.value = '';
  render();
});

clearSpeakerBtn.addEventListener('click', () => {
  speakerFilter = '';
  speakerSelect.value = '';
  speakerSelect.classList.remove('active');
  clearSpeakerBtn.hidden = true;
  render();
});

coordSelect.addEventListener('change', () => {
  coordFilter = coordSelect.value;
  coordSelect.classList.toggle('active', !!coordFilter);
  clearCoordBtn.hidden = !coordFilter;
  applyShowCoords(showCoordChk.checked);
  query = '';
  searchInput.value = '';
  render();
});

clearCoordBtn.addEventListener('click', () => {
  coordFilter = '';
  coordSelect.value = '';
  coordSelect.classList.remove('active');
  clearCoordBtn.hidden = true;
  applyShowCoords(showCoordChk.checked);
  render();
});

showCoordChk.addEventListener('change', () => applyShowCoords(showCoordChk.checked));

async function init() {
  initShowCoords();
  try {
    program = await loadProgram();
    populateSpeakers();
    populateCoordinators();
    render();
  } catch (err) {
    const detail = (err && err.message) ? String(err.message) : 'unknown error';
    console.error('program load failed:', err);
    if (!sessionStorage.getItem('asogic29.retried')) {
      sessionStorage.setItem('asogic29.retried', '1');
      scheduleEl.innerHTML = '<p class="no-results">Repairing app cache…</p>';
      (async () => {
        try {
          if (navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          }
          if (caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch (e) {}
        location.reload();
      })();
      return;
    }
    scheduleEl.innerHTML = '<p class="no-results">Could not load the program (' + detail + '). Please reopen the app.</p>';
  }
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let hadUpdate = hadController;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadUpdate) { hadUpdate = true; return; }
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 60000);
    }).catch(() => {});
  }
}

async function loadProgram() {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch('data/program.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 350 * (i + 1)));
    }
  }
  throw lastErr;
}

init();
