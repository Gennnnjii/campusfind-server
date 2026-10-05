const mongoose = require('mongoose')
require('dotenv').config()

const Category = require('../models/Category')
const Location = require('../models/Location')
const Item = require('../models/Item')
const Claim = require('../models/Claim')
const ActivityLog = require('../models/ActivityLog')
const { categories, locations, items, claims, activities } = require('./seedData')

async function upsertAll(Model, records) {
  await Model.bulkWrite(records.map((record) => {
    const { _id, ...fields } = record
    return {
      updateOne: {
        filter: { _id },
        update: { $set: fields, $setOnInsert: { _id } },
        upsert: true,
        runValidators: true
      }
    }
  }))
}

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to seed the database')
  }

  await mongoose.connect(process.env.MONGO_URI)
  await Promise.all([
    Category.init(),
    Location.init(),
    Item.init(),
    Claim.init(),
    ActivityLog.init()
  ])
  await upsertAll(Category, categories)
  await upsertAll(Location, locations)
  await upsertAll(Item, items)
  await upsertAll(Claim, claims)
  await upsertAll(ActivityLog, activities)

  console.log(`Seed complete: ${categories.length} categories, ${locations.length} locations, ${items.length} items, ${claims.length} claims, and ${activities.length} activity logs.`)
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
