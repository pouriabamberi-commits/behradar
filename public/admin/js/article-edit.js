(function () {
  var id = new URLSearchParams(location.search).get("id"),
    box = document.getElementById("articleBlocks");
  function esc(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function add(type, data) {
    var d = document.createElement("div");
    d.className = "article-builder-block";
    d.dataset.type = type;
    data = data || {};
    var body = data.body || "";
    if (type === "list") {
      try {
        body = JSON.parse(body).join("\n");
      } catch (e) {}
    }
    if (type === "paragraph")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>پاراگراف</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><textarea class="form-control body" rows="5" required>' +
        esc(body) +
        "</textarea>";
    if (type === "heading")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>تیتر فرعی</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><input class="form-control body" value="' +
        esc(body) +
        '" required>';
    if (type === "highlight")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>نکته مهم</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><input class="form-control title mb-2" value="' +
        esc(data.title || "") +
        '"><textarea class="form-control body" rows="4" required>' +
        esc(body) +
        "</textarea>";
    if (type === "list")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>لیست شماره‌دار</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><textarea class="form-control body" rows="5" required>' +
        esc(body) +
        "</textarea>";
    box.appendChild(d);
  }
  document.querySelectorAll("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      add(b.dataset.add);
    });
  });
  box.addEventListener("click", function (e) {
    if (e.target.closest(".remove"))
      e.target.closest(".article-builder-block").remove();
  });
  fetch("/api/articles/" + id)
    .then((r) => r.json())
    .then(function (a) {
      document.getElementById("articleTitle").value = a.title;
      document.getElementById("articleCategory").value = a.category;
      document.getElementById("articleStatus").value = a.status;
      document.getElementById("articleSummary").value = a.summary;
      document.getElementById("readingTime").value = a.reading_time;
      document.getElementById("articleTags").value = (a.tags || []).join(", ");
      (a.blocks || []).forEach(function (b) {
        add(b.block_type, b);
      });
    });
  document
    .getElementById("articleCreateForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      var blocks = [];
      box.querySelectorAll(".article-builder-block").forEach(function (d) {
        var type = d.dataset.type,
          body = d.querySelector(".body").value.trim();
        if (!body) return;
        blocks.push({
          type: type,
          title: d.querySelector(".title")
            ? d.querySelector(".title").value.trim()
            : "",
          body:
            type === "list"
              ? JSON.stringify(
                  body
                    .split("\n")
                    .map(function (x) {
                      return x.trim();
                    })
                    .filter(Boolean)
                )
              : body,
        });
      });
      var fd = new FormData();
      fd.append("title", document.getElementById("articleTitle").value);
      fd.append("category", document.getElementById("articleCategory").value);
      fd.append(
        "category_label",
        document.getElementById("articleCategory").selectedOptions[0]
          .textContent
      );
      fd.append("status", document.getElementById("articleStatus").value);
      fd.append("summary", document.getElementById("articleSummary").value);
      fd.append("reading_time", document.getElementById("readingTime").value);
      fd.append(
        "tags",
        JSON.stringify(
          document
            .getElementById("articleTags")
            .value.split(",")
            .map(function (x) {
              return x.trim();
            })
            .filter(Boolean)
        )
      );
      fd.append("blocks", JSON.stringify(blocks));
      var file = document.getElementById("articleImage");
      if (file.files[0]) fd.append("image", file.files[0]);
      fetch("/api/articles/" + id, { method: "PUT", body: fd })
        .then((r) => r.json())
        .then(function (x) {
          if (!x.success) throw new Error(x.message);
          alert("مقاله ویرایش شد.");
          location.href = "articles.html";
        })
        .catch(function (e) {
          alert(e.message);
        });
    });
})();
