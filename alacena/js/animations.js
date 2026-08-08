// ==========================================================================
// GSAP ANIMATIONS — todas las transiciones y micro-interacciones de la app
// gsap se carga globalmente vía CDN en index.html
// ==========================================================================

const EASE_OUT = "power3.out";
const EASE_IN = "power2.in";
const EASE_BOUNCE = "back.out(1.7)";

/* --------------------------------------------------------------------
 * 1. Entrada en stagger de las tarjetas de producto (carga inicial /
 *    cambio de filtro)
 * ------------------------------------------------------------------ */
export function animateCardsIn(cards) {
  if (!cards.length) return;

  gsap.set(cards, { opacity: 0, y: 26, scale: 0.96 });

  gsap.to(cards, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.55,
    ease: EASE_OUT,
    stagger: { each: 0.06, from: "start" },
  });

  // Anillo de stock: se "llena" después de que la tarjeta aparece
  cards.forEach((card) => {
    const fill = card.querySelector(".gauge-fill");
    if (!fill) return;
    const target = Number(fill.dataset.targetOffset);
    const circumference = Number(fill.dataset.circumference);
    gsap.fromTo(
      fill,
      { strokeDashoffset: circumference },
      { strokeDashoffset: target, duration: 0.9, ease: "power2.out", delay: 0.25 }
    );
  });
}

/* --------------------------------------------------------------------
 * 2. Inserción de una tarjeta nueva (después de crear un producto)
 * ------------------------------------------------------------------ */
export function animateCardInsert(card) {
  gsap.from(card, {
    opacity: 0,
    y: 20,
    scale: 0.9,
    duration: 0.5,
    ease: EASE_BOUNCE,
  });
  const fill = card.querySelector(".gauge-fill");
  if (fill) {
    const target = Number(fill.dataset.targetOffset);
    const circumference = Number(fill.dataset.circumference);
    gsap.fromTo(
      fill,
      { strokeDashoffset: circumference },
      { strokeDashoffset: target, duration: 0.8, ease: "power2.out", delay: 0.15 }
    );
  }
}

/* --------------------------------------------------------------------
 * 3. Salida de una tarjeta (al eliminar un producto)
 * ------------------------------------------------------------------ */
export function animateCardRemove(card) {
  return new Promise((resolve) => {
    gsap.to(card, {
      opacity: 0,
      scale: 0.85,
      y: -12,
      duration: 0.35,
      ease: EASE_IN,
      onComplete: resolve,
    });
  });
}

/* --------------------------------------------------------------------
 * 4. Micro-interacción al actualizar el stock (+/-) de una tarjeta
 * ------------------------------------------------------------------ */
export function animateStockChange(card, { increased }) {
  const valueEl = card.querySelector(".stepper-value");
  const gauge = card.querySelector(".stock-gauge");

  gsap.fromTo(
    valueEl,
    { scale: 1.35, color: increased ? "var(--color-forest)" : "var(--color-clay)" },
    { scale: 1, duration: 0.35, ease: EASE_BOUNCE, clearProps: "color" }
  );

  gsap.fromTo(
    gauge,
    { scale: 1.12 },
    { scale: 1, duration: 0.4, ease: EASE_BOUNCE }
  );
}

/**
 * Anima el anillo de stock a un nuevo porcentaje (tras editar cantidad).
 */
export function animateGaugeTo(card, newOffset) {
  const fill = card.querySelector(".gauge-fill");
  if (!fill) return;
  gsap.to(fill, { strokeDashoffset: newOffset, duration: 0.6, ease: "power2.out" });
}

/**
 * Resalta brevemente una tarjeta que acaba de entrar (o salir) de stock bajo.
 */
export function flashCardAlert(card) {
  gsap.fromTo(
    card,
    { boxShadow: "0 0 0 0 rgba(184,92,74,0.55)" },
    {
      boxShadow: "0 0 0 10px rgba(184,92,74,0)",
      duration: 0.8,
      ease: "power2.out",
    }
  );
}

/* --------------------------------------------------------------------
 * 5. Modal: apertura / cierre (fade + escala)
 * ------------------------------------------------------------------ */
export function openOverlay(overlay, panel) {
  overlay.hidden = false;
  overlay.style.pointerEvents = "auto";
  gsap.killTweensOf([overlay, panel]);

  gsap.set(overlay, { opacity: 0 });
  gsap.set(panel, { opacity: 0, scale: 0.9, y: 16 });
  gsap.to(overlay, { opacity: 1, duration: 0.25, ease: EASE_OUT });
  gsap.to(
    panel,
    { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" }
  );
}

export function closeOverlay(overlay, panel) {
  return new Promise((resolve) => {
    gsap.killTweensOf([overlay, panel]);
    gsap.to(panel, { opacity: 0, scale: 0.92, y: 10, duration: 0.25, ease: EASE_IN });
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.25,
      ease: EASE_IN,
      delay: 0.05,
      onComplete: () => {
        overlay.hidden = true;
        overlay.style.pointerEvents = "none";
        resolve();
      },
    });
  });
}

/**
 * Pequeño "shake" para marcar un campo de formulario inválido.
 */
export function shakeField(field) {
  gsap.fromTo(
    field,
    { x: -6 },
    { x: 0, duration: 0.4, ease: "elastic.out(1, 0.35)" }
  );
}

/* --------------------------------------------------------------------
 * 6. Panel de alertas de stock bajo
 * ------------------------------------------------------------------ */
export function revealAlertsPanel(panel) {
  panel.hidden = false;
  gsap.fromTo(
    panel,
    { opacity: 0, height: 0, y: -8 },
    {
      opacity: 1,
      height: "auto",
      y: 0,
      duration: 0.45,
      ease: EASE_OUT,
    }
  );
}

export function hideAlertsPanel(panel) {
  gsap.to(panel, {
    opacity: 0,
    height: 0,
    y: -8,
    duration: 0.35,
    ease: EASE_IN,
    onComplete: () => {
      panel.hidden = true;
      gsap.set(panel, { clearProps: "height" });
    },
  });
}

export function animateAlertChipsIn(chips) {
  gsap.from(chips, {
    opacity: 0,
    x: -10,
    duration: 0.35,
    stagger: 0.05,
    ease: EASE_OUT,
  });
}

/* --------------------------------------------------------------------
 * 7. Toast de notificación
 * ------------------------------------------------------------------ */
let toastTimeline = null;

export function showToast(toastEl) {
  if (toastTimeline) toastTimeline.kill();
  toastEl.hidden = false;

  toastTimeline = gsap.timeline({
    onComplete: () => {
      toastEl.hidden = true;
    },
  });
  toastTimeline
    .fromTo(
      toastEl,
      { opacity: 0, y: 20, x: "-50%" },
      { opacity: 1, y: 0, x: "-50%", duration: 0.4, ease: EASE_BOUNCE }
    )
    .to(toastEl, { opacity: 0, y: 10, duration: 0.35, ease: EASE_IN, delay: 2.4 });
}

/* --------------------------------------------------------------------
 * 8. Toggle de tema claro/oscuro
 * ------------------------------------------------------------------ */
export function animateThemeToggle(button) {
  gsap.fromTo(
    button,
    { rotate: -25, scale: 0.85 },
    { rotate: 0, scale: 1, duration: 0.5, ease: EASE_BOUNCE }
  );
}

/* --------------------------------------------------------------------
 * 9. Botón "Guardar" — feedback de carga breve
 * ------------------------------------------------------------------ */
export function pulseButton(button) {
  gsap.fromTo(button, { scale: 0.96 }, { scale: 1, duration: 0.3, ease: EASE_BOUNCE });
}
