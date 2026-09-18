(function () {
  var box = document.getElementById("articleBlocks");
  fetch("/api/profile")
    .then(function (r) {
      return r.json();
    })
    .then(function (u) {
      var j = document.getElementById("authorJob");
      if (j) j.value = u.author_job || "مدرس ارشد زبان انگلیسی";
    });
  function esc(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function add(type) {
    var d = document.createElement("div");
    d.className = "article-builder-block";
    d.dataset.type = type;
    if (type === "paragraph")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>پاراگراف</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><textarea class="form-control body" rows="5" placeholder="متن پاراگراف..." required></textarea>';
    if (type === "heading")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>تیتر فرعی</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><input class="form-control body" placeholder="عنوان بخش..." required>';
    if (type === "highlight")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>نکته مهم</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><input class="form-control title mb-2" placeholder="عنوان نکته"><textarea class="form-control body" rows="4" placeholder="متن نکته..." required></textarea>';
    if (type === "list")
      d.innerHTML =
        '<div class="d-flex justify-content-between mb-2"><b>لیست شماره‌دار</b><button type="button" class="btn btn-sm btn-outline-danger remove">حذف</button></div><textarea class="form-control body" rows="5" placeholder="هر مورد در یک خط..." required></textarea>';
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
  add("paragraph");
  document
    .getElementById("articleCreateForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      var blocks = [];
      box.querySelectorAll(".article-builder-block").forEach(function (d) {
        var type = d.dataset.type;
        var body = d.querySelector(".body").value.trim();
        if (!body) return;
        if (type === "list") {
          blocks.push({
            type: type,
            body: JSON.stringify(
              body
                .split("\n")
                .map(function (x) {
                  return x.trim();
                })
                .filter(Boolean)
            ),
          });
        } else blocks.push({ type: type, title: d.querySelector(".title") ? d.querySelector(".title").value.trim() : "", body: body });
      });
      if (!blocks.length) {
        alert("حداقل یک بلوک مقاله لازم است.");
        return;
      }
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
      fd.append("author_job", document.getElementById("authorJob").value);
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
      var image = document.getElementById("articleImage");
      if (image.files[0]) fd.append("image", image.files[0]);
      fetch("/api/articles", { method: "POST", body: fd })
        .then(function (r) {
          return r.json().then(function (x) {
            return { ok: r.ok, data: x };
          });
        })
        .then(function (x) {
          if (!x.ok) throw new Error(x.data.message || "خطا");
          alert("مقاله ذخیره شد.");
          location.href = "articles.html";
        })
        .catch(function (err) {
          alert(err.message);
        });
    });
})();
