const Claim = require('../models/Claim')
const Item = require('../models/Item')
const ActivityLog = require('../models/ActivityLog')
const HttpError = require('../utils/HttpError')
const runInTransaction = require('../utils/transaction')

async function confirmTurnover(itemId) {
  await runInTransaction(async (session) => {
    const item = await Item.findById(itemId).session(session)
    if (!item) {
      throw new HttpError(404, 'Found item not found')
    }
    if (item.type !== 'found' || item.status !== 'pending_turnover') {
      throw new HttpError(400, 'Only Found items awaiting turnover can be confirmed')
    }

    item.status = 'available_for_claim'
    await item.save({ session })

    await ActivityLog.create([{
      item: item._id,
      action: 'turnover_confirmed',
      message: `${item.title} was turned over to ${item.claimLocation} and is now available for claim.`
    }], { session })
  })

  return Item.findById(itemId).populate('category location', 'name')
}

async function markReturned(itemId) {
  await runInTransaction(async (session) => {
    const item = await Item.findById(itemId).session(session)
    if (!item) {
      throw new HttpError(404, 'Found item not found')
    }
    if (item.type !== 'found' || item.status !== 'available_for_claim') {
      throw new HttpError(400, 'Only an Available for Claim item can be marked Returned')
    }

    const approvedClaim = await Claim.findOne({
      item: item._id,
      status: 'approved'
    }).session(session)

    if (!approvedClaim) {
      throw new HttpError(400, 'An approved claim is required before this item can be returned')
    }

    item.status = 'returned'
    await item.save({ session })

    await ActivityLog.create([{
      item: item._id,
      claim: approvedClaim._id,
      action: 'item_returned',
      message: `${item.title} was released to the approved claimant and marked Returned.`
    }], { session })
  })

  return Item.findById(itemId).populate('category location', 'name')
}

module.exports = { confirmTurnover, markReturned }
