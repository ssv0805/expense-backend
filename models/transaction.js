const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["income", "expense"], 
        required: true
    },
    category: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    payment: String,   
    source:{
        type:String, 
        
    }, 
    to: String,       
    user: {
        type: String,
        required: true
    },
    billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bill",
    default: null
},
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);