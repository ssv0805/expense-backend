const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    // keep SAME format as your transaction (String date)
    dueDate: {
        type: String,
        required: true
    },

    // recurring type
    frequency: {
        type: String,
        enum: ["Monthly", "Yearly", "One-time"],
        default: "Monthly"
    },

    // paid / unpaid only (overdue will be calculated)
    status: {
        type: String,
        enum: ["paid", "unpaid"],
        default: "unpaid"
    },

    // when last paid
    lastPaidDate: {
        type: String,
        default: null
    },

    // used for monthly reset logic
    lastPaidMonth: {
        type: String, // example: "2026-04"
        default: null
    },

    paymentMethod: {
        type: String,
        enum: ["UPI", "Cash", "Card", "NetBanking"],
        default: "UPI"
    },

    // SAME as your transaction model
    user: {
        type: String,
        required: true
    },
    billId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bill",
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model("Bill", billSchema);