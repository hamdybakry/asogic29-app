const scheduleEl = document.getElementById('schedule');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const dayLabel = document.getElementById('dayLabel');
const expandAllBtn = document.getElementById('expandAllBtn');
const speakerSelect = document.getElementById('speakerSelect');
const clearSpeakerBtn = document.getElementById('clearSpeaker');

let program = null;
let activeDay = 'day1';
let query = '';
let speakerFilter = '';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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
  const isPanel = /panel discussion|interactive session/i.test(`${talkTitle || ''} ${s}`);
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
  const isPanel = /panel discussion|interactive session/i.test(`${talkTitle || ''} ${s}`);
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

function collectSpeakers(prog) {
  const byNorm = new Map();
  const addPairs = pairs => pairs.forEach(({ name, role }) => addRole(byNorm, name, role));
  const addNames = (arr, role) => (arr || []).forEach(v => {
    if (typeof v !== 'string') return;
    splitNames(v).forEach(n => addRole(byNorm, n, role));
  });
  const addTalk = t => {
    if (!t) return;
    addPairs(rolesFromSpeakerField(t.speaker, t.title));
    addPairs(rolesFromNote(t.note, t.title));
    addPairs(rolesFromNote(t.speaker, t.title));
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
  const hitName = n => samePerson(n, name);

  const scanTalks = talks => {
    for (const t of talks || []) {
      for (const p of rolesFromSpeakerField(t.speaker, t.title)) {
        if (hitName(p.name)) roles.add(p.role);
      }
      for (const p of rolesFromNote(t.note, t.title)) {
        if (hitName(p.name)) roles.add(p.role);
      }
      if (t.speaker && nameIn(t.speaker, name)) {
        const pairs = rolesFromSpeakerField(t.speaker, t.title);
        if (!pairs.some(p => hitName(p.name)) && !/moderators?\s*:/i.test(t.speaker)) {
          roles.add(/panel discussion|interactive session/i.test(`${t.title || ''} ${t.speaker}`) ? 'Panelist' : 'Speaker');
        }
      }
    }
  };

  scanTalks(item.talks);
  for (const c of item.chairpersons || []) if (hitName(c)) roles.add('Chairperson');
  for (const m of item.moderators || []) if (hitName(m)) roles.add('Moderator');
  for (const m of item.panel?.moderators || []) if (hitName(m)) roles.add('Moderator');
  for (const p of item.panel?.panelists || []) if (hitName(p)) roles.add('Panelist');
  for (const r of item.rooms || []) {
    scanTalks(r.talks);
    for (const c of r.chairpersons || []) if (hitName(c)) roles.add('Chairperson');
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

function itemHasSpeaker(item, name) {
  if (!name) return true;
  const n = normName(name);
  if (!n) return true;
  return normName(JSON.stringify(item)).includes(n);
}

function to12h(hhmm) {
  const m = toMin(hhmm);
  return m == null ? esc(hhmm) : esc(toHHMM(m));
}

function timeRange(start, end) {
  if (!end) return to12h(start);
  return `${to12h(start)}<br><span class="end">${to12h(end)}</span>`;
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
    const speaker = String(t.speaker || '').trim();
    const isPureDuration = /^\d+\s*(?::\s*\d+\s*)?h(?:ours?)?(?:\s*\d+\s*min)?$/i.test(speaker)
      || /^\d+\s*min(?:utes?)?$/i.test(speaker);
    if (isPureDuration && /session/i.test(t.title || '')) return null;
    const dur = parseDurationMins(t.note, t.speaker, t.title);
    const range = { start: toHHMM(cur), end: toHHMM(cur + dur) };
    cur += dur;
    return range;
  });
}

function talksHtml(talks, sessionStart) {
  if (!talks?.length) return '';
  const ranges = talkTimeRanges(talks, sessionStart);
  return talks.map((t, i) => {
    const hay = `${t.title} ${t.speaker || ''} ${t.note || ''}`;
    const hit = speakerFilter && (
      nameIn(t.speaker, speakerFilter) ||
      nameIn(t.note, speakerFilter) ||
      rolesFromSpeakerField(t.speaker, t.title).some(p => samePerson(p.name, speakerFilter)) ||
      rolesFromNote(t.note, t.title).some(p => samePerson(p.name, speakerFilter))
    );
    const hide = speakerFilter && !hit;
    const talkRoles = hit && speakerFilter
      ? (() => {
          const set = new Set();
          for (const p of rolesFromSpeakerField(t.speaker, t.title)) {
            if (samePerson(p.name, speakerFilter)) set.add(p.role);
          }
          for (const p of rolesFromNote(t.note, t.title)) {
            if (samePerson(p.name, speakerFilter)) set.add(p.role);
          }
          if (!set.size && nameIn(t.speaker, speakerFilter) && !/moderators?\s*:/i.test(t.speaker || '')) {
            set.add(/panel discussion|interactive session/i.test(`${t.title || ''} ${t.speaker}`) ? 'Panelist' : 'Speaker');
          }
          return [...set];
        })()
      : [];
    const tr = ranges[i];
    return `
    <div class="talk${hit ? ' speaker-hit' : ''}${hide ? ' hidden' : ''}" data-search="${esc(hay.toLowerCase())}">
      ${tr ? `<p class="talk-time">${esc(tr.start)} – ${esc(tr.end)}</p>` : ''}
      <p class="talk-title">${esc(t.title)}${talkRoles.length ? ` <span class="inline-role">${talkRoles.map(esc).join(' · ')}</span>` : ''}</p>
      ${t.speaker ? `<p class="talk-speaker">${esc(t.speaker)}</p>` : ''}
      ${t.badge ? `<p class="talk-note"><span class="badge gold">${esc(t.badge)}</span></p>` : ''}
      ${t.note ? `<p class="talk-note">${esc(t.note)}</p>` : ''}
    </div>`;
  }).join('');
}

function personChip(text, role) {
  const hit = speakerFilter && nameIn(text, speakerFilter);
  const label = hit && role ? `${role}: ${text}` : text;
  return `<span class="chip${hit ? ' speaker-hit' : ''}">${esc(label)}</span>`;
}

function chairpersonsHtml(list) {
  if (!list?.length) return '';
  return `
    <p class="section-label">Chairpersons</p>
    <div class="chip-row">${list.map(p => personChip(p, 'Chairperson')).join('')}</div>`;
}

function panelHtml(panel) {
  if (!panel) return '';
  return `
    <p class="section-label">${esc(panel.format)}</p>
    ${panel.moderators?.length ? `
      <div class="chip-row" style="margin-bottom:8px">
        ${panel.moderators.map(m => personChip(m, 'Moderator')).join('')}
      </div>` : ''}
    ${panel.panelists?.length ? `
      <div class="chip-row">
        ${panel.panelists.map(p => personChip(p, 'Panelist')).join('')}
      </div>` : ''}
    ${panel.topics?.length ? `
      <p class="section-label">Topics</p>
      <div class="chip-row">
        ${panel.topics.map(t => `<span class="chip">${esc(t)}</span>`).join('')}
      </div>` : ''}`;
}

function sessionModeratorsHtml(list) {
  if (!list?.length) return '';
  return `
    <p class="section-label">Moderators</p>
    <div class="chip-row">${list.map(m => personChip(m, 'Moderator')).join('')}</div>`;
}

function sessionHtml(item) {
  let search = JSON.stringify(item).toLowerCase();
  if (item.start) search += ' ' + toHHMM(toMin(item.start));
  if (item.end) search += ' ' + toHHMM(toMin(item.end));

  if (item.type === 'info' || item.type === 'break') {
    const cls = item.type === 'break' ? 'compact' : 'compact';
    return `
      <article class="session ${cls}" data-id="${esc(item.id)}" data-search="${esc(search)}">
        <div class="time">${timeRange(item.start, item.end)}</div>
        <div class="title">${esc(item.title)}</div>
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
    if (!rooms.length) return '';
    return `
      <article class="session" data-id="${esc(item.id)}" data-search="${esc(search)}">
        <button class="session-head" aria-expanded="false">
          <div class="time-col">${timeRange(item.start, item.end)}</div>
          <div class="head-main">
            <div class="kicker"><span class="badge">${esc(item.label)}</span>${roleBadgesHtml(item)}</div>
            <h2 class="session-title">Parallel Sessions</h2>
            <p class="session-sub">${rooms.map(r => `Room ${esc(r.id)}`).join(' · ')}</p>
          </div>
          <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="session-body" style="padding-top:4px">
          ${rooms.length > 1 ? `
          <div class="room-tabs" role="tablist">
            ${rooms.map((r, i) => `
              <button class="room-tab ${i === 0 ? 'active' : ''}" data-room="${esc(r.id)}" role="tab">${esc(r.id)}</button>`).join('')}
          </div>` : ''}
          ${rooms.map((r, i) => `
            <div class="room-panel ${i === 0 ? 'active' : ''}" data-room-panel="${esc(r.id)}">
              <p class="room-title">${esc(r.id)} — ${esc(r.title)}</p>
              ${r.subtitle ? `<p class="room-sub">${esc(r.subtitle)}</p>` : ''}
              ${r.badge ? `<p class="room-sub"><span class="badge soft">${esc(r.badge)}</span></p>` : ''}
              ${chairpersonsHtml(r.chairpersons)}
              ${sessionModeratorsHtml(r.moderators)}
              ${panelHtml(r.panel)}
              ${talksHtml(r.talks, item.start)}
            </div>`).join('')}
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
              ${item.badge ? `<span class="badge gold">${esc(item.badge)}</span>` : ''}
              ${roleBadgesHtml(item)}
            </div>
            <h2 class="session-title">${esc(item.title)}</h2>
            ${item.subtitle ? `<p class="session-sub">${esc(item.subtitle)}</p>` : ''}
          </div>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <div class="session-body">
        ${chairpersonsHtml(item.chairpersons)}
        ${sessionModeratorsHtml(item.moderators)}
        ${talksHtml(item.talks, item.start)}
        ${panelHtml(item.panel)}
      </div>
    </article>`;
}

function formatDate(day) {
  return new Date(day.date + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function render() {
  if (!program) return;

  if (speakerFilter) {
    const person = collectSpeakers(program).find(p => samePerson(p.name, speakerFilter));
    const roleTxt = person?.roles?.length ? ` (${person.roles.join(' · ')})` : '';
    dayLabel.textContent = `${speakerFilter}${roleTxt}`;
    let html = '';
    let count = 0;
    for (const day of program.days) {
      const items = day.items.filter(it => itemHasSpeaker(it, speakerFilter));
      if (!items.length) continue;
      count += items.length;
      html += `<div class="filter-day">${esc(day.weekday)} · ${esc(formatDate(day))}</div>`;
      html += `<div class="timeline">${items.map(sessionHtml).join('')}</div>`;
    }
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
  const head = card.querySelector('.session-head');
  if (head) head.setAttribute('aria-expanded', String(open));
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
  scheduleEl.querySelectorAll('.session-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.session');
      setCardOpen(card, !card.classList.contains('open'));
      updateExpandBtn();
    });
  });

  scheduleEl.querySelectorAll('.room-tabs').forEach(tabs => {
    tabs.addEventListener('click', e => {
      const tab = e.target.closest('.room-tab');
      if (!tab) return;
      const card = tab.closest('.session');
      const roomId = tab.dataset.room;
      card.querySelectorAll('.room-tab').forEach(t => t.classList.toggle('active', t === tab));
      card.querySelectorAll('.room-panel').forEach(p =>
        p.classList.toggle('active', p.dataset.roomPanel === roomId));
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
      if (talkHit) card.classList.add('open');
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
  applyFilter();
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

async function init() {
  try {
    const res = await fetch('data/program.json');
    program = await res.json();
    populateSpeakers();
    render();
  } catch (err) {
    scheduleEl.innerHTML = '<p class="no-results">Could not load the program. Please reopen the app.</p>';
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
