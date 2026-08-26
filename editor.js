/**
 * Nébula — editor de copy provisional
 * Textos, fotos y pendientes que se actualizan solos.
 */
(() => {
  const STORAGE_KEY = "nebula-copy-v1";
  const IMAGES_KEY = "nebula-images-v1";
  const MAX_IMAGE_SIDE = 1400;
  const JPEG_QUALITY = 0.78;

  const statusEl = () => document.getElementById("editor-status");
  let activeImageSlot = null;
  let images = {};
  const defaults = {};

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
    if (!now) return false;
    if (isPlaceholder(now)) return false;
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

  function paintImageSlot(slot, dataUrl) {
    const img = slot.querySelector(".upload-img");
    const clearBtn = slot.querySelector(".upload-clear");
    if (!img) return;
    if (dataUrl) {
      img.src = dataUrl;
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

  function saveImages() {
    try {
      localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
      return true;
    } catch {
      setStatus("La imagen es muy pesada para guardar en este navegador");
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
      li.setAttribute("aria-checked", done ? "true" : "false");
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
        photos === 3
          ? "· fotos listas"
          : photos > 0
            ? `· ${photos}/3 fotos`
            : "· clic en cada foto para subir";
    }
  }

  function save() {
    const data = collect();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const ok = saveImages();
    updatePendings();
    if (!ok) return;
    const t = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    setStatus(`Guardado · ${t}`);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const rawImages = localStorage.getItem(IMAGES_KEY);
      if (!raw && !rawImages) {
        setStatus("Sin cambios locales");
        updatePendings();
        return;
      }
      if (raw) apply(JSON.parse(raw));
      if (rawImages) applyImages(JSON.parse(rawImages));
      else applyImages({});
      setStatus("Borrador local restaurado");
      updatePendings();
    } catch {
      setStatus("No se pudo restaurar el borrador");
    }
  }

  function reset() {
    if (!confirm("¿Borrar el borrador local (textos y fotos) y volver al HTML?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMAGES_KEY);
    location.reload();
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
    const groups = grouped();
    const lines = [
      "# Nébula Media — Copy para diseñadora",
      "",
      `_Exportado: ${new Date().toLocaleString("es-CL")}_`,
      "",
      "> Documento de trabajo. Textos provisionales ordenados por sección.",
      "",
    ];
    for (const [section, items] of Object.entries(groups)) {
      lines.push(`## ${sectionTitle(section)}`, "");
      for (const item of items) {
        lines.push(`### ${item.label}`, "", item.value || "_(vacío)_", "");
      }
    }
    const imageEntries = Object.entries(images);
    if (imageEntries.length) {
      lines.push("## Imágenes cargadas (borrador local)", "");
      for (const [key, value] of imageEntries) {
        const slot = document.querySelector(`[data-image="${key}"]`);
        const label = slot?.dataset.imageLabel || key;
        lines.push(
          `- **${label}** (\`${key}\`): imagen cargada (${Math.round((value.length || 0) / 1024)} KB)`
        );
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  function toJSON() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        project: "Nébula Media — maqueta de contenidos",
        sections: grouped(),
        flat: collect(),
        images: Object.fromEntries(
          Object.keys(images).map((key) => [
            key,
            {
              label: document.querySelector(`[data-image="${key}"]`)?.dataset.imageLabel || key,
              hasImage: true,
            },
          ])
        ),
      },
      null,
      2
    );
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

  function exportMd() {
    save();
    download("nebula-copy.md", toMarkdown(), "text/markdown;charset=utf-8");
    setStatus("Exportado · Markdown");
  }

  function exportJson() {
    save();
    download("nebula-copy.json", toJSON(), "application/json;charset=utf-8");
    setStatus("Exportado · JSON");
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
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
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
      if (saveImages()) {
        updatePendings();
        const t = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
        setStatus(`Imagen guardada · ${t}`);
      } else {
        delete images[key];
        paintImageSlot(activeImageSlot, null);
        updatePendings();
      }
    } catch (err) {
      setStatus(err.message || "No se pudo subir la imagen");
    } finally {
      activeImageSlot = null;
    }
  }

  function clearImage(slot, event) {
    event?.stopPropagation();
    const key = slot.dataset.image;
    delete images[key];
    paintImageSlot(slot, null);
    saveImages();
    updatePendings();
    setStatus("Imagen quitada");
  }

  function openPicker(slot) {
    activeImageSlot = slot;
    const picker = document.getElementById("image-picker");
    if (!picker) return;
    picker.value = "";
    picker.click();
  }

  function wireImages() {
    const picker = document.getElementById("image-picker");
    picker?.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      handleImageFile(file);
    });

    for (const slot of imageSlots()) {
      slot.setAttribute("role", "button");
      slot.setAttribute("tabindex", "0");
      slot.setAttribute(
        "aria-label",
        `Subir imagen: ${slot.dataset.imageLabel || slot.dataset.image}`
      );

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
        timer = setTimeout(save, 400);
        setStatus("Editando…");
        updatePendings();
      });
      el.addEventListener("blur", save);
    }

    document.getElementById("btn-save")?.addEventListener("click", save);
    document.getElementById("btn-export-md")?.addEventListener("click", exportMd);
    document.getElementById("btn-export-json")?.addEventListener("click", exportJson);
    document.getElementById("btn-reset")?.addEventListener("click", reset);

    document.querySelectorAll("a[data-field]").forEach((a) => {
      a.addEventListener("click", (e) => e.preventDefault());
    });

    wireImages();
  }

  document.addEventListener("DOMContentLoaded", () => {
    captureDefaults();
    wire();
    load();
  });
})();
