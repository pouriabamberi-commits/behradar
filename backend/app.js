
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post("/api/chack/pass" , (req,res)=>{

    const keys = [{T:true},{F:false}];
    let pass = Number(req.body.pass);
    console.log(pass);

    if(pass === 123){
        res.json(keys[0].T);
    }else{
        res.json(keys[1].F);
    }
    
});

app.listen(3000 , ()=>{
    console.log("I'm listening on port 3000");
});