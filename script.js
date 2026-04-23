/* ============================================================
   Anime Notify — IndexedDB version
   ============================================================ */

// ---------- IndexedDB wrapper ----------
const DB_NAME = 'AnimeNotifyDB';
const DB_VERSION = 1;
const STORE = 'items';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// คำนวณวันที่ครั้งถัดไป (สำหรับ repeat รายสัปดาห์)
function nextOccurrence(item) {
  const base = new Date(`${item.date}T${item.time}`);
  if (!item.repeat) return base;

  const now = new Date();
  let next = new Date(base);
  while (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

// ---------- Page navigation ----------
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1));
  if (target) target.classList.add('active');
  document.getElementById('bentoMenu').classList.add('hidden');
  if (name === 'home') renderHome();
  if (name === 'manage') renderManage();
}

// ---------- Bento ----------
const bentoBtn = document.getElementById('bentoBtn');
const bentoMenu = document.getElementById('bentoMenu');
bentoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  bentoMenu.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!bentoMenu.contains(e.target) && e.target !== bentoBtn) {
    bentoMenu.classList.add('hidden');
  }
});
document.querySelectorAll('.tile[data-page]').forEach(t => {
  t.addEventListener('click', () => showPage(t.dataset.page));
});

// ---------- Render Home ----------
async function renderHome() {
  const items = await dbGetAll();
  const grid = document.getElementById('cardGrid');
  const empty = document.getElementById('emptyState');

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // เรียงตามครั้งถัดไปที่จะฉาย
  const sorted = items
    .map(it => ({ ...it, _next: nextOccurrence(it) }))
    .sort((a, b) => a._next - b._next);

  grid.innerHTML = sorted.map(it => {
    const next = it._next;
    const dayStr = next.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' });
    const timeStr = next.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const img = it.image
      ? `<img class="card-img" src="${it.image}" alt="">`
      : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--blue-300);font-family:'Hiragino Sans',serif">あ</div>`;
    return `
      <div class="card">
        ${img}
        <div class="card-body">
          <div class="card-title">${escapeHtml(it.title)}</div>
          <div class="card-meta">
            <span>${dayStr}</span>
            <span class="badge badge-time">${timeStr}</span>
            ${it.repeat ? '<span class="badge badge-repeat">🔁 ทุกสัปดาห์</span>' : ''}
          </div>
          ${it.note ? `<div class="card-note">${escapeHtml(it.note)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// ---------- Add form ----------
const imgInput = document.getElementById('imgInput');
const imgPreview = document.getElementById('imgPreview');
let imageDataUrl = '';

imgInput.addEventListener('change', () => {
  const file = imgInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imageDataUrl = reader.result;
    imgPreview.src = imageDataUrl;
    imgPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    id: uid(),
    title: document.getElementById('titleInput').value.trim(),
    date: document.getElementById('dateInput').value,
    time: document.getElementById('timeInput').value,
    repeat: document.getElementById('repeatInput').checked,
    note: document.getElementById('noteInput').value.trim(),
    image: imageDataUrl,
    notifiedKey: '', // กันแจ้งเตือนซ้ำในรอบเดียวกัน
  };
  await dbPut(item);
  e.target.reset();
  imgPreview.classList.add('hidden');
  imageDataUrl = '';
  document.getElementById('repeatInput').checked = true;
  alert('บันทึกแล้ว ✓');
  showPage('home');
});

// ---------- Manage page ----------
async function renderManage() {
  const items = await dbGetAll();
  const list = document.getElementById('manageList');
  if (items.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--blue-700);padding:40px">ไม่มีรายการ</p>';
    return;
  }
  list.innerHTML = items.map(it => `
    <div class="manage-item" data-id="${it.id}">
      <img src="${it.image || ''}" alt="" onerror="this.style.background='var(--blue-100)'">
      <div class="manage-info">
        <h3>${escapeHtml(it.title)}</h3>
        <small>${it.date} ${it.time} ${it.repeat ? '🔁' : ''}</small>
      </div>
      <div class="manage-actions">
        <button class="btn-icon" data-act="rename">✏️</button>
        <button class="btn-icon" data-act="reimg">🖼️</button>
        <button class="btn-icon danger" data-act="delete">🗑️</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.manage-item').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('[data-act="rename"]').onclick = async () => {
      const items = await dbGetAll();
      const it = items.find(x => x.id === id);
      const name = prompt('ชื่อใหม่:', it.title);
      if (name && name.trim()) { it.title = name.trim(); await dbPut(it); renderManage(); }
    };
    el.querySelector('[data-act="reimg"]').onclick = () => {
      const f = document.createElement('input');
      f.type = 'file'; f.accept = 'image/*';
      f.onchange = async () => {
        const file = f.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = async () => {
          const items = await dbGetAll();
          const it = items.find(x => x.id === id);
          it.image = r.result; await dbPut(it); renderManage();
        };
        r.readAsDataURL(file);
      };
      f.click();
    };
    el.querySelector('[data-act="delete"]').onclick = async () => {
      if (confirm('ลบรายการนี้?')) { await dbDelete(id); renderManage(); }
    };
  });
}

// ---------- Export / Import ----------
document.getElementById('exportBtn').onclick = async () => {
  const items = await dbGetAll();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `anime-notify-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  bentoMenu.classList.add('hidden');
};

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').onclick = () => importFile.click();
importFile.onchange = async () => {
  const file = importFile.files[0]; if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
    const mode = confirm('OK = รวมกับข้อมูลเดิม\nCancel = แทนที่ทั้งหมด') ? 'merge' : 'replace';
    if (mode === 'replace') await dbClear();
    const existing = await dbGetAll();
    const existingIds = new Set(existing.map(x => x.id));
    for (const it of data) {
      if (!it.id) it.id = uid();
      if (mode === 'merge' && existingIds.has(it.id)) continue;
      await dbPut(it);
    }
    alert('นำเข้าสำเร็จ ✓');
    renderHome();
  } catch (err) {
    alert('ไฟล์ไม่ถูกต้อง: ' + err.message);
  }
  importFile.value = '';
};

// ---------- Notification ----------
document.getElementById('notifyBtn').onclick = async () => {
  if (!('Notification' in window)) { alert('Browser ไม่รองรับการแจ้งเตือน'); return; }
  const perm = await Notification.requestPermission();
  alert(perm === 'granted' ? 'เปิดแจ้งเตือนแล้ว ✓' : 'ถูกปฏิเสธ');
};

// ตรวจทุก 30 วินาที — ส่งแจ้งเตือนเมื่อถึงเวลา (รองรับ repeat)
async function checkNotifications() {
  if (Notification.permission !== 'granted') return;
  const items = await dbGetAll();
  const now = Date.now();
  for (const it of items) {
    const next = nextOccurrence(it);
    const diff = next.getTime() - now;
    // ถึงเวลา (อยู่ในกรอบ -30วิ ถึง +30วิ) และยังไม่เคยแจ้งรอบนี้
    const occurrenceKey = next.toISOString();
    if (diff <= 30000 && diff >= -30000 && it.notifiedKey !== occurrenceKey) {
      try {
        if (navigator.serviceWorker?.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(it.title, {
            body: it.note || 'ถึงเวลาแล้ว!',
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            tag: it.id,
          });
        } else {
          new Notification(it.title, { body: it.note || 'ถึงเวลาแล้ว!', icon: 'icon-192.png' });
        }
      } catch (e) { console.error(e); }
      it.notifiedKey = occurrenceKey;
      await dbPut(it);
    }
  }
}
setInterval(checkNotifications, 30000);
checkNotifications();

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

// ---------- Initial render ----------
renderHome();
