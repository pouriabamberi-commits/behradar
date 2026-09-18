$(document).ready(function () {


    // =========================
    // SEARCH ARTICLES
    // =========================

    $("#articleSearch").on("keyup", function () {

        let searchText = $(this).val().toLowerCase();

        filterArticles(searchText);

    });



    // =========================
    // FILTER STATUS
    // =========================

    $("#articleStatusFilter").change(function () {

        let searchText = $("#articleSearch")
            .val()
            .toLowerCase();

        filterArticles(searchText);

    });



    // =========================
    // FILTER FUNCTION
    // =========================

    function filterArticles(searchText) {

        let selectedStatus =
            $("#articleStatusFilter").val();

        let visibleArticles = 0;


        $("#articlesTable tr").each(function () {

            let articleTitle =
                $(this).data("title").toLowerCase();

            let articleStatus =
                $(this).data("status");


            let titleMatches =
                articleTitle.includes(searchText);


            let statusMatches =
                selectedStatus === "all" ||
                selectedStatus === articleStatus;


            if (titleMatches && statusMatches) {

                $(this).show();

                visibleArticles++;

            } else {

                $(this).hide();

            }

        });


        // Update count

        $("#articleCount").text(
            visibleArticles + " مقاله"
        );


        // Empty state

        if (visibleArticles === 0) {

            $("#emptyArticles").fadeIn(200);

        } else {

            $("#emptyArticles").hide();

        }

    }



    // =========================
    // DELETE ARTICLE
    // =========================

    $(document).on(
        "click",
        ".delete-article",
        function () {

            let row = $(this).closest("tr");

            let articleTitle =
                row.data("title");


            let confirmDelete = confirm(
                "آیا مطمئن هستید که می‌خواهید مقاله «" +
                articleTitle +
                "» را حذف کنید؟"
            );


            if (confirmDelete) {

                row.fadeOut(300, function () {

                    $(this).remove();

                    filterArticles(
                        $("#articleSearch")
                            .val()
                            .toLowerCase()
                    );

                });

            }

        }
    );


});