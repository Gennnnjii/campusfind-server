const express = require('express')

const Claim = require('../models/Claim')
const Item = require('../models/Item')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')

const router = express.Router()

router.get('/:id/claim-eligibility', asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id)
    .select('title description type status claimLocation category location dateOccurred')
    .populate('category location', 'name')

  if (!item) {
    throw new HttpError(404, 'Item not found')
  }

  const eligible = item.type === 'found' && item.status === 'available_for_claim'
  res.json({
    data: {
      item,
      eligible,
      reason: eligible ? null : 'Only Found items with Available for Claim status can receive claims.'
    }
  })
}))

router.get('/:id/claims', asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('_id title type status')
  if (!item) {
    throw new HttpError(404, 'Item not found')
  }

  const claims = await Claim.find({ item: item._id }).sort({ createdAt: -1 })
  res.json({ data: { item, claims } })
}))

module.exports = router
