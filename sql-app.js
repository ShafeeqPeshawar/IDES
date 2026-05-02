var sqlJsModule = null;
var sqlDb = null;
var sqlEditorFontSize = 14;
var sqlResultsFontSize = 13;
var sqlPersistTimer = null;
var SQL_LS_KEY = "igniup_sql_workspace_v1";

var SQL_EMPLOYEES_COLUMNS =
  "empno INTEGER, name TEXT, salary INTEGER, department TEXT, city TEXT, country TEXT";

/** Quoted so SQLite keeps a capital E: Employees */
var SQL_EMPLOYEES_TABLE_Q = '"Employees"';

function sqlInsertThousandEmployeesRows() {
  if (!sqlDb) return;
  var ins = sqlDb.prepare(
    "INSERT INTO " +
      SQL_EMPLOYEES_TABLE_Q +
      " (empno, name, salary, department, city, country) VALUES (?,?,?,?,?,?)"
  );
  var depts = ["HR", "IT", "Sales", "Ops", "Legal"];
  var cities = ["NYC", "LA", "Chicago", "Houston", "Miami"];
  var countries = ["USA", "Canada", "UK", "USA", "Mexico"];
  for (var i = 1; i <= 1000; i++) {
    ins.run([
      i,
      "Employee " + i,
      35000 + ((i * 73) % 115000),
      depts[i % 5],
      cities[i % 5],
      countries[i % countries.length],
    ]);
  }
  ins.free();
}

function escapeHtml(text) {
  if (text == null) return "";
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function uint8ToBase64(bytes) {
  var CHUNK = 0x8000;
  var binary = "";
  for (var i = 0; i < bytes.length; i += CHUNK) {
    var end = Math.min(i + CHUNK, bytes.length);
    binary += String.fromCharCode.apply(null, bytes.subarray(i, end));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  var binary = atob(base64);
  var len = binary.length;
  var out = new Uint8Array(len);
  for (var i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function sqlUpdateLineNumbers() {
  var ed = document.getElementById("editor");
  var ln = document.getElementById("lineNumbers");
  if (!ed || !ln) return;
  var n = ed.value.split("\n").length;
  var s = "";
  for (var r = 1; r <= n; r++) s += r + "\n";
  ln.textContent = s;
}

function sqlSyncScroll() {
  var ed = document.getElementById("editor");
  var ln = document.getElementById("lineNumbers");
  if (ed && ln) ln.scrollTop = ed.scrollTop;
}

function closeSqlDb() {
  if (sqlDb) {
    try {
      sqlDb.close();
    } catch (e) {}
    sqlDb = null;
  }
}

function openSqlDatabase(data) {
  closeSqlDb();
  sqlDb =
    data && data.byteLength > 0
      ? new sqlJsModule.Database(data)
      : new sqlJsModule.Database();
  sqlDb.run("PRAGMA foreign_keys = ON;");
  var seededRows = false;
  try {
    /* Default practice table; SQLite stores CHAR as TEXT (length not enforced). */
    sqlDb.run(
      "CREATE TABLE IF NOT EXISTS " +
        SQL_EMPLOYEES_TABLE_Q +
        " (" +
        SQL_EMPLOYEES_COLUMNS +
        ");"
    );
    var countRes = sqlDb.exec("SELECT COUNT(*) FROM " + SQL_EMPLOYEES_TABLE_Q + ";");
    var cnt = 0;
    if (
      countRes &&
      countRes[0] &&
      countRes[0].values &&
      countRes[0].values[0]
    ) {
      cnt = Number(countRes[0].values[0][0]) || 0;
    }
    if (cnt === 0) {
      sqlDb.run("BEGIN TRANSACTION;");
      sqlInsertThousandEmployeesRows();
      sqlDb.run("COMMIT;");
      seededRows = true;
    }
  } catch (e) {
    try {
      sqlDb.run("ROLLBACK;");
    } catch (r) {}
  }
  sqlRefreshExplorer();
  if (seededRows) {
    persistLocal();
    scheduleCloudPersist();
  }
}

function persistLocal() {
  try {
    if (!sqlDb || !sqlJsModule) return;
    var data = sqlDb.export();
    var ed = document.getElementById("editor");
    var payload = {
      sqliteBase64: uint8ToBase64(data),
      editorScript: ed ? ed.value : "",
    };
    localStorage.setItem(SQL_LS_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadLocalWorkspace() {
  try {
    var raw = localStorage.getItem(SQL_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function scheduleCloudPersist() {
  if (typeof window.isLoggedIn !== "function" || !window.isLoggedIn()) return;
  if (sqlPersistTimer) clearTimeout(sqlPersistTimer);
  sqlPersistTimer = setTimeout(function () {
    sqlPersistTimer = null;
    saveWorkspaceToCloud(true);
  }, 2500);
}

function sqlShowResultsEmpty() {
  var out = document.getElementById("sqlResults");
  if (out) out.innerHTML = '<div class="sql-results-empty">No data available.</div>';
}

function sqlShowResultsSuccessExecuted() {
  var out = document.getElementById("sqlResults");
  if (out)
    out.innerHTML =
      '<div class="sql-results-msg success">Executed successfully.</div>';
}

function sqlToggleExplorerSection(id) {
  var sec = document.getElementById(id);
  if (!sec) return;
  sec.classList.toggle("collapsed");
  var btn = sec.querySelector(".sql-explorer-head");
  var collapsed = sec.classList.contains("collapsed");
  if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function sqlExplorerInsertName(name) {
  var ed = document.getElementById("editor");
  if (!ed) return;
  var pos = ed.selectionStart;
  var val = ed.value;
  ed.value = val.slice(0, pos) + name + val.slice(pos);
  ed.selectionStart = ed.selectionEnd = pos + name.length;
  ed.focus();
  sqlUpdateLineNumbers();
}

function sqlNamesForType(type) {
  if (!sqlDb) return [];
  try {
    var r = sqlDb.exec(
      "SELECT name FROM sqlite_master WHERE type='" +
        type +
        "' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    if (!r || !r[0] || !r[0].values) return [];
    return r[0].values.map(function (row) {
      return row[0];
    });
  } catch (e) {
    return [];
  }
}

function sqlRefreshExplorer() {
  var ulT = document.getElementById("sqlExplorerTables");
  var ulV = document.getElementById("sqlExplorerViews");
  if (!ulT || !ulV) return;
  ulT.innerHTML = "";
  ulV.innerHTML = "";
  if (!sqlDb) {
    ulT.innerHTML = '<li class="sql-explorer-empty">(none)</li>';
    ulV.innerHTML = '<li class="sql-explorer-empty">(none)</li>';
    return;
  }
  function fillList(ul, names) {
    if (!names.length) {
      ul.innerHTML = '<li class="sql-explorer-empty">(none)</li>';
      return;
    }
    names.forEach(function (name) {
      var li = document.createElement("li");
      li.className = "sql-explorer-item";
      li.textContent = name;
      li.title = "Insert name at cursor";
      li.onclick = function () {
        sqlExplorerInsertName(name);
      };
      ul.appendChild(li);
    });
  }
  fillList(ulT, sqlNamesForType("table"));
  fillList(ulV, sqlNamesForType("view"));
}

function renderExecResults(container, results) {
  container.innerHTML = "";
  if (!results || !results.length) {
    sqlShowResultsSuccessExecuted();
    return;
  }
  for (var idx = 0; idx < results.length; idx++) {
    var res = results[idx];
    var table = document.createElement("table");
    table.className = "sql-result-table";
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var cols = res.columns || [];
    for (var c = 0; c < cols.length; c++) {
      var th = document.createElement("th");
      th.textContent = cols[c];
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    var rows = res.values || [];
    for (var r = 0; r < rows.length; r++) {
      var tr = document.createElement("tr");
      var row = rows[r];
      for (var k = 0; k < cols.length; k++) {
        var td = document.createElement("td");
        var cell = row[k];
        td.textContent = cell === null || typeof cell === "undefined" ? "NULL" : String(cell);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }
}

function sqlRun() {
  var out = document.getElementById("sqlResults");
  var btn = document.getElementById("sqlRunBtn");
  var ed = document.getElementById("editor");
  if (!sqlDb || !sqlJsModule) {
    if (out)
      out.innerHTML =
        '<span class="error">SQL engine not ready yet. Wait a moment and try again.</span>';
    return;
  }
  var sql = ed.value.trim();
  if (!sql) {
    if (out) out.innerHTML = '<span class="error">Nothing to run.</span>';
    return;
  }
  if (btn) btn.disabled = true;
  if (out) out.innerHTML = '<span class="loading">Running...</span>';
  try {
    var results = sqlDb.exec(sql);
    sqlRefreshExplorer();
    if (!results || !results.length) {
      sqlShowResultsSuccessExecuted();
    } else {
      renderExecResults(out, results);
    }
    persistLocal();
    scheduleCloudPersist();
  } catch (err) {
    if (out)
      out.innerHTML =
        '<span class="error">Error:\n' + escapeHtml(err.message || String(err)) + "</span>";
  } finally {
    if (btn) btn.disabled = false;
  }
}

function sqlClearResults() {
  sqlShowResultsEmpty();
}

function sqlClearEditor() {
  if (!confirm("Clear the entire SQL editor?")) return;
  document.getElementById("editor").value = "";
  sqlUpdateLineNumbers();
  sqlClearResults();
}

function sqlResetDatabase() {
  if (
    !confirm(
      "Re-create the Employees table with 1,000 sample rows? Other tables and views you added will be kept."
    )
  )
    return;
  if (!sqlDb || !sqlJsModule) {
    openSqlDatabase(null);
  } else {
    try {
      sqlDb.run("BEGIN TRANSACTION;");
      sqlDb.run("DROP TABLE IF EXISTS employees;");
      sqlDb.run("DROP TABLE IF EXISTS " + SQL_EMPLOYEES_TABLE_Q + ";");
      sqlDb.run(
        "CREATE TABLE " + SQL_EMPLOYEES_TABLE_Q + " (" + SQL_EMPLOYEES_COLUMNS + ");"
      );
      sqlInsertThousandEmployeesRows();
      sqlDb.run("COMMIT;");
    } catch (e) {
      try {
        sqlDb.run("ROLLBACK;");
      } catch (r) {}
    }
    sqlRefreshExplorer();
  }
  document.getElementById("editor").value = "";
  sqlUpdateLineNumbers();
  sqlShowResultsEmpty();
  persistLocal();
  scheduleCloudPersist();
}

function sqlGoHome() {
  var code = document.getElementById("editor").value.trim();
  if (code === "") {
    window.location.href = "index.html";
    return;
  }
  if (confirm("Leave the SQL editor and go home?")) window.location.href = "index.html";
}

function sqlCopyEditor() {
  var ed = document.getElementById("editor");
  ed.select();
  document.execCommand("copy");
  var out = document.getElementById("sqlResults");
  if (out) out.innerHTML = '<div class="sql-results-msg success">Copied to clipboard.</div>';
  setTimeout(function () {
    window.getSelection().removeAllRanges();
    sqlShowResultsEmpty();
  }, 1600);
}

function sqlPasteEditor() {
  navigator.clipboard
    .readText()
    .then(function (text) {
      var ed = document.getElementById("editor");
      var start = ed.selectionStart;
      var end = ed.selectionEnd;
      var val = ed.value;
      ed.value = val.substring(0, start) + text + val.substring(end);
      ed.selectionStart = ed.selectionEnd = start + text.length;
      sqlUpdateLineNumbers();
      var out = document.getElementById("sqlResults");
      if (out)
        out.innerHTML = '<div class="sql-results-msg success">Pasted from clipboard.</div>';
      setTimeout(sqlShowResultsEmpty, 1600);
    })
    .catch(function () {
      var out = document.getElementById("sqlResults");
      if (out)
        out.innerHTML =
          '<span class="error">Paste blocked. Try Ctrl+V in the editor.</span>';
    });
}

function sqlToggleTheme() {
  var body = document.body;
  var label = document.getElementById("themeLabel");
  if (body.classList.contains("light")) {
    body.classList.remove("light");
    body.classList.add("dark");
    if (label) label.textContent = "Light";
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.remove("dark");
    body.classList.add("light");
    if (label) label.textContent = "Dark";
    localStorage.setItem("theme", "light");
  }
  document.body.classList.add("sql-ide-page");
}

function sqlZoomEditor(delta) {
  sqlEditorFontSize = Math.max(10, Math.min(24, sqlEditorFontSize + delta));
  var ed = document.getElementById("editor");
  var ln = document.getElementById("lineNumbers");
  var lh = 1.6 * sqlEditorFontSize + "px";
  ed.style.fontSize = sqlEditorFontSize + "px";
  ed.style.lineHeight = lh;
  ln.style.fontSize = sqlEditorFontSize + "px";
  ln.style.lineHeight = lh;
}

function sqlZoomResults(delta) {
  sqlResultsFontSize = Math.max(10, Math.min(22, sqlResultsFontSize + delta));
  var el = document.getElementById("sqlResults");
  if (el) el.style.fontSize = sqlResultsFontSize + "px";
}

function sqlLoadScriptFile() {
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".sql,.txt";
  inp.onchange = function (ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("editor").value = e.target.result;
      sqlUpdateLineNumbers();
      var out = document.getElementById("sqlResults");
      if (out)
        out.innerHTML =
          '<div class="sql-results-msg success">Loaded file: ' +
          escapeHtml(f.name) +
          "</div>";
      setTimeout(sqlShowResultsEmpty, 2000);
    };
    reader.readAsText(f);
  };
  inp.click();
}

function sqlSaveScriptFile() {
  var text = document.getElementById("editor").value;
  var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "query.sql";
  a.click();
  URL.revokeObjectURL(a.href);
  var out = document.getElementById("sqlResults");
  if (out)
    out.innerHTML =
      '<div class="sql-results-msg success">Download started (query.sql).</div>';
  setTimeout(sqlShowResultsEmpty, 2000);
}

function saveWorkspaceToCloud(silent) {
  silent = !!silent;
  var out = document.getElementById("sqlResults");
  if (typeof window.isLoggedIn !== "function" || !window.isLoggedIn()) {
    if (!silent && out)
      out.innerHTML =
        '<span class="error">Log in to save your workspace to the cloud. Local copy is still in this browser.</span>';
    return;
  }
  if (!sqlDb || !sqlJsModule) return;
  var base = window.API_BASE || "";
  var data = sqlDb.export();
  var ed = document.getElementById("editor");
  var body = {
    sqliteBase64: uint8ToBase64(data),
    editorScript: ed ? ed.value : "",
  };
  fetch(base + "/api/sql-workspace", {
    method: "PUT",
    headers: window.getAuthHeaders(),
    body: JSON.stringify(body),
  })
    .then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || "Save failed");
        return j;
      });
    })
    .then(function (data) {
      persistLocal();
      if (!silent && out) {
        var exp =
          data.expiresAt != null
            ? new Date(data.expiresAt).toLocaleString()
            : "";
        out.innerHTML =
          '<span class="success">Workspace saved to your account.' +
          (exp ? " Kept until at least: " + escapeHtml(exp) + "." : "") +
          "</span>";
      }
    })
    .catch(function (err) {
      if (!silent && out)
        out.innerHTML =
          '<span class="error">' + escapeHtml(err.message || String(err)) + "</span>";
    });
}

function fetchCloudWorkspace() {
  var base = window.API_BASE || "";
  return fetch(base + "/api/sql-workspace", {
    headers: window.getAuthHeaders(),
  }).then(function (r) {
    return r.json().then(function (j) {
      if (!r.ok) throw new Error(j.error || "Load failed");
      return j;
    });
  });
}

function applyWorkspacePayload(payload) {
  if (payload && payload.sqliteBase64) {
    var bytes = base64ToUint8Array(payload.sqliteBase64);
    openSqlDatabase(bytes);
    if (payload.editorScript != null)
      document.getElementById("editor").value = payload.editorScript;
    else document.getElementById("editor").value = "";
  } else {
    openSqlDatabase(null);
    document.getElementById("editor").value = "";
  }
  sqlUpdateLineNumbers();
}

function initSqlIdeAfterEngine() {
  var out = document.getElementById("sqlResults");
  var loggedIn = typeof window.isLoggedIn === "function" && window.isLoggedIn();

  function finishInit() {
    sqlShowResultsEmpty();
    setTimeout(initSqlSplitResizer, 0);
  }

  if (loggedIn) {
    fetchCloudWorkspace()
      .then(function (res) {
        if (res.workspace) {
          applyWorkspacePayload(res.workspace);
        } else {
          var local = loadLocalWorkspace();
          if (local && local.sqliteBase64) applyWorkspacePayload(local);
          else applyWorkspacePayload(null);
        }
        finishInit();
      })
      .catch(function () {
        var local = loadLocalWorkspace();
        if (local && local.sqliteBase64) applyWorkspacePayload(local);
        else applyWorkspacePayload(null);
        if (out)
          out.innerHTML =
            '<span class="error">Could not load cloud workspace (showing local or new DB).</span>';
        setTimeout(initSqlSplitResizer, 0);
      });
  } else {
    var local = loadLocalWorkspace();
    if (local && local.sqliteBase64) applyWorkspacePayload(local);
    else applyWorkspacePayload(null);
    finishInit();
  }
}

var SQL_SPLIT_LS_KEY = "igniup_sql_editor_height";
var SQL_SPLIT_MIN_EDITOR = 110;
var SQL_SPLIT_MIN_RESULTS = 120;
var SQL_SPLIT_DEFAULT = 168;

function initSqlSplitResizer() {
  if (window.__sqlSplitResizerInit) return;
  var stack = document.getElementById("sqlIdeStack");
  var edSec = document.getElementById("sqlEditorSection");
  var handle = document.getElementById("sqlStackResizer");
  if (!stack || !edSec || !handle) return;
  window.__sqlSplitResizerInit = true;

  function clampEditorPx(px) {
    var stackH = stack.getBoundingClientRect().height;
    var maxEd = stackH - handle.offsetHeight - SQL_SPLIT_MIN_RESULTS;
    if (maxEd < SQL_SPLIT_MIN_EDITOR) maxEd = SQL_SPLIT_MIN_EDITOR;
    return Math.max(SQL_SPLIT_MIN_EDITOR, Math.min(maxEd, Math.round(px)));
  }

  function applyEditorHeight(px) {
    px = clampEditorPx(px);
    edSec.style.flex = "0 0 " + px + "px";
    edSec.style.height = px + "px";
    handle.setAttribute("aria-valuenow", String(px));
  }

  var saved = parseInt(localStorage.getItem(SQL_SPLIT_LS_KEY), 10);
  if (!isNaN(saved) && saved >= SQL_SPLIT_MIN_EDITOR) {
    applyEditorHeight(saved);
  } else {
    applyEditorHeight(SQL_SPLIT_DEFAULT);
  }

  var startY = 0;
  var startH = 0;

  function onMove(e) {
    applyEditorHeight(startH + (e.clientY - startY));
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    var h = edSec.getBoundingClientRect().height;
    localStorage.setItem(SQL_SPLIT_LS_KEY, String(Math.round(h)));
  }

  handle.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    startY = e.clientY;
    startH = edSec.getBoundingClientRect().height;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  });

  handle.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 24 : 12;
    var h = edSec.getBoundingClientRect().height;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var next =
        e.key === "ArrowDown" ? h + step : h - step;
      applyEditorHeight(next);
      localStorage.setItem(
        SQL_SPLIT_LS_KEY,
        String(Math.round(edSec.getBoundingClientRect().height))
      );
    }
  });

  window.addEventListener("resize", function () {
    applyEditorHeight(edSec.getBoundingClientRect().height);
  });
}

function wireSqlIdeChrome() {
  var saved = localStorage.getItem("theme");
  var body = document.body;
  var themeLabel = document.getElementById("themeLabel");
  if (saved === "dark") {
    body.classList.remove("light");
    body.classList.add("dark");
    if (themeLabel) themeLabel.textContent = "Light";
  } else {
    body.classList.remove("dark");
    body.classList.add("light");
    if (themeLabel) themeLabel.textContent = "Dark";
  }

  var loggedIn = typeof window.isLoggedIn === "function" && window.isLoggedIn();
  var logoutEl = document.getElementById("ideLogout");
  var profileWrap = document.getElementById("ideProfileBtnWrap");
  var topBarBrand = document.getElementById("ideTopBarBrand");
  var currentBadgeWrap = document.getElementById("ideCurrentBadge");
  var badgeIconEl = document.getElementById("ideBadgeIcon");
  var badgeNameEl = document.getElementById("ideBadgeName");

  if (profileWrap) profileWrap.style.display = loggedIn ? "flex" : "none";
  if (logoutEl) {
    logoutEl.style.display = loggedIn ? "inline" : "none";
    logoutEl.onclick = function (e) {
      e.preventDefault();
      if (window.clearAuth) window.clearAuth();
      window.location.href = "index.html";
    };
  }

  if (loggedIn && currentBadgeWrap && topBarBrand) {
    topBarBrand.style.display = "none";
    var base = window.API_BASE || "";
    var headers = {};
    if (typeof window.getAuthHeaders === "function") {
      var h = window.getAuthHeaders();
      if (h && h.Authorization) headers.Authorization = h.Authorization;
    }
    fetch(base + "/api/auth/me", { headers: headers })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (me) {
        var points = me && typeof me.points === "number" ? me.points : 0;
        var BADGES = [
          { name: "First Code", points: 10, icon: "✨" },
          { name: "Coder", points: 30, icon: "🐍" },
          { name: "Explorer", points: 50, icon: "🔍" },
          { name: "Script Soldier", points: 100, icon: "🎖️" },
          { name: "Builder", points: 200, icon: "🏗️" },
          { name: "Syntax Explorer", points: 500, icon: "🏆" },
          { name: "Master", points: 1000, icon: "👑" },
        ];
        var currentBadge = null;
        for (var i = BADGES.length - 1; i >= 0; i--) {
          if (BADGES[i].points <= points) {
            currentBadge = BADGES[i];
            break;
          }
        }
        if (currentBadge && badgeIconEl && badgeNameEl) {
          badgeIconEl.textContent = currentBadge.icon;
          badgeNameEl.textContent = currentBadge.name;
          currentBadgeWrap.style.display = "flex";
        } else {
          if (badgeIconEl) badgeIconEl.textContent = "";
          if (badgeNameEl) badgeNameEl.textContent = "No badge yet";
          currentBadgeWrap.style.display = "flex";
        }
      })
      .catch(function () {
        if (topBarBrand) topBarBrand.style.display = "";
        if (currentBadgeWrap) currentBadgeWrap.style.display = "none";
      });
  } else {
    if (topBarBrand) topBarBrand.style.display = "";
    if (currentBadgeWrap) currentBadgeWrap.style.display = "none";
  }

  document.body.classList.add("sql-ide-page");
}

window.addEventListener("load", function () {
  wireSqlIdeChrome();

  var ed = document.getElementById("editor");
  ed.addEventListener("input", function () {
    sqlUpdateLineNumbers();
    persistLocal();
    scheduleCloudPersist();
  });
  ed.addEventListener("scroll", sqlSyncScroll);
  ed.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sqlRun();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      sqlSaveScriptFile();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      var t = this.selectionStart;
      var n = this.selectionEnd;
      this.value = this.value.substring(0, t) + "  " + this.value.substring(n);
      this.selectionStart = this.selectionEnd = t + 2;
      sqlUpdateLineNumbers();
    }
  });

  sqlUpdateLineNumbers();

  var out = document.getElementById("sqlResults");
  if (typeof initSqlJs !== "function") {
    if (out)
      out.innerHTML =
        '<span class="error">Could not load sql.js from CDN. Check your network.</span>';
    setTimeout(initSqlSplitResizer, 0);
    return;
  }

  initSqlJs({
    locateFile: function (file) {
      return "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/" + file;
    },
  })
    .then(function (SQL) {
      if (out) out.innerHTML = '<span class="loading">Loading SQL engine...</span>';
      sqlJsModule = SQL;
      initSqlIdeAfterEngine();
    })
    .catch(function (err) {
      if (out)
        out.innerHTML =
          '<span class="error">Failed to init SQL engine: ' +
          escapeHtml(err.message || String(err)) +
          "</span>";
      setTimeout(initSqlSplitResizer, 0);
    });
});
