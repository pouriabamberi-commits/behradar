(function () {
  function applyUser(user) {
    document.querySelectorAll("[data-admin-name]").forEach(function (e) {
      e.textContent = user.full_name;
    });
    document.querySelectorAll("[data-admin-phone]").forEach(function (e) {
      e.textContent = user.phone;
    });
    document.body.classList.toggle("dark-mode", user.theme === "dark");
  }
  fetch("/api/auth/me")
    .then(function (r) {
      return r.json();
    })
    .then(function (x) {
      if (!x.authenticated) {
        location.href = "/admin/index.html";
        return;
      }
      applyUser(x.user);
    })
    .catch(function () {
      location.href = "/admin/index.html";
    });
  var toggle = document.getElementById("sidebarToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var s = document.getElementById("sidebar"),
        m = document.getElementById("mainContent");
      if (s) s.classList.toggle("closed");
      if (m) m.classList.toggle("full-width");
    });
  }
  document.addEventListener("click", function (e) {
    var logout = e.target.closest("[data-logout]");
    if (logout) {
      e.preventDefault();
      fetch("/api/auth/admin-logout", { method: "POST" }).then(function () {
        location.href = "/admin/index.html";
      });
    }
  });
})();
