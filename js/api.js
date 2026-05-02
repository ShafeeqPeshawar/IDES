(function () {
  var protocol = window.location.protocol;
  var hostname = window.location.hostname;
  var port = window.location.port || (protocol === "https:" ? "443" : "80");
  var apiPort = "3000";
  if (protocol === "file:") {
    window.API_BASE = "http://localhost:" + apiPort;
  } else if (
    protocol === "http:" &&
    port !== apiPort &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    /* e.g. Live Server on :5500 — API must target igniUp server, not the static host */
    window.API_BASE = "http://localhost:" + apiPort;
  } else {
    window.API_BASE = "";
  }

  /** Join API_BASE with a path that starts with "/". Avoids `http://host//api/...` which returns 404. */
  window.apiUrl = function (path) {
    if (path == null || path === "") {
      return String(window.API_BASE || "").replace(/\/+$/, "");
    }
    var p = String(path);
    if (p.charAt(0) !== "/") p = "/" + p;
    var base = String(window.API_BASE || "").replace(/\/+$/, "");
    return base + p;
  };

  window.getAuthHeaders = function () {
    var token = localStorage.getItem("token");
    var headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    return headers;
  };

  window.isLoggedIn = function () {
    return !!localStorage.getItem("token");
  };

  window.getStoredUser = function () {
    try {
      var u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  };

  window.setStoredUser = function (user, token) {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    if (token) localStorage.setItem("token", token);
    if (user && user.name) localStorage.setItem("userName", user.name);
  };

  window.clearAuth = function () {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userName");
  };
})();
