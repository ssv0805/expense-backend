const Bill = require("../models/bill");
const Transaction=require("../models/transaction")

const addBill = async (req, res) => {
    try {
        const { name, amount, category, frequency, dueDate, paymentMethod } = req.body;

        const parsedDate = new Date(dueDate);

        if (isNaN(parsedDate)) {
            return res.status(400).json({ message: "Invalid date" });
        }

        const bill = new Bill({
            name,
            amount,
            category,
            frequency,
            paymentMethod,
            dueDate: parsedDate,

            // ✅ IMPORTANT
            nextDueDate: parsedDate,

            user: req.user.email
        });

        const saved = await bill.save();
        res.status(201).json(saved);

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};


const getBills = async (req, res) => {
    try {
        const bills = await Bill.find({ user: req.user.email });

        const today = new Date();

        const formattedBills = bills.map((bill) => {

            // mark overdue in memory (optional)
            if (
                bill.status !== "paid_on_time" &&
                bill.status !== "paid_late" &&
                new Date(bill.dueDate) < today
            ) {
                bill.status = "overdue";
            }

            return {
                ...bill._doc,

                
                dueDate: bill.dueDate
                    ? new Date(bill.dueDate).toISOString().split("T")[0]
                    : null,

                lastPaidDate: bill.lastPaidDate
                    ? new Date(bill.lastPaidDate).toISOString().split("T")[0]
                    : null,

                nextDueDate: bill.nextDueDate
                    ? new Date(bill.nextDueDate).toISOString().split("T")[0]
                    : null
            };
        });

        res.json(formattedBills);

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};


const payBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const today = new Date();
        const isLate = today > new Date(bill.dueDate);

        // 1️⃣ update bill
        bill.lastPaidDate = today;
        bill.status = isLate ? "paid_late" : "paid_on_time";

        await bill.save();

        // 2️⃣ CREATE EXPENSE TRANSACTION AUTOMATICALLY
        const transaction = new Transaction({
            date: today,
            type: "expense",
            category: bill.category,
            amount: bill.amount,
            payment: bill.paymentMethod,
            source: "bill",
            to: bill.name,
            user: req.user.email
        });

        await transaction.save();

        res.json({
            message: "Bill paid and transaction created",
            bill,
            transaction
        });

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};


// ❌ DELETE BILL
const deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        // ✅ delete related transactions
        await Transaction.deleteMany({
            to: bill.name,
            category: "Bills",
            user: req.user.email
        });

        // ✅ delete bill
        await Bill.findByIdAndDelete(req.params.id);

        res.json({ message: "Bill and related transactions deleted" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    addBill,
    getBills,
    payBill,
    deleteBill
};