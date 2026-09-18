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
  function size(n) {
    return n > 1048576
      ? (n / 1048576).toFixed(1) + " MB"
      : (n / 1024).toFixed(0) + " KB";
  }
  function load() {
    fetch("/api/files")
      .then((r) => r.json())
      .then(function (rows) {
        document.getElementById("filesList").innerHTML =
          rows
            .map(function (f) {
              return (
                '<div class="file-row"><div><strong>' +
                esc(f.title) +
                '</strong><div class="small-muted">' +
                esc(f.grade || "عمومی") +
                " · " +
                esc(f.category) +
                " · " +
                size(f.size) +
                '</div></div><div class="admin-actions"><a class="btn btn-sm btn-outline-dark" href="' +
                esc(f.file_path) +
                '" target="_blank">مشاهده</a><button class="btn btn-sm btn-outline-danger" data-del="' +
                f.id +
                '">حذف</button></div></div>'
              );
            })
            .join("") ||
          '<p class="text-muted small">هنوز فایلی آپلود نشده است.</p>';
      });
  }
  document.getElementById("fileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData();
    fd.append("title", document.getElementById("fileTitle").value);
    fd.append("grade", document.getElementById("fileGrade").value);
    fd.append("category", document.getElementById("fileCategory").value);
    fd.append("file", document.getElementById("fileInput").files[0]);
    fetch("/api/files", { method: "POST", body: fd })
      .then((r) => r.json())
      .then(function (x) {
        var out = document.getElementById("fileResult");
        out.textContent = x.message || "فایل آپلود شد.";
        out.className =
          "small mt-2 " + (x.success ? "text-success" : "text-danger");
        if (x.success) {
          e.target.reset();
          load();
        }
      });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]");
    if (!b) return;
    if (!confirm("این فایل حذف شود؟")) return;
    fetch("/api/files/" + b.dataset.del, { method: "DELETE" })
      .then((r) => r.json())
      .then(function (x) {
        if (!x.success) alert(x.message);
        load();
      });
  });
  load();
})();
