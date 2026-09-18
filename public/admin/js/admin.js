$(document).ready(function () {

    $("#sidebarToggle").click(function () {

        $("#sidebar").animate(
            {
                right: $("#sidebar").hasClass("closed")
                    ? "0px"
                    : "-270px"
            },
            300
        );

        $("#sidebar").toggleClass("closed");

        $("#sidebar").hasClass("closed")
            ? $("#mainContent").addClass("full-width")
            : $("#mainContent").removeClass("full-width");

    });

});