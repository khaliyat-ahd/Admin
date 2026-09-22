/* =========================================================================
   ربط Firebase — نفس مشروع الموقع الرئيسي (khaleyat-ahd)
   ========================================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2tFMqBciAqo3h2ZTQ5je2NOJIkVnr8UM",
  authDomain: "khaleyat-ahd.firebaseapp.com",
  projectId: "khaleyat-ahd",
  storageBucket: "khaleyat-ahd.firebasestorage.app",
  messagingSenderId: "357598654671",
  appId: "1:357598654671:web:d32d004006c6293fb847ba",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ============ Cloudinary (رفع صور الأصناف) ============ */
const CLOUDINARY_CLOUD_NAME = "iyaqi8xq";
const CLOUDINARY_UPLOAD_PRESET = "qt3qlvm6";

async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("فشل رفع الصورة إلى Cloudinary");
  const data = await res.json();
  return data.secure_url;
}

/* ============ القيم الافتراضية لإعدادات المحل (Fallback فقط) ============ */
const DEFAULT_HOURS = [
  { day: 0, label: "الأحد", open: "16:00", close: "00:00", closed: false },
  { day: 1, label: "الاثنين", open: "16:00", close: "00:00", closed: false },
  { day: 2, label: "الثلاثاء", open: "16:00", close: "00:00", closed: false },
  { day: 3, label: "الأربعاء", open: "16:00", close: "00:00", closed: false },
  { day: 4, label: "الخميس", open: "16:00", close: "01:00", closed: false },
  { day: 5, label: "الجمعة", open: "16:30", close: "01:00", closed: false },
  { day: 6, label: "السبت", open: "16:00", close: "01:00", closed: false },
];

/* ============ الحالة العامة ============ */
const state = {
  sections: [], // { docId, key, title, desc, order }
  items: [], // { docId, id, section, name, description, calories, image, isPopular, price?, sizes?, options }
  configRaw: {}, // آخر نسخة كاملة وصلت من config/main (نحافظ على الحقول غير المعروضة بالنموذج)
  settingsHours: structuredClone(DEFAULT_HOURS),
  currentView: "overview",
  search: "",
  pricingMode: "single",
  sectionKeyLocked: false,
  imagePreviewUrl: "",
  pendingImageFile: null,
  toastTimer: null,
  unsubscribers: [],
  ready: { sections: false, items: false, config: false },
};

/* ============ الأيقونات المضمنة ============ */
const ICONS = {
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  utensils: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3v7M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c2.2 1.5 3 3.2 3 5.5 0 2-1.2 3.5-3 3.5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.6v-2.4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17 15 12 10 7M15 12H3"/><path d="M14 4h5v16h-5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.6 3.5 9 3l2 5-2.1 1.6a15 15 0 0 0 5.5 5.5L16 13l5 2 .5 2.4a2.5 2.5 0 0 1-2.7 2.9C10 19.3 4.7 14 3.6 5.2A2.5 2.5 0 0 1 6.6 3.5Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 2-2 6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
};

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    const icon = ICONS[node.dataset.icon];
    if (icon) node.innerHTML = icon;
    const svg = node.querySelector("svg");
    if (svg) {
      svg.setAttribute("aria-hidden", "true");
      svg.style.width = "18px";
      svg.style.height = "18px";
    }
  });
}

/* ============ أدوات مساعدة ============ */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        character
      ])
  );
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function openModal(id) {
  const modal = $(`#${id}`);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  const modal = $(`#${id}`);
  modal.hidden = true;
  document.body.style.overflow = "";
}

function setFormBusy(formId, busy, label) {
  const form = $(`#${formId}`);
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  submitBtn.disabled = busy;
  submitBtn.dataset.originalHtml = submitBtn.dataset.originalHtml || submitBtn.innerHTML;
  submitBtn.innerHTML = busy ? label : submitBtn.dataset.originalHtml;
}

function formatPrice(item) {
  if (item.sizes && item.sizes.length) {
    const min = Math.min(...item.sizes.map((size) => Number(size.price) || 0));
    return `من ${min} ر.س`;
  }
  return `${item.price || 0} ر.س`;
}

function sortedSections() {
  return [...state.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
}
function itemsForSection(sectionKey) {
  return state.items.filter((item) => item.section === sectionKey);
}

function toSlug(text) {
  const transliteration = { ا: "a", أ: "a", إ: "i", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", ى: "a" };
  const slug = [...text.toLowerCase()]
    .map((character) => transliteration[character] || character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `section-${state.sections.length + 1}`;
}

function authErrorMessage(code) {
  const map = {
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests": "محاولات كثيرة، حاولي مرة أخرى بعد قليل.",
    "auth/network-request-failed": "تعذّر الاتصال بالشبكة، تحققي من الإنترنت.",
    "auth/missing-password": "اكتبي كلمة المرور للمتابعة.",
  };
  return map[code] || "تعذّر تسجيل الدخول، حاولي مرة أخرى.";
}

/* ============ التنقل ============ */
function navigate(view) {
  state.currentView = view;
  $$(".page-view").forEach((page) =>
    page.classList.toggle("active", page.id === `view-${view}`)
  );
  $$("[data-view]").forEach((link) =>
    link.classList.toggle("active", link.dataset.view === view)
  );
  window.history.replaceState({}, "", `#${view}`);
}

function setupNavigation() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-view]");
    if (nav) {
      navigate(nav.dataset.view);
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "new-item") openItemModal();
      if (action.dataset.action === "new-section") openSectionModal();
    }
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);

    const editItemBtn = event.target.closest("[data-edit-item]");
    if (editItemBtn) openItemModal(editItemBtn.dataset.editItem);
    const deleteItemBtn = event.target.closest("[data-delete-item]");
    if (deleteItemBtn) deleteItem(deleteItemBtn.dataset.deleteItem);

    const editSectionBtn = event.target.closest("[data-edit-section]");
    if (editSectionBtn) openSectionModal(editSectionBtn.dataset.editSection);
    const deleteSectionBtn = event.target.closest("[data-delete-section]");
    if (deleteSectionBtn) deleteSection(deleteSectionBtn.dataset.deleteSection);

    const pricingButton = event.target.closest("[data-pricing]");
    if (pricingButton) setPricingMode(pricingButton.dataset.pricing);
    const addRowButton = event.target.closest("[data-add-row]");
    if (addRowButton) addArrayRow(addRowButton.dataset.addRow);
    const removeRowButton = event.target.closest("[data-remove-row]");
    if (removeRowButton)
      removeArrayRow(removeRowButton.dataset.removeRow, Number(removeRowButton.dataset.index));
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const error = $("#login-error");
    error.hidden = true;
    if (!email || !password) {
      error.textContent = "اكتبي البريد الإلكتروني وكلمة المرور للمتابعة.";
      error.hidden = false;
      return;
    }
    const submitBtn = $("#login-form button[type=submit]");
    submitBtn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged سيتكفّل بعرض التطبيق
    } catch (err) {
      error.textContent = authErrorMessage(err.code);
      error.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await signOut(auth);
  });
}

/* ============ لوحة النظرة العامة ============ */
function renderOverview() {
  const popularCount = state.items.filter((item) => item.isPopular).length;
  $("#stats-grid").innerHTML = [
    ["إجمالي الأصناف", state.items.length, "أصناف مرتبة في المنيو"],
    ["أقسام المنيو", state.sections.length, "تسهل رحلة العميل"],
    ["الأكثر طلباً", popularCount, "صنف عليه شارة محبوب"],
    ["حالة المحل", isShopOpen() ? "مفتوح" : "مغلق", isShopOpen() ? "يستقبل طلبات اليوم" : "يفتح حسب الجدول"],
  ]
    .map(
      ([label, number, helper], index) =>
        `<article class="stat-card" data-testid="stat-card-${index}"><div class="stat-label">${label}</div><div class="stat-number">${number}</div><div class="stat-helper">${helper}</div></article>`
    )
    .join("");

  const current = getCurrentHour();
  $("#shop-status-card").innerHTML = `<div class="status-kicker"><span class="status-dot"></span>${
    isShopOpen() ? "المحل مفتوح الآن" : "المحل مغلق الآن"
  }</div><h2>${
    isShopOpen() ? `يفتح اليوم حتى ${current.close}` : `يفتح اليوم ${current.open}`
  }</h2><p>${
    current.closed ? "يوم راحة — نلتقي بك في اليوم التالي." : "وقت مناسب لمراجعة المنيو قبل استقبال الطلبات."
  }</p>`;

  $("#activity-list").innerHTML = `<div class="activity-row"><span class="activity-bullet"></span><div><p>البيانات متصلة مباشرة بقاعدة Firestore</p><small>كل تعديل يظهر فوراً على الموقع</small></div></div>`;
  hydrateIcons($("#stats-grid"));
}

function getCurrentHour() {
  const dayIndex = new Date().getDay();
  return state.settingsHours[dayIndex] || state.settingsHours[0];
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isShopOpen() {
  const hour = getCurrentHour();
  if (hour.closed) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const open = timeToMinutes(hour.open);
  let close = timeToMinutes(hour.close);
  if (close <= open) close += 24 * 60;
  const adjustedCurrent = current < open && close > 24 * 60 ? current + 24 * 60 : current;
  return adjustedCurrent >= open && adjustedCurrent < close;
}

/* ============ صفحة الأصناف ============ */
function renderItems() {
  const query = state.search.trim().toLowerCase();
  let visibleCount = 0;
  const markup = sortedSections()
    .map((section) => {
      const sectionItems = itemsForSection(section.key)
        .filter((item) => item.name.toLowerCase().includes(query))
        .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, "ar"));
      visibleCount += sectionItems.length;
      if (!sectionItems.length) return "";
      return `<section class="items-group"><div class="items-group-head"><h2>${escapeHtml(
        section.title
      )}</h2><span class="count-pill">${sectionItems.length} أصناف</span></div><div class="items-grid">${sectionItems
        .map(renderItemCard)
        .join("")}</div></section>`;
    })
    .join("");
  $("#items-groups").innerHTML =
    markup || `<div class="empty-state"><span data-icon="search"></span><p>لا توجد أصناف بهذا البحث.</p></div>`;
  $("#item-result-count").textContent = `${visibleCount} نتيجة`;
  hydrateIcons($("#items-groups"));
}

function renderItemCard(item) {
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />`
    : '<span data-icon="utensils"></span>';
  return `<article class="item-card" data-testid="card-item-${item.docId}"><div class="item-image">${image}</div><div class="item-card-body"><div class="item-card-top"><h3 class="item-name">${escapeHtml(
    item.name
  )}</h3>${
    item.isPopular ? '<span class="popular-badge"><span data-icon="star"></span> محبوب</span>' : ""
  }</div><p class="item-description">${escapeHtml(
    item.description || "لا يوجد وصف لهذا الصنف بعد."
  )}</p><div class="item-card-meta"><div><div class="item-price">${formatPrice(
    item
  )}</div><span class="item-order">${item.calories || 0} سعرة</span></div><div class="card-actions"><button class="icon-button" data-edit-item="${
    item.docId
  }" aria-label="تعديل ${escapeHtml(item.name)}" title="تعديل"><span data-icon="edit"></span></button><button class="icon-button delete" data-delete-item="${
    item.docId
  }" aria-label="حذف ${escapeHtml(item.name)}" title="حذف"><span data-icon="trash"></span></button></div></div></div></article>`;
}

async function deleteItem(docId) {
  const item = state.items.find((entry) => entry.docId === docId);
  if (!item || !window.confirm(`هل تريدين حذف صنف «${item.name}»؟`)) return;
  try {
    await deleteDoc(doc(db, "items", docId));
    showToast("تم حذف الصنف");
  } catch (err) {
    showToast("تعذّر حذف الصنف، حاولي مرة أخرى");
  }
}

/* ============ نموذج الصنف ============ */
function fillSectionSelect(selectedKey = "") {
  $("#item-section").innerHTML = sortedSections()
    .map(
      (section) =>
        `<option value="${escapeHtml(section.key)}" ${
          section.key === selectedKey ? "selected" : ""
        }>${escapeHtml(section.title)}</option>`
    )
    .join("");
}

function openItemModal(docId = "") {
  const item = state.items.find((entry) => entry.docId === docId);
  $("#item-form").reset();
  $("#item-id").value = item?.docId || "";
  $("#item-modal-title").textContent = item ? "تعديل الصنف" : "إضافة صنف جديد";
  fillSectionSelect(item?.section || state.sections[0]?.key || "");
  $("#item-name").value = item?.name || "";
  $("#item-description").value = item?.description || "";
  $("#item-calories").value = item?.calories || "";
  $("#item-order").value = item?.order || "";
  $("#item-popular").checked = Boolean(item?.isPopular);
  state.pricingMode = item?.sizes && item.sizes.length ? "multi" : "single";
  state.imagePreviewUrl = item?.image || "";
  state.pendingImageFile = null;
  $("#item-price").value = item?.price || "";
  renderPricingMode();
  renderArrayRows(
    "size",
    (item?.sizes || []).map((s) => ({ name: s.label, price: s.price }))
  );
  renderArrayRows(
    "option",
    (item?.options || []).map((o) => ({ name: o.label, price: o.priceDelta }))
  );
  renderImagePreview(state.imagePreviewUrl);
  openModal("item-modal");
  setTimeout(() => $("#item-name").focus(), 40);
}

function setPricingMode(mode) {
  state.pricingMode = mode;
  renderPricingMode();
}

function renderPricingMode() {
  $$(".pricing-toggle button").forEach((button) =>
    button.classList.toggle("active", button.dataset.pricing === state.pricingMode)
  );
  $("#single-price-group").hidden = state.pricingMode !== "single";
  $("#sizes-group").hidden = state.pricingMode !== "multi";
}

function renderArrayRows(type, rows) {
  const list = $(`#${type === "size" ? "sizes-list" : "options-list"}`);
  list.className = "array-list";
  list.innerHTML = rows
    .map(
      (row, index) =>
        `<div class="array-row" data-row-type="${type}"><input class="field-input" data-row-name="${type}" data-index="${index}" value="${escapeHtml(
          row.name
        )}" placeholder="${
          type === "size" ? "اسم الحجم" : "اسم الإضافة"
        }" aria-label="${type === "size" ? "اسم الحجم" : "اسم الإضافة"} ${
          index + 1
        }" /><input class="field-input" data-row-price="${type}" data-index="${index}" type="number" min="0" step="0.5" value="${
          Number(row.price) || 0
        }" placeholder="${
          type === "size" ? "السعر" : "فرق السعر"
        }" aria-label="السعر ${index + 1}" /><button type="button" class="icon-button delete" data-remove-row="${type}" data-index="${index}" aria-label="حذف الصف"><span data-icon="trash"></span></button></div>`
    )
    .join("");
  hydrateIcons(list);
}

function currentArrayRows(type) {
  return $$(`[data-row-type="${type}"]`).map((row) => ({
    name: $(`[data-row-name="${type}"]`, row)?.value.trim() || "",
    price: Number($(`[data-row-price="${type}"]`, row)?.value) || 0,
  }));
}

function addArrayRow(type) {
  const rows = currentArrayRows(type);
  rows.push({ name: "", price: 0 });
  renderArrayRows(type, rows);
  const inputs = $$(`[data-row-name="${type}"]`);
  inputs[inputs.length - 1]?.focus();
}

function removeArrayRow(type, index) {
  const rows = currentArrayRows(type);
  rows.splice(index, 1);
  renderArrayRows(type, rows);
}

function renderImagePreview(src) {
  const preview = $("#image-preview");
  preview.hidden = !src;
  preview.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="معاينة صورة الصنف" />` : "";
}

function setupItemForm() {
  $("#item-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#item-name").value.trim();
    if (!name || !$("#item-section").value) return;

    setFormBusy("item-form", true, "جارٍ الحفظ...");
    try {
      let imageUrl = state.imagePreviewUrl;
      if (state.pendingImageFile) {
        showToast("جارٍ رفع الصورة...");
        imageUrl = await uploadImageToCloudinary(state.pendingImageFile);
      }

      const existingDocId = $("#item-id").value;
      const docId = existingDocId || doc(collection(db, "items")).id;

      const itemData = {
        id: docId,
        section: $("#item-section").value,
        name,
        description: $("#item-description").value.trim(),
        calories: Number($("#item-calories").value) || 0,
        isPopular: $("#item-popular").checked,
        image: imageUrl || "",
        options: currentArrayRows("option")
          .filter((row) => row.name)
          .map((row) => ({ label: row.name, priceDelta: row.price })),
      };
      const orderValue = Number($("#item-order").value);
      if (orderValue) itemData.order = orderValue;

      if (state.pricingMode === "multi") {
        itemData.sizes = currentArrayRows("size")
          .filter((row) => row.name)
          .map((row) => ({ label: row.name, price: row.price }));
      } else {
        itemData.price = Number($("#item-price").value) || 0;
      }

      await setDoc(doc(db, "items", docId), itemData);
      closeModal("item-modal");
      showToast(existingDocId ? "تم تحديث الصنف" : "تمت إضافة الصنف بنجاح");
    } catch (err) {
      console.error(err);
      showToast("تعذّر حفظ الصنف، حاولي مرة أخرى");
    } finally {
      setFormBusy("item-form", false);
    }
  });

  $("#item-image").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.pendingImageFile = file;
    if (state.imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = URL.createObjectURL(file);
    renderImagePreview(state.imagePreviewUrl);
  });
}

/* ============ صفحة الأقسام ============ */
function renderSections() {
  $("#sections-list").innerHTML = sortedSections()
    .map(
      (section) =>
        `<article class="section-row" data-testid="row-section-${section.docId}"><span class="section-order">${
          section.order || 0
        }</span><div><h3>${escapeHtml(section.title)}</h3><p dir="ltr">${escapeHtml(
          section.key
        )}</p></div><span class="section-item-count">${
          itemsForSection(section.key).length
        } أصناف</span><div class="row-actions"><button class="icon-button" data-edit-section="${
          section.docId
        }" aria-label="تعديل ${escapeHtml(section.title)}" title="تعديل"><span data-icon="edit"></span></button><button class="icon-button delete" data-delete-section="${
          section.docId
        }" aria-label="حذف ${escapeHtml(section.title)}" title="حذف"><span data-icon="trash"></span></button></div></article>`
    )
    .join("");
  hydrateIcons($("#sections-list"));
}

function openSectionModal(docId = "") {
  const section = state.sections.find((entry) => entry.docId === docId);
  state.sectionKeyLocked = Boolean(section);
  $("#section-form").reset();
  $("#section-id").value = section?.docId || "";
  $("#section-modal-title").textContent = section ? "تعديل القسم" : "إضافة قسم جديد";
  $("#section-name").value = section?.title || "";
  $("#section-slug").value = section?.key || "";
  $("#section-slug").disabled = state.sectionKeyLocked;
  $("#section-slug-hint").hidden = !state.sectionKeyLocked;
  $("#section-desc").value = section?.desc || "";
  $("#section-order").value = section?.order || state.sections.length + 1;
  openModal("section-modal");
  setTimeout(() => $("#section-name").focus(), 40);
}

async function deleteSection(docId) {
  const section = state.sections.find((entry) => entry.docId === docId);
  if (!section) return;
  const affectedItems = itemsForSection(section.key);
  const fallbackSection = state.sections.find((entry) => entry.docId !== docId);
  if (affectedItems.length && !fallbackSection) {
    window.alert("لا يمكن حذف آخر قسم بينما توجد أصناف مرتبطة به. أضيفي قسماً آخر أولاً.");
    return;
  }
  const message = affectedItems.length
    ? `هذا القسم يحتوي على ${affectedItems.length} أصناف مرتبطة. سيتم نقلها إلى «${fallbackSection.title}». هل تريدين المتابعة؟`
    : `هل تريدين حذف قسم «${section.title}»؟`;
  if (!window.confirm(message)) return;

  try {
    const batch = writeBatch(db);
    affectedItems.forEach((item) => {
      batch.update(doc(db, "items", item.docId), { section: fallbackSection.key });
    });
    batch.delete(doc(db, "sections", docId));
    await batch.commit();
    showToast("تم حذف القسم");
  } catch (err) {
    console.error(err);
    showToast("تعذّر حذف القسم، حاولي مرة أخرى");
  }
}

function setupSectionForm() {
  $("#section-name").addEventListener("input", (event) => {
    if (!state.sectionKeyLocked) $("#section-slug").value = toSlug(event.target.value);
  });

  $("#section-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#section-name").value.trim();
    if (!title) return;

    setFormBusy("section-form", true, "جارٍ الحفظ...");
    try {
      const existingDocId = $("#section-id").value;
      const key = $("#section-slug").value.trim() || toSlug(title);

      if (!existingDocId && state.sections.some((entry) => entry.key === key)) {
        showToast("يوجد قسم آخر بنفس المعرّف، غيّري المعرّف الإنجليزي");
        return;
      }

      const docId = existingDocId || doc(collection(db, "sections")).id;
      const sectionData = {
        key,
        title,
        desc: $("#section-desc").value.trim(),
        order: Number($("#section-order").value) || state.sections.length + 1,
      };
      await setDoc(doc(db, "sections", docId), sectionData);
      closeModal("section-modal");
      showToast(existingDocId ? "تم تحديث القسم" : "تمت إضافة القسم");
    } catch (err) {
      console.error(err);
      showToast("تعذّر حفظ القسم، حاولي مرة أخرى");
    } finally {
      setFormBusy("section-form", false);
    }
  });
}

/* ============ صفحة الإعدادات ============ */
function renderSettings() {
  const c = state.configRaw;
  $("#setting-whatsapp").value = c.RESTAURANT_PHONE || "";
  $("#setting-phone").value = c.CALL_PHONE || "";
  $("#setting-maps").value = c.MAPS_URL || "";
  $("#setting-instagram").value = c.INSTAGRAM_URL || "";
  $("#setting-snapchat").value = c.SNAPCHAT_URL || "";
  $("#hours-list").innerHTML = state.settingsHours
    .map(
      (hour, index) =>
        `<div class="hour-row"><span class="day-name">${hour.label}</span><input class="field-input" type="time" value="${
          hour.open
        }" data-hour-field="open" data-index="${index}" aria-label="وقت فتح ${
          hour.label
        }" ${hour.closed ? "disabled" : ""} /><input class="field-input" type="time" value="${
          hour.close
        }" data-hour-field="close" data-index="${index}" aria-label="وقت إغلاق ${
          hour.label
        }" ${hour.closed ? "disabled" : ""} /><label class="closed-toggle"><input type="checkbox" data-hour-field="closed" data-index="${index}" ${
          hour.closed ? "checked" : ""
        } /><span>مغلق</span></label></div>`
    )
    .join("");
}

function setupSettingsForm() {
  $("#hours-list").addEventListener("change", (event) => {
    const field = event.target.dataset.hourField;
    const index = Number(event.target.dataset.index);
    if (!field) return;
    state.settingsHours[index][field] =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    if (field === "closed") renderSettings();
  });

  $("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormBusy("settings-form", true, "جارٍ الحفظ...");
    try {
      const configData = {
        ...state.configRaw,
        RESTAURANT_PHONE: $("#setting-whatsapp").value.trim(),
        CALL_PHONE: $("#setting-phone").value.trim(),
        MAPS_URL: $("#setting-maps").value.trim(),
        INSTAGRAM_URL: $("#setting-instagram").value.trim(),
        SNAPCHAT_URL: $("#setting-snapchat").value.trim(),
        WORKING_HOURS: state.settingsHours,
      };
      await setDoc(doc(db, "config", "main"), configData);
      $("#settings-saved").hidden = false;
      showToast("تم حفظ الإعدادات بنجاح");
      setTimeout(() => {
        $("#settings-saved").hidden = true;
      }, 3000);
    } catch (err) {
      console.error(err);
      showToast("تعذّر حفظ الإعدادات، حاولي مرة أخرى");
    } finally {
      setFormBusy("settings-form", false);
    }
  });
}

/* ============ البحث والتحديث العام ============ */
function renderAll() {
  renderOverview();
  renderItems();
  renderSections();
  renderSettings();
  navigate(state.currentView);
  hydrateIcons();
}

function renderIfReady() {
  if (state.ready.sections && state.ready.items && state.ready.config) renderAll();
}

function setupSearch() {
  $("#item-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderItems();
  });
}

/* ============ الاستماع الحي لبيانات Firestore ============ */
function startListeners() {
  const sectionsQuery = query(collection(db, "sections"), orderBy("order"));
  state.unsubscribers.push(
    onSnapshot(sectionsQuery, (snap) => {
      state.sections = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      state.ready.sections = true;
      renderIfReady();
    }, (err) => {
      console.error(err);
      showToast("تعذّر جلب الأقسام من Firestore");
    })
  );

  state.unsubscribers.push(
    onSnapshot(collection(db, "items"), (snap) => {
      state.items = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      state.ready.items = true;
      renderIfReady();
    }, (err) => {
      console.error(err);
      showToast("تعذّر جلب الأصناف من Firestore");
    })
  );

  state.unsubscribers.push(
    onSnapshot(doc(db, "config", "main"), (snap) => {
      state.configRaw = snap.exists() ? snap.data() : {};
      state.settingsHours = (state.configRaw.WORKING_HOURS || DEFAULT_HOURS).map((h) => ({
        closed: false,
        ...h,
      }));
      state.ready.config = true;
      renderIfReady();
    }, (err) => {
      console.error(err);
      showToast("تعذّر جلب الإعدادات من Firestore");
    })
  );
}

function stopListeners() {
  state.unsubscribers.forEach((unsub) => unsub());
  state.unsubscribers = [];
  state.ready = { sections: false, items: false, config: false };
  state.sections = [];
  state.items = [];
  state.configRaw = {};
}

/* ============ التنقل بين شاشة الدخول والتطبيق ============ */
function showApp() {
  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  const hashView = window.location.hash.replace("#", "");
  if (["overview", "items", "sections", "settings"].includes(hashView)) {
    state.currentView = hashView;
  }
  startListeners();
}

function showLogin() {
  $("#app-view").hidden = true;
  $("#login-view").hidden = false;
  $("#login-error").hidden = true;
  $("#login-form").reset();
  stopListeners();
}

/* ============ التشغيل ============ */
function init() {
  hydrateIcons();
  setupNavigation();
  setupSearch();
  setupItemForm();
  setupSectionForm();
  setupSettingsForm();

  onAuthStateChanged(auth, (user) => {
    if (user) showApp();
    else showLogin();
  });
}

document.addEventListener("DOMContentLoaded", init);