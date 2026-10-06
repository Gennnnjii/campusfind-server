const Claim = require('../models/Claim')
const Item = require('../models/Item')
const ActivityLog = require('../models/ActivityLog')
const HttpError = require('../utils/HttpError')
const runInTransaction = require('../utils/transaction')
const { generateClaimReference } = require('../utils/claimReference')

function assertClaimableItem(item) {
  if (!item) {
    throw new HttpError(404, 'Found item not found')
  }
  if (item.type !== 'Found') {
    throw new HttpError(400, 'Claims can only be submitted for Found items')
  }
  if (item.status !== 'Available for Claim') {
    throw new HttpError(400, 'This item is not available for claim')
  }
}

async function submitClaim(payload) {
  const claimId = await runInTransaction(async (session) => {
    const claim = new Claim({
      item: payload.item,
      claimantName: payload.claimantName,
      claimantEmail: payload.claimantEmail,
      proofDescription: payload.proofDescription,
      referenceCode: generateClaimReference()
    })
    await claim.validate()

    const item = await Item.findById(claim.item).session(session)
    assertClaimableItem(item)

    const existingPendingClaim = await Claim.exists({
      item: item._id,
      claimantEmail: claim.claimantEmail,
      status: 'Pending'
    }).session(session)

    if (existingPendingClaim) {
      throw new HttpError(400, 'You already have a pending claim for this item')
    }

    await claim.save({ session })

    await ActivityLog.create([{
      item: item._id,
      claim: claim._id,
      action: 'claim_submitted',
      message: `Claim ${claim.referenceCode} was submitted for ${item.title}.`
    }], { session })

    return claim._id
  })

  return Claim.findById(claimId)
    .populate('item', 'title type status claimLocation category location dateOccurred')
}

async function reviewClaim({ claimId, status, reviewNote = '' }) {
  if (!['Approved', 'Rejected'].includes(status)) {
    throw new HttpError(400, 'Status must be Approved or Rejected')
  }
  if (status === 'Rejected' && reviewNote.trim().length < 5) {
    throw new HttpError(400, 'A short review note is required when rejecting a claim')
  }

  await runInTransaction(async (session) => {
    const claim = await Claim.findById(claimId).session(session)
    if (!claim) {
      throw new HttpError(404, 'Claim not found')
    }
    if (claim.status !== 'Pending') {
      throw new HttpError(400, 'Only Pending claims can be reviewed')
    }

    const item = await Item.findById(claim.item).session(session)
    assertClaimableItem(item)

    claim.status = status
    claim.reviewNote = reviewNote.trim()
    claim.reviewedAt = new Date()
    await claim.save({ session })

    const logs = [{
      item: item._id,
      claim: claim._id,
      action: status === 'Approved' ? 'claim_approved' : 'claim_rejected',
      message: `Claim ${claim.referenceCode} was ${status.toLowerCase()}.`
    }]

    if (status === 'Approved') {
      const competingClaims = await Claim.find({
        _id: { $ne: claim._id },
        item: item._id,
        status: 'Pending'
      }).select('_id referenceCode').session(session)

      if (competingClaims.length > 0) {
        await Claim.updateMany(
          { _id: { $in: competingClaims.map((candidate) => candidate._id) } },
          {
            $set: {
              status: 'Rejected',
              reviewNote: 'Automatically closed because another claim was approved.',
              reviewedAt: new Date()
            }
          },
          { session, runValidators: true }
        )

        logs.push(...competingClaims.map((candidate) => ({
          item: item._id,
          claim: candidate._id,
          action: 'claim_rejected',
          message: `Claim ${candidate.referenceCode} was automatically rejected after another claim was approved.`
        })))
      }
    }

    await ActivityLog.insertMany(logs, { session })
  })

  return Claim.findById(claimId)
    .populate('item', 'title type status claimLocation category location dateOccurred')
}

module.exports = {
  assertClaimableItem,
  submitClaim,
  reviewClaim
}
