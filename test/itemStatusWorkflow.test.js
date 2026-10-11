const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveItemStatusTransition } = require('../services/itemStatusWorkflow')

test('item status workflow allows only its forward transitions', () => {
  assert.equal(resolveItemStatusTransition({ type: 'lost', status: 'open' }, 'recovered'), 'recover_lost')
  assert.equal(resolveItemStatusTransition({ type: 'found', status: 'pending_turnover' }, 'available_for_claim'), 'confirm_turnover')
  assert.equal(resolveItemStatusTransition({ type: 'found', status: 'available_for_claim' }, 'returned'), 'mark_returned')

  assert.equal(resolveItemStatusTransition({ type: 'lost', status: 'recovered' }, 'open'), null)
  assert.equal(resolveItemStatusTransition({ type: 'found', status: 'available_for_claim' }, 'pending_turnover'), null)
  assert.equal(resolveItemStatusTransition({ type: 'found', status: 'pending_turnover' }, 'returned'), null)
  assert.equal(resolveItemStatusTransition({ type: 'lost', status: 'open' }, 'available_for_claim'), null)
})
