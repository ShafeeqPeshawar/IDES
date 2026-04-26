(function () {
  var protocol = window.location.protocol;
  var hostname = window.location.hostname;
  var port = window.location.port || (protocol === "https:" ? "443" : "80");
  if (protocol === "file:") {
    window.API_BASE = "http://localhost:3000";
  } else if (hostname === "localhost" && port !== "3000") {
    window.API_BASE = "http://localhost:3000";
  } else {
    window.API_BASE = "";
  }

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
