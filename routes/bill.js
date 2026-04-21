const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
    addBill,
    getBills,
    payBill,
    deleteBill
} = require("../controllers/bill");

// routes
router.post("/", auth, addBill);
router.get("/", auth, getBills);
router.put("/:id/pay", auth, payBill);
router.delete("/:id", auth, deleteBill);

module.exports = router;