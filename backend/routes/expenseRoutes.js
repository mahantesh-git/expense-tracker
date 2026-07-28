const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect, admin } = require('../middleware/auth');
const mongoose=require('mongoose')

// @route   POST /api/expenses
// @desc    Create an expense directly (Admin only)
//          Clients must use POST /api/expense-requests instead — direct writes are blocked.
// @access  Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { description, amount, splits, payer } = req.body;

    const expense = await Expense.create({
      description,
      amount,
      payer,
      splits
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/expenses
// @desc    Get expenses
// @access  Private (Admin sees all, Client sees own)
router.get('/', protect, async (req, res) => {
  try {
    let expenses;
    if (req.user.role === 'admin') {
      expenses = await Expense.find({}).populate('payer', 'username').populate('splits.user', 'username');
    } else {
      expenses = await Expense.find({
        $or: [
          { payer: req.user._id },
          { 'splits.user': req.user._id }
        ]
      }).populate('payer', 'username').populate('splits.user', 'username');
    }
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private (Admin only)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { description, amount, splits, payer } = req.body;
    const expense = await Expense.findById(req.params.id);

    if (expense) {
      expense.description = description || expense.description;
      expense.amount = amount || expense.amount;
      expense.splits = splits || expense.splits;
      expense.payer = payer || expense.payer;

      const updatedExpense = await expense.save();
      res.json(updatedExpense);
    } else {
      res.status(404).json({ message: 'Expense not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
