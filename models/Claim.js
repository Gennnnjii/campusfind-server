const mongoose = require('mongoose')

const CLAIM_STATUSES = ['Pending', 'Approved', 'Rejected']

const claimSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  claimantName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  claimantEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address']
  },
  proofDescription: {
    type: String,
    required: true,
    trim: true,
    minlength: 20,
    maxlength: 1200
  },
  referenceCode: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    trim: true,
    match: [/^CF-\d{8}-[A-F0-9]{6}$/, 'Invalid claim reference format']
  },
  status: {
    type: String,
    enum: CLAIM_STATUSES,
    default: 'Pending',
    required: true,
    index: true
  },
  reviewNote: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  reviewedAt: Date
}, {
  timestamps: true
})

claimSchema.index(
  { item: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Approved' },
    name: 'one_approved_claim_per_item'
  }
)

claimSchema.index(
  { item: 1, claimantEmail: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Pending' },
    name: 'one_pending_claim_per_email_item'
  }
)

module.exports = mongoose.model('Claim', claimSchema)
module.exports.CLAIM_STATUSES = CLAIM_STATUSES
