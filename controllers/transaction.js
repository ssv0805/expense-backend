const Transaction = require("../models/transaction");
const Bill = require("../models/bill");

const XLSX = require("xlsx");

const exportTransactions = async (req, res) => {
    try {
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


const updateTransaction = async (req, res) => {
    try {
        const updated = await Transaction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Update failed" });
    }
};



// ➕ ADD TRANSACTION
const addTransaction = async (req, res) => {
    try {
        const { category, amount, to ,paymentMethod,payment} = req.body;

        const today = new Date();

        
        if (category.toLowerCase() === "bills") {

            // find bill by name
            const bill = await Bill.findOne({
                name: to,
                user: req.user.email
            });

            if (bill) {

                
                if (
                    bill.status === "paid_on_time" ||
                    bill.status === "paid_late"
                ) {
                    return res.status(400).json({
                        message: "Bill already paid"
                    });
                }

                
                bill.lastPaidDate = today;

                if (today > new Date(bill.dueDate)) {
                    bill.status = "paid_late";
                } else {
                    bill.status = "paid_on_time";
                }

                await bill.save();

            } else {
                // ✅ if bill not found → create it
                const newBill = new Bill({
                    name: to,
                    amount,
                    paymentMethod:payment,
                    category: "Bills",
                    dueDate: today,
                    nextDueDate: today,
                    status: "paid_on_time",
                    lastPaidDate: today,
                    user: req.user.email
                });

                await newBill.save();
            }
        }

        // ✅ create transaction (normal)
        const transaction = new Transaction({
            ...req.body,
            user: req.user.email,
            date: req.body.date || new Date().toISOString().split("T")[0]
        });

        const saved = await transaction.save();

        res.status(201).json(saved);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: err.message });
    }
};



const getTransactions = async (req, res) => {
    try {
        const data = await Transaction.find({ user: req.user.email })
            .populate("billId"); // keep this

        res.json(data);
    } catch (err) {
        res.status(500).json(err);
    }
};



const deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        // revert bill if linked
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
    deleteTransaction,
    updateTransaction,
    exportTransactions
};