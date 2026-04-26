var pyodide,
  editorFontSize = 14,
  outputFontSize = 13,
  currentProgramId = null;

function updateLineNumbers() {
  var e = document.getElementById("editor"),
    t = document.getElementById("lineNumbers"),
    n = e.value.split("\n").length,
    o = "";
  for (var r = 1; r <= n; r++) o += r + "\n";
  t.textContent = o;
}

function syncScroll() {
  var e = document.getElementById("editor"),
    t = document.getElementById("lineNumbers");
  t.scrollTop = e.scrollTop;
}

function escapeHtml(text) {
  if (text == null) return "";
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function cleanErrorMessage(e) {
  var t = e.split("\n"),
    n = [];
  for (var o = 0; o < t.length; o++) {
    var r = t[o];
    if (
      r.indexOf("/lib/python311.zip/_pyodide/") !== -1 ||
      r.indexOf("eval_code_async") !== -1 ||
      r.indexOf("run_async") !== -1 ||
      r.indexOf("await CodeRunner") !== -1 ||
      r.indexOf("coroutine = eval") !== -1
    )
      continue;
    if (
      r.indexOf('File ""') !== -1 ||
      r.indexOf("Error:") !== -1 ||
      r.indexOf("Exception:") !== -1 ||
      r.indexOf("Traceback") !== -1 ||
      o === t.length - 1
    )
      n.push(r);
  }
  return n.join("\n");
}

async function initPyodide() {
  var e = document.getElementById("output");
  e.innerHTML = '<span class="loading">⏳ Loading Python...</span>';
  try {
    pyodide = await loadPyodide();
    pyodide.runPython("import sys\nfrom io import StringIO");
    pyodide.runPython(
      "from js import window\n" +
      "async def _async_input(prompt=''):\n" +
      "    return await window.getInput(prompt)\n"
    );
    e.innerHTML = '<span class="success">✓ Python ready!</span>';
  } catch (t) {
    e.innerHTML =
      '<span class="error">✗ Failed: ' + t.message + "</span>";
  }
}

function transformCodeForInput(code) {
  var lines = code.split("\n");
  var transformed = lines
    .map(function (line) {
      return "  " + line.replace(/\binput\s*\(/g, "(await _async_input(");
    })
    .join("\n");
  transformed = addClosingParens(transformed);
  return (
    "async def __run__():\n" +
    transformed +
    "\n\nawait __run__()\n"
  );
}

function addClosingParens(str) {
  var idx = 0;
  var result = [];
  var needle = "(await _async_input(";
  while (true) {
    var pos = str.indexOf(needle, idx);
    if (pos === -1) {
      result.push(str.slice(idx));
      break;
    }
    result.push(str.slice(idx, pos));
    var openPos = pos + needle.length - 1;
    var depth = 0;
    var i = openPos;
    while (i < str.length) {
      var c = str[i];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    result.push(str.slice(pos, i) + ")" + str.slice(i, i + 1));
    idx = i + 1;
  }
  return result.join("");
}

function hasInputCall(code) {
  return /\binput\s*\(/.test(code);
}

function showConsoleInput(resolve, prompt) {
  var outputEl = document.getElementById("output");
  var loading = outputEl.querySelector(".loading");
  if (loading) loading.remove();
  if (prompt != null && String(prompt).length > 0) {
    var promptSpan = document.createElement("span");
    promptSpan.textContent = prompt;
    outputEl.appendChild(promptSpan);
  }
  var wrap = document.createElement("span");
  wrap.className = "console-input-wrap";
  var inp = document.createElement("input");
  inp.type = "text";
  inp.className = "console-input";
  inp.setAttribute("autocomplete", "off");
  wrap.appendChild(inp);
  outputEl.appendChild(wrap);
  inp.focus();
  function submit() {
    var val = inp.value;
    wrap.replaceWith(document.createTextNode(val + "\n"));
    resolve(val.trim());
  }
  inp.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submit();
    }
  });
}

window.getInput = function (prompt) {
  return new Promise(function (resolve) {
    showConsoleInput(resolve, prompt);
  });
};

window.appendOutput = function (text) {
  var el = document.getElementById("output");
  var loading = el.querySelector(".loading");
  if (loading) loading.remove();
  var span = document.createElement("span");
  span.textContent = text;
  el.appendChild(span);
};

window.appendError = function (text) {
  var el = document.getElementById("output");
  var loading = el.querySelector(".loading");
  if (loading) loading.remove();
  var span = document.createElement("span");
  span.className = "error";
  span.textContent = text;
  el.appendChild(span);
};

async function runCode() {
  if (!pyodide)
    return void (document.getElementById("output").innerHTML =
      '<span class="error">⚠ Python not loaded yet...</span>');
  var e = document.getElementById("editor").value,
    t = document.getElementById("output"),
    n = document.getElementById("runBtn");
  if (!e.trim())
    return void (t.innerHTML =
      '<span class="error">⚠ No code to execute!</span>');
  n.disabled = true;
  t.innerHTML = '<span class="loading">⏳ Executing...</span>';
  try {
    pyodide.runPython(
      "import sys\n" +
      "from js import window\n" +
      "class _OutWriter:\n" +
      "  def __init__(self, is_err=0):\n" +
      "    self.buf = []\n" +
      "    self.is_err = is_err\n" +
      "  def write(self, s):\n" +
      "    self.buf.append(s)\n" +
      "    (window.appendError(s) if self.is_err else window.appendOutput(s))\n" +
      "  def getvalue(self):\n" +
      "    return ''.join(self.buf)\n" +
      "names_to_delete = [k for k in list(globals().keys()) if not k.startswith('__') and k not in ('sys','StringIO','_async_input','_OutWriter','window')]\n" +
      "for k in names_to_delete: del globals()[k]\n" +
      "sys.stdout = _OutWriter(0)\n" +
      "sys.stderr = _OutWriter(1)\n"
    );
    var codeToRun = hasInputCall(e) ? transformCodeForInput(e) : e;
    await pyodide.runPythonAsync(codeToRun);
    var loading = t.querySelector(".loading");
    if (loading) loading.remove();
    var status = document.createElement("span");
    status.className = "program-status";
    status.textContent = "\n--- Program Executed Successfully ---";
    t.appendChild(status);
    recordExecutionSuccess();
    autoSaveProgramToCloud(e);
  } catch (i) {
    var s = cleanErrorMessage(i.message);
    t.innerHTML =
      '<span class="error">✗ Error:\n' +
      escapeHtml(s) +
      '</span>\n<span class="program-status">--- Program Exited with Errors ---</span>';
  } finally {
    n.disabled = false;
  }
}

function recordExecutionSuccess() {
  if (!currentProgramId || typeof window.getAuthHeaders !== "function") return;
  var base = window.API_BASE || "";
  fetch(base + "/api/programs/" + currentProgramId, {
    method: "PATCH",
    headers: window.getAuthHeaders(),
    body: JSON.stringify({ executedSuccessfully: true }),
  }).catch(function () {});
}

function autoSaveProgramToCloud(code) {
  if (typeof window.isLoggedIn !== "function" || !window.isLoggedIn() || !code.trim()) return;
  var base = window.API_BASE || "";
  var headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
  fetch(base + "/api/programs", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ code: code, executedSuccessfully: true }),
  })
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || "Auto-save failed");
        return data;
      });
    })
    .then(function (data) {
      currentProgramId = data._id || data.id;
    })
    .catch(function () {});
}

function openMyPrograms() {
  if (typeof window.isLoggedIn === "function" && !window.isLoggedIn()) {
    window.location.href = "authenticate.html";
    return;
  }
  var base = window.API_BASE || "";
  var output = document.getElementById("output");
  output.innerHTML = '<span class="loading">Loading your programs...</span>';
  fetch(base + "/api/programs", { headers: window.getAuthHeaders ? window.getAuthHeaders() : {} })
    .then(function (r) {
      if (!r.ok) throw new Error("Failed to load list");
      return r.json();
    })
    .then(function (list) {
      if (!list.length) {
        output.innerHTML = '<span class="program-status">No programs saved yet. Save to cloud to see them here.</span>';
        return;
      }
      var choice = prompt(
        "Enter number to load (1–" +
          list.length +
          "):\n\n" +
          list
            .map(function (p, i) {
              return (i + 1) + ". " + (p.title || "Untitled") + (p.executedSuccessfully ? " ✓" : "");
            })
            .join("\n")
      );
      if (choice == null) {
        output.innerHTML = '<span class="success">Cancelled.</span>';
        return;
      }
      var idx = parseInt(choice, 10) - 1;
      if (idx < 0 || idx >= list.length) {
        output.innerHTML = '<span class="error">Invalid number.</span>';
        return;
      }
      var id = list[idx]._id;
      return fetch(base + "/api/programs/" + id, {
        headers: window.getAuthHeaders ? window.getAuthHeaders() : {},
      }).then(function (r) {
        if (!r.ok) throw new Error("Failed to load program");
        return r.json();
      });
    })
    .then(function (program) {
      if (!program) return;
      currentProgramId = program._id;
      document.getElementById("editor").value = program.code || "";
      updateLineNumbers();
      output.innerHTML =
        '<span class="success">✓ Loaded: ' + escapeHtml(program.title || "Untitled") + "</span>";
    })
    .catch(function (err) {
      output.innerHTML = '<span class="error">✗ ' + escapeHtml(err.message) + "</span>";
    });
}

async function saveCode() {
  try {
    var e = document.getElementById("editor").value,
      t = {
        suggestedName: "python_code.py",
        types: [
          {
            description: "Python Files",
            accept: { "text/plain": [".py"] },
          },
        ],
      },
      n = await window.showSaveFilePicker(t),
      o = await n.createWritable();
    (await o.write(e),
      await o.close(),
      (document.getElementById("output").innerHTML =
        '<span class="success">✓ File saved successfully!</span>'));
  } catch (r) {
    if ("AbortError" !== r.name) {
      var a = document.getElementById("editor").value,
        i = new Blob([a], { type: "text/plain" }),
        s = document.createElement("a");
      ((s.href = URL.createObjectURL(i)),
        (s.download = "python_code.py"),
        s.click(),
        URL.revokeObjectURL(s.href),
        (document.getElementById("output").innerHTML =
          '<span class="success">✓ File saved!</span>'));
    }
  }
}

function loadCode() {
  var e = document.createElement("input");
  e.type = "file";
  e.accept = ".py,.txt";
  e.onchange = function (ev) {
    var t = ev.target.files[0];
    if (t) {
      currentProgramId = null;
      var n = new FileReader();
      n.onload = function (evt) {
        document.getElementById("editor").value = evt.target.result;
        updateLineNumbers();
        document.getElementById("output").innerHTML =
          '<span class="success">✓ File loaded: ' + t.name + "</span>";
      };
      n.readAsText(t);
    }
  };
  e.click();
}

function clearOutput() {
  document.getElementById("output").innerHTML =
    '<span class="success">Output cleared. Ready to execute code...</span>';
}

function clearEditor() {
  confirm("Are you sure you want to clear the editor?") &&
    ((document.getElementById("editor").value = ""),
      updateLineNumbers(),
      (document.getElementById("output").innerHTML =
        '<span class="success">Editor cleared. Ready for new code...</span>'));
}

function goHome() {
  var code = document.getElementById("editor").value.trim();
  if (code === "") {
    window.location.href = "index.html";
    return;
  }
  if (confirm("You have code in the editor. Leave and go to home?")) {
    window.location.href = "index.html";
  }
}

function copyCode() {
  var e = document.getElementById("editor");
  (e.select(),
    document.execCommand("copy"),
    (document.getElementById("output").innerHTML =
      '<span class="success">✓ Code copied to clipboard!</span>'),
    setTimeout(function () {
      window.getSelection().removeAllRanges();
    }, 100));
}

function pasteCode() {
  navigator.clipboard
    .readText()
    .then(function (e) {
      var t = document.getElementById("editor"),
        n = t.selectionStart,
        o = t.selectionEnd,
        r = t.value;
      ((t.value = r.substring(0, n) + e + r.substring(o)),
        (t.selectionStart = t.selectionEnd = n + e.length),
        updateLineNumbers(),
        (document.getElementById("output").innerHTML =
          '<span class="success">✓ Code pasted from clipboard!</span>'));
    })
    .catch(function () {
      document.getElementById("output").innerHTML =
        '<span class="error">⚠ Paste permission denied. Use Ctrl+V instead.</span>';
    });
}

function toggleTheme() {
  var e = document.body,
    n = document.getElementById("themeLabel");
  if (e.classList.contains("light")) {
    e.classList.remove("light");
    e.classList.add("dark");
    if (n) n.textContent = "Light";
    localStorage.setItem("theme", "dark");
  } else {
    e.classList.remove("dark");
    e.classList.add("light");
    if (n) n.textContent = "Dark";
    localStorage.setItem("theme", "light");
  }
}

function zoomEditor(e) {
  ((editorFontSize = Math.max(10, Math.min(24, editorFontSize + e))),
    (document.getElementById("editor").style.fontSize =
      editorFontSize + "px"),
    (document.getElementById("lineNumbers").style.fontSize =
      editorFontSize + "px"),
    (document.getElementById("lineNumbers").style.lineHeight =
      1.6 * editorFontSize + "px"),
    (document.getElementById("editor").style.lineHeight =
      1.6 * editorFontSize + "px"));
}

function zoomOutput(e) {
  ((outputFontSize = Math.max(10, Math.min(24, outputFontSize + e))),
    (document.getElementById("output").style.fontSize =
      outputFontSize + "px"));
}

document
  .getElementById("editor")
  .addEventListener("input", updateLineNumbers);
document.getElementById("editor").addEventListener("scroll", syncScroll);
document
  .getElementById("editor")
  .addEventListener("keydown", function (e) {
    if (
      ((e.ctrlKey || e.metaKey) &&
        "Enter" === e.key &&
        (e.preventDefault(), runCode()),
      (e.ctrlKey || e.metaKey) &&
        "s" === e.key &&
        (e.preventDefault(), saveCode()),
      "Tab" === e.key)
    ) {
      e.preventDefault();
      var t = this.selectionStart,
        n = this.selectionEnd;
      ((this.value =
        this.value.substring(0, t) + " " + this.value.substring(n)),
        (this.selectionStart = this.selectionEnd = t + 4),
        updateLineNumbers());
    }
  });
window.addEventListener("load", function () {
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
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        var points = (me && typeof me.points === "number") ? me.points : 0;
        var BADGES = [
          { name: "First Code", points: 10, icon: "✨" },
          { name: "Coder", points: 30, icon: "🐍" },
          { name: "Explorer", points: 50, icon: "🔍" },
          { name: "Script Soldier", points: 100, icon: "🎖️" },
          { name: "Builder", points: 200, icon: "🏗️" },
          { name: "Syntax Explorer", points: 500, icon: "🏆" },
          { name: "Master", points: 1000, icon: "👑" }
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
        topBarBrand.style.display = "";
        if (currentBadgeWrap) currentBadgeWrap.style.display = "none";
      });
  } else {
    if (topBarBrand) topBarBrand.style.display = "";
    if (currentBadgeWrap) currentBadgeWrap.style.display = "none";
  }

  initPyodide();
  updateLineNumbers();
});
