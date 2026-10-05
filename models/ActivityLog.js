const mongoose = require('mongoose')

const ACTIVITY_ACTIONS = [
  'report_created',
  'turnover_confirmed',
  'claim_submitted',
  'claim_approved',
  'claim_rejected',
  'item_returned',
  'item_recovered'
]

const activityLogSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  claim: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Claim',
    default: null,
    index: true
  },
  action: {
    type: String,
    enum: ACTIVITY_ACTIONS,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  }
}, {
  timestamps: true
})

activityLogSchema.index({ createdAt: -1 })

module.exports = mongoose.model('ActivityLog', activityLogSchema)
module.exports.ACTIVITY_ACTIONS = ACTIVITY_ACTIONS
