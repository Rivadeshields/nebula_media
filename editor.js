/**
 * Nébula — editor en equipo (sin GitHub para quienes editan)
 * Guarda en Supabase; el equipo solo pulsa "Guardar".
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const IMAGES_KEY = "nebula-images-v1";
  const NAME_KEY = "nebula-editor-name";
  const MAX_IMAGE_SIDE = 1400;
  const JPEG_QUALITY = 0.78;
  const POLL_MS = 20000;
  const ROW_ID = 1;

  const cfg = () => window.NEBULA_CONFIG || {};
  const statusEl = () => document.getElementById("editor-status");

  let activeImageSlot = null;
  let images = {};
  const defaults = {};
  let saving = false;
  let lastRemoteUpdatedAt = null;
  let pollTimer = null;

  function isConfigured() {
    return Boolean(cfg().supabaseUrl && cfg().supabaseAnonKey);
  }

  function fields() {
    return [...document.querySelectorAll("[data-field]")];
  }

  function imageSlots() {
    return [...document.querySelectorAll("[data-image]")];
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

  function saveLocalDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
      return true;
    } catch {
      setStatus("Borrador local demasiado pesado (prueba imágenes más livianas)");
      return false;
    }
  }

  const pendingChecks = {
    promesa: () => changed("inicio.headline"),
    servicio2: () => {
      const note = fieldText("servicios.s2_nota");
      if (changed("servicios.s2_texto") && note && !/pendiente/i.test(note)) return true;
      if (changed("servicios.s2_nota") && !/pendiente/i.test(note)) return true;
      return false;
    },
    testimonio: () => changed("quienes.testimonio") && !isPlaceholder(fieldText("quienes.testimonio")),
    equipo: () => {
      const photos = ["quienes.p1", "quienes.p2", "quienes.p3"].filter(hasImage).length;
      const names =
        changed("quienes.p1_nombre") || changed("quienes.p2_nombre") || changed("quienes.p3_nombre");
      const roles =
        changed("quienes.p1_rol") || changed("quienes.p2_rol") || changed("quienes.p3_rol");
      return photos >= 1 && (names || roles || photos >= 3);
    },
    esquema: () => hasImage("como.esquema"),
    lab: () => changed("lab.e1_titulo") || changed("lab.e1_texto") || changed("lab.e1_meta"),
    portafolio: () => hasAnyImage("portafolio."),
  };

  function updatePendings() {
    const items = [...document.querySelectorAll("#pending-list [data-pending]")];
    let doneCount = 0;
    for (const li of items) {
      const id = li.dataset.pending;
      const check = pendingChecks[id];
      const done = check ? Boolean(check()) : false;
      li.classList.toggle("is-done", done);
      if (done) doneCount += 1;
    }
    const meta = document.getElementById("pending-meta");
    if (meta) {
      meta.textContent =
        doneCount === items.length
          ? "Todos los pendientes completados"
          : `${doneCount} de ${items.length} completados · se actualizan solos`;
    }
    const hint = document.getElementById("equipo-hint");
    if (hint) {
      const photos = ["quienes.p1", "quienes.p2", "quienes.p3"].filter(hasImage).length;
      hint.textContent =
        photos === 3 ? "· fotos listas" : photos > 0 ? `· ${photos}/3 fotos` : "· clic en cada foto para subir";
    }
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
    if (payload.fields) apply(payload.fields);
    if (payload.images) applyImages(payload.images);
    lastRemoteUpdatedAt = row.updated_at || null;
    const when = row.updated_at ? new Date(row.updated_at).toLocaleString("es-CL") : "";
    const by = row.updated_by ? ` · ${row.updated_by}` : "";
    if (when) setStatus(`Guardado compartido${by} · ${when}`);
    saveLocalDraft();
    updatePendings();
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
    if (!isConfigured()) {
      setStatus("Aún no está el espacio compartido. Quien administra el proyecto debe completar config.js (ver SETUP.md).");
      return;
    }

    const password = cfg().teamPassword || "";
    const inputPass = document.getElementById("team-password");
    if (password) {
      if ((inputPass?.value || "") !== password) {
        setStatus("Clave del equipo incorrecta");
        return;
      }
      sessionStorage.setItem("nebula-team-ok", "1");
    }

    const nameInput = document.getElementById("editor-name");
    const name = (nameInput?.value || "").trim() || "Alguien del equipo";
    localStorage.setItem(NAME_KEY, name);

    saving = true;
    const btn = document.getElementById("btn-save");
    if (btn) btn.disabled = true;
    setStatus("Guardando para el equipo…");

    const payload = {
      fields: collect(),
      images,
    };
    const body = {
      id: ROW_ID,
      payload,
      updated_at: new Date().toISOString(),
      updated_by: name,
    };

    try {
      // Upsert: try PATCH first, then INSERT if missing
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
          prefer: "return=representation",
        });
      }
      lastRemoteUpdatedAt = body.updated_at;
      saveLocalDraft();
      updatePendings();
      setStatus(`Guardado · visible para el equipo · ${name} · ${new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`);
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
        setStatus(`Actualizado por ${row.updated_by || "el equipo"} · ${new Date(row.updated_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`);
      } else if (!lastRemoteUpdatedAt) {
        lastRemoteUpdatedAt = row.updated_at;
      }
    } catch {
      // silent poll failures
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
      const dataUrl = await compressImage(file);
      images[key] = dataUrl;
      paintImageSlot(activeImageSlot, dataUrl);
      saveLocalDraft();
      updatePendings();
      setStatus("Imagen lista · pulsa Guardar para compartirla con el equipo");
    } catch (err) {
      setStatus(err.message || "No se pudo subir la imagen");
    } finally {
      activeImageSlot = null;
    }
  }

  function clearImage(slot, event) {
    event?.stopPropagation();
    delete images[slot.dataset.image];
    paintImageSlot(slot, null);
    saveLocalDraft();
    updatePendings();
    setStatus("Imagen quitada · pulsa Guardar para compartir el cambio");
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
    const lines = [
      "# Nébula Media — Copy para diseñadora",
      "",
      `_Exportado: ${new Date().toLocaleString("es-CL")}_`,
      "",
    ];
    for (const [section, items] of Object.entries(grouped())) {
      lines.push(`## ${sectionTitle(section)}`, "");
      for (const item of items) {
        lines.push(`### ${item.label}`, "", item.value || "_(vacío)_", "");
      }
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
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          saveLocalDraft();
          updatePendings();
        }, 400);
        setStatus("Editando… · pulsa Guardar para compartir");
        updatePendings();
      });
      el.addEventListener("blur", () => {
        saveLocalDraft();
        updatePendings();
      });
    }

    const nameInput = document.getElementById("editor-name");
    if (nameInput) nameInput.value = localStorage.getItem(NAME_KEY) || "";

    const pass = cfg().teamPassword || "";
    const passInput = document.getElementById("team-password");
    const passLabel = document.getElementById("team-password-label");
    if (pass && passInput && passLabel) {
      passInput.hidden = false;
      passLabel.hidden = false;
      if (sessionStorage.getItem("nebula-team-ok") === "1") {
        passInput.value = pass;
      }
    }

    document.getElementById("btn-save")?.addEventListener("click", saveShared);
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
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      if (!confirm("¿Borrar borrador local de este navegador?")) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(IMAGES_KEY);
      location.reload();
    });

    document.querySelectorAll("a[data-field]").forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });

    wireImages();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    captureDefaults();
    wire();

    if (!isConfigured()) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const rawImages = localStorage.getItem(IMAGES_KEY);
        if (raw) apply(JSON.parse(raw));
        if (rawImages) applyImages(JSON.parse(rawImages));
      } catch {
        /* ignore */
      }
      setStatus("Modo local · falta configurar el espacio compartido (SETUP.md)");
      updatePendings();
      return;
    }

    try {
      const ok = await loadShared();
      if (!ok) setStatus("Espacio compartido vacío · edita y pulsa Guardar");
    } catch (err) {
      setStatus(`No se pudo cargar el espacio compartido: ${err.message}`);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) apply(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    updatePendings();
    pollTimer = setInterval(pollRemote, POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pollRemote();
    });
  });
})();
