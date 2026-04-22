const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema({
    user: String,
    category: String,
    amount: Number,
    month: String,
    year: Number
}, { timestamps: true });

module.exports = mongoose.model("Budget", budgetSchema);