const express = require('express')

const Claim = require('../models/Claim')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')
const { submitClaim, reviewClaim } = require('../services/claimWorkflow')

const router = express.Router()

router.get('/', asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) {
    if (!['Pending', 'Approved', 'Rejected'].includes(req.query.status)) {
      throw new HttpError(400, 'Invalid claim status filter')
    }
    filter.status = req.query.status
  }
  if (req.query.item) {
    filter.item = req.query.item
  }

  const claims = await Claim.find(filter)
    .populate('item', 'title type status claimLocation category location dateOccurred')
    .sort({ createdAt: -1 })

  res.json({ data: claims })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id)
    .populate({
      path: 'item',
      select: 'title description type status claimLocation category location dateOccurred',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'location', select: 'name' }
      ]
    })

  if (!claim) {
    throw new HttpError(404, 'Claim not found')
  }

  res.json({ data: claim })
}))

router.post('/', asyncHandler(async (req, res) => {
  const { item, claimantName, claimantEmail, proofDescription } = req.body
  const claim = await submitClaim({ item, claimantName, claimantEmail, proofDescription })
  res.status(201).json({
    data: claim,
    message: 'Claim submitted successfully. Keep your reference code for follow-up.'
  })
}))

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const claim = await reviewClaim({
    claimId: req.params.id,
    status: req.body.status,
    reviewNote: req.body.reviewNote
  })

  res.json({ data: claim, message: `Claim ${claim.status.toLowerCase()} successfully.` })
}))

module.exports = router
