const mongoose = require('mongoose')

const objectId = (series, value) => new mongoose.Types.ObjectId(
  `${series}${value.toString(16).padStart(22, '0')}`
)

const categoryNames = [
  'Electronics',
  'Identification',
  'Bags and Cases',
  'Clothing',
  'Books and Supplies',
  'Keys and Access',
  'Personal Items'
]

const locationNames = [
  'Main Library',
  'Student Center',
  'Engineering Building',
  'Gymnasium',
  'Cafeteria',
  'Science Hall'
]

const categories = categoryNames.map((name, index) => ({
  _id: objectId('10', index + 1),
  name,
  description: `CampusFind category for ${name.toLowerCase()}.`,
  isActive: true
}))

const locations = locationNames.map((name, index) => ({
  _id: objectId('20', index + 1),
  name,
  description: `Common reporting area at ${name}.`,
  isActive: true
}))

const foundBlueprints = [
  ['Black wireless earbuds', 'pending_turnover'],
  ['Blue insulated tumbler', 'pending_turnover'],
  ['Scientific calculator', 'pending_turnover'],
  ['Canvas pencil case', 'pending_turnover'],
  ['Silver house keys', 'pending_turnover'],
  ['Gray zip hoodie', 'pending_turnover'],
  ['USB flash drive', 'pending_turnover'],
  ['Red compact umbrella', 'pending_turnover'],
  ['Student organization lanyard', 'pending_turnover'],
  ['Paperback statistics book', 'pending_turnover'],
  ['Black leather wallet', 'available_for_claim'],
  ['Rose gold wristwatch', 'available_for_claim'],
  ['Green document envelope', 'available_for_claim'],
  ['White charging case', 'available_for_claim'],
  ['Navy drawstring bag', 'available_for_claim'],
  ['Prescription eyeglasses', 'available_for_claim'],
  ['Tablet sleeve', 'returned'],
  ['Brass dormitory key', 'returned'],
  ['Maroon notebook', 'returned'],
  ['Digital voice recorder', 'returned']
]

const lostBlueprints = [
  ['University identification card', 'open'],
  ['Laptop charger', 'open'],
  ['Geometry reference book', 'open'],
  ['Brown card holder', 'recovered'],
  ['Mechanical pencil set', 'recovered'],
  ['Fitness tracker', 'recovered']
]

const itemBlueprints = [
  ...foundBlueprints.map(([title, status]) => ({ title, status, type: 'found' })),
  ...lostBlueprints.map(([title, status]) => ({ title, status, type: 'lost' }))
]

const items = itemBlueprints.map((blueprint, index) => ({
  _id: objectId('30', index + 1),
  title: blueprint.title,
  description: `${blueprint.title} reported with enough non-sensitive detail for campus identification and workflow testing.`,
  category: categories[index % categories.length]._id,
  location: locations[index % locations.length]._id,
  type: blueprint.type,
  dateOccurred: new Date(Date.UTC(2026, 8, 8 + (index % 20), 8 + (index % 8))),
  status: blueprint.status,
  claimLocation: 'SDAO'
}))

const claimBlueprints = [
  [10, 'pending'], [10, 'pending'],
  [11, 'rejected'], [11, 'pending'],
  [12, 'approved'], [12, 'rejected'],
  [13, 'pending'],
  [16, 'approved'], [16, 'rejected'],
  [17, 'approved'], [18, 'approved'], [19, 'approved']
]

const claims = claimBlueprints.map(([itemIndex, status], index) => ({
  _id: objectId('40', index + 1),
  item: items[itemIndex]._id,
  claimantName: `Demo Claimant ${index + 1}`,
  claimantEmail: `claimant${index + 1}@example.edu`,
  proofDescription: `Private verification detail ${index + 1}: identifies a distinctive feature that is not displayed on the public item page.`,
  referenceCode: `CF-202609${String(10 + index).padStart(2, '0')}-${String(index + 1).padStart(6, '0')}`,
  status,
  reviewNote: status === 'rejected' ? 'The submitted identifying details did not match the item.' : '',
  ...(status !== 'pending' ? { reviewedAt: new Date(Date.UTC(2026, 8, 22 + (index % 7), 9)) } : {})
}))

const activities = []
let activityCounter = 1
const addActivity = (entry) => activities.push({
  _id: objectId('50', activityCounter++),
  ...entry
})

items.forEach((item) => {
  addActivity({
    item: item._id,
    action: 'report_created',
    message: `${item.title} was reported as ${item.type}.`
  })
})

items.filter((item) => item.type === 'found' && item.status !== 'pending_turnover').forEach((item) => {
  addActivity({
    item: item._id,
    action: 'turnover_confirmed',
    message: `${item.title} was turned over to SDAO.`
  })
})

claims.forEach((claim) => {
  const item = items.find((candidate) => candidate._id.equals(claim.item))
  addActivity({
    item: claim.item,
    claim: claim._id,
    action: 'claim_submitted',
    message: `Claim ${claim.referenceCode} was submitted for ${item.title}.`
  })
  if (claim.status !== 'pending') {
    addActivity({
      item: claim.item,
      claim: claim._id,
      action: claim.status === 'approved' ? 'claim_approved' : 'claim_rejected',
      message: `Claim ${claim.referenceCode} was ${claim.status}.`
    })
  }
})

items.filter((item) => item.status === 'returned').forEach((item) => {
  const approvedClaim = claims.find((claim) => claim.item.equals(item._id) && claim.status === 'approved')
  addActivity({
    item: item._id,
    claim: approvedClaim._id,
    action: 'item_returned',
    message: `${item.title} was released to an approved claimant and marked Returned.`
  })
})

items.filter((item) => item.status === 'recovered').forEach((item) => {
  addActivity({
    item: item._id,
    action: 'item_recovered',
    message: `${item.title} was marked Recovered.`
  })
})

module.exports = { categories, locations, items, claims, activities }
