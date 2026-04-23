const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    category: String,
    paymentMethod: String,

    frequency: {
        type: String,
        enum: ["monthly", "weekly", "yearly"],
        default: "monthly"
    },

    // ✅ CHANGE DATE → STRING
    dueDate: {
        type: String,
        required: true
    },

    nextDueDate: String,
    lastPaidDate: String,

    status: {
        type: String,
        enum: ["pending", "overdue", "paid_on_time", "paid_late"],
        default: "pending"
    },

    user: String
}, { timestamps: false }); 

module.exports = mongoose.model("Bill", billSchema);