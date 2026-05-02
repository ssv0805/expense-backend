const Transaction = require("../models/transaction");
const Bill = require("../models/bill");
const XLSX = require("xlsx");


// ================= EXPORT =================
const exportTransactions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Session expired. Please login again."
            });
        }

        const transactions = await Transaction.find({
            user: req.user.email
        });

        const data = transactions.map((t) => ({
            Date: t.date,
            Type: t.type,
            Category: t.category,
            Amount: t.amount,
            Payment: t.payment || "",
            Source: t.source || "",
            To: t.to || ""
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");

        const buffer = XLSX.write(wb, {
            type: "buffer",
            bookType: "xlsx"
        });

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=transactions.xlsx"
        );

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.send(buffer);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ================= ADD TRANSACTION =================
const addTransaction = async (req, res) => {
    try {
        const today =
            req.body.date || new Date().toISOString().split("T")[0];

        const currentMonth = today.slice(0, 7);

        // ===== BILL LOGIC =====
        if (req.body.category?.toLowerCase().trim() === "bills") {

            const cleanName = req.body.to.trim().toLowerCase();

            let bill = await Bill.findOne({
                name: cleanName,
                user: req.user.email,
                dueDate: { $regex: `^${currentMonth}` }
            });

            if (bill) {

                // 🚫 Prevent duplicate payment
                if (bill.status === "paid") {
                    return res.status(400).json({
                        message: "Bill already paid for this month"
                    });
                }

                // ✅ Mark unpaid bill as paid
                bill.status = "paid";
                bill.lastPaidDate = today;
                bill.lastPaidMonth = currentMonth;

                await bill.save();

            } else {
                // ✅ Create NEW bill if not exists
                bill = await Bill.create({
                    name: cleanName,
                    amount: req.body.amount,
                    paymentMethod: req.body.payment || "UPI",
                    category: "Bills",
                    dueDate: today,
                    frequency: "Monthly",
                    status: "paid",
                    lastPaidDate: today,
                    lastPaidMonth: currentMonth,
                    user: req.user.email
                });
            }

            // 🔒 LOCK values (feature 7)
            req.body.amount = bill.amount;
            req.body.payment = bill.paymentMethod;
            req.body.to = bill.name;

            req.body.billId = bill._id;
        }

        const transaction = new Transaction({
            ...req.body,
            user: req.user.email,
            date: today
        });

        const saved = await transaction.save();

        res.status(201).json(saved);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: err.message
        });
    }
};


// ================= UPDATE TRANSACTION =================
const updateTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        const today =
            req.body.date || new Date().toISOString().split("T")[0];

        const currentMonth = today.slice(0, 7);

        // ===== BILL LOGIC =====
        if (req.body.category?.toLowerCase().trim() === "bills") {

            const cleanName = req.body.to.trim().toLowerCase();

            // 🔁 STEP 1: revert old bill
            if (transaction.billId) {
                const oldBill = await Bill.findById(transaction.billId);

                if (oldBill) {
                    oldBill.status = "unpaid";
                    oldBill.lastPaidDate = null;
                    oldBill.lastPaidMonth = null;
                    await oldBill.save();
                }
            }

            // 🔎 STEP 2: find or create new bill
            let bill = await Bill.findOne({
                name: cleanName,
                user: req.user.email,
                dueDate: { $regex: `^${currentMonth}` }
            });

            if (bill) {

                if (bill.status === "paid") {
                    return res.status(400).json({
                        message: "Bill already paid for this month"
                    });
                }

                bill.status = "paid";
                bill.lastPaidDate = today;
                bill.lastPaidMonth = currentMonth;

                await bill.save();

            } else {

                bill = await Bill.create({
                    name: cleanName,
                    amount: req.body.amount,
                    paymentMethod: req.body.payment || "UPI",
                    category: "Bills",
                    dueDate: today,
                    frequency: "Monthly",
                    status: "paid",
                    lastPaidDate: today,
                    lastPaidMonth: currentMonth,
                    user: req.user.email
                });
            }

            // 🔒 LOCK values
            req.body.amount = bill.amount;
            req.body.payment = bill.paymentMethod;
            req.body.to = bill.name;

            req.body.billId = bill._id;
        }

        const updated = await Transaction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updated);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Update failed"
        });
    }
};


// ================= DELETE =================
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // 🔁 revert bill
        if (transaction.billId) {
            const bill = await Bill.findById(transaction.billId);

            if (bill) {
                bill.status = "unpaid";
                bill.lastPaidDate = null;
                bill.lastPaidMonth = null;
                await bill.save();
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json(err);
    }
};


// ================= GET =================
const getAllTransactions = async (req, res) => {
    try {
        const data = await Transaction.find({
            user: req.user.email
        }).sort({ date: -1 });

        res.json(data);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 7, category, type, month } = req.query;

        const query = { user: req.user.email };

        if (category) query.category = category;
        if (type) query.type = type;

        if (month) {
            const startDate = new Date(new Date().getFullYear(), month - 1, 1);
            const endDate = new Date(new Date().getFullYear(), month, 0);

            query.date = {
                $gte: startDate.toISOString().split("T")[0],
                $lte: endDate.toISOString().split("T")[0]
            };
        }

        const transactions = await Transaction.find(query)
            .populate("billId")
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Transaction.countDocuments(query);

        res.json({
            data: transactions,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        res.status(500).json(err);
    }
};


// ================= CATEGORIES =================
const getCategories = async (req, res) => {
    try {
        const { type } = req.query;

        const query = { user: req.user.email };

        if (type) {
            query.type = type;
        }

        const categories = await Transaction.distinct("category", query);

        res.json(categories);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


module.exports = {
    addTransaction,
    getTransactions,
    deleteTransaction,
    updateTransaction,
    exportTransactions,
    getAllTransactions,
    getCategories
};