'use strict';
// Default training program: Upper/Lower split, 4 days a week, 8-week cycle.
// Weeks 7-8 are deload weeks (about 40-50% lighter, 2 sets per exercise).
// Shoulder note: horizontal pressing is avoided; vertical presses, lateral raises
// and rear-delt/rotator-cuff work are used instead.

const SESSIONS = {
  upperA: {
    name: 'Upper A',
    focus: 'Strength · 5–8 reps',
    exercises: [
      { id: 'ua1', name: 'External rotation, band', sets: 2, reps: '15', rest: 60,
        note: 'Rotator cuff warm-up. Light band, slow reps.',
        alts: ['Dumbbell external rotation, very light'] },
      { id: 'ua2', name: 'Lat pulldown, wide grip', sets: 4, reps: '5–8', rest: 150,
        alts: ['Assisted pull-ups', 'Pull-ups with a band', 'One-arm dumbbell row'] },
      { id: 'ua3', name: 'Bent-over row, neutral grip', sets: 4, reps: '5–8', rest: 150,
        note: 'Elbows close to the body.',
        alts: ['Bent-over dumbbell row', 'T-bar row'] },
      { id: 'ua4', name: 'Incline dumbbell press, 30°', sets: 3, reps: '6–8', rest: 150,
        note: 'Neutral grip. Stop at the first shoulder discomfort and switch to cable crossover or pec-dec.',
        alts: ['Smith machine incline press', 'Hammer press', 'Pec-dec'] },
      { id: 'ua5', name: 'Dumbbell fly, flat', sets: 3, reps: '10–12', rest: 90,
        note: 'Light weight, feel the stretch at the bottom.',
        alts: ['Cable crossover, low to high', 'Pec-dec'] },
      { id: 'ua6', name: 'Seated dumbbell shoulder press', sets: 3, reps: '6–8', rest: 120,
        note: 'Vertical plane is comfortable for the shoulder.',
        alts: ['Machine shoulder press', 'Seated barbell press'] },
      { id: 'ua7', name: 'Rear delt fly, bent-over', sets: 3, reps: '12–15', rest: 90,
        note: 'Direct rear-delt work protects the shoulder.',
        alts: ['Reverse pec-dec', 'Cable rear delt fly'] },
      { id: 'ua8', name: 'EZ-bar curl', sets: 3, reps: '8–10', rest: 90,
        alts: ['Dumbbell curl, alternating', 'Cable curl'] },
      { id: 'ua9', name: 'Close-grip EZ-bar press', sets: 3, reps: '8–10', rest: 90,
        note: 'Elbows close to the body.',
        alts: ['Cable triceps pushdown', 'Lying dumbbell triceps extension'] }
    ]
  },

  lowerA: {
    name: 'Lower A',
    focus: 'Strength · 5–8 reps',
    exercises: [
      { id: 'la1', name: 'Back squat', sets: 4, reps: '5–8', rest: 180,
        alts: ['Smith machine squat', 'Leg press, heavy and low reps'] },
      { id: 'la2', name: 'Romanian deadlift', sets: 4, reps: '6–8', rest: 150,
        note: 'Neutral grip, bar close to the legs.',
        alts: ['Dumbbell Romanian deadlift', 'Weighted back extension'] },
      { id: 'la3', name: 'Leg press, narrow stance', sets: 3, reps: '8–10', rest: 120,
        alts: ['Smith machine squat, narrow stance', 'Hack squat'] },
      { id: 'la4', name: 'Leg curl, machine', sets: 3, reps: '10–12', rest: 90,
        alts: ['Standing leg curl', 'Stability-ball leg curl'] },
      { id: 'la5', name: 'Standing calf raise', sets: 4, reps: '8–12', rest: 75,
        alts: ['Smith machine calf raise', 'Single-leg dumbbell calf raise'] },
      { id: 'la6', name: 'Plank', sets: 3, reps: '30–45', unit: 'sec', rest: 60,
        note: 'Hold with a straight line from head to heels. Log seconds.',
        alts: ['Side plank', 'Dead bug'] }
    ]
  },

  upperB: {
    name: 'Upper B',
    focus: 'Volume · 10–15 reps',
    exercises: [
      { id: 'ub1', name: 'Hammer row / seated cable row', sets: 4, reps: '10–12', rest: 120,
        note: 'Neutral grip.',
        alts: ['One-arm dumbbell row'] },
      { id: 'ub2', name: 'One-arm dumbbell row', sets: 3, reps: '12–15', rest: 90,
        alts: ['Hammer row', 'Lever row'] },
      { id: 'ub3', name: 'Cable crossover', sets: 4, reps: '12–15', rest: 90,
        note: 'Shoulder-safe chest work in place of horizontal pressing.',
        alts: ['Pec-dec', 'Dumbbell fly, light', 'Hammer press, narrow grip'] },
      { id: 'ub4', name: 'Bench dips', sets: 3, reps: '12–15', rest: 90,
        note: 'Torso upright, elbows pointing back. Add weight on your lap when easy.',
        alts: ['Cable triceps pushdown, rope'] },
      { id: 'ub5', name: 'Seated machine shoulder press', sets: 3, reps: '12–15', rest: 90,
        alts: ['Seated dumbbell shoulder press', 'Arnold press'] },
      { id: 'ub6', name: 'Face pull', sets: 3, reps: '15–20', rest: 60,
        note: 'Rear delts and rotator cuff. Pull to the face, elbows high.',
        alts: ['Cable rear delt fly', 'Bent-over face pull, dumbbells'] },
      { id: 'ub7', name: 'Dumbbell lateral raise', sets: 3, reps: '15–20', rest: 60,
        note: 'Light weight. Stop at shoulder height if going higher bothers the shoulder.',
        alts: ['Cable lateral raise'] },
      { id: 'ub8', name: 'Hammer curl', sets: 3, reps: '12–15', rest: 60,
        alts: ['Rope cable curl'] },
      { id: 'ub9', name: 'Cable triceps extension', sets: 3, reps: '15', rest: 60,
        alts: ['Rope pushdown'] }
    ]
  },

  lowerB: {
    name: 'Lower B',
    focus: 'Volume · 10–15 reps',
    exercises: [
      { id: 'lb1', name: 'Leg press, wide stance', sets: 4, reps: '10–12', rest: 120,
        note: 'Emphasis on glutes.',
        alts: ['Smith machine sumo squat', 'Hack squat, wide stance'] },
      { id: 'lb2', name: 'Dumbbell lunges', sets: 3, reps: '12–15', rest: 90,
        note: 'Reps per leg.',
        alts: ['Bulgarian split squat', 'Step-ups'] },
      { id: 'lb3', name: 'Leg extension', sets: 3, reps: '15', rest: 75,
        alts: ['Smith machine squat with a pause'] },
      { id: 'lb4', name: 'Hip thrust', sets: 4, reps: '12–15', rest: 120,
        alts: ['Hip thrust machine', 'Floor glute bridge, weighted'] },
      { id: 'lb5', name: 'Lying leg curl', sets: 3, reps: '15', rest: 75,
        alts: ['Seated leg curl', 'Stability-ball leg curl'] },
      { id: 'lb6', name: 'Seated calf raise', sets: 4, reps: '15–20', rest: 60,
        alts: ['Standing calf raise'] },
      { id: 'lb7', name: 'Ab wheel rollout', sets: 3, reps: '10–12', rest: 60,
        alts: ['Plank', 'Hanging knee raise'] }
    ]
  }
};

// ---- Extra sessions: Full Body (3 days a week) and a short shoulder-care routine ----
Object.assign(SESSIONS, {
  fullA: {
    name: 'Full Body A',
    focus: 'Strength · 6–10 reps',
    exercises: [
      { id: 'fa1', name: 'External rotation, band', sets: 2, reps: '15', rest: 45,
        note: 'Rotator cuff warm-up. Light band, slow reps.', alts: ['Dumbbell external rotation, very light'] },
      { id: 'fa2', name: 'Back squat', sets: 3, reps: '6–8', rest: 150,
        alts: ['Smith machine squat', 'Leg press, heavy and low reps'] },
      { id: 'fa3', name: 'Lat pulldown, wide grip', sets: 3, reps: '8–10', rest: 120,
        alts: ['Assisted pull-ups', 'One-arm dumbbell row'] },
      { id: 'fa4', name: 'Seated dumbbell shoulder press', sets: 3, reps: '8–10', rest: 120,
        note: 'Vertical plane is comfortable for the shoulder.', alts: ['Machine shoulder press'] },
      { id: 'fa5', name: 'Romanian deadlift', sets: 3, reps: '8–10', rest: 150,
        alts: ['Dumbbell Romanian deadlift', 'Weighted back extension'] },
      { id: 'fa6', name: 'Cable crossover', sets: 3, reps: '12–15', rest: 75,
        note: 'Shoulder-safe chest work. Stop if the left shoulder burns.', alts: ['Pec-dec', 'Dumbbell fly, light'] },
      { id: 'fa7', name: 'Plank', sets: 3, reps: '30–45', unit: 'sec', rest: 60,
        note: 'Straight line from head to heels. Log seconds.', alts: ['Side plank', 'Dead bug'] }
    ]
  },
  fullB: {
    name: 'Full Body B',
    focus: 'Volume · 8–12 reps',
    exercises: [
      { id: 'fb1', name: 'External rotation, band', sets: 2, reps: '15', rest: 45,
        alts: ['Dumbbell external rotation, very light'] },
      { id: 'fb2', name: 'Leg press, wide stance', sets: 3, reps: '10–12', rest: 120,
        alts: ['Smith machine sumo squat', 'Hack squat, wide stance'] },
      { id: 'fb3', name: 'Bent-over row, neutral grip', sets: 3, reps: '8–10', rest: 120,
        note: 'Elbows close to the body.', alts: ['Bent-over dumbbell row', 'T-bar row'] },
      { id: 'fb4', name: 'Incline dumbbell press, 30°', sets: 3, reps: '8–10', rest: 120,
        note: 'Neutral grip. Stop at the first shoulder discomfort and switch to cable crossover.',
        alts: ['Smith machine incline press', 'Hammer press', 'Pec-dec'] },
      { id: 'fb5', name: 'Hip thrust', sets: 3, reps: '10–12', rest: 120,
        alts: ['Hip thrust machine', 'Floor glute bridge, weighted'] },
      { id: 'fb6', name: 'Dumbbell lateral raise', sets: 3, reps: '12–15', rest: 60,
        note: 'Light weight. Stop at shoulder height if going higher bothers the shoulder.', alts: ['Cable lateral raise'] },
      { id: 'fb7', name: 'Hammer curl', sets: 2, reps: '10–12', rest: 60, alts: ['Rope cable curl'] },
      { id: 'fb8', name: 'Cable triceps extension', sets: 2, reps: '12–15', rest: 60, alts: ['Rope pushdown'] }
    ]
  },
  fullC: {
    name: 'Full Body C',
    focus: 'Volume · 10–15 reps',
    exercises: [
      { id: 'fc1', name: 'External rotation, band', sets: 2, reps: '15', rest: 45,
        alts: ['Dumbbell external rotation, very light'] },
      { id: 'fc2', name: 'Dumbbell lunges', sets: 3, reps: '10–12', rest: 90,
        note: 'Reps per leg.', alts: ['Bulgarian split squat', 'Step-ups'] },
      { id: 'fc3', name: 'Hammer row / seated cable row', sets: 3, reps: '10–12', rest: 90,
        note: 'Neutral grip.', alts: ['One-arm dumbbell row'] },
      { id: 'fc4', name: 'Seated machine shoulder press', sets: 3, reps: '10–12', rest: 90,
        alts: ['Seated dumbbell shoulder press', 'Arnold press'] },
      { id: 'fc5', name: 'Leg curl, machine', sets: 3, reps: '10–12', rest: 75,
        alts: ['Lying leg curl', 'Stability-ball leg curl'] },
      { id: 'fc6', name: 'Pec-dec', sets: 3, reps: '12–15', rest: 75,
        alts: ['Cable crossover', 'Dumbbell fly, light'] },
      { id: 'fc7', name: 'Rear delt fly, bent-over', sets: 3, reps: '12–15', rest: 60,
        alts: ['Reverse pec-dec', 'Cable rear delt fly'] },
      { id: 'fc8', name: 'Standing calf raise', sets: 3, reps: '12–15', rest: 60,
        alts: ['Seated calf raise', 'Single-leg dumbbell calf raise'] },
      { id: 'fc9', name: 'Ab wheel rollout', sets: 2, reps: '10–12', rest: 60,
        alts: ['Plank', 'Hanging knee raise'] }
    ]
  },
  rehab: {
    name: 'Shoulder care',
    focus: 'Mobility · 10–15 min',
    exercises: [
      { id: 'rh1', name: 'External rotation, band', sets: 2, reps: '15', rest: 30,
        note: 'General shoulder-care routine, not a treatment. Stop if pain increases and mention it to your doctor.',
        alts: ['Dumbbell external rotation, very light'] },
      { id: 'rh2', name: 'Band pull-apart', sets: 2, reps: '15', rest: 30,
        note: 'Light band, squeeze the shoulder blades together.', alts: [] },
      { id: 'rh3', name: 'Wall slides', sets: 2, reps: '10', rest: 30,
        note: 'Forearms and back of the hands stay on the wall. Move only in a pain-free range.', alts: [] },
      { id: 'rh4', name: 'Prone Y raise', sets: 2, reps: '10', rest: 30,
        note: 'Bodyweight only. Lift the arms to a Y shape, thumbs up.', alts: [] },
      { id: 'rh5', name: 'Thoracic extension, foam roller', sets: 2, reps: '8', rest: 30,
        note: 'Roller across the upper back, hands behind the head, extend slowly.', alts: [] }
    ]
  }
});

// Programs: each one sets the weekly schedule (JS getDay() index -> session id).
const PROGRAMS = {
  ul: { name: 'Upper / Lower', sub: '4 days a week', schedule: { 1: 'upperA', 2: 'lowerA', 3: null, 4: 'upperB', 5: 'lowerB', 6: null, 0: null } },
  fb: { name: 'Full body', sub: '3 days a week', schedule: { 1: 'fullA', 2: null, 3: 'fullB', 4: null, 5: 'fullC', 6: null, 0: null } }
};

// Technique videos, keyed by exercise name (swapped exercises use their own name).
// IDs came from YouTube search results matched by title and were not individually verified,
// so the app also offers "Open in YouTube", a search link and a field for your own link.
const VIDEOS = {
  'External rotation, band': 'ybNV36DoRfY',
  'Lat pulldown, wide grip': 'AOpi-p0cJkc',
  'Bent-over row, neutral grip': 'A1urXNw49Pg',
  'Incline dumbbell press, 30°': 'gkV_byB3Ego',
  'Dumbbell fly, flat': 'QwuUZ5wgQOk',
  'Seated dumbbell shoulder press': 'WKEl69bIGus',
  'Rear delt fly, bent-over': 'dA4iqyTgx5I',
  'EZ-bar curl': 'SDFZBaJcTsU',
  'Close-grip EZ-bar press': 'dDB9scrW7k8',
  'Back squat': '8PMjqgR8Wa8',
  'Romanian deadlift': 'lKLYvNGz6mk',
  'Leg press, narrow stance': 'K5n2vg3oZa4',
  'Leg press, wide stance': 'K5n2vg3oZa4',
  'Leg curl, machine': '92MK-Qx3TiM',
  'Standing calf raise': '4HQ8Am9IuME',
  'Plank': 'B296mZDhrP4',
  'Hammer row / seated cable row': 'xjlz8lRXOOI',
  'One-arm dumbbell row': 'PgpQ4-jHiq4',
  'Cable crossover': 'aoP0s_MjN-g',
  'Bench dips': 'IExSaQUjyIw',
  'Seated machine shoulder press': '6-FxadmQrSM',
  'Face pull': '6chrLjsE47c',
  'Dumbbell lateral raise': 'Y29xKcze8Ik',
  'Hammer curl': 'FNvndC4Ov04',
  'Cable triceps extension': '_iSX_125XUg',
  'Dumbbell lunges': 'I34ysEkPK7w',
  'Leg extension': 'xAUvXdHu1sI',
  'Hip thrust': 'S_uZP4UH6J0',
  'Lying leg curl': '3gZm9wGTsEo',
  'Seated calf raise': 'pz66Bw6HJ4s',
  'Ab wheel rollout': 'NbudTqiwguk',
  'Pec-dec': 'Dbly77Jgbo8',
  'Band pull-apart': 'WqdNDTTe-9g',
  'Wall slides': 'UB_n4DxOTCo',
  'Prone Y raise': 'XO2UbpMCHo0',
  'Thoracic extension, foam roller': '9Y11Kc0E0og',
  'Rope pushdown': 'y6EdXBdL75A'
};

const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' }
];

// Body measurement points. side/y place the label next to the figure (y in px of a 340 px tall card).
const MEASURE_PARTS = [
  { id: 'neck', label: 'Neck', full: 'Neck', side: 'left', y: 38 },
  { id: 'chest', label: 'Chest', full: 'Chest', side: 'left', y: 92 },
  { id: 'waist', label: 'Waist', full: 'Waist', side: 'left', y: 142 },
  { id: 'thigh', label: 'Thigh', full: 'Thigh', side: 'left', y: 200 },
  { id: 'shoulders', label: 'Shoulders', full: 'Shoulders', side: 'right', y: 62 },
  { id: 'arm', label: 'Arm', full: 'Arm (flexed)', side: 'right', y: 114 },
  { id: 'hips', label: 'Hips', full: 'Hips', side: 'right', y: 166 },
  { id: 'calf', label: 'Calf', full: 'Calf', side: 'right', y: 275 }
];

// Weekly schedule: JS getDay() index -> session id (null = rest).
const DEFAULT_SCHEDULE = { 1: 'upperA', 2: 'lowerA', 3: null, 4: 'upperB', 5: 'lowerB', 6: null, 0: null };
