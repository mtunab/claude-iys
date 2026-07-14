'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 4173;

const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'konu'
  );
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function topicDir(section, topic, kind) {
  // uploads/<section>/<topic-slug-id>/<kind>/
  const folder = slugify(topic.name) + '_' + topic.id;
  return path.join(UPLOAD_DIR, section, folder, kind);
}

// Multer: dosyaları geçici belleğe alır; hedef yolu topic bilindikten sonra yazarız
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    const isImage = /^image\/(jpeg|jpg)$/i.test(file.mimetype) || /\.(jpg|jpeg)$/i.test(file.originalname);
    if (isPdf || isImage) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF ve JPG dosyaları yüklenebilir.'));
    }
  },
});

function fixTurkishFilename(name) {
  // multer latin1 olarak çözebilir; utf8'e çevirmeyi dene
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch (e) {
    return name;
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

app.get('/api/state', (req, res) => {
  res.json(store.getState());
});

// ---------------------------------------------------------------------------
// Konular (topics)
// ---------------------------------------------------------------------------

app.post('/api/topics', (req, res) => {
  const { section, name } = req.body || {};
  if (!store.isValidSection(section)) {
    return res.status(400).json({ error: 'Geçersiz bölüm.' });
  }
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Konu adı boş olamaz.' });
  }
  const list = store.getTopicList(section);
  const topic = store.makeTopic(trimmed, list.length);
  list.push(topic);
  store.save();
  res.status(201).json(topic);
});

app.patch('/api/topics/:id', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic } = found;
  const { name, status, personalNote } = req.body || {};

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'Konu adı boş olamaz.' });
    topic.name = trimmed;
  }
  if (status !== undefined) {
    if (!['red', 'yellow', 'green'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum.' });
    }
    topic.status = status;
  }
  if (personalNote !== undefined) {
    topic.personalNote = String(personalNote);
  }
  store.save();
  res.json(topic);
});

app.delete('/api/topics/:id', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic, section } = found;
  const state = store.getState();

  // Dosyaları diskten temizle
  for (const kind of ['notes', 'tests']) {
    const dir = topicDir(section, topic, kind);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Bu konuya bağlı görevlerin bağlantısını kopar (görevi silme)
  for (const task of state.tasks) {
    if (task.topicId === topic.id) {
      task.topicId = null;
      task.section = null;
    }
  }

  state.topics[section] = state.topics[section].filter((t) => t.id !== topic.id);
  store.save();
  res.json({ ok: true });
});

app.post('/api/topics/reorder', (req, res) => {
  const { section, orderedIds } = req.body || {};
  if (!store.isValidSection(section)) {
    return res.status(400).json({ error: 'Geçersiz bölüm.' });
  }
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds bir dizi olmalı.' });
  }
  const list = store.getTopicList(section);
  const byId = new Map(list.map((t) => [t.id, t]));
  const reordered = [];
  orderedIds.forEach((tid, i) => {
    const t = byId.get(tid);
    if (t) {
      t.order = i;
      reordered.push(t);
      byId.delete(tid);
    }
  });
  // Listede olup gönderilmeyenleri sona ekle
  for (const t of byId.values()) {
    t.order = reordered.length;
    reordered.push(t);
  }
  store.getState().topics[section] = reordered;
  store.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Test sonuçları
// ---------------------------------------------------------------------------

app.post('/api/topics/:id/results', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic } = found;
  let { date, correct, total } = req.body || {};
  correct = Number(correct);
  total = Number(total);
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: 'Doğru/toplam sayıları geçersiz.' });
  }
  if (correct < 0) correct = 0;
  if (correct > total) correct = total;
  const result = {
    id: store.id(),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
    correct,
    total,
  };
  topic.results.push(result);
  topic.results.sort((a, b) => a.date.localeCompare(b.date));
  store.save();
  res.status(201).json(result);
});

app.delete('/api/topics/:id/results/:resultId', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic } = found;
  topic.results = topic.results.filter((r) => r.id !== req.params.resultId);
  store.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// PDF dosyaları
// ---------------------------------------------------------------------------

app.post('/api/topics/:id/files', upload.single('file'), (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic, section } = found;
  const kind = req.body.kind; // 'notes' | 'tests'
  if (!['notes', 'tests'].includes(kind)) {
    return res.status(400).json({ error: 'Geçersiz dosya tipi (notes/tests).' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya bulunamadı.' });
  }

  const dir = topicDir(section, topic, kind);
  fs.mkdirSync(dir, { recursive: true });

  const original = fixTurkishFilename(req.file.originalname);
  const dateStamp = today();
  const kindLabel = kind === 'notes' ? 'not' : 'test';
  // örn. modal-verbs_test_2026-07-13.pdf  (çakışmayı önlemek için kısa id eki)
  const base = slugify(topic.name) + '_' + kindLabel + '_' + dateStamp;
  const storedName = base + '_' + store.id() + '.pdf';
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, req.file.buffer);

  const entry = {
    id: store.id(),
    originalName: original,
    storedName,
    date: dateStamp,
    size: req.file.size,
  };
  topic[kind].push(entry);
  store.save();
  res.status(201).json(entry);
});

app.delete('/api/topics/:id/files/:fileId', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).json({ error: 'Konu bulunamadı.' });
  const { topic, section } = found;
  const kind = ['notes', 'tests'].includes(req.query.kind) ? req.query.kind : null;
  const kinds = kind ? [kind] : ['notes', 'tests'];

  for (const k of kinds) {
    const entry = topic[k].find((f) => f.id === req.params.fileId);
    if (entry) {
      const fullPath = path.join(topicDir(section, topic, k), entry.storedName);
      fs.rmSync(fullPath, { force: true });
      topic[k] = topic[k].filter((f) => f.id !== req.params.fileId);
      store.save();
      return res.json({ ok: true });
    }
  }
  res.status(404).json({ error: 'Dosya bulunamadı.' });
});

// PDF / JPG görüntüleme/indirme
app.get('/api/topics/:id/files/:fileId/raw', (req, res) => {
  const found = store.findTopic(req.params.id);
  if (!found) return res.status(404).send('Konu bulunamadı.');
  const { topic, section } = found;
  for (const k of ['notes', 'tests']) {
    const entry = topic[k].find((f) => f.id === req.params.fileId);
    if (entry) {
      const fullPath = path.join(topicDir(section, topic, k), entry.storedName);
      if (!fs.existsSync(fullPath)) return res.status(404).send('Dosya diskte yok.');

      // Content-Type'ı dosya tipi bağlı olarak belirle
      let contentType = 'application/octet-stream';
      if (/\.pdf$/i.test(entry.originalName)) contentType = 'application/pdf';
      else if (/\.(jpg|jpeg)$/i.test(entry.originalName)) contentType = 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + encodeURIComponent(entry.originalName) + '"'
      );
      return fs.createReadStream(fullPath).pipe(res);
    }
  }
  res.status(404).send('Dosya bulunamadı.');
});

// ---------------------------------------------------------------------------
// Günlük görevler
// ---------------------------------------------------------------------------

app.post('/api/tasks', (req, res) => {
  const state = store.getState();
  let { text, topicId, date } = req.body || {};
  text = String(text || '').trim();
  if (!text) return res.status(400).json({ error: 'Görev metni boş olamaz.' });

  let section = null;
  if (topicId) {
    const found = store.findTopic(topicId);
    if (!found) return res.status(400).json({ error: 'Bağlanacak konu bulunamadı.' });
    section = found.section;
  } else {
    topicId = null;
  }

  const task = {
    id: store.id(),
    text,
    done: false,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
    topicId,
    section,
  };
  state.tasks.push(task);
  store.save();
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const state = store.getState();
  const task = state.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Görev bulunamadı.' });
  const { done, text } = req.body || {};
  if (done !== undefined) task.done = !!done;
  if (text !== undefined) {
    const trimmed = String(text).trim();
    if (!trimmed) return res.status(400).json({ error: 'Görev metni boş olamaz.' });
    task.text = trimmed;
  }
  store.save();
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const state = store.getState();
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => t.id !== req.params.id);
  if (state.tasks.length === before) {
    return res.status(404).json({ error: 'Görev bulunamadı.' });
  }
  store.save();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Hata yakalama (multer vb.)
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Bir hata oluştu.' });
  }
  next();
});

store.load();
app.listen(PORT, () => {
  console.log('YTÜ İYS Takip Paneli çalışıyor:  http://localhost:' + PORT);
});
