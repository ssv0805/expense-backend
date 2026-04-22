const router = require("express").Router();
const {
    addBudget,
    getBudgets,
    updateBudget,
    deleteBudget
} = require("../controllers/budget");
const auth = require("../middleware/auth");

router.post("/", auth, addBudget);
router.get("/", auth, getBudgets);
router.put("/:id", auth, updateBudget);
router.delete("/:id", auth, deleteBudget);

module.exports = router;