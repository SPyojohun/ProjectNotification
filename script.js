/* =========================================================
 * Notify Board - script.js
 * เก็บข้อมูลใน localStorage เป็น JSON
 * รองรับ Notification API + Export/Import JSON + PWA
 * ========================================================= */

const STORAGE_KEY = "notify_board_items_v1";

/** @typedef {{id:string, name:string, date:string, time:string, image:string|null, notified?:boolean}} Item */

// ---------- Storage ----------
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("โหลดข้อมูลล้มเหลว", e);
    return [];
  }
}
function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let items = loadItems();
let editingId = null;
let editingImage = null;
let newImage = null;

// ---------- Page navigation ----------
const pages = {
  schedule: document.getElementById("page-schedule"),
  add:      document.getElementById("page-add"),
  manage:   document.getElementById("page-manage"),
};
function goPage(name) {
  Object.values(pages).forEach(p => p.classList.remove("active"));
  pages[name].classList.add("active");
  if (name === "schedule") renderSchedule();
  if (name === "manage")   renderManage();
  closeBento();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Bento menu ----------
const bentoBtn  = document.getElementById("bentoBtn");
const bentoMenu = document.getElementById("bentoMenu");
function closeBento() { bentoMenu.classList.add("hidden"); }
bentoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  bentoMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!bentoMenu.contains(e.target) && e.target !== bentoBtn) closeBento();
});
bentoMenu.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => goPage(btn.dataset.page));
});

// ---------- Notification permission ----------
document.getElementById("askPermBtn").addEventListener("click", askNotificationPermission);

async function askNotificationPermission() {
  if (!("Notification" in window)) {
    toast("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน");
    return;
  }
  if (Notification.permission === "granted") {
    toast("เปิดการแจ้งเตือนอยู่แล้ว ✓");
    return;
  }
  const result = await Notification.requestPermission();
  if (result === "granted") {
    toast("เปิดการแจ้งเตือนสำเร็จ 🔔");
    new Notification("Notify Board", {
      body: "พร้อมแจ้งเตือนตามเวลาที่คุณตั้งไว้ 📅",
    });
  } else {
    toast("ไม่ได้รับอนุญาตให้แจ้งเตือน");
  }
}

window.addEventListener("load", () => {
  if ("Notification" in window && Notification.permission === "default") {
    setTimeout(() => Notification.requestPermission().catch(()=>{}), 1500);
  }
});

// ---------- Export JSON ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notify-board-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("ส่งออกเรียบร้อย ✓");
});

// ---------- Import JSON ----------
const importInput = document.getElementById("importInput");
document.getElementById("importBtn").addEventListener("click", () => {
  importInput.click();
});
importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");

      // ถามผู้ใช้ว่าจะ "รวม" หรือ "แทนที่"
      const mode = confirm(
        `พบ ${parsed.length} รายการในไฟล์\n\n` +
        `กด OK = รวมกับข้อมูลเดิม (Merge)\n` +
        `กด Cancel = แทนที่ข้อมูลเดิมทั้งหมด (Replace)`
      );

      // validate และ normalize
      const valid = parsed
        .filter(it => it && it.name && it.date && it.time)
        .map(it => ({
          id: it.id || uid(),
          name: String(it.name),
          date: String(it.date),
          time: String(it.time),
          image: it.image || null,
          notified: !!it.notified,
        }));

      if (mode) {
        // merge: skip รายการที่ id ซ้ำ
        const existingIds = new Set(items.map(i => i.id));
        const toAdd = valid.filter(i => !existingIds.has(i.id));
        items = [...items, ...toAdd];
        toast(`นำเข้า ${toAdd.length} รายการใหม่ ✓`);
      } else {
        items = valid;
        toast(`แทนที่ข้อมูลด้วย ${valid.length} รายการ ✓`);
      }
      saveItems(items);
      renderSchedule();
      renderManage();
    } catch (err) {
      console.error(err);
      alert("อ่านไฟล์ไม่สำเร็จ: " + err.message);
    } finally {
      importInput.value = "";
    }
  };
  reader.readAsText(file);
});

// ---------- Image picker ----------
function setupImagePicker(inputEl, previewEl, onChange) {
  inputEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      previewEl.style.backgroundImage = `url(${reader.result})`;
      previewEl.classList.add("has-img");
      onChange(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
const imgInput = document.getElementById("imgInput");
const imgPreview = document.getElementById("imgPreview");
setupImagePicker(imgInput, imgPreview, (data) => { newImage = data; });

const editImg = document.getElementById("editImg");
const editImgPreview = document.getElementById("editImgPreview");
setupImagePicker(editImg, editImgPreview, (data) => { editingImage = data; });

// ---------- Add form ----------
document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("nameInput").value.trim();
  const date = document.getElementById("dateInput").value;
  const time = document.getElementById("timeInput").value;
  if (!name || !date || !time) return;

  /** @type {Item} */
  const item = {
    id: uid(),
    name, date, time,
    image: newImage,
    notified: false,
  };
  items.push(item);
  saveItems(items);
  toast("บันทึกเรียบร้อย ✓");

  e.target.reset();
  imgPreview.style.backgroundImage = "";
  imgPreview.classList.remove("has-img");
  newImage = null;
  goPage("schedule");
});

// ---------- Render: schedule ----------
function renderSchedule() {
  const area = document.getElementById("scheduleArea");
  const empty = document.getElementById("emptyState");
  area.innerHTML = "";

  if (items.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const groups = {};
  items.forEach(it => {
    (groups[it.date] = groups[it.date] || []).push(it);
  });
  const sortedDates = Object.keys(groups).sort();

  const now = new Date();
  const soonMs = 60 * 60 * 1000;

  sortedDates.forEach(date => {
    const list = groups[date].sort((a,b) => a.time.localeCompare(b.time));
    const block = document.createElement("div");
    block.className = "day-block";

    const d = new Date(date + "T00:00:00");
    const weekdayTH = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"][d.getDay()];
    const weekdayJP = ["日","月","火","水","木","金","土"][d.getDay()];
    const dateText = d.toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });

    block.innerHTML = `
      <div class="day-title">
        <span class="date-main">${dateText} (${weekdayTH})</span>
        <span class="date-jp">${weekdayJP}曜日</span>
        <span class="date-count">${list.length} รายการ</span>
      </div>
      <div class="cards-grid"></div>
    `;
    const grid = block.querySelector(".cards-grid");

    list.forEach(it => {
      const card = document.createElement("div");
      card.className = "card";
      const itemDate = new Date(`${it.date}T${it.time}`);
      const diff = itemDate - now;
      if (diff < -60000) card.classList.add("passed");
      else if (diff <= soonMs && diff > -60000) card.classList.add("upcoming-soon");

      const imgStyle = it.image ? `style="background-image:url(${it.image})"` : "";
      const imgInner = it.image ? "" : "通知";

      card.innerHTML = `
        <div class="card-img" ${imgStyle}>${imgInner}</div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(it.name)}</h3>
          <span class="card-time">🕐 ${it.time} น.</span>
        </div>
      `;
      grid.appendChild(card);
    });

    area.appendChild(block);
  });
}

// ---------- Render: manage ----------
function renderManage() {
  const list = document.getElementById("manageList");
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-jp">空</div><p>ยังไม่มีรายการให้จัดการ</p></div>`;
    return;
  }

  const sorted = [...items].sort((a,b) =>
    (a.date + a.time).localeCompare(b.date + b.time)
  );

  sorted.forEach(it => {
    const row = document.createElement("div");
    row.className = "manage-row";
    const thumbStyle = it.image ? `style="background-image:url(${it.image})"` : "";
    const thumbInner = it.image ? "" : "通";
    row.innerHTML = `
      <div class="thumb" ${thumbStyle}>${thumbInner}</div>
      <div class="info">
        <h4>${escapeHtml(it.name)}</h4>
        <p>📅 ${it.date} · 🕐 ${it.time}</p>
      </div>
      <div class="actions">
        <button class="btn-ghost" data-edit="${it.id}">แก้ไข</button>
        <button class="btn-danger" data-del="${it.id}">ลบ</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => {
      if (!confirm("ลบรายการนี้?")) return;
      items = items.filter(i => i.id !== b.dataset.del);
      saveItems(items);
      renderManage();
      toast("ลบแล้ว");
    });
  });
  list.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => openEdit(b.dataset.edit));
  });
}

// ---------- Edit modal ----------
const editModal = document.getElementById("editModal");
function openEdit(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  editingId = id;
  editingImage = it.image;
  document.getElementById("editName").value = it.name;
  document.getElementById("editDate").value = it.date;
  document.getElementById("editTime").value = it.time;
  if (it.image) {
    editImgPreview.style.backgroundImage = `url(${it.image})`;
    editImgPreview.classList.add("has-img");
  } else {
    editImgPreview.style.backgroundImage = "";
    editImgPreview.classList.remove("has-img");
  }
  editModal.classList.remove("hidden");
}
document.getElementById("cancelEdit").addEventListener("click", () => {
  editModal.classList.add("hidden");
  editingId = null;
});
document.getElementById("saveEdit").addEventListener("click", () => {
  const it = items.find(i => i.id === editingId);
  if (!it) return;
  it.name = document.getElementById("editName").value.trim() || it.name;
  it.date = document.getElementById("editDate").value || it.date;
  it.time = document.getElementById("editTime").value || it.time;
  it.image = editingImage;
  it.notified = false;
  saveItems(items);
  editModal.classList.add("hidden");
  renderManage();
  toast("อัปเดตแล้ว ✓");
});

// ---------- Notification scheduler ----------
function checkNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  let changed = false;
  items.forEach(it => {
    if (it.notified) return;
    const t = new Date(`${it.date}T${it.time}`);
    const diff = now - t;
    if (diff >= 0 && diff < 5 * 60 * 1000) {
      try {
        // ใช้ service worker notification ถ้ามี (เสถียรกว่าบนมือถือ)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(it.name, {
              body: `🔔 ถึงเวลา: ${it.name}`,
              tag: it.id,
              icon: it.image || "icon-192.png",
              badge: "icon-192.png",
            });
          });
        } else {
          new Notification(it.name, {
            body: `🔔 ถึงเวลา: ${it.name}`,
            tag: it.id,
            icon: it.image || "icon-192.png",
          });
        }
      } catch (e) { console.warn(e); }
      it.notified = true;
      changed = true;
    }
  });
  if (changed) saveItems(items);
}
setInterval(checkNotifications, 20 * 1000);
checkNotifications();

// ---------- PWA: register service worker + install prompt ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err =>
      console.warn("SW register failed:", err)
    );
  });
}

let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "";
});
installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) {
    toast("เปิดเมนูเบราว์เซอร์ → 'Add to Home Screen'");
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") toast("ติดตั้งสำเร็จ ✓");
  deferredPrompt = null;
  installBtn.style.display = "none";
});

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}

// ---------- Init ----------
const today = new Date().toISOString().slice(0,10);
document.getElementById("dateInput").value = today;
renderSchedule();
