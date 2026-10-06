const express = require('express')

const Category = require('../models/Category')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 })
  res.json({ data: categories })
}))

module.exports = router
