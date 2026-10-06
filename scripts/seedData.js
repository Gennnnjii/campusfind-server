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
  ['Black wireless earbuds', 'Pending Turnover'],
  ['Blue insulated tumbler', 'Pending Turnover'],
  ['Scientific calculator', 'Pending Turnover'],
  ['Canvas pencil case', 'Pending Turnover'],
  ['Silver house keys', 'Pending Turnover'],
  ['Gray zip hoodie', 'Pending Turnover'],
  ['USB flash drive', 'Pending Turnover'],
  ['Red compact umbrella', 'Pending Turnover'],
  ['Student organization lanyard', 'Pending Turnover'],
  ['Paperback statistics book', 'Pending Turnover'],
  ['Black leather wallet', 'Available for Claim'],
  ['Rose gold wristwatch', 'Available for Claim'],
  ['Green document envelope', 'Available for Claim'],
  ['White charging case', 'Available for Claim'],
  ['Navy drawstring bag', 'Available for Claim'],
  ['Prescription eyeglasses', 'Available for Claim'],
  ['Tablet sleeve', 'Returned'],
  ['Brass dormitory key', 'Returned'],
  ['Maroon notebook', 'Returned'],
  ['Digital voice recorder', 'Returned']
]

const lostBlueprints = [
  ['University identification card', 'Open'],
  ['Laptop charger', 'Open'],
  ['Geometry reference book', 'Open'],
  ['Brown card holder', 'Recovered'],
  ['Mechanical pencil set', 'Recovered'],
  ['Fitness tracker', 'Recovered']
]

const itemBlueprints = [
  ...foundBlueprints.map(([title, status]) => ({ title, status, type: 'Found' })),
  ...lostBlueprints.map(([title, status]) => ({ title, status, type: 'Lost' }))
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
  [10, 'Pending'], [10, 'Pending'],
  [11, 'Rejected'], [11, 'Pending'],
  [12, 'Approved'], [12, 'Rejected'],
  [13, 'Pending'],
  [16, 'Approved'], [16, 'Rejected'],
  [17, 'Approved'], [18, 'Approved'], [19, 'Approved']
]

const claims = claimBlueprints.map(([itemIndex, status], index) => ({
  _id: objectId('40', index + 1),
  item: items[itemIndex]._id,
  claimantName: `Demo Claimant ${index + 1}`,
  claimantEmail: `claimant${index + 1}@example.edu`,
  proofDescription: `Private verification detail ${index + 1}: identifies a distinctive feature that is not displayed on the public item page.`,
  referenceCode: `CF-202609${String(10 + index).padStart(2, '0')}-${String(index + 1).padStart(6, '0')}`,
  status,
  reviewNote: status === 'Rejected' ? 'The submitted identifying details did not match the item.' : '',
  ...(status !== 'Pending' ? { reviewedAt: new Date(Date.UTC(2026, 8, 22 + (index % 7), 9)) } : {})
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

items.filter((item) => item.type === 'Found' && item.status !== 'Pending Turnover').forEach((item) => {
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
  if (claim.status !== 'Pending') {
    addActivity({
      item: claim.item,
      claim: claim._id,
      action: claim.status === 'Approved' ? 'claim_approved' : 'claim_rejected',
      message: `Claim ${claim.referenceCode} was ${claim.status.toLowerCase()}.`
    })
  }
})

items.filter((item) => item.status === 'Returned').forEach((item) => {
  const approvedClaim = claims.find((claim) => claim.item.equals(item._id) && claim.status === 'Approved')
  addActivity({
    item: item._id,
    claim: approvedClaim._id,
    action: 'item_returned',
    message: `${item.title} was released to an approved claimant and marked Returned.`
  })
})

items.filter((item) => item.status === 'Recovered').forEach((item) => {
  addActivity({
    item: item._id,
    action: 'item_recovered',
    message: `${item.title} was marked Recovered.`
  })
})

module.exports = { categories, locations, items, claims, activities }
