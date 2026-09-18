(function () {
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function date(v) {
    return new Date(v).toLocaleDateString("fa-IR");
  }
  function load() {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/access-requests").then((r) => r.json()),
    ]).then(function (x) {
      var s = x[0],
        students = x[1],
        req = x[2];
      document.getElementById("statStudents").textContent = s.students;
      document.getElementById("statTeachers").textContent = s.teachers;
      document.getElementById("statArticles").textContent = s.articles;
      document.getElementById("statMessages").textContent = s.unread_messages;
      document.getElementById("messageBadge").textContent = s.unread_messages;
      document.getElementById("notifCount").textContent = s.pending_requests;
      var tb = document.getElementById("recentStudents");
      tb.innerHTML =
        students
          .slice(0, 6)
          .map(function (u) {
            return (
              '<tr><td><div class="table-user"><div class="mini-avatar">' +
              esc(u.full_name.charAt(0)) +
              "</div><strong>" +
              esc(u.full_name) +
              '</strong></div></td><td dir="ltr">' +
              esc(u.phone) +
              "</td><td>" +
              date(u.created_at) +
              "</td></tr>"
            );
          })
          .join("") ||
        '<tr><td colspan="3" class="text-center text-muted">هنوز زبان‌آموزی ثبت نشده است.</td></tr>';
      var box = document.getElementById("accessRequests");
      var pending = req.filter(function (r) {
        return r.status === "pending";
      });
      box.innerHTML =
        pending
          .slice(0, 5)
          .map(function (r) {
            return (
              '<div class="request-card"><div class="d-flex justify-content-between gap-2"><strong>' +
              esc(r.full_name) +
              '</strong><span class="admin-chip">در انتظار</span></div><div class="small-muted mt-1" dir="ltr">' +
              esc(r.phone) +
              '</div><div class="admin-actions mt-3"><button class="btn btn-sm btn-dark" data-decision="approve" data-id="' +
              r.id +
              '">تایید دسترسی</button><button class="btn btn-sm btn-outline-danger" data-decision="reject" data-id="' +
              r.id +
              '">رد درخواست</button></div></div>'
            );
          })
          .join("") ||
        '<div class="text-center text-muted small py-4">درخواست معلقی وجود ندارد.</div>';
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-decision]");
    if (!b) return;
    fetch("/api/access-requests/" + b.getAttribute("data-id") + "/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: b.getAttribute("data-decision") }),
    })
      .then((r) => r.json())
      .then(function (x) {
        alert(x.message || "انجام شد");
        load();
      });
  });
  load();
})();
