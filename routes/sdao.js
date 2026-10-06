const express = require('express')

const Item = require('../models/Item')
const Claim = require('../models/Claim')
const asyncHandler = require('../utils/asyncHandler')
const { confirmTurnover, markReturned } = require('../services/sdaoWorkflow')

const router = express.Router()

router.get('/overview', asyncHandler(async (req, res) => {
  const itemPopulate = [
    { path: 'category', select: 'name' },
    { path: 'location', select: 'name' }
  ]
  const claimPopulate = {
    path: 'item',
    select: 'title type status claimLocation category location dateOccurred',
    populate: itemPopulate
  }

  const [awaitingTurnover, availableForClaim, pendingClaims, approvedClaims, returnedItems] = await Promise.all([
    Item.find({ type: 'Found', status: 'Pending Turnover' }).populate(itemPopulate).sort({ createdAt: -1 }),
    Item.find({ type: 'Found', status: 'Available for Claim' }).populate(itemPopulate).sort({ createdAt: -1 }),
    Claim.find({ status: 'Pending' }).populate(claimPopulate).sort({ createdAt: -1 }),
    Claim.find({ status: 'Approved' }).populate(claimPopulate).sort({ reviewedAt: -1 }),
    Item.find({ type: 'Found', status: 'Returned' }).populate(itemPopulate).sort({ updatedAt: -1 })
  ])

  res.json({
    data: {
      counts: {
        awaitingTurnover: awaitingTurnover.length,
        availableForClaim: availableForClaim.length,
        pendingClaims: pendingClaims.length,
        approvedClaims: approvedClaims.length,
        returnedItems: returnedItems.length
      },
      awaitingTurnover,
      availableForClaim,
      pendingClaims,
      approvedClaims,
      returnedItems
    }
  })
}))

router.patch('/items/:id/turnover', asyncHandler(async (req, res) => {
  const item = await confirmTurnover(req.params.id)
  res.json({ data: item, message: 'Turnover confirmed. The item is now available for claim.' })
}))

router.patch('/items/:id/return', asyncHandler(async (req, res) => {
  const item = await markReturned(req.params.id)
  res.json({ data: item, message: 'Item marked Returned successfully.' })
}))

module.exports = router
