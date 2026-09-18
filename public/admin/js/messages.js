(function () {
  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function load() {
    Promise.all([
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/access-requests").then((r) => r.json()),
      fetch("/api/messages").then((r) => r.json()),
    ]).then(function (x) {
      var teachers = x[0],
        requests = x[1],
        messages = x[2];
      var me = window.__me;
      var sel = document.getElementById("receiver");
      sel.innerHTML = teachers
        .map(function (t) {
          return (
            '<option value="' +
            t.id +
            '">' +
            esc(t.full_name) +
            " — " +
            esc(t.phone) +
            "</option>"
          );
        })
        .join("");
      document.getElementById("requests").innerHTML =
        requests
          .map(function (r) {
            return (
              '<div class="request-card"><div class="d-flex justify-content-between"><strong>' +
              esc(r.full_name) +
              '</strong><span class="admin-chip">' +
              esc(
                r.status === "pending"
                  ? "در انتظار"
                  : r.status === "approved"
                  ? "تایید شده"
                  : "رد شده"
              ) +
              '</span></div><div class="small-muted mt-1" dir="ltr">' +
              esc(r.phone) +
              "</div>" +
              (r.status === "pending"
                ? '<div class="admin-actions mt-2"><button class="btn btn-sm btn-dark" data-req="' +
                  r.id +
                  '" data-decision="approve">تایید</button><button class="btn btn-sm btn-outline-danger" data-req="' +
                  r.id +
                  '" data-decision="reject">رد</button></div>'
                : "") +
              "</div>"
            );
          })
          .join("") || '<p class="text-muted small">درخواستی وجود ندارد.</p>';
      document.getElementById("inbox").innerHTML =
        messages
          .map(function (m) {
            return (
              '<div class="message-item ' +
              (m.is_read ? "" : "unread") +
              ' mb-2" data-message="' +
              m.id +
              '"><div class="d-flex justify-content-between"><strong>' +
              esc(m.sender_name) +
              '</strong><span class="small-muted">' +
              new Date(m.created_at).toLocaleString("fa-IR") +
              '</span></div><div class="small-muted">' +
              esc(m.subject || "بدون موضوع") +
              '</div><p class="mt-2 mb-1">' +
              esc(m.body) +
              '</p><button class="btn btn-sm btn-link p-0" data-read="' +
              m.id +
              '">علامت‌گذاری به عنوان خوانده‌شده</button></div>'
            );
          })
          .join("") || '<p class="text-muted small">پیامی ندارید.</p>';
    });
  }
  document
    .getElementById("messageForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_id: document.getElementById("receiver").value,
          subject: document.getElementById("subject").value,
          body: document.getElementById("body").value,
        }),
      })
        .then((r) => r.json())
        .then(function (x) {
          document.getElementById("sendResult").textContent = x.message;
          document.getElementById("sendResult").className =
            "small mt-2 " + (x.success ? "text-success" : "text-danger");
          if (x.success) document.getElementById("messageForm").reset();
          load();
        });
    });
  document.addEventListener("click", function (e) {
    var r = e.target.closest("[data-req]");
    if (r) {
      fetch("/api/access-requests/" + r.dataset.req + "/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: r.dataset.decision }),
      })
        .then(function (x) {
          return x.json();
        })
        .then(function () {
          load();
        });
    }
    var read = e.target.closest("[data-read]");
    if (read) {
      fetch("/api/messages/" + read.dataset.read + "/read", {
        method: "PUT",
      }).then(function () {
        load();
      });
    }
  });
  load();
})();
