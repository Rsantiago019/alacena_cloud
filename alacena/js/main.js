// ==========================================================================
// MAIN — estado de la app, render de UI, y orquestación Supabase + GSAP
// ==========================================================================
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  isLowStock,
  triggerLowStockAlert,
} from "./supabaseClient.js";

import {
  animateCardsIn,
  animateCardRemove,
  animateStockChange,
  animateGaugeTo,
  flashCardAlert,
  openOverlay,
  closeOverlay,
  shakeField,
  revealAlertsPanel,
  hideAlertsPanel,
  animateAlertChipsIn,
  showToast,
  animateThemeToggle,
  pulseButton,
} from "./animations.js";

const CATEGORIES = [
  "Granos",
  "Panadería",
  "Carnes",
  "Lácteos",
  "Bebidas",
  "Limpieza",
  "Condimentos",
  "Otros",
];

/* --------------------------------------------------------------------
 * Referencias al DOM
 * ------------------------------------------------------------------ */
const el = {
  grid: document.getElementById("productsGrid"),
  loading: document.getElementById("loadingState"),
  empty: document.getElementById("emptyState"),
  categoryFilters: document.getElementById("categoryFilters"),
  sortSelect: document.getElementById("sortSelect"),
  searchInput: document.getElementById("searchInput"),

  alertsPanel: document.getElementById("alertsPanel"),
  alertsCount: document.getElementById("alertsCount"),
  alertsList: document.getElementById("alertsList"),
  notifyBtn: document.getElementById("notifyBtn"),

  themeToggle: document.getElementById("themeToggle"),
  addProductBtn: document.getElementById("addProductBtn"),
  emptyStateAddBtn: document.getElementById("emptyStateAddBtn"),

  modalOverlay: document.getElementById("modalOverlay"),
  modal: document.getElementById("productModal"),
  modalTitle: document.getElementById("modalTitle"),
  form: document.getElementById("productForm"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  submitBtn: document.getElementById("submitBtn"),
  productId: document.getElementById("productId"),

  confirmOverlay: document.getElementById("confirmOverlay"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmText: document.getElementById("confirmText"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

  toast: document.getElementById("toast"),
  toastIcon: document.getElementById("toastIcon"),
  toastMessage: document.getElementById("toastMessage"),
};

/* --------------------------------------------------------------------
 * Estado
 * ------------------------------------------------------------------ */
const state = {
  products: [],
  category: "todas",
  sort: "nombre",
  search: "",
  editingId: null,
  deleteTargetId: null,
};

/* --------------------------------------------------------------------
 * Utilidades
 * ------------------------------------------------------------------ */
function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(d);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Circunferencia y offset del anillo de stock (r = 21). */
const GAUGE_R = 21;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;

function gaugeOffsetFor(producto) {
  const cantidad = Number(producto.cantidad) || 0;
  const minimo = Number(producto.stock_minimo) || 0;
  const referencia = minimo > 0 ? minimo * 2 : Math.max(cantidad, 1);
  const pct = Math.max(0, Math.min(1, cantidad / referencia));
  return {
    pct,
    offset: GAUGE_CIRCUMFERENCE * (1 - pct),
  };
}

function toast(message, type = "success") {
  el.toastIcon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "•";
  el.toastMessage.textContent = message;
  showToast(el.toast);
}

/* --------------------------------------------------------------------
 * Render: filtros de categoría
 * ------------------------------------------------------------------ */
function renderCategoryFilters() {
  const chips = ['<button class="chip is-active" data-category="todas" type="button">Todas</button>']
    .concat(
      CATEGORIES.map(
        (cat) => `<button class="chip" data-category="${escapeHtml(cat)}" type="button">${escapeHtml(cat)}</button>`
      )
    )
    .join("");
  el.categoryFilters.innerHTML = chips;

  el.categoryFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.category = btn.dataset.category;
    [...el.categoryFilters.children].forEach((c) => c.classList.toggle("is-active", c === btn));
    renderGrid();
  });
}

/* --------------------------------------------------------------------
 * Filtro + orden de productos según el estado actual
 * ------------------------------------------------------------------ */
function getVisibleProducts() {
  let list = [...state.products];

  if (state.category !== "todas") {
    list = list.filter((p) => p.categoria === state.category);
  }

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter((p) => p.nombre.toLowerCase().includes(q));
  }

  switch (state.sort) {
    case "stock":
      list.sort((a, b) => Number(a.cantidad) - Number(b.cantidad));
      break;
    case "fecha_compra":
      list.sort((a, b) => new Date(b.fecha_compra || 0) - new Date(a.fecha_compra || 0));
      break;
    case "precio":
      list.sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0));
      break;
    default:
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  return list;
}

/* --------------------------------------------------------------------
 * Construcción de una tarjeta de producto
 * ------------------------------------------------------------------ */
function buildCard(producto) {
  const card = document.createElement("article");
  const low = isLowStock(producto);
  card.className = "product-card" + (low ? " is-low" : "");
  card.dataset.id = producto.id;

  const { pct, offset } = gaugeOffsetFor(producto);

  card.innerHTML = `
    <div class="card-top">
      <div class="card-title-block">
        <span class="card-category">${escapeHtml(producto.categoria)}</span>
        <h3 class="card-title">${escapeHtml(producto.nombre)}</h3>
      </div>
      <div class="stock-gauge">
        <svg viewBox="0 0 48 48">
          <circle class="gauge-track" cx="24" cy="24" r="${GAUGE_R}"></circle>
          <circle class="gauge-fill" cx="24" cy="24" r="${GAUGE_R}"
            stroke-dasharray="${GAUGE_CIRCUMFERENCE}"
            data-circumference="${GAUGE_CIRCUMFERENCE}"
            data-target-offset="${offset}"
            style="stroke-dashoffset:${GAUGE_CIRCUMFERENCE}"></circle>
        </svg>
        <span class="gauge-value">${Math.round(pct * 100)}%</span>
      </div>
    </div>

    <div class="card-meta">
      <span>Stock mínimo: <strong>${producto.stock_minimo} ${escapeHtml(producto.unidad)}</strong></span>
    </div>

    <div class="card-divider"></div>

    <div class="card-footer">
      <div class="stock-stepper">
        <button type="button" class="step-down" aria-label="Restar stock">
          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <span class="stepper-value">${Number(producto.cantidad)} ${escapeHtml(producto.unidad)}</span>
        <button type="button" class="step-up" aria-label="Sumar stock">
          <svg viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="card-actions">
        <span class="price-tag">${formatCurrency(producto.precio)}</span>
        <button type="button" class="edit-btn" aria-label="Editar">
          <svg viewBox="0 0 16 16" fill="none"><path d="M11 2.5 13.5 5 6 12.5 3 13l.5-3L11 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="delete-btn" aria-label="Eliminar">
          <svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `;

  card.querySelector(".step-down").addEventListener("click", () => handleStockStep(producto.id, -1));
  card.querySelector(".step-up").addEventListener("click", () => handleStockStep(producto.id, 1));
  card.querySelector(".edit-btn").addEventListener("click", () => openEditModal(producto.id));
  card.querySelector(".delete-btn").addEventListener("click", () => openDeleteConfirm(producto.id));

  return card;
}

/* --------------------------------------------------------------------
 * Render de la grilla completa
 * ------------------------------------------------------------------ */
function renderGrid() {
  const visible = getVisibleProducts();

  el.grid.innerHTML = "";
  el.loading.hidden = true;

  if (!state.products.length) {
    el.grid.hidden = true;
    el.empty.hidden = false;
    return;
  }

  el.empty.hidden = true;
  el.grid.hidden = false;

  const cards = visible.map(buildCard);
  cards.forEach((c) => el.grid.appendChild(c));
  animateCardsIn(cards);
}

/* --------------------------------------------------------------------
 * Render del panel de alertas de stock bajo
 * ------------------------------------------------------------------ */
function renderAlertsPanel() {
  const lowStockItems = state.products.filter(isLowStock);

  if (!lowStockItems.length) {
    if (!el.alertsPanel.hidden) hideAlertsPanel(el.alertsPanel);
    return;
  }

  el.alertsCount.textContent = lowStockItems.length;
  el.alertsList.innerHTML = lowStockItems
    .map(
      (p) => `
      <span class="alert-chip">
        <span class="dot"></span>
        ${escapeHtml(p.nombre)}
        <span class="qty">${p.cantidad}/${p.stock_minimo} ${escapeHtml(p.unidad)}</span>
      </span>`
    )
    .join("");

  if (el.alertsPanel.hidden) {
    revealAlertsPanel(el.alertsPanel);
  }
  animateAlertChipsIn(el.alertsList.querySelectorAll(".alert-chip"));
}

/* --------------------------------------------------------------------
 * Carga inicial de productos
 * ------------------------------------------------------------------ */
async function loadProducts() {
  try {
    state.products = await fetchProducts();
    renderGrid();
    renderAlertsPanel();
  } catch (err) {
    console.error(err);
    el.loading.hidden = true;
    toast("No se pudo conectar con Supabase. Revisá js/config.js", "error");
  }
}

/* --------------------------------------------------------------------
 * Modal: agregar / editar producto
 * ------------------------------------------------------------------ */
function openAddModal() {
  state.editingId = null;
  el.modalTitle.textContent = "Nuevo producto";
  el.submitBtn.textContent = "Guardar producto";
  el.form.reset();
  el.productId.value = "";
  const fechaInput = document.getElementById("fechaCompra");
  if (fechaInput) {
    fechaInput.valueAsDate = new Date();
  }
  el.confirmOverlay.hidden = true;
  el.modalOverlay.hidden = false;
  openOverlay(el.modalOverlay, el.modal);
}

function openEditModal(id) {
  const producto = state.products.find((p) => p.id === id);
  if (!producto) return;

  state.editingId = id;
  el.modalTitle.textContent = "Editar producto";
  el.submitBtn.textContent = "Guardar cambios";

  el.productId.value = producto.id;
  el.form.nombre.value = producto.nombre;
  el.form.categoria.value = producto.categoria;
  el.form.unidad.value = producto.unidad;
  el.form.cantidad.value = producto.cantidad;
  el.form.stock_minimo.value = producto.stock_minimo;
  el.form.precio.value = producto.precio ?? "";
  el.form.fecha_compra.value = producto.fecha_compra ?? "";

  openOverlay(el.modalOverlay, el.modal);
}

async function closeProductModal() {
  await closeOverlay(el.modalOverlay, el.modal);
  state.editingId = null;
  el.modalOverlay.hidden = true;
}

function validateForm() {
  let valid = true;
  const required = [el.form.nombre, el.form.cantidad, el.form.stock_minimo];
  required.forEach((field) => {
    if (!field.value.trim()) {
      valid = false;
      shakeField(field.closest(".field"));
    }
  });
  return valid;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  pulseButton(el.submitBtn);
  el.submitBtn.disabled = true;

  const payload = {
    nombre: el.form.nombre.value.trim(),
    categoria: el.form.categoria.value,
    unidad: el.form.unidad.value,
    cantidad: Number(el.form.cantidad.value),
    stock_minimo: Number(el.form.stock_minimo.value),
    precio: el.form.precio.value ? Number(el.form.precio.value) : null,
    fecha_compra: el.form.fecha_compra.value || null,
  };

  try {
    if (state.editingId) {
      const updated = await updateProduct(state.editingId, payload);
      const idx = state.products.findIndex((p) => p.id === state.editingId);
      state.products[idx] = updated;
      await closeProductModal();
      renderGrid();
      renderAlertsPanel();
      toast("Producto actualizado");
    } else {
      const created = await createProduct(payload);
      state.products.push(created);
      await closeProductModal();
      renderGrid();
      renderAlertsPanel();
      toast("Producto agregado");
    }
  } catch (err) {
    console.error(err);
    toast("Ocurrió un error al guardar. Intentá de nuevo.", "error");
  } finally {
    el.submitBtn.disabled = false;
  }
}

/* --------------------------------------------------------------------
 * Eliminar producto
 * ------------------------------------------------------------------ */
function openDeleteConfirm(id) {
  const producto = state.products.find((p) => p.id === id);
  if (!producto) return;
  state.deleteTargetId = id;
  el.confirmText.textContent = `"${producto.nombre}" se va a eliminar de tu alacena. Esta acción no se puede deshacer.`;
  el.modalOverlay.hidden = true;
  el.confirmOverlay.hidden = false;
  openOverlay(el.confirmOverlay, el.confirmDialog);
}

async function closeDeleteConfirm() {
  await closeOverlay(el.confirmOverlay, el.confirmDialog);
  state.deleteTargetId = null;
  el.confirmOverlay.hidden = true;
}

async function handleConfirmDelete() {
  const id = state.deleteTargetId;
  if (!id) return;

  const card = el.grid.querySelector(`[data-id="${id}"]`);
  el.confirmDeleteBtn.disabled = true;

  try {
    await closeDeleteConfirm();
    if (card) await animateCardRemove(card);
    await deleteProduct(id);
    state.products = state.products.filter((p) => p.id !== id);
    if (card) card.remove();
    if (!getVisibleProducts().length) renderGrid();
    renderAlertsPanel();
    toast("Producto eliminado");
  } catch (err) {
    console.error(err);
    toast("No se pudo eliminar el producto.", "error");
  } finally {
    el.confirmDeleteBtn.disabled = false;
  }
}

/* --------------------------------------------------------------------
 * Ajuste rápido de stock (+/-) desde la tarjeta
 * ------------------------------------------------------------------ */
async function handleStockStep(id, delta) {
  const producto = state.products.find((p) => p.id === id);
  if (!producto) return;

  const wasLow = isLowStock(producto);
  const step = producto.unidad === "kg" || producto.unidad === "l" ? 0.5 : 1;
  const nuevaCantidad = Math.max(0, Number(producto.cantidad) + delta * step);

  producto.cantidad = nuevaCantidad;

  const card = el.grid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.querySelector(".stepper-value").textContent = `${nuevaCantidad} ${producto.unidad}`;
    animateStockChange(card, { increased: delta > 0 });
    const { pct, offset } = gaugeOffsetFor(producto);
    card.querySelector(".gauge-value").textContent = `${Math.round(pct * 100)}%`;
    animateGaugeTo(card, offset);

    const nowLow = isLowStock(producto);
    if (nowLow !== wasLow) {
      card.classList.toggle("is-low", nowLow);
      flashCardAlert(card);
    }
  }

  try {
    await adjustStock(id, nuevaCantidad);
    renderAlertsPanel();
  } catch (err) {
    console.error(err);
    toast("No se pudo actualizar el stock en el servidor.", "error");
  }
}

/* --------------------------------------------------------------------
 * Enviar alerta de stock bajo (Edge Function -> correo)
 * ------------------------------------------------------------------ */
async function handleNotifyClick() {
  const lowStockItems = state.products.filter(isLowStock);
  if (!lowStockItems.length) return;

  el.notifyBtn.disabled = true;
  el.notifyBtn.textContent = "Enviando…";

  try {
    await triggerLowStockAlert(lowStockItems);
    toast("Alerta enviada por correo");
  } catch (err) {
    console.error(err);
    toast("No se pudo enviar la alerta (¿desplegaste la Edge Function?)", "error");
  } finally {
    el.notifyBtn.disabled = false;
    el.notifyBtn.textContent = "Enviar alerta por correo";
  }
}

/* --------------------------------------------------------------------
 * Tema claro / oscuro
 * ------------------------------------------------------------------ */
function initTheme() {
  const saved = localStorage.getItem("alacena-theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.body.dataset.theme = preferred;
}

function handleThemeToggle() {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = next;
  localStorage.setItem("alacena-theme", next);
  animateThemeToggle(el.themeToggle);
}

/* --------------------------------------------------------------------
 * Listeners generales
 * ------------------------------------------------------------------ */
function bindEvents() {
  el.addProductBtn.addEventListener("click", openAddModal);
  el.emptyStateAddBtn.addEventListener("click", openAddModal);
  el.closeModalBtn.addEventListener("click", closeProductModal);
  el.cancelBtn.addEventListener("click", closeProductModal);
  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeProductModal();
  });
  el.form.addEventListener("submit", handleFormSubmit);

  el.confirmCancelBtn.addEventListener("click", closeDeleteConfirm);
  el.confirmOverlay.addEventListener("click", (e) => {
    if (e.target === el.confirmOverlay) closeDeleteConfirm();
  });
  el.confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

  el.notifyBtn.addEventListener("click", handleNotifyClick);
  el.themeToggle.addEventListener("click", handleThemeToggle);

  el.searchInput.addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value;
      renderGrid();
    }, 200)
  );

  el.sortSelect.addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el.modalOverlay.hidden) closeProductModal();
    if (!el.confirmOverlay.hidden) closeDeleteConfirm();
  });
}

/* --------------------------------------------------------------------
 * Arranque
 * ------------------------------------------------------------------ */
(async function init() {
  initTheme();
  renderCategoryFilters();
  bindEvents();
  await loadProducts();
})();
