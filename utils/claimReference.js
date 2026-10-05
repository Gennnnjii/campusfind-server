const crypto = require('crypto')

function generateClaimReference(date = new Date()) {
  const datePart = date.toISOString().slice(0, 10).replaceAll('-', '')
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `CF-${datePart}-${randomPart}`
}

module.exports = { generateClaimReference }
