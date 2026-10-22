/*
 * Property editor (Django admin) — client review of the listing page:
 *  - every image / document is uploaded the moment it is picked and kept across errors and
 *    edits (the form only carries its id — see admin_widgets.StickyFileInput);
 *  - "Upload several" adds many gallery / site photos / documents at once;
 *  - a list of every field to fix, with links, when a save is refused;
 *  - a warning before leaving with unsaved changes, and a local draft that can be restored.
 */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var form = document.getElementById("property_form");
    if (!form) return;

    var uploadUrl = location.pathname.replace(/\/property\/.*$/, "/property/upload/");
    var csrfInput = form.querySelector("[name=csrfmiddlewaretoken]");
    var csrf = csrfInput ? csrfInput.value : "";
    var hasErrors = !!document.querySelector(".errornote");
    var draftKey = "capimax.propertyDraft:" + location.pathname;
    var submitKey = "capimax.propertyDraft.submitted";
    var dirty = hasErrors; // a refused save still holds unsaved work
    var submitting = false;
    var busy = 0;

    function esc(s) {
      var d = document.createElement("div");
      d.textContent = s == null ? "" : String(s);
      return d.innerHTML;
    }
    function byName(name) {
      return form.querySelector('[name="' + name.replace(/"/g, '\\"') + '"]');
    }

    // ------------------------------------------------------------------ //
    // Upload on pick
    // ------------------------------------------------------------------ //
    function showKept(token, info) {
      var status = token.nextElementSibling;
      token.dataset.label = info.name || "";
      token.dataset.url = info.url || "";
      token.dataset.image = info.isImage ? "1" : "";
      if (!status) return;
      status.innerHTML =
        (info.isImage && info.url ? '<img src="' + esc(info.url) + '" alt="">' : "") +
        "<span>✓ " + esc(info.name) + " — kept, it is attached when you save.</span>" +
        ' <a href="#" class="sticky-remove">Remove</a>';
    }

    function fillDocumentName(input, fileName) {
      // A document row's name is filled from the file name when still empty.
      var row = input.closest("tr");
      if (!row) return;
      var nameInput = row.querySelector('input[name$="-name_en"]');
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      }
    }

    function upload(input, file) {
      var token = byName(input.name + "__pending");
      if (!token) return Promise.resolve();
      var status = token.nextElementSibling;
      if (status) status.innerHTML = '<span class="sticky-busy">Uploading ' + esc(file.name) + "…</span>";
      var fd = new FormData();
      fd.append("file", file);
      fd.append("kind", input.dataset.sticky || "document");
      busy += 1;
      return fetch(uploadUrl, {
        method: "POST",
        body: fd,
        headers: { "X-CSRFToken": csrf },
        credentials: "same-origin",
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (r.status === 413) throw new Error("The file is larger than 20 MB.");
            if (!r.ok) throw new Error(j.error || "Upload failed (" + r.status + ").");
            return j;
          });
        })
        .then(function (j) {
          token.value = j.token;
          input.value = "";
          showKept(token, j);
          if (input.dataset.sticky === "document") fillDocumentName(input, j.name);
          dirty = true;
        })
        .catch(function (e) {
          input.value = "";
          if (status) {
            status.innerHTML = '<span class="sticky-error">' + esc(e.message) + " Choose the file again.</span>";
          }
        })
        .then(function () { busy -= 1; });
    }

    form.addEventListener("change", function (e) {
      var input = e.target;
      if (input.type === "file" && input.dataset.sticky && input.files && input.files[0]) {
        upload(input, input.files[0]);
      }
    });

    form.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest(".sticky-remove");
      if (!link) return;
      e.preventDefault();
      var status = link.closest(".sticky-status");
      var token = status && status.previousElementSibling;
      if (token && token.classList.contains("sticky-token")) token.value = "";
      if (status) status.innerHTML = "";
      dirty = true;
    });

    // "Upload several at once" above the gallery, site photos and documents.
    [
      ["gallery", "image", "Upload several images at once"],
      ["site_photos", "image", "Upload several site photos at once"],
      ["documents", "document", "Upload several documents at once"],
    ].forEach(function (cfg) {
      var group = document.getElementById(cfg[0] + "-group");
      if (!group) return;
      var addLink = function () { return group.querySelector(".add-row a"); };
      var bar = document.createElement("div");
      bar.className = "multi-upload";
      var picker = document.createElement("input");
      picker.type = "file";
      picker.multiple = true;
      if (cfg[1] === "image") picker.accept = "image/*";
      picker.hidden = true;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = cfg[2];
      button.addEventListener("click", function () { picker.click(); });
      picker.addEventListener("change", function () {
        var files = Array.prototype.slice.call(picker.files || []);
        picker.value = "";
        files.forEach(function (file) {
          var link = addLink();
          if (!link) return;
          link.click();
          var rows = group.querySelectorAll(".dynamic-" + cfg[0]);
          var row = rows[rows.length - 1];
          var input = row && row.querySelector('input[type="file"][data-sticky]');
          if (input) upload(input, file);
        });
      });
      bar.appendChild(button);
      bar.appendChild(picker);
      var anchor = group.querySelector("fieldset, .tabular, h2");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling);
      else group.insertBefore(bar, group.firstChild);
    });

    // ------------------------------------------------------------------ //
    // When a save is refused: list every field to fix, with links
    // ------------------------------------------------------------------ //
    function openAncestors(el) {
      for (var p = el; p; p = p.parentElement) {
        if (p.tagName === "DETAILS") p.open = true;
        if (p.classList && p.classList.contains("collapsed")) p.classList.remove("collapsed");
      }
    }

    function fieldOf(ul) {
      // Django gives a field's error list the id "<field id>_error".
      var m = ul.id && ul.id.match(/^(.*)_error$/);
      return m ? document.getElementById(m[1]) : null;
    }

    function fieldLabel(ul) {
      var field = fieldOf(ul);
      var own = field && document.querySelector('label[for="' + field.id + '"]');
      if (own) return own.textContent.replace(/:\s*$/, "").trim();
      var cell = ul.closest("td");
      if (cell) {
        var table = cell.closest("table");
        var th = table && table.querySelectorAll("thead th")[cell.cellIndex];
        return th ? th.textContent.trim() : "";
      }
      var box = ul.closest(".fieldBox") || ul.closest(".form-row");
      var label = box && box.querySelector("label");
      return label ? label.textContent.replace(/:\s*$/, "").trim() : "";
    }

    function sectionName(ul) {
      var group = ul.closest(".inline-group");
      if (group) {
        var h = group.querySelector("h2");
        return h ? h.textContent.trim() : "";
      }
      var fs = ul.closest("fieldset");
      var legend = fs && fs.querySelector("legend, h2, summary");
      return legend ? legend.textContent.trim() : "";
    }

    if (hasErrors) {
      var note = document.querySelector(".errornote");
      var items = [];
      document.querySelectorAll("ul.errorlist").forEach(function (ul) {
        if (ul.closest(".empty-form")) return;
        var msg = Array.prototype.map.call(ul.querySelectorAll("li"), function (li) {
          return li.textContent.trim();
        }).join(" ");
        if (!msg) return;
        openAncestors(ul);
        var label = ul.classList.contains("nonfield") ? "" : fieldLabel(ul);
        var section = sectionName(ul);
        var where = [section, label].filter(Boolean).join(" › ");
        items.push({ ul: ul, text: (where ? where + ": " : "") + msg });
      });
      if (note && items.length) {
        note.textContent = "The property was NOT saved yet — nothing you entered or uploaded is lost. Fix " +
          (items.length === 1 ? "this field" : "these " + items.length + " fields") + " and save again:";
        var list = document.createElement("ul");
        list.className = "error-summary";
        items.forEach(function (it) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = "#";
          a.textContent = it.text;
          a.addEventListener("click", function (e) {
            e.preventDefault();
            openAncestors(it.ul);
            var scope = it.ul.closest("td, .fieldBox, .form-row") || it.ul.parentElement;
            var target = fieldOf(it.ul) || scope.querySelector("input:not([type=hidden]), select, textarea") || it.ul;
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            if (target.focus) setTimeout(function () { target.focus({ preventScroll: true }); }, 300);
          });
          li.appendChild(a);
          list.appendChild(li);
        });
        note.insertAdjacentElement("afterend", list);
      }
    }

    // ------------------------------------------------------------------ //
    // Unsaved changes: warn before leaving + keep a local draft
    // ------------------------------------------------------------------ //
    form.addEventListener("input", function () { dirty = true; });
    form.addEventListener("change", function () { dirty = true; });
    form.addEventListener("submit", function (e) {
      if (busy > 0) {
        e.preventDefault();
        alert("Please wait — a file is still uploading.");
        return;
      }
      submitting = true;
      saveDraft();
      try { sessionStorage.setItem(submitKey, draftKey); } catch (err) { /* private mode */ }
    });
    window.addEventListener("beforeunload", function (e) {
      if (dirty && !submitting) {
        saveDraft();
        e.preventDefault();
        e.returnValue = "";
      }
    });

    function snapshot() {
      var values = {};
      var meta = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.name === "csrfmiddlewaretoken" || el.name.indexOf("__prefix__") !== -1) return;
        if (el.type === "file" || el.type === "submit" || el.type === "button") return;
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.type === "radio" && !el.checked) return;
          values[el.name] = el.type === "checkbox" ? el.checked : el.value;
        } else if (el.type === "select-multiple") {
          values[el.name] = Array.prototype.filter.call(el.options, function (o) { return o.selected; })
            .map(function (o) { return o.value; });
        } else {
          values[el.name] = el.value;
        }
        if (el.classList.contains("sticky-token") && el.value) {
          meta[el.name] = { name: el.dataset.label, url: el.dataset.url, isImage: el.dataset.image === "1" };
        }
      });
      return { t: Date.now(), values: values, meta: meta };
    }

    function saveDraft() {
      if (!dirty) return;
      try { localStorage.setItem(draftKey, JSON.stringify(snapshot())); } catch (err) { /* full / private */ }
    }
    setInterval(saveDraft, 3000);

    function restore(draft) {
      // Recreate the inline rows the draft had, then put every value back.
      Object.keys(draft.values).forEach(function (name) {
        var m = name.match(/^(.*)-TOTAL_FORMS$/);
        if (!m) return;
        var total = byName(name);
        var group = document.getElementById(m[1] + "-group");
        var link = group && group.querySelector(".add-row a");
        var want = parseInt(draft.values[name], 10) || 0;
        var guard = 0;
        while (total && link && parseInt(total.value, 10) < want && guard < 200) {
          link.click();
          guard += 1;
        }
      });
      Object.keys(draft.values).forEach(function (name) {
        if (/-(TOTAL|INITIAL|MIN_NUM|MAX_NUM)_FORMS$/.test(name)) return;
        var v = draft.values[name];
        var els = form.querySelectorAll('[name="' + name.replace(/"/g, '\\"') + '"]');
        Array.prototype.forEach.call(els, function (el) {
          if (el.type === "checkbox") el.checked = !!v;
          else if (el.type === "radio") el.checked = el.value === v;
          else if (el.type === "select-multiple") {
            Array.prototype.forEach.call(el.options, function (o) { o.selected = v.indexOf(o.value) !== -1; });
          } else if (el.type !== "file") el.value = v;
        });
        if (draft.meta && draft.meta[name] && els[0]) showKept(els[0], draft.meta[name]);
      });
      dirty = true;
    }

    var submitted = null;
    try { submitted = sessionStorage.getItem(submitKey); sessionStorage.removeItem(submitKey); } catch (err) { /* */ }
    if (submitted && !hasErrors) {
      // The last save went through — its local draft is no longer needed.
      try { localStorage.removeItem(submitted); } catch (err) { /* */ }
    }

    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch (err) { saved = null; }
    if (saved && !hasErrors && saved.values && Date.now() - saved.t < 14 * 24 * 3600 * 1000) {
      var banner = document.createElement("div");
      banner.className = "draft-banner";
      banner.innerHTML =
        "<strong>You have unsaved work on this property</strong> from " +
        esc(new Date(saved.t).toLocaleString()) + ". " +
        '<button type="button" class="button draft-restore">Restore it</button> ' +
        '<button type="button" class="button draft-discard">Discard</button>';
      form.insertBefore(banner, form.firstChild);
      banner.querySelector(".draft-restore").addEventListener("click", function () {
        restore(saved);
        banner.innerHTML = "Restored. Review it and press <strong>Save draft</strong> or <strong>Save and publish</strong>.";
      });
      banner.querySelector(".draft-discard").addEventListener("click", function () {
        try { localStorage.removeItem(draftKey); } catch (err) { /* */ }
        banner.remove();
      });
    }
  });
})();
