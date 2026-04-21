const mongoose=require("mongoose")
const newSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    name:{
        type:String
    }
})

module.exports=mongoose.model("collection",newSchema)

