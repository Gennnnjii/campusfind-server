const express = require('express')

const Location = require('../models/Location')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
  const locations = await Location.find({ isActive: true }).sort({ name: 1 })
  res.json({ data: locations })
}))

module.exports = router
