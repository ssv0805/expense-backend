const Budget = require("../models/budget");

// ➕ ADD BUDGET
const addBudget = async (req, res) => {
    try {
        const { category, amount } = req.body;

        const now = new Date();

        const budget = new Budget({
            user: req.user.email,
            category,
            amount,
            month: now.toLocaleString("default", { month: "long" }),
            year: now.getFullYear()
        });

        const saved = await budget.save();
        res.status(201).json(saved);

    } catch (err) {
        res.status(500).json(err);
    }
};

// 📥 GET BUDGETS
const getBudgets = async (req, res) => {
    try {
        const budgets = await Budget.find({ user: req.user.email });
        res.json(budgets);
    } catch (err) {
        res.status(500).json(err);
    }
};

// ✏️ UPDATE
const updateBudget = async (req, res) => {
    try {
        const updated = await Budget.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json(err);
    }
};

// ❌ DELETE
const deleteBudget = async (req, res) => {
    try {
        await Budget.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json(err);
    }
};

module.exports = {
    addBudget,
    getBudgets,
    updateBudget,
    deleteBudget
};