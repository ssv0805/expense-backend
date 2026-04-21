const express = require("express");
const router = express.Router();
const auth =require ("../middleware/auth")

const {
    addTransaction,
    getTransactions,
    deleteTransaction
} = require("../controllers/transaction");

// routes
router.post("/",auth, addTransaction);
router.get("/",auth, getTransactions);
router.delete("/:id", auth, deleteTransaction);

module.exports = router;  