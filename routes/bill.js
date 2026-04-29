const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
    createBill,
    getBills,
    updateBill,
    deleteBill,
    payBill,
    resetBillsMonthly
} = require("../controllers/bill");


router.post("/", auth, createBill);
router.get("/", auth , getBills);
router.put("/:billId", auth , updateBill);
router.delete("/:billId", auth, deleteBill);
router.post("/pay/:billId",auth ,payBill);
router.get("/reset", auth, resetBillsMonthly);

module.exports = router;