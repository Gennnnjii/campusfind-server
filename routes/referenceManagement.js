const express = require('express')
const mongoose = require('mongoose')

const Item = require('../models/Item')
const asyncHandler = require('../utils/asyncHandler')
const HttpError = require('../utils/HttpError')

const escapeRegex = (value) => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

function validateReferenceFields(body, { allowActive = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }

  const allowedFields = allowActive ? ['name', 'description', 'isActive'] : ['name', 'description']
  const unsupportedFields = Object.keys(body).filter((field) => !allowedFields.includes(field))
  if (unsupportedFields.length) {
    throw new HttpError(400, 'Unsupported reference fields', unsupportedFields)
  }

  const errors = []
  if (Object.hasOwn(body, 'name') && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80)) {
    errors.push('Name must be between 2 and 80 characters')
  }
  if (Object.hasOwn(body, 'description') && (typeof body.description !== 'string' || body.description.trim().length > 500)) {
    errors.push('Description must be 500 characters or fewer')
  }
  if (Object.hasOwn(body, 'isActive') && typeof body.isActive !== 'boolean') {
    errors.push('isActive must be true or false')
  }
  if (errors.length) throw new HttpError(400, 'Validation failed', errors)
}

function createReferenceManagementRouter({ Model, label, itemReferenceField }) {
  const router = express.Router()

  router.get('/', asyncHandler(async (req, res) => {
    let filter = { isActive: true }
    if (req.query.includeInactive !== undefined) {
      if (!['true', 'false'].includes(req.query.includeInactive)) {
        throw new HttpError(400, 'includeInactive must be true or false')
      }
      if (req.query.includeInactive === 'true') filter = {}
    }

    const references = await Model.find(filter).sort({ name: 1 })
    res.json({ data: references })
  }))

  router.post('/', asyncHandler(async (req, res) => {
    validateReferenceFields(req.body)
    if (!Object.hasOwn(req.body, 'name')) {
      throw new HttpError(400, 'Name is required')
    }

    const normalizedName = req.body.name.trim()
    const duplicate = await Model.findOne({ name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' } })
    if (duplicate) throw new HttpError(400, `A ${label.toLowerCase()} with that name already exists`)

    const reference = await Model.create({
      name: normalizedName,
      description: (req.body.description ?? '').trim(),
      isActive: true
    })
    res.status(201).json({ data: reference, message: `${label} created successfully.` })
  }))

  router.patch('/:id', asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, `Invalid ${label.toLowerCase()} ID`)
    }

    validateReferenceFields(req.body, { allowActive: true })
    if (!Object.keys(req.body).length) {
      throw new HttpError(400, `Provide at least one ${label.toLowerCase()} field to update`)
    }

    const reference = await Model.findById(req.params.id)
    if (!reference) throw new HttpError(404, `${label} not found`)

    if (Object.hasOwn(req.body, 'name')) {
      const normalizedName = req.body.name.trim()
      const duplicate = await Model.findOne({
        _id: { $ne: reference._id },
        name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: 'i' }
      })
      if (duplicate) throw new HttpError(400, `A ${label.toLowerCase()} with that name already exists`)
      reference.name = normalizedName
    }
    if (Object.hasOwn(req.body, 'description')) reference.description = req.body.description.trim()
    if (Object.hasOwn(req.body, 'isActive')) reference.isActive = req.body.isActive
    await reference.save()

    res.json({ data: reference, message: `${label} updated successfully.` })
  }))

  // Keep historical item references valid by deactivating instead of deleting.
  router.delete('/:id', asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new HttpError(400, `Invalid ${label.toLowerCase()} ID`)
    }

    const reference = await Model.findById(req.params.id)
    if (!reference) throw new HttpError(404, `${label} not found`)

    const isReferenced = await Item.exists({ [itemReferenceField]: reference._id })
    reference.isActive = false
    await reference.save()

    res.json({
      data: reference,
      message: isReferenced
        ? `${label} deactivated. Existing item references have been preserved.`
        : `${label} deactivated successfully.`
    })
  }))

  return router
}

module.exports = createReferenceManagementRouter
