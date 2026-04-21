const Transaction = require("../models/transaction");
const Bill = require("../models/bill")

// ➕ ADD TRANSACTION
const addTransaction = async (req, res) => {
    try {
        const { type, amount, category, note, billId, paymentMethod } = req.body;

        // 1️⃣ Create transaction
        const transaction = new Transaction({
            type,
            amount,
            category,
            note,
            paymentMethod,
            billId: billId || null,
            user: req.user.email
        });

        const saved = await transaction.save();

        // 2️⃣ IF THIS TRANSACTION IS FOR A BILL → UPDATE BILL
        if (billId) {
            const bill = await Bill.findById(billId);

            if (bill) {
                const today = new Date();

                // check if paid after due date
                const isLate = today > new Date(bill.nextDueDate);

                bill.lastPaidDate = today;

                // next due date logic (monthly)
                const nextDate = new Date(bill.nextDueDate);
                nextDate.setMonth(nextDate.getMonth() + 1);

                bill.nextDueDate = nextDate;

                bill.status = isLate ? "paid-late" : "paid";

                await bill.save();
                
            }
        }

        res.status(201).json(saved);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: err.message });
    }
};


// 📥 GET TRANSACTIONS
const getTransactions = async (req, res) => {
    try {
        const data = await Transaction.find({ user: req.user.email })
            .populate("billId"); // 👈 IMPORTANT (for frontend)

        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
};


// ❌ DELETE TRANSACTION
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        // if deleting a bill-linked transaction → revert bill
        if (transaction?.billId) {
            const bill = await Bill.findById(transaction.billId);

            if (bill) {
                bill.status = "pending";
                bill.lastPaidDate = null;
                await bill.save();
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json(err);
    }
};

module.exports = {
    addTransaction,
    getTransactions,
    deleteTransaction
};