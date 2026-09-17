let btn = document.getElementById("btn");
let spanError = document.getElementById("spanError");

class PassObjectCreator {
    constructor(pass) {
        this.pass = pass;
    }
}

btn.addEventListener("click", () => {

    let inpPassword = document.getElementById("inputPassword").value;

    let pass = new PassObjectCreator(inpPassword);

    fetch("/api/chack/pass", {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(pass)
    })
    .then((res) => {
        return res.json();
    })
    .then((data) => {
        console.log(data);
        if(data){
            window.location.href = "dashboard.html";
        }else{
            document.getElementById("inputPassword").value = "";
            spanError.classList.replace("d-none","d-block");
        }
    })
    .catch((err) => {
        console.log(err);
    });

});