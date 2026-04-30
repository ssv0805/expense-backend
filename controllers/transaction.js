const Transaction = require("../models/transaction");
const Bill = require("../models/bill");
const XLSX = require("xlsx");


//  EXPORT TRANSACTIONS
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


//  UPDATE TRANSACTION
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

        // BILL CATEGORY LOGIC
        if (req.body.category?.toLowerCase().trim() === "bills") {

            const cleanName = req.body.to.trim().toLowerCase();
            const today = req.body.date || new Date().toISOString().split("T")[0];
            const currentMonth = today.slice(0, 7);

            // ✅ revert old bill
            if (transaction.billId) {
                const oldBill = await Bill.findById(transaction.billId);

                if (oldBill && oldBill.name !== cleanName) {
                    oldBill.status = "unpaid";
                    oldBill.lastPaidDate = null;
                    oldBill.lastPaidMonth = null;
                    await oldBill.save();
                }
            }

            let bill = await Bill.findOne({
                name: cleanName,
                user: req.user.email,
                dueDate: { $regex: `^${currentMonth}` }
            });

            if (bill) {
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


//  ADD TRANSACTION (CLEAN)
const addTransaction = async (req, res) => {
    try {
        const today =
            req.body.date || new Date().toISOString().split("T")[0];

        const currentMonth = today.slice(0, 7);

        // BILL LOGIC
        if (req.body.category?.toLowerCase().trim() === "bills") {

            const cleanName = req.body.to.trim().toLowerCase();
            const today = req.body.date || new Date().toISOString().split("T")[0];
            const currentMonth = today.slice(0, 7);

            let linkedBill;

            const existingBill = await Bill.findOne({
                name: cleanName,
                user: req.user.email,
                dueDate: { $regex: `^${currentMonth}` }
            });

            if (existingBill) {
                if (
                    existingBill.status === "paid" &&
                    existingBill.lastPaidMonth === currentMonth
                ) {
                    return res.status(400).json({
                        message: "Bill already paid for this month"
                    });
                }

                existingBill.status = "paid";
                existingBill.lastPaidDate = today;
                existingBill.lastPaidMonth = currentMonth;

                await existingBill.save();
                linkedBill = existingBill;

            } else {
                // ✅ create ONLY if not exists
                linkedBill = await Bill.create({
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

            req.body.billId = linkedBill._id;
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

//  GET ALL TRANSACTIONS (NO PAGINATION)
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


//  GET TRANSACTIONS (WITH FILTER + PAGINATION)
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
            .populate("billId") // ✅ keep this
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


//  DELETE TRANSACTION (FIXED )
const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // ✅ If linked to bill → revert bill
        if (transaction.billId) {
            const bill = await Bill.findById(transaction.billId);

            if (bill) {
                bill.status = "unpaid";   // ✅ FIXED
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

//get categories
// GET DISTINCT CATEGORIES
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