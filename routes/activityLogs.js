const express = require('express')

const ActivityLog = require('../models/ActivityLog')
const { ACTIVITY_ACTIONS } = require('../models/ActivityLog')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.action) {
    if (!ACTIVITY_ACTIONS.includes(req.query.action)) {
      throw new HttpError(400, 'Invalid activity action filter')
    }
    filter.action = req.query.action
  }
  if (req.query.item) filter.item = req.query.item
  if (req.query.claim) filter.claim = req.query.claim
  if (req.query.before) {
    const before = new Date(req.query.before)
    if (Number.isNaN(before.getTime())) {
      throw new HttpError(400, 'Invalid before date')
    }
    filter.createdAt = { $lt: before }
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50

  const logs = await ActivityLog.find(filter)
    .populate('item', 'title type status')
    .populate('claim', 'referenceCode status')
    .sort({ createdAt: -1 })
    .limit(limit)

  res.json({ data: logs })
}))

module.exports = router
