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

test('invalid activity filters return a JSON 400 before database access', async () => {
  const response = await fetch(`${baseUrl}/api/activity-logs?action=not-real`)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { message: 'Invalid activity action filter' })
})
