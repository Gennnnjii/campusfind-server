const express = require('express')
const mongoose = require('mongoose')

const Item = require('../models/Item')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')

const router = express.Router()

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

router.get('/', asyncHandler(async (req, res) => {
  const { search, type, status, category, location } = req.query

  const query = {}

  if (search !== undefined) {
    if (typeof search !== 'string') {
      throw new HttpError(400, 'Invalid search filter')
    }
    const trimmed = search.trim()
    if (trimmed.length > 120) {
      throw new HttpError(400, 'Search must not exceed 120 characters')
    }
    if (trimmed.length > 0) {
      const escapedSearch = escapeRegex(trimmed)
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } }
      ]
    }
  }

  if (type !== undefined) {
    if (typeof type !== 'string' || !['lost', 'found'].includes(type)) {
      throw new HttpError(400, 'Invalid item type filter')
    }
    query.type = type
  }

  if (status !== undefined) {
    const validStatuses = ['open', 'recovered', 'pending_turnover', 'available_for_claim', 'returned']
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      throw new HttpError(400, 'Invalid item status filter')
    }
    query.status = status
  }

  if (category !== undefined) {
    if (typeof category !== 'string' || !mongoose.isValidObjectId(category)) {
      throw new HttpError(400, 'Invalid category filter')
    }
    query.category = category
  }

  if (location !== undefined) {
    if (typeof location !== 'string' || !mongoose.isValidObjectId(location)) {
      throw new HttpError(400, 'Invalid location filter')
    }
    query.location = location
  }

  const items = await Item.find(query)
    .populate('category', '_id name description isActive')
    .populate('location', '_id name description isActive')
    .sort({ createdAt: -1 })

  res.json({ data: items })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid item ID')
  }

  const item = await Item.findById(req.params.id)
    .populate('category', '_id name description isActive')
    .populate('location', '_id name description isActive')

  if (!item) {
    throw new HttpError(404, 'Item not found')
  }

  res.json({ data: item })
}))

module.exports = router
