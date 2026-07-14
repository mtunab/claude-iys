'use strict';

/* =========================================================================
 * YTÜ İYS Takip Paneli — istemci tarafı SPA (vanilla JS)
 * ========================================================================= */

const SECTION_META = {
  grammar: { title: 'Grammar', sub: 'Gramer konuları' },
  questionTypes: { title: 'Soru Tipleri', sub: 'Sınav soru tipleri' },
};

const STATUS_META = {
  red: { label: 'Çalışılmadı' },
  yellow: { label: 'Çalışılıyor' },
  green: { label: 'Pekişti' },
};

function statusDot(status) {
  return `<span class="status-dot ${status}"></span>`;
}

let state = null;
let currentView = 'dashboard';
let openTopicId = null;

// ---------------------------------------------------------------------------
// API yardımcıları
// ---------------------------------------------------------------------------

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'İstek başarısız.');
  return data;
}

async function refresh() {
  state = await api('GET', '/api/state');
}

// ---------------------------------------------------------------------------
// Bildirim
// ---------------------------------------------------------------------------

let toastTimer = null;
function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function fmtDate(d) {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  const [y, m, day] = d.split('-').map(Number);
  return day + ' ' + months[m - 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Türetilmiş veriler
// ---------------------------------------------------------------------------

function statusCounts(section) {
  const c = { red: 0, yellow: 0, green: 0 };
  state.topics[section].forEach((t) => (c[t.status]++));
  return c;
}

function allTopics() {
  return [
    ...state.topics.grammar.map((t) => ({ ...t, section: 'grammar' })),
    ...state.topics.questionTypes.map((t) => ({ ...t, section: 'questionTypes' })),
  ];
}

function findTopic(id) {
  return allTopics().find((t) => t.id === id);
}

function lastResult(topic) {
  if (!topic.results.length) return null;
  return topic.results[topic.results.length - 1];
}

function recentResults(limit) {
  const rows = [];
  allTopics().forEach((t) => {
    t.results.forEach((r) => {
      rows.push({ ...r, topicName: t.name, topicId: t.id, section: t.section });
    });
  });
  rows.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  return rows.slice(0, limit);
}

function computeStreak() {
  // Üzerinde en az bir "tamamlanmış" görev olan günleri bugünden geriye say
  const doneDates = new Set(
    state.tasks.filter((t) => t.done).map((t) => t.date)
  );
  let streak = 0;
  const d = new Date();
  // Bugün henüz bitmemişse: bugün tamamlanmış görev yoksa dünden başla
  if (!doneDates.has(today())) {
    d.setDate(d.getDate() - 1);
  }
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (doneDates.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  render();
}

function render() {
  const el = document.getElementById('view');
  if (currentView === 'dashboard') el.innerHTML = renderDashboard();
  else if (currentView === 'tasks') el.innerHTML = renderTasks();
  else el.innerHTML = renderSection(currentView);

  document.getElementById('streakCount').textContent = computeStreak();
  wireView();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function distBar(counts) {
  const total = counts.red + counts.yellow + counts.green || 1;
  const seg = (n, c) =>
    `<div class="dist-seg ${c}" style="width:${(n / total) * 100}%"></div>`;
  return `
    <div class="dist-bar">
      ${seg(counts.green, 'green')}${seg(counts.yellow, 'yellow')}${seg(counts.red, 'red')}
    </div>
    <div class="dist-legend">
      <span>${statusDot('green')} Pekişti ${counts.green}</span>
      <span>${statusDot('yellow')} Çalışılıyor ${counts.yellow}</span>
      <span>${statusDot('red')} Çalışılmadı ${counts.red}</span>
    </div>`;
}

function renderDashboard() {
  const g = statusCounts('grammar');
  const q = statusCounts('questionTypes');
  const totalTopics =
    state.topics.grammar.length + state.topics.questionTypes.length;
  const greenTotal = g.green + q.green;
  const pct = totalTopics ? Math.round((greenTotal / totalTopics) * 100) : 0;

  const todays = state.tasks.filter((t) => t.date === today());
  const todaysDone = todays.filter((t) => t.done).length;

  const recent = recentResults(5);

  const now = new Date();
  const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  const remaining = totalTopics - greenTotal;

  return `
    <div class="dash-hero">
      <div>
        <h1 class="dash-greet">Kolay gelsin.<br/><span class="greet-dim">Sınava hazırlanmaya devam.</span></h1>
        <p class="dash-greet-sub">${greenTotal} konu pekişti · ${remaining} konu seni bekliyor</p>
      </div>
      <div class="dash-hero-side">
        <div class="date-chip">
          <span class="date-chip-day">${now.getDate()}</span>
          <span class="date-chip-rest">${DAYS[now.getDay()]},<br/>${MONTHS[now.getMonth()]}</span>
        </div>
        <button class="btn btn-primary" data-nav="tasks">Görevlerim<span class="btn-arrow">→</span></button>
      </div>
    </div>

    <div class="grid stat-grid" style="margin-bottom:16px">
      <div class="stat-card stat-ring-card">
        <div class="progress-ring" style="background:conic-gradient(var(--accent) ${pct * 3.6}deg, var(--ring-track) 0)">
          <div class="progress-ring-in"><b>${pct}%</b><span>pekişti</span></div>
        </div>
        <div>
          <div class="stat-label">Genel İlerleme</div>
          <div class="stat-value">${greenTotal}/${totalTopics}</div>
          <div class="stat-hint">konu pekişti</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Grammar</div>
        <div class="stat-value">${g.green}/${g.green + g.yellow + g.red}</div>
        <div class="stat-hint">pekişen konu</div>
        ${distBar(g)}
      </div>

      <div class="stat-card">
        <div class="stat-label">Soru Tipleri</div>
        <div class="stat-value">${q.green}/${q.green + q.yellow + q.red}</div>
        <div class="stat-hint">pekişen tip</div>
        ${distBar(q)}
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <h4 class="dashboard-h4">Son Çözülen Testler</h4>
        ${
          recent.length
            ? `<div class="recent-list">${recent
                .map((r) => {
                  const p = Math.round((r.correct / r.total) * 100);
                  const c = p >= 75 ? 'var(--green)' : p >= 50 ? 'var(--yellow)' : 'var(--red)';
                  return `
                  <div class="recent-row">
                    <span class="recent-topic" data-open="${r.topicId}">${esc(r.topicName)}</span>
                    <span class="tag">${fmtDate(r.date)}</span>
                    <b style="color:${c}">${r.correct}/${r.total}</b>
                  </div>`;
                })
                .join('')}</div>`
            : `<div class="empty-state">Henüz test sonucu girilmedi.</div>`
        }
      </div>

      <div class="card">
        <h4 class="dashboard-h4">Bugünün Görevleri (${todaysDone}/${todays.length})</h4>
        ${
          todays.length
            ? `<div>${todays
                .map(
                  (t) => `
              <div class="task-row ${t.done ? 'done' : ''}" style="margin-bottom:0">
                <input type="checkbox" class="task-check" data-toggle="${t.id}" ${
                    t.done ? 'checked' : ''
                  }/>
                <span class="task-text">${esc(t.text)}</span>
                ${
                  t.topicId
                    ? `<span class="task-link" data-open="${t.topicId}">↗ konu</span>`
                    : ''
                }
              </div>`
                )
                .join('')}</div>`
            : `<div class="empty-state">Bugün için görev yok. <br/><span style="font-size:13px">Günlük Görevler'den ekle.</span></div>`
        }
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Section (Grammar / Question Types)
// ---------------------------------------------------------------------------

function topicCard(topic, section) {
  const st = STATUS_META[topic.status];
  const last = lastResult(topic);
  return `
    <div class="topic-card" draggable="true" data-topic="${topic.id}" data-section="${section}">
      <span class="topic-drag" title="Sürükle">⠿</span>
      <span class="topic-name" data-open="${topic.id}">${esc(topic.name)}</span>
      <div class="topic-meta">
        <span>${topic.notes.length} not</span>
        <span>${topic.tests.length} test</span>
        <span>${topic.results.length} sonuç</span>
      </div>
      ${
        last
          ? `<div class="mini-score">Son: <b>${last.correct}/${last.total}</b> · ${fmtDate(
              last.date
            )}</div>`
          : ''
      }
      <span class="status-pill ${topic.status}">${statusDot(topic.status)} ${st.label}</span>
    </div>`;
}

function renderSection(section) {
  const meta = SECTION_META[section];
  const topics = state.topics[section];
  return `
    <div class="page-head">
      <div>
        <h1 class="page-title">${meta.title}</h1>
        <p class="page-sub">${topics.length} konu · sürükleyerek sırala, satıra tıklayarak aç</p>
      </div>
      <button class="btn btn-primary" data-add-topic="${section}">+ Yeni Konu Ekle</button>
    </div>
    <div class="grid topic-grid" id="topicGrid" data-section="${section}">
      ${topics.map((t) => topicCard(t, section)).join('')}
      <button class="add-topic-card" data-add-topic="${section}">+ Yeni Konu Ekle</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function renderTasks() {
  // Tarihe göre grupla (bugün en üstte, sonra geçmiş)
  const groups = {};
  state.tasks.forEach((t) => {
    (groups[t.date] = groups[t.date] || []).push(t);
  });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const topicOptions = ['grammar', 'questionTypes']
    .map((section) => {
      const opts = state.topics[section]
        .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`)
        .join('');
      return opts ? `<optgroup label="${SECTION_META[section].title}">${opts}</optgroup>` : '';
    })
    .join('');

  const todayKey = today();

  const groupHtml = dates
    .map((date) => {
      const rows = groups[date]
        .map(
          (t) => `
        <div class="task-row ${t.done ? 'done' : ''}">
          <input type="checkbox" class="task-check" data-toggle="${t.id}" ${
            t.done ? 'checked' : ''
          }/>
          <span class="task-text">${esc(t.text)}</span>
          ${
            t.topicId
              ? `<span class="task-link" data-open="${t.topicId}">↗ ${esc(
                  (findTopic(t.topicId) || {}).name || 'konu'
                )}</span>`
              : ''
          }
          <button class="icon-btn" data-del-task="${t.id}" title="Sil">×</button>
        </div>`
        )
        .join('');
      const label = date === todayKey ? 'Bugün' : fmtDate(date) + ' · ' + date.slice(0, 4);
      const doneCount = groups[date].filter((t) => t.done).length;
      return `<div class="task-group"><h3>${label} (${doneCount}/${groups[date].length})</h3>${rows}</div>`;
    })
    .join('');

  return `
    <div class="page-head">
      <div>
        <h1 class="page-title">Günlük Görevler</h1>
        <p class="page-sub"><b class="mono-accent">${computeStreak()}</b> gün üst üste çalışma serisi</p>
      </div>
    </div>

    <div class="task-input-row">
      <input type="text" id="taskText" placeholder="Yeni görev... (örn. Modal Verbs testini çöz)" />
      <select id="taskTopic">
        <option value="">— Konu bağlama (opsiyonel) —</option>
        ${topicOptions}
      </select>
      <button class="btn btn-primary" id="addTaskBtn">Ekle</button>
    </div>

    ${groupHtml || '<div class="empty-state">Henüz görev yok. Yukarıdan ilk görevini ekle.</div>'}`;
}

// ---------------------------------------------------------------------------
// Topic modal
// ---------------------------------------------------------------------------

function getFileExt(filename) {
  if (/\.pdf$/i.test(filename)) return 'PDF';
  if (/\.(jpg|jpeg)$/i.test(filename)) return 'JPG';
  return '?';
}

function fileList(topic, kind) {
  const files = topic[kind];
  if (!files.length) {
    return `<div class="empty-hint">Henüz ${kind === 'notes' ? 'not' : 'test'} dosyası yok.</div>`;
  }
  return `<div class="file-list">${files
    .map(
      (f) => `
      <div class="file-row">
        <span class="file-ext">${getFileExt(f.originalName)}</span>
        <span class="file-name" data-view-file="${topic.id}/${f.id}" title="${esc(
        f.originalName
      )}">${esc(f.originalName)}</span>
        <span class="file-date">${fmtDate(f.date)}</span>
        <button class="icon-btn" data-del-file="${topic.id}/${f.id}/${kind}" title="Sil">×</button>
      </div>`
    )
    .join('')}</div>`;
}

function resultList(topic) {
  if (!topic.results.length) {
    return `<div class="empty-hint">Henüz test sonucu girilmedi.</div>`;
  }
  const rows = topic.results
    .slice()
    .reverse()
    .map((r) => {
      const p = Math.round((r.correct / r.total) * 100);
      const c = p >= 75 ? 'var(--green)' : p >= 50 ? 'var(--yellow)' : 'var(--red)';
      return `
      <div class="result-row">
        <span class="file-date">${fmtDate(r.date)}</span>
        <div class="result-bar"><i style="width:${p}%;background:${c}"></i></div>
        <span class="result-score">${r.correct}/${r.total}</span>
        <span class="result-pct">${p}%</span>
        <button class="icon-btn" data-del-result="${topic.id}/${r.id}" title="Sil">×</button>
      </div>`;
    })
    .join('');
  return `<div class="result-list">${rows}</div>`;
}

function openTopic(id) {
  openTopicId = id;
  const topic = findTopic(id);
  if (!topic) return;
  const root = document.getElementById('modalRoot');

  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal" role="dialog">
        <div class="modal-head">
          <input class="modal-title-in" id="topicName" value="${esc(topic.name)}" />
          <button class="icon-btn" id="closeModal" title="Kapat" style="font-size:20px">×</button>
        </div>
        <div class="modal-body">

          <div class="section-block">
            <h4>Durum</h4>
            <div class="status-select" id="statusSelect">
              ${['red', 'yellow', 'green']
                .map(
                  (s) =>
                    `<button class="status-opt ${s} ${
                      topic.status === s ? 'sel' : ''
                    }" data-status="${s}">${statusDot(s)} ${STATUS_META[s].label}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="section-block file-cols">
            <div>
              <h4>Notlar</h4>
              <label class="btn btn-sm upload-btn" style="display:inline-block">
                + Yükle (PDF/JPG)
                <input type="file" accept=".pdf,image/jpeg,.jpg" data-upload="notes" />
              </label>
              ${fileList(topic, 'notes')}
            </div>
            <div>
              <h4>Testler</h4>
              <label class="btn btn-sm upload-btn" style="display:inline-block">
                + Yükle (PDF/JPG)
                <input type="file" accept=".pdf,image/jpeg,.jpg" data-upload="tests" />
              </label>
              ${fileList(topic, 'tests')}
            </div>
          </div>

          <div class="section-block">
            <h4>Test Sonuçları</h4>
            <div class="result-form">
              <div class="field">
                <label>Doğru</label>
                <input type="number" class="small" id="resCorrect" min="0" placeholder="8" />
              </div>
              <div class="field">
                <label>Toplam</label>
                <input type="number" class="small" id="resTotal" min="1" placeholder="10" />
              </div>
              <div class="field">
                <label>Tarih</label>
                <input type="date" id="resDate" value="${today()}" />
              </div>
              <button class="btn btn-primary btn-sm" id="addResult">Ekle</button>
            </div>
            ${resultList(topic)}
          </div>

          <div class="section-block">
            <h4>Kişisel Not</h4>
            <textarea id="personalNote" placeholder="Hızlı notlar, hatırlatmalar, zayıf noktalar...">${esc(
              topic.personalNote
            )}</textarea>
          </div>

        </div>
        <div class="modal-foot">
          <button class="btn btn-danger" id="deleteTopic">Konuyu Sil</button>
          <button class="btn btn-primary" id="doneModal">Kapat</button>
        </div>
      </div>
    </div>`;

  wireModal(topic);
}

function closeModal() {
  openTopicId = null;
  document.getElementById('modalRoot').innerHTML = '';
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

async function guard(fn) {
  try {
    await fn();
  } catch (err) {
    toast(err.message || 'Hata oluştu.', true);
  }
}

function wireView() {
  // Konu / görev linklerinden konu penceresini aç
  document.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => openTopic(el.dataset.open));
  });

  // Sayfa içi görünüm geçişleri (örn. dashboard'daki "Görevlerim" butonu)
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  if (currentView === 'grammar' || currentView === 'questionTypes') {
    wireSection(currentView);
  }
  if (currentView === 'tasks') {
    wireTasks();
  }
}

function wireSection(section) {
  document.querySelectorAll('[data-add-topic]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const name = prompt('Yeni konu adı:');
        if (name == null) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        await api('POST', '/api/topics', { section, name: trimmed });
        await refresh();
        render();
        toast('Konu eklendi: ' + trimmed);
      })
    );
  });

  // Drag & drop sıralama
  const grid = document.getElementById('topicGrid');
  if (!grid) return;
  let dragId = null;

  grid.querySelectorAll('.topic-card').forEach((card) => {
    card.addEventListener('dragstart', () => {
      dragId = card.dataset.topic;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      dragId = null;
      card.classList.remove('dragging');
      grid.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (card.dataset.topic !== dragId) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (!dragId || card.dataset.topic === dragId) return;
      guard(async () => {
        const ids = state.topics[section].map((t) => t.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(card.dataset.topic);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        // İyimser güncelleme
        const byId = new Map(state.topics[section].map((t) => [t.id, t]));
        state.topics[section] = ids.map((id) => byId.get(id));
        render();
        await api('POST', '/api/topics/reorder', { section, orderedIds: ids });
      });
    });
  });
}

function wireTasks() {
  const addBtn = document.getElementById('addTaskBtn');
  const input = document.getElementById('taskText');
  const topicSel = document.getElementById('taskTopic');

  const add = () =>
    guard(async () => {
      const text = input.value.trim();
      if (!text) return;
      await api('POST', '/api/tasks', {
        text,
        topicId: topicSel.value || null,
      });
      await refresh();
      render();
      toast('Görev eklendi.');
    });

  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  document.querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.addEventListener('change', () =>
      guard(async () => {
        await api('PATCH', '/api/tasks/' + cb.dataset.toggle, { done: cb.checked });
        await refresh();
        render();
      })
    );
  });

  document.querySelectorAll('[data-del-task]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        await api('DELETE', '/api/tasks/' + btn.dataset.delTask);
        await refresh();
        render();
      })
    );
  });
}

// Dashboard checkbox toggles also need wiring
function wireDashboardToggles() {
  document.querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.addEventListener('change', () =>
      guard(async () => {
        await api('PATCH', '/api/tasks/' + cb.dataset.toggle, { done: cb.checked });
        await refresh();
        render();
      })
    );
  });
}

function wireModal(topic) {
  const overlay = document.getElementById('modalOverlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('doneModal').addEventListener('click', () => {
    closeModal();
    render();
  });

  // Rename (blur / enter)
  const nameIn = document.getElementById('topicName');
  const saveName = () =>
    guard(async () => {
      const name = nameIn.value.trim();
      if (!name || name === topic.name) return;
      await api('PATCH', '/api/topics/' + topic.id, { name });
      topic.name = name;
      await refresh();
      toast('Konu yeniden adlandırıldı.');
    });
  nameIn.addEventListener('blur', saveName);
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameIn.blur();
  });

  // Status
  document.querySelectorAll('#statusSelect [data-status]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const status = btn.dataset.status;
        await api('PATCH', '/api/topics/' + topic.id, { status });
        topic.status = status;
        await refresh();
        // reflect selection
        document.querySelectorAll('#statusSelect [data-status]').forEach((b) =>
          b.classList.toggle('sel', b.dataset.status === status)
        );
      })
    );
  });

  // Personal note (debounced save on blur)
  const note = document.getElementById('personalNote');
  note.addEventListener('blur', () =>
    guard(async () => {
      if (note.value === topic.personalNote) return;
      await api('PATCH', '/api/topics/' + topic.id, { personalNote: note.value });
      topic.personalNote = note.value;
      await refresh();
      toast('Not kaydedildi.');
    })
  );

  // Uploads
  document.querySelectorAll('[data-upload]').forEach((inp) => {
    inp.addEventListener('change', () =>
      guard(async () => {
        const file = inp.files[0];
        if (!file) return;
        const kind = inp.dataset.upload;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        const res = await fetch('/api/topics/' + topic.id + '/files', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Yükleme başarısız.');
        await refresh();
        openTopic(topic.id); // yeniden çiz
        toast('PDF yüklendi.');
      })
    );
  });

  // View files
  document.querySelectorAll('[data-view-file]').forEach((el) => {
    el.addEventListener('click', () => {
      const [tid, fid] = el.dataset.viewFile.split('/');
      window.open('/api/topics/' + tid + '/files/' + fid + '/raw', '_blank');
    });
  });

  // Delete files
  document.querySelectorAll('[data-del-file]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const [tid, fid, kind] = btn.dataset.delFile.split('/');
        if (!confirm('Bu PDF silinsin mi?')) return;
        await api('DELETE', '/api/topics/' + tid + '/files/' + fid + '?kind=' + kind);
        await refresh();
        openTopic(tid);
        toast('PDF silindi.');
      })
    );
  });

  // Add result
  document.getElementById('addResult').addEventListener('click', () =>
    guard(async () => {
      const correct = document.getElementById('resCorrect').value;
      const total = document.getElementById('resTotal').value;
      const date = document.getElementById('resDate').value;
      if (correct === '' || total === '') {
        toast('Doğru ve toplam sayısını gir.', true);
        return;
      }
      await api('POST', '/api/topics/' + topic.id + '/results', {
        correct,
        total,
        date,
      });
      await refresh();
      openTopic(topic.id);
      toast('Sonuç eklendi.');
    })
  );

  // Delete result
  document.querySelectorAll('[data-del-result]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const [tid, rid] = btn.dataset.delResult.split('/');
        await api('DELETE', '/api/topics/' + tid + '/results/' + rid);
        await refresh();
        openTopic(tid);
      })
    );
  });

  // Delete topic
  document.getElementById('deleteTopic').addEventListener('click', () =>
    guard(async () => {
      if (!confirm('"' + topic.name + '" konusu ve tüm dosyaları silinsin mi?')) return;
      await api('DELETE', '/api/topics/' + topic.id);
      await refresh();
      closeModal();
      render();
      toast('Konu silindi.');
    })
  );
}

// Patch render() to also wire dashboard toggles
const _render = render;
render = function () {
  _render();
  if (currentView === 'dashboard') wireDashboardToggles();
};

// ---------------------------------------------------------------------------
// Tema (açık/koyu)
// ---------------------------------------------------------------------------

const THEME_KEY = 'iys-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#161513' : '#efeeec');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.querySelectorAll('.nav-item').forEach((b) => {
    b.addEventListener('click', () => navigate(b.dataset.view));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openTopicId) closeModal();
  });

  try {
    await refresh();
    navigate('dashboard');
  } catch (err) {
    document.getElementById('view').innerHTML =
      '<div class="empty-state">Sunucuya bağlanılamadı. Terminalde <code>npm start</code> çalışıyor mu?</div>';
  }
}

boot();
