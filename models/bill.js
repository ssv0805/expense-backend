const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    category: String,
    paymentMethod: String, // ✅ ADD THIS

    frequency: {
        type: String,
        enum: ["monthly", "weekly", "yearly"],
        default: "monthly"
    },

    dueDate: {
        type: Date, 
        required: true
    },

    nextDueDate: Date,
    lastPaidDate: Date,

    status: {
        type: String,
        enum: ["pending", "overdue", "paid_on_time", "paid_late"],
        default: "pending"
    },

    user: String
}, { timestamps: true });

module.exports = mongoose.model("Bill", billSchema);