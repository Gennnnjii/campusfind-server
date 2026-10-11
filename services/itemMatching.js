const MATCH_BOUNDARY_MS = 259200000 // 3 days in milliseconds: 3 * 24 * 60 * 60 * 1000

function normalizeId(value) {
  if (value == null) return null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || null
  }

  if (typeof value !== 'object') {
    return null
  }

  if (typeof value.toHexString === 'function') {
    const hexadecimal = value.toHexString()
    return typeof hexadecimal === 'string' && hexadecimal.trim()
      ? hexadecimal.trim()
      : null
  }

  if (value._id && value._id !== value) {
    return normalizeId(value._id)
  }

  if (
    typeof value.toString === 'function' &&
    value.toString !== Object.prototype.toString
  ) {
    const normalized = value.toString().trim()

    if (normalized && normalized !== '[object Object]') {
      return normalized
    }
  }

  return null
}

function tokenizeTitle(title) {
  if (typeof title !== 'string' || !title.trim()) {
    return new Set()
  }
  const cleaned = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const rawTokens = cleaned.trim().split(/\s+/)
  const validTokens = rawTokens.filter((token) => token.length >= 3)
  return new Set(validTokens)
}

function parseTimestamp(dateVal) {
  if (!dateVal) return null
  if (dateVal instanceof Date) {
    const t = dateVal.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof dateVal === 'string' || typeof dateVal === 'number') {
    const d = new Date(dateVal)
    const t = d.getTime()
    return Number.isNaN(t) ? null : t
  }
  return null
}

function calculateDateDeltaMs(dateA, dateB) {
  const tsA = parseTimestamp(dateA)
  const tsB = parseTimestamp(dateB)
  if (tsA === null || tsB === null) return null
  return Math.abs(tsA - tsB)
}

function calculateMatchScore(source, candidate) {
  const breakdown = {
    category: 0,
    location: 0,
    date: 0,
    title: 0
  }
  const reasons = []

  // 1. Same non-null Category ObjectId (+40)
  const sourceCatId = normalizeId(source?.category)
  const candCatId = normalizeId(candidate?.category)
  if (sourceCatId && candCatId && sourceCatId === candCatId) {
    breakdown.category = 40
    reasons.push('Same category')
  }

  // 2. Same non-null Location ObjectId (+25)
  const sourceLocId = normalizeId(source?.location)
  const candLocId = normalizeId(candidate?.location)
  if (sourceLocId && candLocId && sourceLocId === candLocId) {
    breakdown.location = 25
    reasons.push('Same location')
  }

  // 3. Date proximity within 259200000 ms (+20)
  const dateDelta = calculateDateDeltaMs(source?.dateOccurred, candidate?.dateOccurred)
  if (dateDelta !== null && dateDelta <= MATCH_BOUNDARY_MS) {
    breakdown.date = 20
    reasons.push('Date within 3 days')
  }

  // 4. Shared normalized title token (+15)
  const sourceTokens = tokenizeTitle(source?.title)
  const candTokens = tokenizeTitle(candidate?.title)
  let hasSharedToken = false
  for (const token of sourceTokens) {
    if (candTokens.has(token)) {
      hasSharedToken = true
      break
    }
  }
  if (hasSharedToken) {
    breakdown.title = 15
    reasons.push('Shared title keywords')
  }

  const score = breakdown.category + breakdown.location + breakdown.date + breakdown.title

  return {
    score,
    reasons,
    scoreBreakdown: breakdown,
    dateDelta
  }
}

function compareMatches(a, b, source) {
  const scoreA = typeof a?.score === 'number' ? a.score : (source ? calculateMatchScore(source, a).score : 0)
  const scoreB = typeof b?.score === 'number' ? b.score : (source ? calculateMatchScore(source, b).score : 0)
  if (scoreB !== scoreA) {
    return scoreB - scoreA
  }

  const deltaA = a?.dateDelta !== undefined ? a.dateDelta : (source ? calculateDateDeltaMs(source?.dateOccurred, a?.dateOccurred) : null)
  const deltaB = b?.dateDelta !== undefined ? b.dateDelta : (source ? calculateDateDeltaMs(source?.dateOccurred, b?.dateOccurred) : null)
  const hasDeltaA = typeof deltaA === 'number' && !Number.isNaN(deltaA)
  const hasDeltaB = typeof deltaB === 'number' && !Number.isNaN(deltaB)
  if (hasDeltaA && hasDeltaB) {
    if (deltaA !== deltaB) return deltaA - deltaB
  } else if (hasDeltaA) {
    return -1
  } else if (hasDeltaB) {
    return 1
  }

  const timeA = parseTimestamp(a?.dateOccurred)
  const timeB = parseTimestamp(b?.dateOccurred)
  if (timeA !== null && timeB !== null) {
    if (timeB !== timeA) return timeB - timeA
  } else if (timeA !== null) {
    return -1
  } else if (timeB !== null) {
    return 1
  }

  const titleA = typeof a?.title === 'string' ? a.title : ''
  const titleB = typeof b?.title === 'string' ? b.title : ''
  const titleComp = titleA.localeCompare(titleB, 'en', { sensitivity: 'base' })
  if (titleComp !== 0) return titleComp

  const idA = normalizeId(a?._id) || ''
  const idB = normalizeId(b?._id) || ''
  return idA.localeCompare(idB)
}

function formatNamedReference(ref) {
  if (!ref) return null
  if (typeof ref === 'object') {
    const id = normalizeId(ref._id)
    if (!id) return null
    return {
      _id: id,
      name: typeof ref.name === 'string' ? ref.name : ''
    }
  }
  const id = normalizeId(ref)
  if (!id) return null
  return {
    _id: id,
    name: ''
  }
}

function isSourceActive(source) {
  if (!source || typeof source !== 'object') return false
  if (source.type === 'lost') {
    return source.status === 'open'
  }
  if (source.type === 'found') {
    return source.status === 'pending_turnover' || source.status === 'available_for_claim'
  }
  return false
}

function isCandidateEligible(source, candidate) {
  if (!source || !candidate) return false
  const sourceId = normalizeId(source._id)
  const candId = normalizeId(candidate._id)
  if (!candId) return false
  if (sourceId && candId === sourceId) return false

  if (source.type === 'lost') {
    if (source.status !== 'open') return false
    return candidate.type === 'found' && candidate.status === 'available_for_claim'
  }

  if (source.type === 'found') {
    if (source.status !== 'pending_turnover' && source.status !== 'available_for_claim') return false
    return candidate.type === 'lost' && candidate.status === 'open'
  }

  return false
}

function findPossibleMatches(source, candidates, limit = 3) {
  if (!isSourceActive(source) || !Array.isArray(candidates)) {
    return []
  }

  const eligibleScored = []

  for (const candidate of candidates) {
    if (!isCandidateEligible(source, candidate)) {
      continue
    }

    const { score, reasons, scoreBreakdown, dateDelta } = calculateMatchScore(source, candidate)
    if (score <= 0) {
      continue
    }

    eligibleScored.push({
      _id: normalizeId(candidate._id),
      title: typeof candidate.title === 'string' ? candidate.title : '',
      description: typeof candidate.description === 'string' ? candidate.description : '',
      type: candidate.type,
      status: candidate.status,
      category: formatNamedReference(candidate.category),
      location: formatNamedReference(candidate.location),
      dateOccurred: candidate.dateOccurred,
      claimLocation: typeof candidate.claimLocation === 'string' ? candidate.claimLocation : 'SDAO',
      score,
      reasons,
      scoreBreakdown,
      dateDelta
    })
  }

  eligibleScored.sort((a, b) => compareMatches(a, b, source))

  const topMatches = eligibleScored.slice(0, limit)

  return topMatches.map((item) => ({
    _id: item._id,
    title: item.title,
    description: item.description,
    type: item.type,
    status: item.status,
    category: item.category,
    location: item.location,
    dateOccurred: item.dateOccurred,
    claimLocation: item.claimLocation,
    score: item.score,
    reasons: item.reasons,
    scoreBreakdown: item.scoreBreakdown
  }))
}

module.exports = {
  normalizeId,
  tokenizeTitle,
  calculateDateDeltaMs,
  calculateMatchScore,
  compareMatches,
  findPossibleMatches
}
