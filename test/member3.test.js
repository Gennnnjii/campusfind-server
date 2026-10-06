const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const Claim = require('../models/Claim')
const Item = require('../models/Item')
const { assertClaimableItem } = require('../services/claimWorkflow')
const { generateClaimReference } = require('../utils/claimReference')

const itemId = new mongoose.Types.ObjectId()

test('claim reference codes are human-readable and unique', () => {
  const references = new Set(Array.from({ length: 200 }, () => generateClaimReference(new Date('2026-10-05T00:00:00Z'))))
  assert.equal(references.size, 200)
  references.forEach((reference) => assert.match(reference, /^CF-20261005-[A-F0-9]{6}$/))
})

test('claim schema enforces email, proof length, and status values', async () => {
  const invalidClaim = new Claim({
    item: itemId,
    claimantName: 'A',
    claimantEmail: 'not-an-email',
    proofDescription: 'too short',
    referenceCode: 'wrong',
    status: 'Maybe'
  })

  await assert.rejects(invalidClaim.validate(), (error) => {
    assert.equal(error.name, 'ValidationError')
    assert.ok(error.errors.claimantName)
    assert.ok(error.errors.claimantEmail)
    assert.ok(error.errors.proofDescription)
    assert.ok(error.errors.referenceCode)
    assert.ok(error.errors.status)
    return true
  })
})

test('item schema prevents a Lost item from using a Found lifecycle status', async () => {
  const invalidItem = new Item({
    title: 'Lost notebook',
    description: 'A sufficiently detailed description for model validation.',
    category: new mongoose.Types.ObjectId(),
    location: new mongoose.Types.ObjectId(),
    type: 'lost',
    dateOccurred: new Date('2026-10-01T00:00:00Z'),
    status: 'available_for_claim'
  })

  await assert.rejects(invalidItem.validate(), /not valid for a lost item/)
})

test('claim eligibility accepts only Found items that are Available for Claim', () => {
  assert.doesNotThrow(() => assertClaimableItem({ type: 'found', status: 'available_for_claim' }))
  assert.throws(() => assertClaimableItem(null), /Found item not found/)
  assert.throws(() => assertClaimableItem({ type: 'lost', status: 'open' }), /only be submitted for Found/)
  assert.throws(() => assertClaimableItem({ type: 'found', status: 'returned' }), /not available for claim/)
})
