const express = require("express");
const router = express.Router();
const auth =require ("../middleware/auth")

const {
    addTransaction,
    getTransactions,
    deleteTransaction,
    updateTransaction,
    exportTransactions,
    getAllTransactions
} = require("../controllers/transaction");

// routes
router.post("/",auth, addTransaction);
router.get("/",auth, getTransactions);
router.delete("/:id", auth, deleteTransaction);
router.put("/:id",auth, updateTransaction);
router.get("/export", auth, exportTransactions);
router.get("/all",auth, getAllTransactions);

module.exports = router;  