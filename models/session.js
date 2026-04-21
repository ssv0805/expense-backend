const mongoose =require("mongoose")

const sessionSchema=new mongoose.Schema({
    sessionId:String,
    email:String,
    createdAt:{
        type:Date,
        default:Date.now,
        expires:60*60*24
    }
})

module.exports=mongoose.model("Session",sessionSchema)