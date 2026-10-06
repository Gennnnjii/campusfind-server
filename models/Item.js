const mongoose = require('mongoose')

const ITEM_TYPES = ['lost', 'found']
const LOST_STATUSES = ['open', 'recovered']
const FOUND_STATUSES = ['pending_turnover', 'available_for_claim', 'returned']
const ITEM_STATUSES = [...LOST_STATUSES, ...FOUND_STATUSES]

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 120
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1200
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  type: {
    type: String,
    enum: ITEM_TYPES,
    required: true
  },
  dateOccurred: {
    type: Date,
    required: true,
    validate: {
      validator: (value) => value <= new Date(),
      message: 'Date occurred cannot be in the future'
    }
  },
  status: {
    type: String,
    enum: ITEM_STATUSES,
    required: true
  },
  claimLocation: {
    type: String,
    trim: true,
    default: 'SDAO',
    maxlength: 100
  }
}, {
  timestamps: true
})

itemSchema.pre('validate', function validateStatus() {
  const allowedStatuses = this.type === 'lost' ? LOST_STATUSES : FOUND_STATUSES
  if (this.type && this.status && !allowedStatuses.includes(this.status)) {
    this.invalidate('status', `${this.status} is not valid for a ${this.type} item`)
  }
})

itemSchema.index({ type: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('Item', itemSchema)
module.exports.ITEM_TYPES = ITEM_TYPES
module.exports.LOST_STATUSES = LOST_STATUSES
module.exports.FOUND_STATUSES = FOUND_STATUSES
