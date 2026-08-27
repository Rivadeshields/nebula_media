/**
 * Nébula workshop editor
 * Banner: checklist + guardar / deshacer / resetear
 * Guardar → éxito → volver con cambios
 * Espacio compartido vía saveUrl (Worker), sin login
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const IMAGES_KEY = "nebula-images-v1";
  const CHECKLIST_KEY = "nebula-checklist-v1";
  const MAX_IMAGE_SIDE = 1400;
  const JPEG_QUALITY = 0.78;
  const POLL_MS = 15000;
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
  let lastContentHash = null;
  let applyingHistory = false;

  function getSaveUrl() {
    return (cfg().saveUrl || "").trim();
  }

  function fields() {
    return [...document.querySelectorAll("[data-field]")];
  }

  function imageSlots() {
    return [...document.querySelectorAll("[data-image]")];
  }

  function snapshot() {
    return { fields: collect(), images: { ...images } };
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
    if (!now || isPlaceholder(now)) return false;
    return now !== defaults[key];
  }

  function hasImage(key) {
    return Boolean(images[key]);
  }

  function hasAnyImage(prefix) {
    return Object.keys(images).some((k) => k.startsWith(prefix));
  }

  function isDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:");
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
    applySnapshot(history[history.length - 1]);
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
    if (badge) badge.textContent = String(checklist.filter((c) => !c.done).length);

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
    let dirty = false;
    for (const item of checklist) {
      if (auto[item.id]) {
        const done = Boolean(auto[item.id]());
        if (item.done !== done) {
          item.done = done;
          dirty = true;
        }
      }
    }
    if (dirty) saveLocalDraft();
  }

  function showSuccessThenReload(detail) {
    const screen = document.getElementById("success-screen");
    const detailEl = document.getElementById("success-detail");
    if (detailEl) {
      detailEl.textContent =
        detail || "Tu edición ya está incorporada. Volvemos a la página para que la revises.";
    }
    if (screen) {
      screen.hidden = false;
      const bar = screen.querySelector(".success-screen__bar span");
      if (bar) {
        bar.style.animation = "none";
        void bar.offsetWidth;
        bar.style.animation = "";
      }
    }
    setTimeout(() => {
      // No recargar desde Pages aquí: el CDN tarda y pisaría el cambio recién guardado.
      openSnapshot = snapshot();
      history = [JSON.parse(JSON.stringify(openSnapshot))];
      updateUndoBtn();
      if (screen) screen.hidden = true;
      setStatus("Guardado · el equipo lo verá al recargar (puede tardar ~1 min en Pages)");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, SUCCESS_MS);
  }

  function safeUploadName(key) {
    return key.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  }

  function dataUrlToBase64(dataUrl) {
    return (dataUrl.split(",")[1] || "");
  }

  async function fetchContentPayload() {
    const { owner, repo, branch } = {
      owner: (cfg().owner || "Rivadeshields"),
      repo: (cfg().repo || "nebula_media"),
      branch: (cfg().branch || "main"),
    };
    const stamp = Date.now();
    const urls = [
      // API de GitHub (más fresco que el CDN de Pages)
      {
        url: `https://api.github.com/repos/${owner}/${repo}/contents/content.json?ref=${branch}&t=${stamp}`,
        headers: { Accept: "application/vnd.github.raw+json" },
      },
      { url: `content.json?t=${stamp}`, headers: {} },
    ];

    for (const item of urls) {
      try {
        const res = await fetch(item.url, { cache: "no-store", headers: item.headers });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async function loadSharedContent() {
    const payload = await fetchContentPayload();
    if (!payload) return false;

    const hash = JSON.stringify(payload);
    if (payload.fields && Object.keys(payload.fields).length) apply(payload.fields);
    if (payload.images) applyImages(payload.images);
    lastContentHash = hash;
    if (payload.updatedAt) {
      const when = new Date(payload.updatedAt).toLocaleString("es-CL");
      setStatus(`Contenido compartido · ${when}`);
    }
    saveLocalDraft();
    updateAutoChecks();
    renderChecklist();
    return Boolean(payload.fields && Object.keys(payload.fields).length);
  }

  async function saveRemote() {
    const saveUrl = getSaveUrl();
    if (!saveUrl) throw new Error("Guardado no configurado");

    const imagePaths = {};
    const imagesPayload = {};

    for (const [key, value] of Object.entries(images)) {
      if (!value) continue;
      if (isDataUrl(value)) {
        imagesPayload[key] = dataUrlToBase64(value);
        imagePaths[key] = `uploads/${safeUploadName(key)}.jpg`;
      } else {
        imagePaths[key] = value;
      }
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      fields: collect(),
      images: imagePaths,
    };

    const res = await fetch(saveUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, images: imagesPayload }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Error ${res.status}`);
    }

    applyImages(imagePaths);
    lastContentHash = JSON.stringify(payload);
    showSuccessThenReload("Guardado · el equipo lo verá al recargar");
  }

  async function saveShared() {
    if (saving) return;

    if (!getSaveUrl()) {
      setStatus("Guardado aún no activo · avisa a quien administra el repo");
      return;
    }

    saving = true;
    const btn = document.getElementById("btn-save");
    if (btn) btn.disabled = true;
    setStatus("Guardando…");
    pushHistory();
    saveLocalDraft();

    try {
      await saveRemote();
    } catch (err) {
      console.error(err);
      setStatus(`No se pudo guardar: ${err.message}`);
    } finally {
      saving = false;
      if (btn) btn.disabled = false;
    }
  }

  async function pollRemote() {
    if (saving || document.hidden) return;
    try {
      const payload = await fetchContentPayload();
      if (!payload) return;
      const hash = JSON.stringify(payload);
      if (lastContentHash && hash !== lastContentHash) {
        if (payload.fields) apply(payload.fields);
        if (payload.images) applyImages(payload.images);
        lastContentHash = hash;
        openSnapshot = snapshot();
        history = [JSON.parse(JSON.stringify(openSnapshot))];
        updateUndoBtn();
        updateAutoChecks();
        renderChecklist();
        setStatus(payload.updatedAt ? `Actualizado · ${new Date(payload.updatedAt).toLocaleString("es-CL")}` : "Actualizado");
      } else if (!lastContentHash) {
        lastContentHash = hash;
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
    for (const el of fields()) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.addEventListener("focus", () => {
        if (!applyingHistory) pushHistory();
      });
      el.addEventListener("input", () => {
        clearTimeout(el._nebulaTimer);
        el._nebulaTimer = setTimeout(() => {
          saveLocalDraft();
          updateAutoChecks();
          renderChecklist();
        }, 400);
        setStatus("Editando… · pulsa Guardar");
      });
    }

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
      await loadSharedContent();
    } catch {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const rawImages = localStorage.getItem(IMAGES_KEY);
        if (raw) apply(JSON.parse(raw));
        if (rawImages) applyImages(JSON.parse(rawImages));
      } catch {
        /* ignore */
      }
      setStatus("Listo · edita y pulsa Guardar");
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
