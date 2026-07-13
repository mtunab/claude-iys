'use strict';

/**
 * Basit, dosya tabanlı JSON veri deposu.
 * Tek kullanıcı için tasarlandı; her yazma işleminde diske senkron kaydeder.
 * (localStorage yerine gerçek dosya sistemi kullanılır.)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_GRAMMAR = [
  'Modal Verbs',
  'Conditionals',
  'Passive Voice',
  'Reported Speech',
  'Relative Clauses',
  'Tenses (Present/Past/Future)',
  'Gerunds & Infinitives',
  'Articles',
  'Prepositions',
  'Comparatives/Superlatives',
];

const DEFAULT_QUESTION_TYPES = [
  'Cloze Test',
  'Closest Meaning',
  'Reading Comprehension',
  'Listening (Note-taking odaklı)',
  'Restatement',
  'Paragraph Completion',
];

let state = null;

function id() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function makeTopic(name, order) {
  return {
    id: id(),
    name: name,
    status: 'red', // red | yellow | green
    personalNote: '',
    order: order,
    notes: [], // { id, originalName, storedName, date, size }
    tests: [], // { id, originalName, storedName, date, size }
    results: [], // { id, date, correct, total }
  };
}

function seed() {
  return {
    seeded: true,
    topics: {
      grammar: DEFAULT_GRAMMAR.map((n, i) => makeTopic(n, i)),
      questionTypes: DEFAULT_QUESTION_TYPES.map((n, i) => makeTopic(n, i)),
    },
    tasks: [], // { id, text, done, date (YYYY-MM-DD), section, topicId }
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  ensureDataDir();
  if (fs.existsSync(DB_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (err) {
      // Bozuk dosya: yedekle ve yeniden başla
      const backup = DB_PATH + '.corrupt-' + Date.now();
      fs.renameSync(DB_PATH, backup);
      state = seed();
      save();
    }
  } else {
    state = seed();
    save();
  }
  return state;
}

function save() {
  ensureDataDir();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH); // atomik yazma
}

function getState() {
  if (!state) load();
  return state;
}

/** section: 'grammar' | 'questionTypes' */
function isValidSection(section) {
  return section === 'grammar' || section === 'questionTypes';
}

function getTopicList(section) {
  const s = getState();
  return s.topics[section];
}

function findTopic(topicId) {
  const s = getState();
  for (const section of ['grammar', 'questionTypes']) {
    const t = s.topics[section].find((x) => x.id === topicId);
    if (t) return { topic: t, section };
  }
  return null;
}

module.exports = {
  DATA_DIR,
  id,
  makeTopic,
  load,
  save,
  getState,
  isValidSection,
  getTopicList,
  findTopic,
};
