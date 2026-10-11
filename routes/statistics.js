const express = require('express')

const Item = require('../models/Item')
const Category = require('../models/Category')
const Location = require('../models/Location')
const Claim = require('../models/Claim')
const asyncHandler = require('../utils/asyncHandler')

const router = express.Router()

router.get('/overview', asyncHandler(async (req, res) => {
  const [items, claims] = await Promise.all([
    Item.find({}, 'type status').lean(),
    Claim.find({}, 'status').lean()
  ])

  let totalLost = 0
  let totalFound = 0
  let activeLost = 0
  let activeFound = 0
  let recovered = 0
  let returned = 0

  for (const item of items) {
    if (item.type === 'lost') {
      totalLost++
      if (item.status === 'open') {
        activeLost++
      } else if (item.status === 'recovered') {
        recovered++
      }
    } else if (item.type === 'found') {
      totalFound++
      if (item.status === 'pending_turnover' || item.status === 'available_for_claim') {
        activeFound++
      } else if (item.status === 'returned') {
        returned++
      }
    }
  }

  let pendingClaims = 0
  let approvedClaims = 0
  let rejectedClaims = 0

  for (const claim of claims) {
    if (claim.status === 'pending') {
      pendingClaims++
    } else if (claim.status === 'approved') {
      approvedClaims++
    } else if (claim.status === 'rejected') {
      rejectedClaims++
    }
  }

  const totalItems = items.length
  const totalClaims = claims.length

  res.json({
    data: {
      totalItems,
      totalLost,
      totalFound,
      activeLost,
      activeFound,
      recovered,
      returned,
      claims: {
        total: totalClaims,
        pending: pendingClaims,
        approved: approvedClaims,
        rejected: rejectedClaims
      }
    }
  })
}))

router.get('/categories', asyncHandler(async (req, res) => {
  const [items, categories] = await Promise.all([
    Item.find({}, 'category type').lean(),
    Category.find({}, '_id name').lean()
  ])

  const categoryMap = new Map()
  for (const cat of categories) {
    categoryMap.set(String(cat._id), cat.name)
  }

  const buckets = new Map()
  let unknownBucket = null

  for (const item of items) {
    const catIdStr = item.category ? String(item.category) : null
    if (catIdStr && categoryMap.has(catIdStr)) {
      let bucket = buckets.get(catIdStr)
      if (!bucket) {
        bucket = {
          categoryId: catIdStr,
          name: categoryMap.get(catIdStr),
          total: 0,
          lost: 0,
          found: 0
        }
        buckets.set(catIdStr, bucket)
      }
      bucket.total++
      if (item.type === 'lost') bucket.lost++
      if (item.type === 'found') bucket.found++
    } else {
      if (!unknownBucket) {
        unknownBucket = {
          categoryId: null,
          name: 'Unknown',
          total: 0,
          lost: 0,
          found: 0
        }
      }
      unknownBucket.total++
      if (item.type === 'lost') unknownBucket.lost++
      if (item.type === 'found') unknownBucket.found++
    }
  }

  const resultList = Array.from(buckets.values())
  if (unknownBucket) {
    resultList.push(unknownBucket)
  }

  resultList.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total
    }
    const nameComp = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    if (nameComp !== 0) {
      return nameComp
    }
    if (a.categoryId === null && b.categoryId === null) {
      return 0
    }
    if (a.categoryId === null) {
      return 1
    }
    if (b.categoryId === null) {
      return -1
    }
    return String(a.categoryId).localeCompare(String(b.categoryId))
  })

  const totalItems = items.length
  const data = resultList.map((bucket) => ({
    categoryId: bucket.categoryId,
    name: bucket.name,
    total: bucket.total,
    lost: bucket.lost,
    found: bucket.found,
    percentage: totalItems > 0 ? Math.round((bucket.total / totalItems) * 1000) / 10 : 0
  }))

  res.json({ data })
}))

router.get('/locations', asyncHandler(async (req, res) => {
  const [items, locations] = await Promise.all([
    Item.find({}, 'location type').lean(),
    Location.find({}, '_id name').lean()
  ])

  const locationMap = new Map()
  for (const loc of locations) {
    locationMap.set(String(loc._id), loc.name)
  }

  const buckets = new Map()
  let unknownBucket = null

  for (const item of items) {
    const locIdStr = item.location ? String(item.location) : null
    if (locIdStr && locationMap.has(locIdStr)) {
      let bucket = buckets.get(locIdStr)
      if (!bucket) {
        bucket = {
          locationId: locIdStr,
          name: locationMap.get(locIdStr),
          total: 0,
          lost: 0,
          found: 0
        }
        buckets.set(locIdStr, bucket)
      }
      bucket.total++
      if (item.type === 'lost') bucket.lost++
      if (item.type === 'found') bucket.found++
    } else {
      if (!unknownBucket) {
        unknownBucket = {
          locationId: null,
          name: 'Unknown',
          total: 0,
          lost: 0,
          found: 0
        }
      }
      unknownBucket.total++
      if (item.type === 'lost') unknownBucket.lost++
      if (item.type === 'found') unknownBucket.found++
    }
  }

  const resultList = Array.from(buckets.values())
  if (unknownBucket) {
    resultList.push(unknownBucket)
  }

  resultList.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total
    }
    const nameComp = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    if (nameComp !== 0) {
      return nameComp
    }
    if (a.locationId === null && b.locationId === null) {
      return 0
    }
    if (a.locationId === null) {
      return 1
    }
    if (b.locationId === null) {
      return -1
    }
    return String(a.locationId).localeCompare(String(b.locationId))
  })

  const totalItems = items.length
  const data = resultList.map((bucket, index) => ({
    locationId: bucket.locationId,
    name: bucket.name,
    total: bucket.total,
    lost: bucket.lost,
    found: bucket.found,
    percentage: totalItems > 0 ? Math.round((bucket.total / totalItems) * 1000) / 10 : 0,
    rank: index + 1
  }))

  res.json({ data })
}))

router.get('/resolution', asyncHandler(async (req, res) => {
  const items = await Item.find({}, 'type status').lean()

  let lostTotal = 0
  let lostRecovered = 0
  let foundTotal = 0
  let foundReturned = 0

  for (const item of items) {
    if (item.type === 'lost') {
      lostTotal++
      if (item.status === 'recovered') {
        lostRecovered++
      }
    } else if (item.type === 'found') {
      foundTotal++
      if (item.status === 'returned') {
        foundReturned++
      }
    }
  }

  const totalReports = items.length
  const resolvedReports = lostRecovered + foundReturned

  const overallResolutionRate = totalReports > 0
    ? Math.round((resolvedReports / totalReports) * 1000) / 10
    : 0

  const lostRate = lostTotal > 0
    ? Math.round((lostRecovered / lostTotal) * 1000) / 10
    : 0

  const foundRate = foundTotal > 0
    ? Math.round((foundReturned / foundTotal) * 1000) / 10
    : 0

  res.json({
    data: {
      totalReports,
      resolvedReports,
      overallResolutionRate,
      lost: {
        total: lostTotal,
        recovered: lostRecovered,
        rate: lostRate
      },
      found: {
        total: foundTotal,
        returned: foundReturned,
        rate: foundRate
      }
    }
  })
}))

module.exports = router
