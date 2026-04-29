const Bill = require("../models/bill");
const Transaction = require("../models/transaction");


// ✅ CREATE BILL
const createBill = async (req, res) => {
    try {

        console.log(req.body);
        const {
            name,
            amount,
            category,
            dueDate,
            frequency,
            paymentMethod
        } = req.body;

        const newBill = new Bill({
            name,
            amount,
            category,
            dueDate,
            frequency,
            paymentMethod,
            user: req.user.email
        });

        await newBill.save();

        res.status(201).json({
            message: "Bill created successfully",
            bill: newBill
        });


    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ✅ GET ALL BILLS
const getBills = async (req, res) => {
    try {
        const bills = await Bill.find({ user: req.user.email })
            .sort({ createdAt: -1 });

        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7);

        for (let bill of bills) {
            const dueMonth = bill.dueDate?.slice(0, 7);
            if (
                bill.frequency === "Monthly" &&
                bill.lastPaidMonth &&
                bill.lastPaidMonth !== currentMonth &&
                dueMonth !== currentMonth
            ) {

                // ✅ 1. reset status
                bill.status = "unpaid";

                // ✅ 2. clear paid date
                bill.lastPaidDate = null;

                // ✅ 3. update due date to next month (SAFE)
                const oldDue = new Date(bill.dueDate);

                const newMonth = oldDue.getMonth() + 1;
                const newYear = oldDue.getFullYear();

                // 🔥 get last day of next month
                const lastDay = new Date(newYear, newMonth + 1, 0).getDate();

                // keep same day OR adjust
                const newDay = Math.min(oldDue.getDate(), lastDay);

                const newDue = new Date(newYear, newMonth, newDay);

                bill.dueDate = newDue.toISOString().split("T")[0];
            }

            await bill.save();
        }
    

        // ✅ SEND UPDATED DATA
        res.status(200).json(bills);

} catch (err) {
    console.log("GET BILLS ERROR:", err);
    res.status(500).json({ message: err.message });
}
};


// PAY BILL (MAIN LOGIC )
const payBill = async (req, res) => {
    try {
        const { billId } = req.params;

        const bill = await Bill.findById(billId);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        // prevent duplicate payment
        if (bill.status === "paid") {
            return res.status(400).json({ message: "Bill already paid" });
        }

        // 1. Create transaction
        const transaction = new Transaction({
            date: new Date().toISOString(),
            type: "expense",
            category: bill.category,
            amount: bill.amount,
            payment: bill.paymentMethod,
            source: "bill",
            to: bill.name,
            user: req.user.email,
            billId: bill._id
        });

        await transaction.save();

        // 2. Update bill
        const now = new Date();


        bill.status = "paid";
        bill.lastPaidDate = new Date().toISOString().split("T")[0];
        bill.lastPaidMonth = new Date().toISOString().slice(0, 7);

        await bill.save();

        res.status(200).json({
            message: "Bill paid successfully",
            transaction
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// DELETE BILL
const deleteBill = async (req, res) => {
    try {
        const { billId } = req.params;

        const bill = await Bill.findByIdAndDelete(billId);

        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        res.status(200).json({ message: "Bill deleted successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// UPDATE BILL
const updateBill = async (req, res) => {
    try {
        const { billId } = req.params;

        const updatedBill = await Bill.findByIdAndUpdate(
            billId,
            req.body,
            { new: true }
        );

        if (!updatedBill) {
            return res.status(404).json({ message: "Bill not found" });
        }

        res.status(200).json({
            message: "Bill updated successfully",
            bill: updatedBill
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// MONTHLY RESET CHECK (IMPORTANT)
const resetBillsMonthly = async (req, res) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);

        const bills = await Bill.find({ user: req.user.email });

        for (let bill of bills) {
            if (
                bill.frequency === "monthly" &&
                bill.lastPaidMonth !== currentMonth
            ) {
                bill.status = "unpaid";
                await bill.save();
            }
        }

        res.status(200).json({
            message: "Bills checked for monthly reset"
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createBill,
    resetBillsMonthly,
    updateBill,
    deleteBill,
    payBill,
    getBills
}