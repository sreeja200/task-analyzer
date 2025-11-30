// script.js
(() => {
  const API_ANALYZE = "https://sreejagunnam.pythonanywhere.com/api/tasks/analyze/";

  const els = {
    input: document.getElementById("taskInput"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    singleForm: document.getElementById("singleForm"),
    title: document.getElementById("title"),
    due_date: document.getElementById("due_date"),
    estimated_hours: document.getElementById("estimated_hours"),
    importance: document.getElementById("importance"),
    dependencies: document.getElementById("dependencies"),
    strategy: document.getElementById("strategy"),
    useBackendWeights: document.getElementById("useBackendWeights"),
    results: document.getElementById("results"),
    currentTasksOl: document.getElementById("currentTasks"),
    clearBtn: document.getElementById("clearBtn"),
  };

  // in-memory current task list
  let currentTasks = [];

  function showStatus(text, isError = false) {
    if (!els.results) return;
    els.results.innerHTML = `<div style="padding:12px;color:${isError ? "crimson" : "#222"}">${text}</div>`;
  }

  function syncTextareaFromCurrent() {
    if (!els.input) return;
    els.input.value = JSON.stringify(currentTasks, null, 2);
  }

  function renderCurrentTasks() {
    if (!els.currentTasksOl) return;
    if (!currentTasks.length) {
      els.currentTasksOl.innerHTML = "<li><small>No tasks yet</small></li>";
      return;
    }
    els.currentTasksOl.innerHTML = currentTasks
      .map((t, i) => {
        const d = t.due_date || "—";
        return `<li data-idx="${i}">
            <strong>${escapeHtml(t.title || "(no title)")}</strong>
            <div style="font-size:12px;color:#555">Due: ${escapeHtml(d)} • Effort: ${escapeHtml(String(t.estimated_hours||"—"))}h • Importance: ${escapeHtml(String(t.importance||"—"))}</div>
            <button data-idx="${i}" class="remove-task" style="margin-top:6px">Remove</button>
          </li>`;
      })
      .join("");
    // attach remove handlers
    els.currentTasksOl.querySelectorAll(".remove-task").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const idx = Number(btn.getAttribute("data-idx"));
        removeTask(idx);
      });
    });
  }

  function escapeHtml(s = "") {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function parseDepsField(raw) {
    if (!raw) return [];
    const t = raw.trim();
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return p;
    } catch {}
    return t.split(",").map(x => {
      const v = x.trim();
      if (v === "") return null;
      return (Number.isFinite(Number(v)) ? Number(v) : v);
    }).filter(x => x !== null);
  }

  function addTaskToListFromForm() {
    const title = (els.title.value || "").trim();
    const due_date = (els.due_date.value || "").trim();
    const estimated_raw = (els.estimated_hours.value || "").trim();
    const importance_raw = (els.importance.value || "").trim();
    const deps_raw = (els.dependencies.value || "").trim();

    // minimal validation: need at least title or due date
    if (!title && !due_date) {
      showStatus("Please provide at least a title or a due date before adding.", true);
      return;
    }

    const estimated_hours = estimated_raw ? Number(estimated_raw) : 0;
    const importance = importance_raw ? Number(importance_raw) : 1;
    const dependencies = parseDepsField(deps_raw);

    const task = {
      title: title || "",
      due_date: due_date || "",
      estimated_hours: Number.isNaN(estimated_hours) ? 0 : estimated_hours,
      importance: Number.isNaN(importance) ? 1 : importance,
      dependencies,
    };

    currentTasks.push(task);
    syncTextareaFromCurrent();
    renderCurrentTasks();
    showStatus(`Added: ${task.title || "(no title)"}`);
    // clear form except keep sensible defaults
    els.title.value = "";
    els.due_date.value = "";
    els.estimated_hours.value = 1;
    els.importance.value = 5;
    els.dependencies.value = "";
  }

  function removeTask(idx) {
    if (idx < 0 || idx >= currentTasks.length) return;
    const removed = currentTasks.splice(idx, 1)[0];
    syncTextareaFromCurrent();
    renderCurrentTasks();
    showStatus(`Removed: ${removed.title || "(no title)"}`);
  }

  async function getTasksFromInput() {
    // prefer textarea JSON if present
    if (!els.input) throw new Error("taskInput not found");
    const raw = els.input.value.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) return parsed.tasks;
        throw new Error("Expected a JSON array of task objects or { tasks: [...] }.");
      } catch (e) {
        throw new Error("Invalid JSON: " + e.message);
      }
    }
    // if textarea empty, fall back to currentTasks (in-memory)
    if (currentTasks.length) return currentTasks;
    // lastly, try building single task from form
    const title = (els.title && els.title.value || "").trim();
    const due_date = (els.due_date && els.due_date.value || "").trim();
    const estimated_hours_raw = (els.estimated_hours && els.estimated_hours.value || "").trim();
    const importance_raw = (els.importance && els.importance.value || "").trim();
    const deps_raw = (els.dependencies && els.dependencies.value || "").trim();
    if (!title && !due_date && !estimated_hours_raw && !importance_raw && !deps_raw) {
      throw new Error("Please paste a JSON array of tasks in the input or add tasks to the list.");
    }
    const estimated_hours = estimated_hours_raw ? Number(estimated_hours_raw) : 0;
    const importance = importance_raw ? Number(importance_raw) : 1;
    const dependencies = parseDepsField(deps_raw);
    const single = {
      title: title || "",
      due_date: due_date || "",
      estimated_hours: Number.isNaN(estimated_hours) ? 0 : estimated_hours,
      importance: Number.isNaN(importance) ? 1 : importance,
      dependencies
    };
    return [single];
  }

  function buildWeightsForStrategy(strategy) {
    const presets = {
      smart: { importance_mul: 5, quickwin_bonus: 10, urgency_overdue: 100, urgency_due_3: 50, urgency_due_7: 20, dependency_mul: 3 },
      fastest: { importance_mul: 3, quickwin_bonus: 25, urgency_due_3: 10, dependency_mul: 1 },
      "high-impact": { importance_mul: 12, quickwin_bonus: 0, urgency_due_3: 20, dependency_mul: 2 },
      deadline: { importance_mul: 4, quickwin_bonus: 5, urgency_due_3: 80, urgency_due_7: 40 },
    };
    return presets[strategy] || presets.smart;
  }

  function scoreToLabel(score) {
    if (score >= 100) return { label: "High", color: "#e74c3c" };
    if (score >= 60) return { label: "Medium", color: "#f39c12" };
    return { label: "Low", color: "#2ecc71" };
  }

  function renderCards(tasks) {
    if (!els.results) return;
    if (!tasks.length) { els.results.innerHTML = "<i>No tasks returned.</i>"; return; }
    const html = tasks.map(t => {
      const s = typeof t.score === "number" ? t.score : 0;
      const meta = scoreToLabel(s);
      return `
        <div class="task-card" style="border-radius:8px;padding:12px;margin:8px 0;border:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600">${escapeHtml(t.title || "(no title)")}</div>
            <div style="font-size:13px;color:#555;margin-top:6px">
              Due: ${escapeHtml(t.due_date || "—")} • Effort: ${escapeHtml(String(t.estimated_hours || "—"))}h • Importance: ${escapeHtml(String(t.importance || "—"))}
            </div>
            
            <div style="font-size:13px;color:#666;margin-top:8px">
            <span style="font-weight:700;color:#333;margin-right:6px">Why:</span>
            ${escapeHtml(String(t.explanation || "—")).replace(/\n/g, "<br/>")}
            </div>

          </div>
          <div style="text-align:right;min-width:120px">
            <div style="font-size:20px;font-weight:700;color:${meta.color}">${s}</div>
            <div style="font-size:12px;color:${meta.color}">${meta.label}</div>
          </div>
        </div>`; }).join("");
    els.results.innerHTML = html;
  }

  async function analyzeTasks() {
    try {
      showStatus("Processing...");
      const tasks = await getTasksFromInput();
      const strategy = (els.strategy && els.strategy.value) || "smart";
      const weights = buildWeightsForStrategy(strategy);
      const payload = { tasks, options: { weights } };

      const resp = await fetch(API_ANALYZE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { json = null; }

        if (json && Array.isArray(json.errors) && json.errors.length) {
          let msg = '<div style="padding:12px;color:#b00020;"><strong>Validation errors:</strong><ul style="margin:8px 0 0 16px;">';
          json.errors.forEach(err => {
            const idx = (err.index !== undefined) ? `Task ${err.index}` : "Task";
            const field = err.field || "(field)";
            const problem = err.problem || JSON.stringify(err);
            msg += `<li><b>${idx}</b> — ${field}: ${problem}</li>`;
          });
          msg += "</ul></div>";
          els.results.innerHTML = msg; return;
        }

        if (json && (json.error || json.message)) {
          els.results.innerHTML = `<div style="padding:12px;color:#b00020;"><strong>Error:</strong> ${json.error || json.message}</div>`; return;
        }

        els.results.innerHTML = `<div style="padding:12px;color:#b00020;"><strong>Server error:</strong><pre style="white-space:pre-wrap;">${text}</pre></div>`;
        return;
      }

      const result = await resp.json();
      const tasksOut = Array.isArray(result) ? result : result.tasks || result;
      renderCards(tasksOut);
    } catch (err) {
      showStatus(err.message, true);
      console.error(err);
    }
  }

  // event wiring
  if (els.addTaskBtn) els.addTaskBtn.addEventListener("click", addTaskToListFromForm);
  if (els.analyzeBtn) els.analyzeBtn.addEventListener("click", analyzeTasks);
  if (els.clearBtn) els.clearBtn.addEventListener("click", () => {
    currentTasks = [];
    syncTextareaFromCurrent();
    renderCurrentTasks();
    els.results.innerHTML = "";
  });

  // init UI
  renderCurrentTasks();
  if (els.results && !els.results.innerHTML.trim()) {
    els.results.innerHTML = "<i>Paste tasks JSON in the left area and click Analyze.</i>";
  }
})();
