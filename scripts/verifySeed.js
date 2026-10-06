const mongoose = require('mongoose')
require('dotenv').config()

const Category = require('../models/Category')
const Location = require('../models/Location')
const Item = require('../models/Item')
const Claim = require('../models/Claim')
const ActivityLog = require('../models/ActivityLog')
const seedData = require('./seedData')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function validateDocuments(Model, records) {
  await Promise.all(records.map((record) => new Model(record).validate()))
}

function verifyRelationships({ items, claims, activities }) {
  const itemIds = new Set(items.map((item) => item._id.toString()))
  const claimIds = new Set(claims.map((claim) => claim._id.toString()))

  claims.forEach((claim) => {
    assert(itemIds.has(claim.item.toString()), `Claim ${claim.referenceCode} references a missing item`)
  })
  activities.forEach((activity) => {
    assert(itemIds.has(activity.item.toString()), 'Activity references a missing item')
    if (activity.claim) {
      assert(claimIds.has(activity.claim.toString()), 'Activity references a missing claim')
    }
  })

  items.filter((item) => item.status === 'Returned').forEach((item) => {
    assert(
      claims.some((claim) => claim.item.equals(item._id) && claim.status === 'Approved'),
      `Returned item ${item.title} has no approved claim`
    )
  })

  const approvedPerItem = new Map()
  claims.filter((claim) => claim.status === 'Approved').forEach((claim) => {
    const key = claim.item.toString()
    approvedPerItem.set(key, (approvedPerItem.get(key) || 0) + 1)
  })
  approvedPerItem.forEach((count) => assert(count === 1, 'An item has more than one approved claim'))
}

async function verifyInMemory() {
  const { categories, locations, items, claims, activities } = seedData
  assert(categories.length === 7, 'Expected 7 categories')
  assert(locations.length === 6, 'Expected 6 locations')
  assert(items.length >= 24 && items.length <= 30, 'Expected 24-30 items')
  assert(claims.length >= 10 && claims.length <= 12, 'Expected 10-12 claims')
  assert(activities.length > 0, 'Expected activity logs')

  await validateDocuments(Category, categories)
  await validateDocuments(Location, locations)
  await validateDocuments(Item, items)
  await validateDocuments(Claim, claims)
  await validateDocuments(ActivityLog, activities)
  verifyRelationships(seedData)

  return {
    categories: categories.length,
    locations: locations.length,
    items: items.length,
    claims: claims.length,
    activities: activities.length
  }
}

async function verifyDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required for --database verification')
  }
  await mongoose.connect(process.env.MONGO_URI)
  const [categories, locations, items, claims, activities] = await Promise.all([
    Category.find({ _id: { $in: seedData.categories.map((record) => record._id) } }),
    Location.find({ _id: { $in: seedData.locations.map((record) => record._id) } }),
    Item.find({ _id: { $in: seedData.items.map((record) => record._id) } }),
    Claim.find({ _id: { $in: seedData.claims.map((record) => record._id) } }),
    ActivityLog.find({ _id: { $in: seedData.activities.map((record) => record._id) } })
  ])
  const databaseData = { categories, locations, items, claims, activities }
  verifyRelationships(databaseData)
  assert(categories.length === seedData.categories.length, 'Database category seed count mismatch')
  assert(locations.length === seedData.locations.length, 'Database location seed count mismatch')
  assert(items.length === seedData.items.length, 'Database item seed count mismatch')
  assert(claims.length === seedData.claims.length, 'Database claim seed count mismatch')
  assert(activities.length === seedData.activities.length, 'Database activity seed count mismatch')
}

async function main() {
  const counts = await verifyInMemory()
  if (process.argv.includes('--database')) await verifyDatabase()
  console.log(`Seed verification passed: ${JSON.stringify(counts)}`)
}

main()
  .catch((error) => {
    console.error('Seed verification failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
