const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const app = require('../app')
const {
  normalizeId,
  tokenizeTitle,
  calculateDateDeltaMs,
  calculateMatchScore,
  compareMatches,
  findPossibleMatches
} = require('../services/itemMatching')

let server
let baseUrl

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
})

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

test('same Category awards 40', () => {
  const source = { category: '507f1f77bcf86cd799439011' }
  const candidate = { category: '507f1f77bcf86cd799439011' }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.category, 40)
  assert.ok(result.reasons.includes('Same category'))
})

test('different Category awards 0', () => {
  const source = { category: '507f1f77bcf86cd799439011' }
  const candidate = { category: '507f1f77bcf86cd799439012' }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.category, 0)
  assert.ok(!result.reasons.includes('Same category'))
})

test('same Location awards 25', () => {
  const source = { location: '507f1f77bcf86cd799439021' }
  const candidate = { location: '507f1f77bcf86cd799439021' }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.location, 25)
  assert.ok(result.reasons.includes('Same location'))
})

test('different Location awards 0', () => {
  const source = { location: '507f1f77bcf86cd799439021' }
  const candidate = { location: '507f1f77bcf86cd799439022' }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.location, 0)
  assert.ok(!result.reasons.includes('Same location'))
})

test('exactly three days awards 20', () => {
  const base = new Date('2026-10-01T00:00:00.000Z')
  const exactlyThreeDaysLater = new Date(base.getTime() + 259200000)
  const result = calculateMatchScore({ dateOccurred: base }, { dateOccurred: exactlyThreeDaysLater })
  assert.equal(result.scoreBreakdown.date, 20)
  assert.ok(result.reasons.includes('Date within 3 days'))
})

test('less than three days awards 20', () => {
  const base = new Date('2026-10-01T00:00:00.000Z')
  const oneDayLater = new Date(base.getTime() + 86400000)
  const result = calculateMatchScore({ dateOccurred: base }, { dateOccurred: oneDayLater })
  assert.equal(result.scoreBreakdown.date, 20)
  assert.ok(result.reasons.includes('Date within 3 days'))
})

test('more than three days awards 0', () => {
  const base = new Date('2026-10-01T00:00:00.000Z')
  const fourDaysLater = new Date(base.getTime() + 259200001)
  const result = calculateMatchScore({ dateOccurred: base }, { dateOccurred: fourDaysLater })
  assert.equal(result.scoreBreakdown.date, 0)
  assert.ok(!result.reasons.includes('Date within 3 days'))
})

test('missing date awards 0', () => {
  const result = calculateMatchScore({ dateOccurred: new Date() }, {})
  assert.equal(result.scoreBreakdown.date, 0)
  assert.ok(!result.reasons.includes('Date within 3 days'))
})

test('invalid date awards 0', () => {
  const result = calculateMatchScore({ dateOccurred: 'invalid-date' }, { dateOccurred: new Date() })
  assert.equal(result.scoreBreakdown.date, 0)
  assert.ok(!result.reasons.includes('Date within 3 days'))
})

test('shared normalized title token awards 15', () => {
  const result = calculateMatchScore({ title: 'Black leather wallet' }, { title: 'Found black wallet' })
  assert.equal(result.scoreBreakdown.title, 15)
  assert.ok(result.reasons.includes('Shared title keywords'))
})

test('punctuation and case normalize correctly', () => {
  const result = calculateMatchScore({ title: 'Blue-Backpack (Navy)!' }, { title: 'blue backpack' })
  assert.equal(result.scoreBreakdown.title, 15)
  assert.ok(result.reasons.includes('Shared title keywords'))
})

test('repeated shared tokens still award only 15', () => {
  const result = calculateMatchScore({ title: 'Blue backpack notebook' }, { title: 'Notebook backpack blue' })
  assert.equal(result.scoreBreakdown.title, 15)
  assert.equal(result.score, 15)
})

test('tokens shorter than three characters do not match', () => {
  const result = calculateMatchScore({ title: 'My id card' }, { title: 'My id pass' })
  assert.equal(result.scoreBreakdown.title, 0)
  assert.ok(!result.reasons.includes('Shared title keywords'))
})

test('no shared tokens awards 0', () => {
  const result = calculateMatchScore({ title: 'Scientific calculator' }, { title: 'Silver keys' })
  assert.equal(result.scoreBreakdown.title, 0)
  assert.ok(!result.reasons.includes('Shared title keywords'))
})

test('complete match awards 100', () => {
  const catId = '507f1f77bcf86cd799439011'
  const locId = '507f1f77bcf86cd799439021'
  const date = new Date('2026-10-01T12:00:00.000Z')
  const source = { category: catId, location: locId, dateOccurred: date, title: 'Black leather wallet' }
  const candidate = { category: catId, location: locId, dateOccurred: date, title: 'Found black wallet' }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.score, 100)
  assert.deepEqual(result.reasons, [
    'Same category',
    'Same location',
    'Date within 3 days',
    'Shared title keywords'
  ])
  assert.deepEqual(result.scoreBreakdown, {
    category: 40,
    location: 25,
    date: 20,
    title: 15
  })
})

test('no signals awards 0', () => {
  const source = {
    category: '507f1f77bcf86cd799439011',
    location: '507f1f77bcf86cd799439021',
    dateOccurred: new Date('2026-10-01T00:00:00.000Z'),
    title: 'Chemistry textbook'
  }
  const candidate = {
    category: '507f1f77bcf86cd799439012',
    location: '507f1f77bcf86cd799439022',
    dateOccurred: new Date('2026-10-15T00:00:00.000Z'),
    title: 'Silver keys'
  }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.score, 0)
  assert.deepEqual(result.reasons, [])
  assert.deepEqual(result.scoreBreakdown, { category: 0, location: 0, date: 0, title: 0 })
})

test('missing Category reference awards 0', () => {
  const result = calculateMatchScore({ category: null }, { category: '507f1f77bcf86cd799439011' })
  assert.equal(result.scoreBreakdown.category, 0)
})

test('missing Location reference awards 0', () => {
  const result = calculateMatchScore({ location: '507f1f77bcf86cd799439021' }, { location: null })
  assert.equal(result.scoreBreakdown.location, 0)
})

test('null/null Category references do not match', () => {
  const result = calculateMatchScore({ category: null }, { category: null })
  assert.equal(result.scoreBreakdown.category, 0)
})

test('null/null Location references do not match', () => {
  const result = calculateMatchScore({ location: null }, { location: null })
  assert.equal(result.scoreBreakdown.location, 0)
})

test('populated and raw ObjectId shapes normalize consistently', () => {
  const catId = '507f1f77bcf86cd799439011'
  const locId = '507f1f77bcf86cd799439021'
  const source = {
    category: catId,
    location: { _id: locId, name: 'Student Center' }
  }
  const candidate = {
    category: { _id: catId, name: 'Electronics' },
    location: locId
  }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.category, 40)
  assert.equal(result.scoreBreakdown.location, 25)
})

test('score breakdown sum equals score', () => {
  const source = {
    category: '507f1f77bcf86cd799439011',
    title: 'Blue water tumbler'
  }
  const candidate = {
    category: '507f1f77bcf86cd799439011',
    title: 'Water tumbler found'
  }
  const result = calculateMatchScore(source, candidate)
  const breakdownSum = result.scoreBreakdown.category + result.scoreBreakdown.location + result.scoreBreakdown.date + result.scoreBreakdown.title
  assert.equal(result.score, breakdownSum)
})

test('score remains within 0 to 100', () => {
  const scores = [
    calculateMatchScore({}, {}).score,
    calculateMatchScore({ title: 'Wallet' }, { title: 'Wallet' }).score,
    calculateMatchScore(
      { category: 'c', location: 'l', dateOccurred: new Date(), title: 'Wallet' },
      { category: 'c', location: 'l', dateOccurred: new Date(), title: 'Wallet' }
    ).score
  ]
  for (const score of scores) {
    assert.ok(score >= 0 && score <= 100)
  }
})

test('score is finite and is an integer', () => {
  const result = calculateMatchScore(
    { dateOccurred: 'invalid' },
    { dateOccurred: new Date() }
  )
  assert.ok(Number.isInteger(result.score))
  assert.ok(Number.isFinite(result.score))
})

test('higher score sorts first', () => {
  const candA = { score: 65, _id: '1' }
  const candB = { score: 85, _id: '2' }
  assert.ok(compareMatches(candA, candB, null) > 0)
  assert.ok(compareMatches(candB, candA, null) < 0)
})

test('tied score uses smaller date difference', () => {
  const candA = { score: 40, dateDelta: 86400000, _id: '1' }
  const candB = { score: 40, dateDelta: 172800000, _id: '2' }
  assert.ok(compareMatches(candA, candB, null) < 0)
})

test('tied date difference uses newer candidate date', () => {
  const candA = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-05T00:00:00.000Z', _id: '1' }
  const candB = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-02T00:00:00.000Z', _id: '2' }
  assert.ok(compareMatches(candA, candB, null) < 0)
})

test('tied candidate date uses case-insensitive title order', () => {
  const candA = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-05T00:00:00.000Z', title: 'Blue umbrella', _id: '2' }
  const candB = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-05T00:00:00.000Z', title: 'Red umbrella', _id: '1' }
  assert.ok(compareMatches(candA, candB, null) < 0)
})

test('final tie uses _id ascending', () => {
  const candA = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-05T00:00:00.000Z', title: 'Umbrella', _id: '507f1f77bcf86cd799439001' }
  const candB = { score: 40, dateDelta: 86400000, dateOccurred: '2026-10-05T00:00:00.000Z', title: 'Umbrella', _id: '507f1f77bcf86cd799439002' }
  assert.ok(compareMatches(candA, candB, null) < 0)
})

test('score-zero candidates are excluded', () => {
  const source = { _id: '1', type: 'lost', status: 'open', title: 'Book' }
  const candidates = [
    { _id: '2', type: 'found', status: 'available_for_claim', title: 'Keys' }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('result list is limited to 3', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 'src', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c1', type: 'found', status: 'available_for_claim', category: cat, title: 'Item 1' },
    { _id: 'c2', type: 'found', status: 'available_for_claim', category: cat, title: 'Item 2' },
    { _id: 'c3', type: 'found', status: 'available_for_claim', category: cat, title: 'Item 3' },
    { _id: 'c4', type: 'found', status: 'available_for_claim', category: cat, title: 'Item 4' },
    { _id: 'c5', type: 'found', status: 'available_for_claim', category: cat, title: 'Item 5' }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 3)
})

test('source item is excluded', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 'same-id', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'same-id', type: 'found', status: 'available_for_claim', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('same-type candidate is excluded', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c', type: 'lost', status: 'open', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('pending-turnover Found candidate is excluded for a Lost source', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c', type: 'found', status: 'pending_turnover', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('Returned Found candidate is excluded', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c', type: 'found', status: 'returned', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('Recovered Lost candidate is excluded', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'found', status: 'available_for_claim', category: cat }
  const candidates = [
    { _id: 'c', type: 'lost', status: 'recovered', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('Available-for-Claim Found candidate is eligible for a Lost source', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c', type: 'found', status: 'available_for_claim', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 1)
  assert.equal(matches[0]._id, 'c')
})

test('Open Lost candidate is eligible for a Found source', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'found', status: 'available_for_claim', category: cat }
  const candidates = [
    { _id: 'c', type: 'lost', status: 'open', category: cat }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 1)
  assert.equal(matches[0]._id, 'c')
})

test('repeated processing returns deterministic order', () => {
  const cat = '507f1f77bcf86cd799439011'
  const source = { _id: 's', type: 'lost', status: 'open', category: cat }
  const candidates = [
    { _id: 'c2', type: 'found', status: 'available_for_claim', category: cat, title: 'Item B' },
    { _id: 'c1', type: 'found', status: 'available_for_claim', category: cat, title: 'Item A' }
  ]
  const run1 = findPossibleMatches(source, candidates)
  const run2 = findPossibleMatches(source, candidates)
  assert.deepEqual(run1, run2)
})

test('reasons remain in scoring-component order', () => {
  const cat = '507f1f77bcf86cd799439011'
  const loc = '507f1f77bcf86cd799439021'
  const date = new Date('2026-10-01T00:00:00.000Z')
  const source = { category: cat, location: loc, dateOccurred: date, title: 'Wallet' }
  const candidate = { category: cat, location: loc, dateOccurred: date, title: 'Wallet' }
  const { reasons } = calculateMatchScore(source, candidate)
  assert.deepEqual(reasons, [
    'Same category',
    'Same location',
    'Date within 3 days',
    'Shared title keywords'
  ])
})

test('GET /api/items/not-an-id/matches returns status 400 with { message: \'Invalid item ID\' }', async () => {
  const response = await fetch(`${baseUrl}/api/items/not-an-id/matches`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Invalid item ID' })
})

test('normalizeId accepts a real mongoose.Types.ObjectId', () => {
  const id = new mongoose.Types.ObjectId()
  const normalized = normalizeId(id)
  assert.equal(typeof normalized, 'string')
  assert.equal(normalized, id.toHexString())
})

test('normalizeId returns exact hex string for real ObjectId', () => {
  const hex = '507f1f77bcf86cd799439011'
  const id = new mongoose.Types.ObjectId(hex)
  assert.equal(normalizeId(id), hex)
})

test('normalizeId does not recurse indefinitely for a real ObjectId', () => {
  const id = new mongoose.Types.ObjectId()
  assert.doesNotThrow(() => {
    const res = normalizeId(id)
    assert.equal(res, id.toString())
  })
})

test('normalizeId accepts populated object with real ObjectId _id', () => {
  const id = new mongoose.Types.ObjectId()
  const populated = { _id: id, name: 'Sample Category' }
  assert.equal(normalizeId(populated), id.toHexString())
})

test('normalizeId produces identical strings for raw ObjectId vs populated object', () => {
  const id = new mongoose.Types.ObjectId()
  const rawResult = normalizeId(id)
  const populatedResult = normalizeId({ _id: id })
  assert.equal(rawResult, populatedResult)
})

test('calculateMatchScore awards Category (+40) with real ObjectId instances', () => {
  const catId = new mongoose.Types.ObjectId()
  const source = { category: catId }
  const candidate = { category: { _id: catId, name: 'Electronics' } }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.category, 40)
  assert.ok(result.reasons.includes('Same category'))
})

test('calculateMatchScore awards Location (+25) with real ObjectId instances', () => {
  const locId = new mongoose.Types.ObjectId()
  const source = { location: locId }
  const candidate = { location: { _id: locId, name: 'Library' } }
  const result = calculateMatchScore(source, candidate)
  assert.equal(result.scoreBreakdown.location, 25)
  assert.ok(result.reasons.includes('Same location'))
})

test('findPossibleMatches handles real ObjectId _id fields without throwing', () => {
  const sourceId = new mongoose.Types.ObjectId()
  const candId = new mongoose.Types.ObjectId()
  const catId = new mongoose.Types.ObjectId()
  const source = { _id: sourceId, type: 'lost', status: 'open', category: catId, title: 'Item' }
  const candidates = [{ _id: candId, type: 'found', status: 'available_for_claim', category: catId, title: 'Item' }]
  assert.doesNotThrow(() => {
    const matches = findPossibleMatches(source, candidates)
    assert.equal(matches.length, 1)
    assert.equal(matches[0]._id, candId.toHexString())
  })
})

test('self-exclusion works with real ObjectId _id instances', () => {
  const sameId = new mongoose.Types.ObjectId()
  const catId = new mongoose.Types.ObjectId()
  const source = { _id: sameId, type: 'lost', status: 'open', category: catId, title: 'Item' }
  const candidates = [{ _id: sameId, type: 'found', status: 'available_for_claim', category: catId, title: 'Item' }]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 0)
})

test('deterministic sorting works with real ObjectId _id instances', () => {
  const sourceId = new mongoose.Types.ObjectId()
  const cand1Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
  const cand2Id = new mongoose.Types.ObjectId('507f1f77bcf86cd799439022')
  const catId = new mongoose.Types.ObjectId()
  const source = { _id: sourceId, type: 'lost', status: 'open', category: catId, title: 'Item' }
  const candidates = [
    { _id: cand2Id, type: 'found', status: 'available_for_claim', category: catId, title: 'Item' },
    { _id: cand1Id, type: 'found', status: 'available_for_claim', category: catId, title: 'Item' }
  ]
  const matches = findPossibleMatches(source, candidates)
  assert.equal(matches.length, 2)
  assert.equal(matches[0]._id, cand1Id.toHexString())
  assert.equal(matches[1]._id, cand2Id.toHexString())
})
