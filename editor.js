/**
 * Nébula workshop editor
 * Banner fijo: checklist + guardar / deshacer / resetear
 * Guardar → pantalla de éxito → volver con cambios
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const IMAGES_KEY = "nebula-images-v1";
  const NAME_KEY = "nebula-editor-name";
  const CHECKLIST_KEY = "nebula-checklist-v1";
  const MAX_IMAGE_SIDE = 1400;
  const JPEG_QUALITY = 0.78;
  const POLL_MS = 20000;
  const ROW_ID = 1;
  const HISTORY_LIMIT = 10;
  const SUCCESS_MS = 1800;

  const DEFAULT_CHECKS = [
    { id: "promesa", text: "Frase promesa / diferencial inspirador", done: false },
    { id: "servicio2", text: "Paquetizar mejor Servicio 2", done: false },
    { id: "testimonio", text: "Testimonios + permisos de logos", done: false },
    { id: "equipo", text: "Fotos e integrantes del equipo", done: false },
    { id: "esquema", text: "Esquema del proceso (imagen)", done: false },
    { id: "lab", text: "1ª entrada del Blog/Lab", done: false },
    { id: "portafolio", text: "Material de portafolio (fotos)", done: false },
  ];

  const cfg = () => window.NEBULA_CONFIG || {};
  const statusEl = () => document.getElementById("editor-status");

  let activeImageSlot = null;
  let images = {};
  const defaults = {};
  let openSnapshot = null;
  let history = [];
  let checklist = [];
  let saving = false;
  let lastRemoteUpdatedAt = null;
  let applyingHistory = false;

  function isConfigured() {
    return Boolean(cfg().supabaseUrl && cfg().supabaseAnonKey);
  }

  function fields() {
    return [...document.querySelectorAll("[data-field]")];
  }

  function imageSlots() {
    return [...document.querySelectorAll("[data-image]")];
  }

  function snapshot() {
    return {
      fields: collect(),
      images: { ...images },
    };
  }

  function captureDefaults() {
    for (const el of fields()) {
      defaults[el.dataset.field] = el.innerText.trim();
    }
  }

  function fieldText(key) {
    const el = document.querySelector(`[data-field="${key}"]`);
    return el ? el.innerText.trim() : "";
  }

  function isPlaceholder(value) {
    if (!value) return true;
    if (/^\[.*\]$/.test(value)) return true;
    if (value.includes("[") && value.includes("]")) return true;
    return false;
  }

  function changed(key) {
    const now = fieldText(key);
    const original = defaults[key];
    if (!now || isPlaceholder(now)) return false;
    return now !== original;
  }

  function hasImage(key) {
    return Boolean(images[key]);
  }

  function hasAnyImage(prefix) {
    return Object.keys(images).some((k) => k.startsWith(prefix));
  }

  function collect() {
    const data = {};
    for (const el of fields()) {
      data[el.dataset.field] = el.innerText.trim();
    }
    return data;
  }

  function apply(data) {
    if (!data) return;
    for (const el of fields()) {
      const key = el.dataset.field;
      if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null) {
        el.innerText = data[key];
      }
    }
  }

  function setStatus(msg) {
    const el = statusEl();
    if (el) el.textContent = msg;
  }

  function paintImageSlot(slot, value) {
    const img = slot.querySelector(".upload-img");
    const clearBtn = slot.querySelector(".upload-clear");
    if (!img) return;
    if (value) {
      img.src = value;
      img.hidden = false;
      img.alt = slot.dataset.imageLabel || "Imagen";
      slot.classList.add("has-image");
      if (clearBtn) clearBtn.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      img.alt = "";
      slot.classList.remove("has-image");
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function applyImages(map) {
    images = map && typeof map === "object" ? { ...map } : {};
    for (const slot of imageSlots()) {
      paintImageSlot(slot, images[slot.dataset.image] || null);
    }
  }

  function applySnapshot(snap) {
    applyingHistory = true;
    apply(snap.fields || {});
    applyImages(snap.images || {});
    applyingHistory = false;
    updateAutoChecks();
    renderChecklist();
    updateUndoBtn();
  }

  function pushHistory() {
    if (applyingHistory) return;
    const snap = snapshot();
    const last = history[history.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
    history.push(snap);
    if (history.length > HISTORY_LIMIT) history.shift();
    updateUndoBtn();
  }

  function undo() {
    if (history.length < 2) {
      setStatus("No hay más pasos para deshacer");
      return;
    }
    history.pop();
    const prev = history[history.length - 1];
    applySnapshot(prev);
    saveLocalDraft();
    setStatus(`Deshecho · quedan ${Math.max(0, history.length - 1)} pasos atrás`);
  }

  function resetToOpen() {
    if (!openSnapshot) return;
    if (!confirm("¿Volver al estado con el que abriste la página?")) return;
    applySnapshot(openSnapshot);
    history = [JSON.parse(JSON.stringify(openSnapshot))];
    saveLocalDraft();
    updateUndoBtn();
    setStatus("Resetado al estado inicial de esta sesión");
  }

  function updateUndoBtn() {
    const btn = document.getElementById("btn-undo");
    if (btn) btn.disabled = history.length < 2;
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
      return true;
    } catch {
      setStatus("Borrador local demasiado pesado");
      return false;
    }
  }

  function loadChecklist() {
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      if (raw) {
        checklist = JSON.parse(raw);
        return;
      }
    } catch {
      /* ignore */
    }
    checklist = DEFAULT_CHECKS.map((c) => ({ ...c }));
  }

  function renderChecklist() {
    const list = document.getElementById("checklist-list");
    const badge = document.getElementById("checklist-badge");
    if (!list) return;
    list.innerHTML = "";
    const pending = checklist.filter((c) => !c.done).length;
    if (badge) badge.textContent = String(pending);

    checklist.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = `checklist__item${item.done ? " is-done" : ""}`;
      const id = `check-${item.id || index}`;
      li.innerHTML = `<input type="checkbox" id="${id}" ${item.done ? "checked" : ""} /><span></span>`;
      li.querySelector("span").textContent = item.text;
      li.querySelector("input").addEventListener("change", (e) => {
        item.done = e.target.checked;
        saveLocalDraft();
        renderChecklist();
      });
      list.appendChild(li);
    });
  }

  function addChecklistItem(text) {
    const clean = text.trim();
    if (!clean) return;
    checklist.push({ id: `custom-${Date.now()}`, text: clean, done: false });
    saveLocalDraft();
    renderChecklist();
  }

  function updateAutoChecks() {
    const auto = {
      promesa: () => changed("inicio.headline"),
      servicio2: () => {
        const note = fieldText("servicios.s2_nota");
        return (
          (changed("servicios.s2_nota") && !/pendiente/i.test(note)) ||
          (changed("servicios.s2_texto") && note && !/pendiente/i.test(note))
        );
      },
      testimonio: () => changed("quienes.testimonio") && !isPlaceholder(fieldText("quienes.testimonio")),
      equipo: () => {
        const photos = ["quienes.p1", "quienes.p2", "quienes.p3"].filter(hasImage).length;
        const names =
          changed("quienes.p1_nombre") || changed("quienes.p2_nombre") || changed("quienes.p3_nombre");
        return photos >= 1 && (names || photos >= 3);
      },
      esquema: () => hasImage("como.esquema"),
      lab: () => changed("lab.e1_titulo") || changed("lab.e1_texto"),
      portafolio: () => hasAnyImage("portafolio."),
    };
    let changedAuto = false;
    for (const item of checklist) {
      if (auto[item.id]) {
        const done = Boolean(auto[item.id]());
        if (item.done !== done) {
          item.done = done;
          changedAuto = true;
        }
      }
    }
    if (changedAuto) saveLocalDraft();
  }

  function showSuccessThenReload(detail) {
    const screen = document.getElementById("success-screen");
    const detailEl = document.getElementById("success-detail");
    if (detailEl) detailEl.textContent = detail || "Tu edición ya está incorporada. Volvemos a la página para que la revises.";
    if (screen) {
      screen.hidden = false;
      const bar = screen.querySelector(".success-screen__bar span");
      if (bar) {
        bar.style.animation = "none";
        void bar.offsetWidth;
        bar.style.animation = "";
      }
    }
    setTimeout(async () => {
      try {
        if (isConfigured()) await loadShared();
      } catch {
        /* keep current */
      }
      openSnapshot = snapshot();
      history = [JSON.parse(JSON.stringify(openSnapshot))];
      updateUndoBtn();
      if (screen) screen.hidden = true;
      setStatus("Cambios incorporados · puedes seguir editando");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, SUCCESS_MS);
  }

  async function supabaseFetch(path, options = {}) {
    const { supabaseUrl, supabaseAnonKey } = cfg();
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = data?.message || data?.error_description || data || `Error ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function applyRemoteRow(row) {
    if (!row) return false;
    const payload = row.payload || {};
    apply(payload.fields || {});
    applyImages(payload.images || {});
    lastRemoteUpdatedAt = row.updated_at || null;
    saveLocalDraft();
    updateAutoChecks();
    renderChecklist();
    return true;
  }

  async function loadShared() {
    if (!isConfigured()) return false;
    const rows = await supabaseFetch(`nebula_content?id=eq.${ROW_ID}&select=*`);
    if (Array.isArray(rows) && rows[0]) {
      applyRemoteRow(rows[0]);
      return true;
    }
    return false;
  }

  async function saveShared() {
    if (saving) return;
    const nameInput = document.getElementById("editor-name");
    const name = (nameInput?.value || "").trim() || "Alguien del equipo";
    localStorage.setItem(NAME_KEY, name);

    const password = cfg().teamPassword || "";
    const inputPass = document.getElementById("team-password");
    if (password) {
      if (inputPass) inputPass.hidden = false;
      if ((inputPass?.value || "") !== password) {
        setStatus("Clave del equipo incorrecta");
        return;
      }
    }

    saving = true;
    const btn = document.getElementById("btn-save");
    if (btn) btn.disabled = true;
    setStatus("Guardando…");

    pushHistory();
    saveLocalDraft();

    try {
      if (isConfigured()) {
        const body = {
          id: ROW_ID,
          payload: { fields: collect(), images },
          updated_at: new Date().toISOString(),
          updated_by: name,
        };
        const existing = await supabaseFetch(`nebula_content?id=eq.${ROW_ID}&select=id`);
        if (Array.isArray(existing) && existing.length) {
          await supabaseFetch(`nebula_content?id=eq.${ROW_ID}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
        } else {
          await supabaseFetch("nebula_content", {
            method: "POST",
            body: JSON.stringify(body),
          });
        }
        lastRemoteUpdatedAt = body.updated_at;
        showSuccessThenReload(`Guardado por ${name}. El equipo ya puede ver este cambio.`);
      } else {
        // Local success so the UX can be tested before shared backend is configured
        showSuccessThenReload(`Cambio guardado en este navegador${name ? ` · ${name}` : ""}. (Espacio compartido pendiente de configurar)`);
      }
    } catch (err) {
      console.error(err);
      setStatus(`No se pudo guardar: ${err.message}`);
    } finally {
      saving = false;
      if (btn) btn.disabled = false;
    }
  }

  async function pollRemote() {
    if (!isConfigured() || saving || document.hidden) return;
    try {
      const rows = await supabaseFetch(
        `nebula_content?id=eq.${ROW_ID}&select=updated_at,updated_by,payload`
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row?.updated_at) return;
      if (lastRemoteUpdatedAt && row.updated_at !== lastRemoteUpdatedAt) {
        applyRemoteRow(row);
        openSnapshot = snapshot();
        history = [JSON.parse(JSON.stringify(openSnapshot))];
        updateUndoBtn();
        setStatus(`Actualizado por ${row.updated_by || "el equipo"}`);
      } else if (!lastRemoteUpdatedAt) {
        lastRemoteUpdatedAt = row.updated_at;
      }
    } catch {
      /* ignore */
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Archivo de imagen inválido"));
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleImageFile(file) {
    if (!activeImageSlot || !file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Elige un archivo de imagen");
      return;
    }
    const key = activeImageSlot.dataset.image;
    setStatus("Procesando imagen…");
    try {
      pushHistory();
      const dataUrl = await compressImage(file);
      images[key] = dataUrl;
      paintImageSlot(activeImageSlot, dataUrl);
      saveLocalDraft();
      updateAutoChecks();
      renderChecklist();
      setStatus("Imagen lista · pulsa Guardar");
    } catch (err) {
      setStatus(err.message || "No se pudo subir la imagen");
    } finally {
      activeImageSlot = null;
    }
  }

  function clearImage(slot, event) {
    event?.stopPropagation();
    pushHistory();
    delete images[slot.dataset.image];
    paintImageSlot(slot, null);
    saveLocalDraft();
    updateAutoChecks();
    renderChecklist();
    setStatus("Imagen quitada · pulsa Guardar");
  }

  function openPicker(slot) {
    activeImageSlot = slot;
    const picker = document.getElementById("image-picker");
    if (!picker) return;
    picker.value = "";
    picker.click();
  }

  function sectionTitle(id) {
    const map = {
      inicio: "01 · Inicio",
      "como-trabajamos": "02 · Cómo trabajamos",
      "quienes-somos": "03 · Quiénes somos",
      servicios: "04 · Servicios",
      portafolio: "05 · Portafolio",
      lab: "06 · Blog / Lab",
      footer: "07 · Footer / RED",
    };
    return map[id] || id;
  }

  function grouped() {
    const groups = {};
    for (const el of fields()) {
      const section = el.dataset.section || "general";
      const label = el.dataset.label || el.dataset.field;
      if (!groups[section]) groups[section] = [];
      groups[section].push({ label, value: el.innerText.trim(), field: el.dataset.field });
    }
    return groups;
  }

  function toMarkdown() {
    const lines = ["# Nébula Media — Copy", "", `_Exportado: ${new Date().toLocaleString("es-CL")}_`, ""];
    for (const [section, items] of Object.entries(grouped())) {
      lines.push(`## ${sectionTitle(section)}`, "");
      for (const item of items) lines.push(`### ${item.label}`, "", item.value || "_(vacío)_", "");
    }
    return lines.join("\n");
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function wireChecklist() {
    const btn = document.getElementById("btn-checklist");
    const panel = document.getElementById("checklist-panel");
    const form = document.getElementById("checklist-add-form");
    const input = document.getElementById("checklist-input");

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!panel || panel.hidden) return;
      if (e.target.closest("#checklist")) return;
      panel.hidden = true;
      btn?.setAttribute("aria-expanded", "false");
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      addChecklistItem(input.value);
      input.value = "";
      input.focus();
    });
  }

  function wireImages() {
    document.getElementById("image-picker")?.addEventListener("change", () => {
      handleImageFile(document.getElementById("image-picker").files?.[0]);
    });
    for (const slot of imageSlots()) {
      slot.setAttribute("role", "button");
      slot.setAttribute("tabindex", "0");
      slot.addEventListener("click", (e) => {
        if (e.target.closest(".upload-clear")) return;
        openPicker(slot);
      });
      slot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker(slot);
        }
      });
      slot.querySelector(".upload-clear")?.addEventListener("click", (e) => clearImage(slot, e));
    }
  }

  function wire() {
    let timer;
    for (const el of fields()) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.addEventListener("focus", () => {
        if (!applyingHistory) pushHistory();
      });
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveLocalDraft();
          updateAutoChecks();
          renderChecklist();
        }, 400);
        setStatus("Editando… · Guardar para aprobar el cambio");
      });
    }

    const nameInput = document.getElementById("editor-name");
    if (nameInput) nameInput.value = localStorage.getItem(NAME_KEY) || "";

    const pass = cfg().teamPassword || "";
    const passInput = document.getElementById("team-password");
    if (pass && passInput) passInput.hidden = false;

    document.getElementById("btn-save")?.addEventListener("click", saveShared);
    document.getElementById("btn-undo")?.addEventListener("click", undo);
    document.getElementById("btn-reset-open")?.addEventListener("click", resetToOpen);
    document.getElementById("btn-export-md")?.addEventListener("click", () => {
      download("nebula-copy.md", toMarkdown(), "text/markdown;charset=utf-8");
      setStatus("Exportado · Markdown");
    });
    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      download(
        "nebula-copy.json",
        JSON.stringify({ fields: collect(), images: Object.keys(images) }, null, 2),
        "application/json;charset=utf-8"
      );
      setStatus("Exportado · JSON");
    });

    document.querySelectorAll("a[data-field]").forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });

    wireImages();
    wireChecklist();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    captureDefaults();
    loadChecklist();
    wire();
    renderChecklist();

    try {
      if (isConfigured()) {
        await loadShared();
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        const rawImages = localStorage.getItem(IMAGES_KEY);
        if (raw) apply(JSON.parse(raw));
        if (rawImages) applyImages(JSON.parse(rawImages));
        setStatus("Listo · Guardar funciona en este navegador (compartido pendiente)");
      }
    } catch (err) {
      setStatus(`No se pudo cargar: ${err.message}`);
    }

    updateAutoChecks();
    renderChecklist();
    openSnapshot = snapshot();
    history = [JSON.parse(JSON.stringify(openSnapshot))];
    updateUndoBtn();

    setInterval(pollRemote, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pollRemote();
    });
  });
})();
