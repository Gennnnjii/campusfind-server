const express = require('express')
const mongoose = require('mongoose')

const Item = require('../models/Item')
const Category = require('../models/Category')
const Location = require('../models/Location')
const ActivityLog = require('../models/ActivityLog')
const Claim = require('../models/Claim')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')
const runInTransaction = require('../utils/transaction')
const { confirmTurnover, markReturned } = require('../services/sdaoWorkflow')
const { resolveItemStatusTransition } = require('../services/itemStatusWorkflow')
const { findPossibleMatches } = require('../services/itemMatching')

const router = express.Router()

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

router.post('/', asyncHandler(async (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }

  const { title, description, category, location, type, dateOccurred } = body
  const errors = []

  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) {
    errors.push('Title must be between 3 and 120 characters')
  }
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 1200) {
    errors.push('Description must be between 10 and 1200 characters')
  }
  if (!['lost', 'found'].includes(type)) {
    errors.push('Type must be lost or found')
  }
  if (typeof category !== 'string' || !mongoose.isValidObjectId(category)) {
    errors.push('A valid category is required')
  }
  if (typeof location !== 'string' || !mongoose.isValidObjectId(location)) {
    errors.push('A valid location is required')
  }
  const parsedDate = typeof dateOccurred === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOccurred)
    ? new Date(`${dateOccurred}T00:00:00.000Z`)
    : null
  const isValidDate = parsedDate && parsedDate.toISOString().slice(0, 10) === dateOccurred
  if (!isValidDate) {
    errors.push('A valid date occurred is required')
  } else if (parsedDate > new Date()) {
    errors.push('Date occurred cannot be in the future')
  }
  if (errors.length) throw new HttpError(400, 'Validation failed', errors)

  const createdItem = await runInTransaction(async (session) => {
    const categoryRecord = await Category.findOne({ _id: category, isActive: true }).session(session)
    const locationRecord = await Location.findOne({ _id: location, isActive: true }).session(session)
    if (!categoryRecord) throw new HttpError(400, 'Selected category is unavailable')
    if (!locationRecord) throw new HttpError(400, 'Selected location is unavailable')

    const [item] = await Item.create([{
      title: title.trim(),
      description: description.trim(),
      category: categoryRecord._id,
      location: locationRecord._id,
      type,
      dateOccurred: parsedDate,
      status: type === 'lost' ? 'open' : 'pending_turnover'
    }], { session })

    await ActivityLog.create([{
      item: item._id,
      action: 'report_created',
      message: `${type === 'lost' ? 'Lost' : 'Found'} item report created: ${item.title}`
    }], { session })

    return item
  })

  const item = await Item.findById(createdItem._id)
    .populate('category', '_id name description isActive')
    .populate('location', '_id name description isActive')

  res.status(201).json({ data: item, message: 'Item report created successfully.' })
}))

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

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid item ID')
  }

  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }

  const editableFields = ['title', 'description', 'category', 'location', 'type', 'dateOccurred']
  const unsupportedFields = Object.keys(body).filter((field) => !editableFields.includes(field))
  if (unsupportedFields.length) {
    throw new HttpError(400, 'Unsupported item fields', unsupportedFields)
  }
  if (!Object.keys(body).length) {
    throw new HttpError(400, 'Provide at least one item field to update')
  }

  const item = await Item.findById(req.params.id)
  if (!item) throw new HttpError(404, 'Item not found')

  const errors = []
  if (Object.hasOwn(body, 'title') && (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 120)) {
    errors.push('Title must be between 3 and 120 characters')
  }
  if (Object.hasOwn(body, 'description') && (typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.trim().length > 1200)) {
    errors.push('Description must be between 10 and 1200 characters')
  }
  if (Object.hasOwn(body, 'type') && body.type !== item.type) {
    errors.push('Report type cannot be changed after creation')
  }
  if (Object.hasOwn(body, 'category') && (typeof body.category !== 'string' || !mongoose.isValidObjectId(body.category))) {
    errors.push('A valid category is required')
  }
  if (Object.hasOwn(body, 'location') && (typeof body.location !== 'string' || !mongoose.isValidObjectId(body.location))) {
    errors.push('A valid location is required')
  }

  let parsedDate
  if (Object.hasOwn(body, 'dateOccurred')) {
    parsedDate = typeof body.dateOccurred === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateOccurred)
      ? new Date(`${body.dateOccurred}T00:00:00.000Z`)
      : null
    const isValidDate = parsedDate && parsedDate.toISOString().slice(0, 10) === body.dateOccurred
    if (!isValidDate) {
      errors.push('A valid date occurred is required')
    } else if (parsedDate > new Date()) {
      errors.push('Date occurred cannot be in the future')
    }
  }
  if (errors.length) throw new HttpError(400, 'Validation failed', errors)

  if (Object.hasOwn(body, 'category') && body.category !== String(item.category)) {
    const category = await Category.findOne({ _id: body.category, isActive: true })
    if (!category) throw new HttpError(400, 'Selected category is unavailable')
    item.category = category._id
  }
  if (Object.hasOwn(body, 'location') && body.location !== String(item.location)) {
    const location = await Location.findOne({ _id: body.location, isActive: true })
    if (!location) throw new HttpError(400, 'Selected location is unavailable')
    item.location = location._id
  }

  if (Object.hasOwn(body, 'title')) item.title = body.title.trim()
  if (Object.hasOwn(body, 'description')) item.description = body.description.trim()
  if (Object.hasOwn(body, 'dateOccurred')) item.dateOccurred = parsedDate
  await item.save()

  const updatedItem = await Item.findById(item._id)
    .populate('category', '_id name description isActive')
    .populate('location', '_id name description isActive')

  res.json({ data: updatedItem, message: 'Item report updated successfully.' })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid item ID')
  }

  await runInTransaction(async (session) => {
    const item = await Item.findById(req.params.id).session(session)
    if (!item) throw new HttpError(404, 'Item not found')

    const hasClaims = await Claim.exists({ item: item._id }).session(session)
    if (hasClaims) {
      throw new HttpError(400, 'Items with claim history cannot be deleted')
    }

    await ActivityLog.deleteMany({ item: item._id }, { session })
    await item.deleteOne({ session })
  })

  res.json({ data: { _id: req.params.id }, message: 'Item report deleted successfully.' })
}))

router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid item ID')
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  const unsupportedFields = Object.keys(req.body).filter((field) => field !== 'status')
  if (unsupportedFields.length) {
    throw new HttpError(400, 'Unsupported status transition fields', unsupportedFields)
  }

  const { status } = req.body
  if (!['recovered', 'available_for_claim', 'returned'].includes(status)) {
    throw new HttpError(400, 'Invalid item status transition')
  }

  const currentItem = await Item.findById(req.params.id)
  if (!currentItem) throw new HttpError(404, 'Item not found')

  const transition = resolveItemStatusTransition(currentItem, status)
  if (!transition) throw new HttpError(400, 'Invalid item status transition')

  if (transition === 'confirm_turnover') {
    const item = await confirmTurnover(currentItem._id)
    return res.json({ data: item, message: 'Turnover confirmed. The item is now available for claim.' })
  }
  if (transition === 'mark_returned') {
    const item = await markReturned(currentItem._id)
    return res.json({ data: item, message: 'Item marked Returned successfully.' })
  }

  const recoveredId = await runInTransaction(async (session) => {
    const item = await Item.findById(req.params.id).session(session)
    if (!item) throw new HttpError(404, 'Item not found')
    if (item.type !== 'lost' || item.status !== 'open') {
      throw new HttpError(400, 'Only Open Lost items can be marked Recovered')
    }

    item.status = 'recovered'
    await item.save({ session })
    await ActivityLog.create([{
      item: item._id,
      action: 'item_recovered',
      message: `${item.title} was marked Recovered.`
    }], { session })
    return item._id
  })

  const recoveredItem = await Item.findById(recoveredId).populate('category location', 'name')
  res.json({ data: recoveredItem, message: 'Lost item marked Recovered successfully.' })
}))

router.get('/:id/matches', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(400, 'Invalid item ID')
  }

  const sourceItem = await Item.findById(req.params.id)
    .select('_id title description type status category location dateOccurred claimLocation')
    .lean()

  if (!sourceItem) {
    throw new HttpError(404, 'Item not found')
  }

  if (!['lost', 'found'].includes(sourceItem.type)) {
    return res.json({ data: [] })
  }

  if (
    (sourceItem.type === 'lost' && sourceItem.status === 'recovered') ||
    (sourceItem.type === 'found' && sourceItem.status === 'returned')
  ) {
    return res.json({ data: [] })
  }

  const isActiveSource =
    (sourceItem.type === 'lost' && sourceItem.status === 'open') ||
    (sourceItem.type === 'found' && ['pending_turnover', 'available_for_claim'].includes(sourceItem.status))

  if (!isActiveSource) {
    return res.json({ data: [] })
  }

  const candidateFilter = {
    type: sourceItem.type === 'lost' ? 'found' : 'lost',
    status: sourceItem.type === 'lost' ? 'available_for_claim' : 'open',
    _id: { $ne: sourceItem._id }
  }

  const candidateItems = await Item.find(candidateFilter)
    .select('_id title description type status category location dateOccurred claimLocation')
    .populate('category', '_id name')
    .populate('location', '_id name')
    .lean()

  const matches = findPossibleMatches(sourceItem, candidateItems, 3)

  res.json({ data: matches })
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
