const Bill = require("../models/bill");
const Transaction = require("../models/transaction");

// ✅ helper (removes timestamp)
const formatDate = (date) => {
    return new Date(date).toISOString().split("T")[0];
};



// ➕ ADD BILL
const addBill = async (req, res) => {
    try {
        const { name, amount, category, frequency, dueDate, paymentMethod } = req.body;

        const formattedDate = formatDate(dueDate);

        const bill = new Bill({
            name,
            amount,
            category,
            frequency,
            paymentMethod,
            dueDate: formattedDate,
            nextDueDate: formattedDate,
            lastPaidDate: null,
            status: "pending",
            user: req.user.email
        });

        const saved = await bill.save();
        res.status(201).json(saved);

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};



// 📥 GET BILLS (CURRENT MONTH ONLY)
const getBills = async (req, res) => {
    try {
        const bills = await Bill.find({ user: req.user.email });

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const filteredBills = bills.filter((bill) => {
            if (!bill.dueDate) return false;

            const d = new Date(bill.dueDate);

            return (
                d.getMonth() === currentMonth &&
                d.getFullYear() === currentYear
            );
        });

        res.json(filteredBills);

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};



// 💸 PAY BILL
const payBill = async (req, res) => {
    try {
        const bill = await Bill.findById(req.params.id);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const today = formatDate(new Date());

        const isLate = new Date(today) > new Date(bill.dueDate);

        // ✅ update bill
        bill.lastPaidDate = today;
        bill.status = isLate ? "paid_late" : "paid_on_time";

        await bill.save();

        // ✅ create transaction automatically
        const transaction = new Transaction({
            date: today,
            type: "expense",
            category: "Bills",
            amount: bill.amount,
            payment: bill.paymentMethod,
            source: "bill",
            to: bill.name,
            user: req.user.email
        });

        await transaction.save();

        res.json({
            message: "Bill paid",
            bill,
            transaction
        });

    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
};



// ❌ DELETE BILL + RELATED TRANSACTIONS
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

        res.json({ message: "Bill and transactions deleted" });

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