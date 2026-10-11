const test = require('node:test')
const assert = require('node:assert/strict')

const app = require('../app')

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
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('health route returns a JSON success response', async () => {
  const response = await fetch(`${baseUrl}/`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { message: 'CampusFind API is running' })
})

test('unknown routes use the consistent JSON 404 shape', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { message: 'Route not found' })
})

test('malformed JSON returns HTTP 400 instead of crashing', async () => {
  const response = await fetch(`${baseUrl}/api/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken-json'
  })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Invalid JSON payload' })
})

test('item creation rejects unsupported report types before database access', async () => {
  const response = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Lost notebook',
      description: 'A notebook with a blue cover and campus notes.',
      category: '507f1f77bcf86cd799439011',
      location: '507f1f77bcf86cd799439012',
      type: 'unknown',
      dateOccurred: '2026-10-01'
    })
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    message: 'Validation failed',
    details: ['Type must be lost or found']
  })
})

test('item creation rejects future and malformed dates before database access', async () => {
  const baseItem = {
    title: 'Lost notebook',
    description: 'A notebook with a blue cover and campus notes.',
    category: '507f1f77bcf86cd799439011',
    location: '507f1f77bcf86cd799439012',
    type: 'lost'
  }

  for (const dateOccurred of ['2099-01-01', '2026-02-31']) {
    const response = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseItem, dateOccurred })
    })
    assert.equal(response.status, 400)
  }
})

test('item edits reject workflow status changes before database access', async () => {
  const response = await fetch(`${baseUrl}/api/items/507f1f77bcf86cd799439011`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'returned' })
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    message: 'Unsupported item fields',
    details: ['status']
  })
})

test('item edit and delete reject malformed IDs before database access', async () => {
  const editResponse = await fetch(`${baseUrl}/api/items/not-an-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Updated report' })
  })
  assert.equal(editResponse.status, 400)
  assert.deepEqual(await editResponse.json(), { message: 'Invalid item ID' })

  const deleteResponse = await fetch(`${baseUrl}/api/items/not-an-id`, { method: 'DELETE' })
  assert.equal(deleteResponse.status, 400)
  assert.deepEqual(await deleteResponse.json(), { message: 'Invalid item ID' })
})

test('item status route rejects invalid targets and malformed IDs before database access', async () => {
  const invalidTargetResponse = await fetch(`${baseUrl}/api/items/507f1f77bcf86cd799439011/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'open' })
  })
  assert.equal(invalidTargetResponse.status, 400)
  assert.deepEqual(await invalidTargetResponse.json(), { message: 'Invalid item status transition' })

  const invalidIdResponse = await fetch(`${baseUrl}/api/items/not-an-id/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'recovered' })
  })
  assert.equal(invalidIdResponse.status, 400)
  assert.deepEqual(await invalidIdResponse.json(), { message: 'Invalid item ID' })
})

test('reference management validates required fields, filters, and IDs before database access', async () => {
  const missingNameResponse = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'A category without a name.' })
  })
  assert.equal(missingNameResponse.status, 400)
  assert.deepEqual(await missingNameResponse.json(), { message: 'Name is required' })

  const invalidFilterResponse = await fetch(`${baseUrl}/api/locations?includeInactive=maybe`)
  assert.equal(invalidFilterResponse.status, 400)
  assert.deepEqual(await invalidFilterResponse.json(), { message: 'includeInactive must be true or false' })

  const invalidIdResponse = await fetch(`${baseUrl}/api/categories/not-an-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated category' })
  })
  assert.equal(invalidIdResponse.status, 400)
  assert.deepEqual(await invalidIdResponse.json(), { message: 'Invalid category ID' })

  const invalidActivationResponse = await fetch(`${baseUrl}/api/locations/507f1f77bcf86cd799439011`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: 'false' })
  })
  assert.equal(invalidActivationResponse.status, 400)
  assert.deepEqual(await invalidActivationResponse.json(), {
    message: 'Validation failed',
    details: ['isActive must be true or false']
  })

  const invalidDeleteIdResponse = await fetch(`${baseUrl}/api/locations/not-an-id`, { method: 'DELETE' })
  assert.equal(invalidDeleteIdResponse.status, 400)
  assert.deepEqual(await invalidDeleteIdResponse.json(), { message: 'Invalid location ID' })
})

test('invalid activity filters return a JSON 400 before database access', async () => {
  const response = await fetch(`${baseUrl}/api/activity-logs?action=not-real`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Invalid activity action filter' })
})
