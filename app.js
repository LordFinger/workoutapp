'use strict';
/* Gym Tracker — offline-first app. All data lives in localStorage on this device.
   Screens: Workout (today + set logging), Nutrition, Program, Body (measurements + weight). */

const STORAGE_KEY = 'gymtracker.v1';
const CYCLE_WEEKS = 8;
const SEED_FOODS = [];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => {
  const x = d || new Date();
  return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
};
// Test hook: window.__TODAY__ = 'YYYY-MM-DD' pins the date.
const todayStr = () => (typeof window !== 'undefined' && window.__TODAY__) || dateStr();
const parseDate = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
const fmtShort = (s) => parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLong = (s) => parseDate(s).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const weekday = (s) => parseDate(s).toLocaleDateString('en-US', { weekday: 'long' });
const num = (v) => {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r1 = (n) => Math.round(n * 10) / 10;
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const mmss = (sec) => pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
const minus = (n) => (n < 0 ? '−' : n > 0 ? '+' : '');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function defaultState() {
  return {
    v: 1,
    startDate: todayStr(),            // first day of week 1
    schedule: Object.assign({}, DEFAULT_SCHEDULE),
    sessionOverride: {},              // date -> session id | 'rest'
    targets: { kcal: 2100, p: 175, c: 175, f: 78 },
    workouts: {},                     // date -> { sets: {exId: [{lb,reps,done}]}, swaps: {exId: name} }
    food: {},                         // date -> { breakfast: [{name,kcal,p,c,f}], ... }
    foods: SEED_FOODS.slice(),        // saved foods
    weights: [],                      // [{date, kg}]
    measures: {},                     // partId -> [{date, cm}]
    lastBackup: null                  // ISO string
  };
}

function normalize(o) {
  const d = defaultState();
  const s = Object.assign({}, d, o || {});
  s.targets = Object.assign({}, d.targets, (o && o.targets) || {});
  s.schedule = Object.assign({}, d.schedule, (o && o.schedule) || {});
  ['sessionOverride', 'workouts', 'food', 'measures'].forEach((k) => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
  ['foods', 'weights'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Could not read saved data', e); }
  return defaultState();
}

let S = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch (e) {
    toast('Could not save: storage is full or blocked');
  }
}

// Memory-only UI state
const ui = {
  bodyTab: 'body',
  part: 'chest',
  draftCm: '',
  draftKg: '',
  nutDate: null,
  rest: null
};

// ---------------------------------------------------------------------------
// Program / date logic
// ---------------------------------------------------------------------------
function weekInfo() {
  const days = Math.round((parseDate(todayStr()) - parseDate(S.startDate)) / 86400000);
  const week = Math.max(1, Math.floor(days / 7) + 1);
  return { week, deload: week === 7 || week === 8, over: week > CYCLE_WEEKS };
}

function sessionIdFor(d) {
  const o = S.sessionOverride[d];
  if (o === 'rest') return null;
  if (o && SESSIONS[o]) return o;
  const planned = S.schedule[parseDate(d).getDay()];
  return planned && SESSIONS[planned] ? planned : null;
}

function plannedSets(ex, wk) { return wk.deload ? Math.min(ex.sets, 2) : ex.sets; }

function findEx(id) {
  const keys = Object.keys(SESSIONS);
  for (let k = 0; k < keys.length; k++) {
    const s = SESSIONS[keys[k]];
    const i = s.exercises.findIndex((e) => e.id === id);
    if (i >= 0) return { sid: keys[k], s, ex: s.exercises[i], i };
  }
  return null;
}

function dayLog(d) {
  if (!S.workouts[d]) S.workouts[d] = { sets: {}, swaps: {} };
  if (!S.workouts[d].sets) S.workouts[d].sets = {};
  if (!S.workouts[d].swaps) S.workouts[d].swaps = {};
  return S.workouts[d];
}

function daySets(d, ex) {
  const log = dayLog(d);
  if (!log.sets[ex.id]) {
    const n = plannedSets(ex, weekInfo());
    log.sets[ex.id] = Array.from({ length: n }, () => ({ lb: '', reps: '', done: false }));
  }
  return log.sets[ex.id];
}

function exName(d, ex) {
  const w = S.workouts[d];
  return (w && w.swaps && w.swaps[ex.id]) || ex.name;
}

function doneCount(d, ex) {
  const w = S.workouts[d];
  const rows = (w && w.sets && w.sets[ex.id]) || [];
  return rows.filter((r) => r.done).length;
}

function lastTime(exId, before) {
  const dates = Object.keys(S.workouts).filter((x) => x < before).sort().reverse();
  for (let i = 0; i < dates.length; i++) {
    const rows = ((S.workouts[dates[i]].sets || {})[exId] || []).filter((r) => r.done);
    if (rows.length) return { date: dates[i], rows };
  }
  return null;
}

function lastTimeText(lt, unit) {
  const u = unit === 'sec' ? ' s' : '';
  const lbs = Array.from(new Set(lt.rows.map((r) => r.lb)));
  if (lbs.length === 1 && lbs[0] !== '') return lbs[0] + ' lb × ' + lt.rows.map((r) => r.reps + u).join(', ');
  return lt.rows.map((r) => (r.lb !== '' ? r.lb + ' lb' : 'bodyweight') + ' × ' + r.reps + u).join(' · ');
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function viewToday() {
  const d = todayStr();
  const wk = weekInfo();
  const sid = sessionIdFor(d);
  const sess = sid ? SESSIONS[sid] : null;

  let html = '<div class="screen">';
  html += '<div class="head"><div class="eyebrow">Week ' + wk.week + (wk.over ? ' · cycle complete' : '') + ' · ' + esc(weekday(d)) + '</div>';
  html += '<h1 class="title">' + (sess ? esc(sess.name) : 'Rest day') + '</h1>';
  html += '<div class="subtitle">' + (sess ? esc(sess.focus) : 'Recovery is when the muscles grow.') + '</div></div>';

  if (wk.deload) {
    html += '<div class="banner">Deload week: use 40–50% less weight and do 2 sets per exercise.</div>';
  }
  const hasData = Object.keys(S.workouts).length > 0 || S.weights.length > 0;
  const daysSince = S.lastBackup ? Math.floor((Date.now() - new Date(S.lastBackup).getTime()) / 86400000) : null;
  if (hasData && (daysSince === null || daysSince >= 14)) {
    html += '<div class="banner warn">' + (daysSince === null ? 'No backup yet.' : 'Last backup was ' + daysSince + ' days ago.') +
      ' <a class="link-btn" href="#/program">Back up now</a></div>';
  }

  if (sess) {
    const sets = sum(sess.exercises, (e) => plannedSets(e, wk));
    const mins = Math.max(5, Math.round(sum(sess.exercises, (e) => plannedSets(e, wk) * (e.rest + 40)) / 60 / 5) * 5);
    html += '<div class="card stats"><div><div class="stat-num">' + sess.exercises.length + '</div><div class="stat-lbl">exercises</div></div>' +
      '<div><div class="stat-num">' + sets + '</div><div class="stat-lbl">work sets</div></div>' +
      '<div><div class="stat-num">≈ ' + mins + '</div><div class="stat-lbl">minutes</div></div></div>';

    html += '<div class="section-label">Exercises</div><div class="card flush">';
    let firstOpen = null;
    sess.exercises.forEach((ex) => {
      const need = plannedSets(ex, wk);
      const done = doneCount(d, ex);
      const status = done >= need ? 'done' : done > 0 ? 'half' : '';
      if (!firstOpen && done < need) firstOpen = ex;
      html += '<a class="row" href="#/log/' + ex.id + '"><span class="ring ' + status + '"></span>' +
        '<span class="grow">' + esc(exName(d, ex)) + '</span>' +
        '<span class="meta">' + (done ? done + '/' : '') + need + ' × ' + esc(ex.reps) + (ex.unit === 'sec' ? ' s' : '') + '</span></a>';
    });
    html += '</div>';
    html += firstOpen
      ? '<a class="btn cta" href="#/log/' + firstOpen.id + '">' + (Object.keys((S.workouts[d] || {}).sets || {}).length ? 'Continue workout' : 'Start workout') + '</a>'
      : '<div class="banner">Workout complete. Nice work.</div>';
  } else {
    html += '<div class="card"><div class="muted">No session planned for today. You can still train: pick one below.</div></div>';
  }

  const cur = S.sessionOverride[d] || 'auto';
  const planned = S.schedule[parseDate(d).getDay()];
  html += '<label class="field" for="session-pick">Today\'s session</label>' +
    '<select class="input" id="session-pick" data-change="session-pick">' +
    '<option value="auto"' + (cur === 'auto' ? ' selected' : '') + '>Planned: ' + (planned && SESSIONS[planned] ? esc(SESSIONS[planned].name) : 'Rest') + '</option>' +
    '<option value="rest"' + (cur === 'rest' ? ' selected' : '') + '>Rest day</option>' +
    Object.keys(SESSIONS).map((k) => '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + esc(SESSIONS[k].name) + '</option>').join('') +
    '</select>';
  html += '</div>';
  return html;
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function viewLog(exId) {
  const found = findEx(exId);
  if (!found) return '<div class="screen"><a class="back" href="#/today">‹ Back</a><p>Exercise not found.</p></div>';
  const { s, ex, i } = found;
  const d = todayStr();
  const wk = weekInfo();
  const rows = daySets(d, ex);
  const unit = ex.unit === 'sec' ? 'sec' : 'reps';
  const lt = lastTime(ex.id, d);
  const firstOpen = rows.findIndex((r) => !r.done);
  const swapped = exName(d, ex) !== ex.name;
  const need = plannedSets(ex, wk);
  const next = s.exercises[i + 1];

  let html = '<div class="screen">';
  html += '<div class="head-row"><a class="back" href="#/today">‹ ' + esc(s.name) + '</a><span class="muted small">Exercise ' + (i + 1) + ' of ' + s.exercises.length + '</span></div>';
  html += '<div style="padding:4px 0 10px"><h1 class="title sm">' + esc(exName(d, ex)) + '</h1>';
  html += '<div class="subtitle" style="font-size:15px">Target ' + need + ' × ' + esc(ex.reps) + (ex.unit === 'sec' ? ' s' : '') +
    (wk.deload ? ' · deload: lighter weight' : ' · stop 1–2 reps before failure') + '</div>';
  if (ex.note && !swapped) html += '<div class="note">' + esc(ex.note) + '</div>';
  if (lt) html += '<div class="note">Last time (' + esc(fmtShort(lt.date)) + '): ' + esc(lastTimeText(lt, ex.unit)) + '</div>';
  html += '</div>';

  html += '<div class="card sets"><div class="sets-head"><span>Set</span><span>lb</span><span>' + (unit === 'sec' ? 'Sec' : 'Reps') + '</span><span></span></div>';
  rows.forEach((r, k) => {
    const prev = lt ? (lt.rows[k] || lt.rows[lt.rows.length - 1]) : null;
    const phLb = prev && prev.lb !== '' ? prev.lb : '';
    const focus = k === firstOpen ? ' accent' : '';
    html += '<div class="set-row' + (r.done ? ' done' : '') + (k === firstOpen ? ' active' : '') + '">' +
      '<span class="set-no">' + (k + 1) + '</span>' +
      '<input class="input num' + focus + '" inputmode="decimal" aria-label="Set ' + (k + 1) + ' weight, lb" placeholder="' + esc(phLb) + '" value="' + esc(r.lb) + '" data-field="lb" data-ex="' + ex.id + '" data-i="' + k + '">' +
      '<input class="input num' + focus + '" inputmode="decimal" aria-label="Set ' + (k + 1) + ' ' + unit + '" placeholder="' + esc(ex.reps) + '" value="' + esc(r.reps) + '" data-field="reps" data-ex="' + ex.id + '" data-i="' + k + '">' +
      '<button class="check' + (r.done ? ' on' : '') + '" data-act="toggle-set" data-ex="' + ex.id + '" data-i="' + k + '" aria-pressed="' + (r.done ? 'true' : 'false') + '" aria-label="' + (r.done ? 'Unmark' : 'Mark') + ' set ' + (k + 1) + ' done">' + CHECK_SVG + '</button></div>';
  });
  html += '<div class="set-tools"><button class="link-btn" data-act="add-set" data-ex="' + ex.id + '">+ Add set</button>' +
    (rows.length > 1 ? '<button class="link-btn" style="color:var(--muted)" data-act="rm-set" data-ex="' + ex.id + '">Remove last set</button>' : '') + '</div></div>';

  if (ui.rest) {
    const left = Math.max(0, Math.ceil((ui.rest.end - Date.now()) / 1000));
    html += '<div class="rest" id="rest-card"><div><div class="rest-lbl">Rest</div><div class="rest-time" id="rest-time">' + (left > 0 ? mmss(left) : 'Go') + '</div></div>' +
      '<div class="btns"><button data-act="rest-add">+15s</button><button class="light" data-act="rest-skip">Skip</button></div></div>';
  }

  if (ex.alts && ex.alts.length) {
    html += '<div class="card"><div class="swap-title">Machine taken? Swap it</div>';
    ex.alts.forEach((a, k) => {
      html += '<button class="swap-row" data-act="swap" data-ex="' + ex.id + '" data-i="' + k + '"><span>' + esc(a) + '</span><span>Use</span></button>';
    });
    if (swapped) html += '<button class="swap-row" data-act="unswap" data-ex="' + ex.id + '"><span>Back to ' + esc(ex.name) + '</span><span>Reset</span></button>';
    html += '</div>';
  }

  html += next
    ? '<a class="btn cta" href="#/log/' + next.id + '">Next exercise</a>'
    : '<a class="btn cta" href="#/today">Finish workout</a>';
  html += '</div>';
  return html;
}

// ----- nutrition -----
function foodDay(d) {
  const day = S.food[d] || {};
  MEALS.forEach((m) => { if (!Array.isArray(day[m.id])) day[m.id] = []; });
  return day;
}
function foodTotals(d) {
  const day = foodDay(d);
  const all = [].concat.apply([], MEALS.map((m) => day[m.id]));
  return { kcal: sum(all, (x) => x.kcal || 0), p: sum(all, (x) => x.p || 0), c: sum(all, (x) => x.c || 0), f: sum(all, (x) => x.f || 0) };
}

function viewNutrition() {
  if (!ui.nutDate) ui.nutDate = todayStr();
  const d = ui.nutDate;
  const t = foodTotals(d);
  const T = S.targets;
  const day = foodDay(d);
  const isToday = d >= todayStr();
  const left = T.kcal - t.kcal;

  let html = '<div class="screen"><div class="head"><div class="head-row"><div class="eyebrow">' + esc(fmtLong(d)) + (d === todayStr() ? ' · Today' : '') + '</div>' +
    '<div class="day-nav"><button class="icon-btn" data-act="nut-prev" aria-label="Previous day">‹</button><button class="icon-btn" data-act="nut-next" aria-label="Next day"' + (isToday ? ' disabled style="opacity:.3"' : '') + '>›</button></div></div>' +
    '<h1 class="title">Nutrition</h1></div>';

  html += '<div class="card"><div class="kcal-row"><div><span class="big-num">' + Math.round(t.kcal) + '</span> <span class="muted">/ ' + T.kcal + ' kcal</span></div>' +
    '<span style="font-size:14px;font-weight:600;color:' + (left >= 0 ? 'var(--green)' : '#A32A0B') + '">' + (left >= 0 ? Math.round(left) + ' left' : Math.round(-left) + ' over') + '</span></div>' +
    '<div class="bar"><i style="width:' + Math.min(100, (t.kcal / T.kcal) * 100) + '%"></i></div>' +
    '<button class="link-btn" data-act="edit-targets" style="margin-top:4px">Edit targets</button></div>';

  const macro = (label, val, tgt) =>
    '<div class="macro"><div class="macro-head"><span style="font-weight:600">' + label + '</span><span class="muted">' + r1(val) + ' / ' + tgt + ' g</span></div>' +
    '<div class="bar thin"><i style="width:' + Math.min(100, (val / tgt) * 100) + '%"></i></div></div>';
  html += '<div class="card" style="padding-top:6px;padding-bottom:6px">' + macro('Protein', t.p, T.p) + macro('Carbs', t.c, T.c) + macro('Fat', t.f, T.f) + '</div>';

  html += '<div class="section-label">Meals</div>';
  MEALS.forEach((m) => {
    const items = day[m.id];
    html += '<div class="card flush" style="margin-top:8px"><div class="row" style="background:#FAF9F6;min-height:44px"><span class="grow" style="font-weight:600">' + m.label + '</span>' +
      '<span class="meta">' + Math.round(sum(items, (x) => x.kcal || 0)) + ' kcal</span>' +
      '<button class="link-btn" data-act="add-food" data-meal="' + m.id + '" aria-label="Add food to ' + m.label.toLowerCase() + '">+ Add</button></div>';
    items.forEach((it, k) => {
      html += '<div class="row"><span class="grow">' + esc(it.name) + '</span><span class="meta">' + Math.round(it.kcal || 0) + ' kcal</span>' +
        '<button class="icon-btn" style="width:36px" data-act="del-food" data-meal="' + m.id + '" data-i="' + k + '" aria-label="Delete ' + esc(it.name) + '">×</button></div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ----- program -----
function viewProgram() {
  const wk = weekInfo();
  const d = todayStr();
  let html = '<div class="screen"><div class="head"><div class="eyebrow">Upper / Lower · 4 days a week</div><h1 class="title">Program</h1></div>';
  html += '<ul class="weeks" aria-label="Weeks of the cycle">';
  for (let w = 1; w <= CYCLE_WEEKS; w++) {
    const deload = w >= 7;
    html += '<li class="' + (w === wk.week ? 'now ' : '') + (deload ? 'deload' : '') + '" aria-label="Week ' + w + (deload ? ', deload' : '') + (w === wk.week ? ', current' : '') + '">' + w + '</li>';
  }
  html += '</ul><div class="note">Weeks 7–8 are deload: cut weight by 40–50% and do 2 sets per exercise.' + (wk.over ? ' Your 8-week cycle is complete: change the start date below to begin a new one.' : '') + '</div>';

  html += '<div class="section-label">Week ' + Math.min(wk.week, CYCLE_WEEKS) + '</div><div class="card flush">';
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' };
  const todayIdx = parseDate(d).getDay();
  order.forEach((idx) => {
    const sid = S.schedule[idx];
    const s = sid && SESSIONS[sid];
    html += (s ? '<button class="row" style="width:100%;border:none;border-top:1px solid var(--line-soft);background:#fff;text-align:left" data-act="view-session" data-id="' + sid + '">' : '<div class="row">') +
      '<span class="day-name"' + (idx === todayIdx ? ' style="color:var(--accent)"' : '') + '>' + names[idx] + '</span>' +
      '<span class="grow" style="' + (s ? 'font-weight:600' : 'color:var(--muted);font-weight:400') + '">' + (s ? esc(s.name) : 'Rest') + '</span>' +
      (s ? '<span class="meta">' + esc(s.focus) + '</span>' : '') +
      (idx === todayIdx ? '<span class="pill">Today</span>' : '') +
      (s ? '</button>' : '</div>');
  });
  html += '</div>';

  html += '<div class="card"><label class="field" for="start-date" style="margin-top:0">Week 1 starts on</label>' +
    '<input class="input" type="date" id="start-date" value="' + esc(S.startDate) + '" data-change="start-date"></div>';

  const backupTxt = S.lastBackup ? 'Last backup: ' + new Date(S.lastBackup).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No backup yet.';
  html += '<div class="card"><div style="font-size:15px;font-weight:600">Your data stays on this iPhone</div>' +
    '<div class="muted" style="font-size:14px;margin:2px 0 12px">Works offline. ' + esc(backupTxt) + ' Save a backup file every couple of weeks.</div>' +
    '<div class="btn-row"><button class="btn sm" data-act="export">Export backup</button>' +
    '<label class="btn sm secondary" for="import-file" style="cursor:pointer">Import</label></div>' +
    '<input type="file" id="import-file" accept="application/json,.json" hidden data-change="import-file">' +
    '<button class="link-btn" style="color:#A32A0B;margin-top:8px" data-act="wipe">Delete all data</button></div>';
  html += '</div>';
  return html;
}

// ----- body -----
const FIGURE_SVG =
  '<svg class="fig" viewBox="0 0 350 340" aria-hidden="true">' +
  '<g transform="translate(105,10)" fill="#E4E1D9" stroke="#CFCBC1" stroke-width="1.5" stroke-linejoin="round">' +
  '<circle cx="70" cy="18" r="16"/><rect x="62" y="32" width="16" height="16" rx="3"/>' +
  '<path d="M34 58 Q70 48 106 58 L108 84 Q100 100 98 118 Q104 132 106 148 Q70 158 34 148 Q36 132 42 118 Q40 100 32 84 Z"/>' +
  '<path d="M30 60 Q16 64 14 84 L8 130 Q6 142 12 152 L24 150 Q26 140 28 130 L36 92 Z"/>' +
  '<path transform="translate(140,0) scale(-1,1)" d="M30 60 Q16 64 14 84 L8 130 Q6 142 12 152 L24 150 Q26 140 28 130 L36 92 Z"/>' +
  '<path d="M36 150 L68 152 L66 232 L62 306 L44 306 L42 232 Z"/>' +
  '<path transform="translate(140,0) scale(-1,1)" d="M36 150 L68 152 L66 232 L62 306 L44 306 L42 232 Z"/></g>' +
  '<g stroke="#8A8E85" stroke-width="1.5" stroke-linecap="round">' +
  '<line x1="100" y1="38" x2="170" y2="50"/><line x1="100" y1="92" x2="150" y2="92"/><line x1="100" y1="142" x2="152" y2="128"/><line x1="100" y1="200" x2="156" y2="200"/>' +
  '<line x1="250" y1="62" x2="205" y2="68"/><line x1="250" y1="114" x2="218" y2="110"/><line x1="250" y1="166" x2="205" y2="160"/><line x1="250" y1="275" x2="196" y2="275"/></g>' +
  '<g fill="#5F635B"><circle cx="170" cy="50" r="4"/><circle cx="150" cy="92" r="4"/><circle cx="152" cy="128" r="4"/><circle cx="156" cy="200" r="4"/>' +
  '<circle cx="205" cy="68" r="4"/><circle cx="218" cy="110" r="4"/><circle cx="205" cy="160" r="4"/><circle cx="196" cy="275" r="4"/></g></svg>';

function sparkline(values) {
  if (values.length < 2) return '';
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const span = (max - min) || 1;
  const pts = values.map((v, i) => [4 + i * (112 / (values.length - 1)), 30 - ((v - min) / span) * 24]);
  const last = pts[pts.length - 1];
  return '<svg viewBox="0 0 120 36" width="100%" height="30" role="img" aria-label="Trend of recent entries" style="display:block">' +
    '<polyline points="' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '" fill="none" stroke="#5F635B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4" fill="#C2410C"/></svg>';
}

function viewBody() {
  let html = '<div class="screen"><div class="head"><div class="eyebrow">' + esc(fmtLong(todayStr())) + '</div><h1 class="title">Body measurements</h1></div>';
  html += '<div class="seg"><button data-act="tab-body" aria-pressed="' + (ui.bodyTab === 'body') + '">Body</button>' +
    '<button data-act="tab-weight" aria-pressed="' + (ui.bodyTab === 'weight') + '">Weight</button></div>';
  html += ui.bodyTab === 'body' ? viewMeasures() : viewWeight();
  html += '</div>';
  return html;
}

function viewMeasures() {
  let html = '<div class="figure">' + FIGURE_SVG;
  MEASURE_PARTS.forEach((p) => {
    const list = S.measures[p.id] || [];
    const last = list.length ? list[list.length - 1] : null;
    html += '<button class="part ' + p.side + '" style="top:' + (p.y - 22) + 'px" data-act="pick-part" data-id="' + p.id + '" aria-pressed="' + (ui.part === p.id) + '" aria-label="' + esc(p.full) + (last ? ', ' + last.cm + ' centimeters' : ', no data yet') + '">' +
      '<span class="pn">' + esc(p.label) + '</span><span class="pv">' + (last ? r1(last.cm) + ' cm' : '—') + '</span></button>';
  });
  html += '</div>';

  const part = MEASURE_PARTS.find((p) => p.id === ui.part) || MEASURE_PARTS[0];
  const list = S.measures[part.id] || [];
  const last = list.length ? list[list.length - 1] : null;
  const first = list.length ? list[0] : null;

  html += '<div class="card"><div class="detail-head"><span class="detail-title">' + esc(part.full) + '</span>' +
    '<span class="muted small">' + (last ? 'Last: ' + r1(last.cm) + ' cm · ' + esc(fmtShort(last.date)) : 'No entries yet') + '</span></div>' +
    '<label class="field" for="m-input">' + esc(part.full) + ' (cm)</label>' +
    '<div class="input-row"><input class="input focus" id="m-input" inputmode="decimal" placeholder="e.g. 104.5" value="' + esc(ui.draftCm) + '" data-field="cm">' +
    '<button class="btn" data-act="save-measure">Save</button></div>';
  if (list.length) {
    const delta = last.cm - first.cm;
    html += '<div class="grid3"><div><div class="stat-lbl">Since start</div><div class="v">' + (list.length > 1 ? minus(delta) + Math.abs(r1(delta)) + ' cm' : '—') + '</div></div>' +
      '<div><div class="stat-lbl">Entries</div><div class="v">' + list.length + '</div></div>' +
      '<div><div class="stat-lbl">Trend</div>' + (sparkline(list.slice(-8).map((e) => e.cm)) || '<div class="v">—</div>') + '</div></div>';
  } else {
    html += '<div class="note" style="border-top:1px solid var(--line-soft);margin-top:12px;padding-top:10px">Measure, type the number in cm and save to start the statistics.</div>';
  }
  html += '</div>';

  if (list.length) {
    html += '<div class="section-label">History</div><div class="card flush">';
    list.map((e, k) => ({ e, k })).reverse().slice(0, 6).forEach((x) => {
      html += '<div class="hist-row"><span>' + esc(fmtShort(x.e.date)) + '</span><span class="rv">' + r1(x.e.cm) + ' cm</span>' +
        '<button class="icon-btn" style="width:40px" data-act="del-measure" data-id="' + part.id + '" data-i="' + x.k + '" aria-label="Delete entry from ' + esc(fmtShort(x.e.date)) + '">×</button></div>';
    });
    html += '</div>';
  }
  return html;
}

function weightChart() {
  const list = S.weights.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!list.length) return '';
  const first = list[0];
  const t0 = parseDate(first.date);
  const dayOf = (s) => Math.round((parseDate(s) - t0) / 86400000);
  const lastDay = dayOf(list[list.length - 1].date);
  const weeks = Math.max(8, Math.ceil(lastDay / 7 / 2) * 2);
  const maxDay = weeks * 7;
  const lowEnd = first.kg - 0.35 * weeks;
  const highEnd = first.kg - 0.25 * weeks;
  const midEnd = first.kg - 0.3 * weeks;
  const vals = list.map((p) => p.kg).concat([lowEnd, first.kg]);
  let yMin = Math.floor(Math.min.apply(null, vals) - 0.3);
  let yMax = Math.ceil(Math.max.apply(null, vals) + 0.3);
  if (yMax - yMin < 2) yMax = yMin + 2;
  const step = (yMax - yMin) <= 6 ? 1 : 2;
  const X = (day) => 36 + (day / maxDay) * 270;
  const Y = (kg) => 120 - ((kg - yMin) / (yMax - yMin)) * 110;

  let g = '';
  for (let v = yMin; v <= yMax; v += step) {
    g += '<line x1="36" y1="' + Y(v).toFixed(1) + '" x2="306" y2="' + Y(v).toFixed(1) + '" stroke="#E4E1D9"/>' +
      '<text x="28" y="' + (Y(v) + 4).toFixed(1) + '" font-size="11" fill="#5F635B" text-anchor="end">' + v + '</text>';
  }
  for (let w = 0; w <= weeks; w += 2) {
    g += '<text x="' + X(w * 7).toFixed(1) + '" y="140" font-size="11" fill="#5F635B" text-anchor="middle">' + (w === 0 ? 'Wk 0' : w) + '</text>';
  }
  const band = '<polygon points="' + X(0).toFixed(1) + ',' + Y(first.kg).toFixed(1) + ' ' + X(maxDay) + ',' + Y(highEnd).toFixed(1) + ' ' + X(maxDay) + ',' + Y(lowEnd).toFixed(1) + '" fill="#E4E1D9" fill-opacity="0.8"/>' +
    '<line x1="' + X(0).toFixed(1) + '" y1="' + Y(first.kg).toFixed(1) + '" x2="' + X(maxDay) + '" y2="' + Y(midEnd).toFixed(1) + '" stroke="#5F635B" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round"/>';
  const pts = list.map((p) => X(dayOf(p.date)).toFixed(1) + ',' + Y(p.kg).toFixed(1));
  const line = list.length > 1 ? '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#C2410C" stroke-width="2.5" stroke-linejoin="round"/>' : '';
  const dots = list.map((p) => '<circle cx="' + X(dayOf(p.date)).toFixed(1) + '" cy="' + Y(p.kg).toFixed(1) + '" r="5" fill="#C2410C"/>').join('');
  return '<svg viewBox="0 0 318 150" width="100%" role="img" aria-label="Body weight chart. First entry ' + first.kg + ' kg, latest ' + list[list.length - 1].kg + ' kg." style="display:block;max-width:100%">' +
    g + band + line + dots + '</svg>';
}

function viewWeight() {
  const list = S.weights.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = list.length ? list[list.length - 1] : null;
  const first = list.length ? list[0] : null;
  let html = '<div class="card"><div style="display:flex;align-items:baseline;gap:6px"><span class="big-num" style="font-size:52px">' + (last ? r1(last.kg).toFixed(1) : '—') + '</span>' +
    '<span class="muted" style="font-size:17px">kg' + (list.length > 1 ? ' · ' + minus(last.kg - first.kg) + Math.abs(r1(last.kg - first.kg)) + ' kg since start' : last ? ' · starting weight' : '') + '</span></div>' +
    '<div class="muted" style="margin-top:6px;font-size:14px">Goal pace: −0.25 to −0.35 kg per week while keeping strength.</div></div>';

  if (list.length) {
    html += '<div class="card"><div class="head-row" style="margin-bottom:4px"><span style="font-size:15px;font-weight:600">Weight over time</span><span class="muted small">kg</span></div>' + weightChart() +
      '<div class="muted small" style="margin-top:2px">Dashed line and band: expected pace from your first entry.</div></div>';
  }

  html += '<div class="card"><label class="field" for="w-input" style="margin-top:0">Today\'s weight (kg)</label>' +
    '<div class="input-row"><input class="input focus" id="w-input" inputmode="decimal" placeholder="' + (last ? r1(last.kg).toFixed(1) : '87.0') + '" value="' + esc(ui.draftKg) + '" data-field="kg">' +
    '<button class="btn" data-act="save-weight">Save</button></div>' +
    '<div class="note">Weigh in the morning under the same conditions and compare weekly averages, not single days.</div></div>';

  if (list.length) {
    html += '<div class="section-label">History</div><div class="card flush">';
    list.map((e, k) => ({ e, k })).reverse().slice(0, 7).forEach((x) => {
      html += '<div class="hist-row"><span>' + esc(fmtShort(x.e.date)) + '</span><span class="rv">' + r1(x.e.kg).toFixed(1) + ' kg</span>' +
        '<button class="icon-btn" style="width:40px" data-act="del-weight" data-date="' + x.e.date + '" aria-label="Delete entry from ' + esc(fmtShort(x.e.date)) + '">×</button></div>';
    });
    html += '</div>';
  }
  return html;
}

// ---------------------------------------------------------------------------
// Rendering & routing
// ---------------------------------------------------------------------------
let lastRoute = '';

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '') || 'today';
  const parts = h.split('/');
  return { name: parts[0], args: parts.slice(1) };
}

function render() {
  const app = $('#app');
  const r = currentRoute();
  let html;
  switch (r.name) {
    case 'log': html = viewLog(r.args[0]); break;
    case 'nutrition': html = viewNutrition(); break;
    case 'program': html = viewProgram(); break;
    case 'body': html = viewBody(); break;
    default: html = viewToday();
  }
  const y = window.scrollY;
  app.innerHTML = html;
  const key = r.name + '/' + (r.args[0] || '');
  if (key !== lastRoute) { window.scrollTo(0, 0); lastRoute = key; } else { window.scrollTo(0, y); }
  const tab = r.name === 'log' ? 'today' : r.name;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  refreshFoodList();
}

function refreshFoodList() {
  const dl = $('#foods-dl');
  if (dl) dl.innerHTML = S.foods.map((f) => '<option value="' + esc(f.name) + '"></option>').join('');
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------------------------------------------------------------------------
// Sheets (modal forms)
// ---------------------------------------------------------------------------
function openSheet(title, body) {
  const sh = $('#sheet');
  sh.innerHTML = '<div class="sheet-backdrop" data-act="close-sheet"></div>' +
    '<div class="sheet-panel" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" tabindex="-1">' +
    '<div class="sheet-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">×</button></div>' + body + '</div>';
  sh.hidden = false;
  const first = sh.querySelector('input, select');
  if (first) first.focus(); else sh.querySelector('.sheet-panel').focus();
}
function closeSheet() {
  const sh = $('#sheet');
  sh.hidden = true;
  sh.innerHTML = '';
}

function foodForm(meal) {
  const label = MEALS.find((m) => m.id === meal).label;
  const quick = S.foods.length
    ? '<div class="field" style="margin-top:0">My foods</div><div class="quick">' +
      S.foods.map((f, i) => '<button type="button" data-act="pick-food" data-i="' + i + '">' + esc(f.name) + '</button>').join('') + '</div>'
    : '';
  return '<form data-form="add-food" data-meal="' + meal + '" autocomplete="off">' + quick +
    '<label class="field" for="f-name">Food</label><input class="input" id="f-name" name="name" list="foods-dl" placeholder="e.g. Boiled eggs, 3 pcs" required>' +
    '<div class="grid2"><div><label class="field" for="f-kcal">Calories</label><input class="input" id="f-kcal" name="kcal" inputmode="decimal" placeholder="kcal"></div>' +
    '<div><label class="field" for="f-p">Protein (g)</label><input class="input" id="f-p" name="p" inputmode="decimal"></div>' +
    '<div><label class="field" for="f-c">Carbs (g)</label><input class="input" id="f-c" name="c" inputmode="decimal"></div>' +
    '<div><label class="field" for="f-f">Fat (g)</label><input class="input" id="f-f" name="f" inputmode="decimal"></div></div>' +
    '<div class="note" style="margin-top:6px">Leave calories empty to calculate them from protein, carbs and fat.</div>' +
    '<label class="check-line"><input type="checkbox" name="remember"> Save to my foods</label>' +
    '<button class="btn cta" type="submit">Add to ' + esc(label.toLowerCase()) + '</button></form>';
}

function targetsForm() {
  const T = S.targets;
  return '<form data-form="targets" autocomplete="off"><div class="grid2">' +
    '<div><label class="field" for="t-kcal">Calories</label><input class="input" id="t-kcal" name="kcal" inputmode="decimal" value="' + T.kcal + '"></div>' +
    '<div><label class="field" for="t-p">Protein (g)</label><input class="input" id="t-p" name="p" inputmode="decimal" value="' + T.p + '"></div>' +
    '<div><label class="field" for="t-c">Carbs (g)</label><input class="input" id="t-c" name="c" inputmode="decimal" value="' + T.c + '"></div>' +
    '<div><label class="field" for="t-f">Fat (g)</label><input class="input" id="t-f" name="f" inputmode="decimal" value="' + T.f + '"></div></div>' +
    '<button class="btn cta" type="submit">Save targets</button></form>';
}

// ---------------------------------------------------------------------------
// Rest timer
// ---------------------------------------------------------------------------
function startRest(ex) {
  ui.rest = { end: Date.now() + ex.rest * 1000 };
}
setInterval(() => {
  if (!ui.rest) return;
  const el = $('#rest-time');
  if (!el) return;
  const left = Math.ceil((ui.rest.end - Date.now()) / 1000);
  el.textContent = left > 0 ? mmss(left) : 'Go';
  if (left <= 0 && !ui.rest.buzzed) {
    ui.rest.buzzed = true;
    if (navigator.vibrate) navigator.vibrate(200);
  }
}, 500);

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------
function markBackup() {
  S.lastBackup = new Date().toISOString();
  save();
}

async function exportBackup() {
  const payload = JSON.stringify({ app: 'gymtracker', exportedAt: new Date().toISOString(), data: S }, null, 2);
  const name = 'gymtracker-backup-' + todayStr() + '.json';
  try {
    const file = new File([payload], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Gym Tracker backup' });
      markBackup();
      render();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackup();
  toast('Backup file created');
  render();
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result));
      const data = obj && obj.data ? obj.data : obj;
      if (!data || typeof data !== 'object' || !data.workouts || !data.food) throw new Error('Not a Gym Tracker backup');
      if (!confirm('Replace all data on this device with the backup?')) return;
      S = normalize(data);
      save();
      toast('Backup imported');
      render();
    } catch (e) {
      toast('That file is not a valid backup');
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const actions = {
  'close-sheet': () => closeSheet(),

  'toggle-set': (el) => {
    const found = findEx(el.dataset.ex);
    if (!found) return;
    const d = todayStr();
    const rows = daySets(d, found.ex);
    const k = Number(el.dataset.i);
    const r = rows[k];
    if (!r.done) {
      if (r.reps === '' || num(r.reps) === null) {
        const inp = document.querySelector('input[data-field="reps"][data-i="' + k + '"]');
        if (inp) { inp.classList.add('bad'); inp.focus(); }
        toast('Enter ' + (found.ex.unit === 'sec' ? 'seconds' : 'reps') + ' first');
        return;
      }
      if (r.lb === '') {
        const lt = lastTime(found.ex.id, d);
        const prev = lt ? (lt.rows[k] || lt.rows[lt.rows.length - 1]) : null;
        if (prev && prev.lb !== '') r.lb = prev.lb;
      }
      r.done = true;
      if (k < rows.length - 1) startRest(found.ex); else ui.rest = null;
    } else {
      r.done = false;
    }
    save();
    render();
  },
  'add-set': (el) => {
    const found = findEx(el.dataset.ex);
    if (!found) return;
    daySets(todayStr(), found.ex).push({ lb: '', reps: '', done: false });
    save(); render();
  },
  'rm-set': (el) => {
    const found = findEx(el.dataset.ex);
    if (!found) return;
    const rows = daySets(todayStr(), found.ex);
    if (rows.length > 1) rows.pop();
    save(); render();
  },
  'swap': (el) => {
    const found = findEx(el.dataset.ex);
    if (!found) return;
    dayLog(todayStr()).swaps[found.ex.id] = found.ex.alts[Number(el.dataset.i)];
    save(); render();
  },
  'unswap': (el) => {
    delete dayLog(todayStr()).swaps[el.dataset.ex];
    save(); render();
  },
  'rest-add': () => {
    const base = ui.rest && ui.rest.end > Date.now() ? ui.rest.end : Date.now();
    ui.rest = { end: base + 15000 };
    render();
  },
  'rest-skip': () => { ui.rest = null; render(); },

  'nut-prev': () => { ui.nutDate = addDays(ui.nutDate || todayStr(), -1); render(); },
  'nut-next': () => {
    const n = addDays(ui.nutDate || todayStr(), 1);
    if (n <= todayStr()) { ui.nutDate = n; render(); }
  },
  'add-food': (el) => openSheet('Add food', foodForm(el.dataset.meal)),
  'pick-food': (el) => {
    const f = S.foods[Number(el.dataset.i)];
    if (!f) return;
    const form = el.closest('form');
    form.elements.name.value = f.name;
    form.elements.kcal.value = f.kcal || '';
    form.elements.p.value = f.p || '';
    form.elements.c.value = f.c || '';
    form.elements.f.value = f.f || '';
  },
  'del-food': (el) => {
    const day = foodDay(ui.nutDate || todayStr());
    day[el.dataset.meal].splice(Number(el.dataset.i), 1);
    S.food[ui.nutDate || todayStr()] = day;
    save(); render();
  },
  'edit-targets': () => openSheet('Daily targets', targetsForm()),

  'view-session': (el) => {
    const s = SESSIONS[el.dataset.id];
    openSheet(s.name, '<div class="subtitle" style="font-size:15px">' + esc(s.focus) + '</div><ul class="ex-list">' +
      s.exercises.map((e) => '<li><span>' + esc(e.name) + '</span><span>' + e.sets + ' × ' + esc(e.reps) + (e.unit === 'sec' ? ' s' : '') + '</span></li>').join('') + '</ul>');
  },
  'export': () => { exportBackup(); },
  'wipe': () => {
    if (!confirm('Delete ALL workouts, food, weight and measurements from this device?')) return;
    if (!confirm('This cannot be undone. Delete everything?')) return;
    S = defaultState();
    save();
    toast('All data deleted');
    render();
  },

  'tab-body': () => { ui.bodyTab = 'body'; render(); },
  'tab-weight': () => { ui.bodyTab = 'weight'; render(); },
  'pick-part': (el) => { ui.part = el.dataset.id; ui.draftCm = ''; render(); },
  'save-measure': () => {
    const v = num(ui.draftCm);
    if (v === null || v <= 0) { toast('Enter a number in cm'); return; }
    const id = ui.part;
    const d = todayStr();
    const list = (S.measures[id] || []).filter((e) => e.date !== d);
    list.push({ date: d, cm: v });
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    S.measures[id] = list;
    ui.draftCm = '';
    save();
    toast('Saved');
    render();
  },
  'del-measure': (el) => {
    const list = S.measures[el.dataset.id] || [];
    list.splice(Number(el.dataset.i), 1);
    save(); render();
  },
  'save-weight': () => {
    const v = num(ui.draftKg);
    if (v === null || v <= 0) { toast('Enter your weight in kg'); return; }
    const d = todayStr();
    S.weights = S.weights.filter((e) => e.date !== d);
    S.weights.push({ date: d, kg: v });
    S.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
    ui.draftKg = '';
    save();
    toast('Saved');
    render();
  },
  'del-weight': (el) => {
    S.weights = S.weights.filter((e) => e.date !== el.dataset.date);
    save(); render();
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});

// Typing never re-renders (keeps the keyboard open); values are written straight to state.
document.addEventListener('input', (e) => {
  const t = e.target;
  const field = t.dataset && t.dataset.field;
  if (!field) return;
  if (t.classList) t.classList.remove('bad');
  if (field === 'lb' || field === 'reps') {
    const found = findEx(t.dataset.ex);
    if (!found) return;
    daySets(todayStr(), found.ex)[Number(t.dataset.i)][field] = t.value.replace(',', '.');
    save();
  } else if (field === 'cm') {
    ui.draftCm = t.value;
  } else if (field === 'kg') {
    ui.draftKg = t.value;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const what = t.dataset && t.dataset.change;
  if (!what) return;
  if (what === 'session-pick') {
    const d = todayStr();
    if (t.value === 'auto') delete S.sessionOverride[d]; else S.sessionOverride[d] = t.value;
    save(); render();
  } else if (what === 'start-date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { S.startDate = t.value; save(); render(); }
  } else if (what === 'import-file') {
    if (t.files && t.files[0]) importBackup(t.files[0]);
    t.value = '';
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  const kind = form.dataset && form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const val = (n) => num(form.elements[n].value);
  if (kind === 'add-food') {
    const name = form.elements.name.value.trim();
    if (!name) return;
    const p = val('p') || 0;
    const c = val('c') || 0;
    const f = val('f') || 0;
    let kcal = val('kcal');
    if (kcal === null) kcal = p * 4 + c * 4 + f * 9;
    const item = { name, kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(f) };
    const d = ui.nutDate || todayStr();
    const day = foodDay(d);
    day[form.dataset.meal].push(item);
    S.food[d] = day;
    if (form.elements.remember.checked && !S.foods.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      S.foods.push(Object.assign({}, item));
    }
    save();
    closeSheet();
    render();
  } else if (kind === 'targets') {
    ['kcal', 'p', 'c', 'f'].forEach((k) => { const v = val(k); if (v !== null && v > 0) S.targets[k] = v; });
    save();
    closeSheet();
    render();
  }
});

window.addEventListener('hashchange', () => { closeSheet(); render(); });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
render();

if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered', err));
  });
}
