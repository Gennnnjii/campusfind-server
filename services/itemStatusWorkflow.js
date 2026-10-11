function resolveItemStatusTransition(item, targetStatus) {
  if (item?.type === 'lost' && item.status === 'open' && targetStatus === 'recovered') {
    return 'recover_lost'
  }
  if (item?.type === 'found' && item.status === 'pending_turnover' && targetStatus === 'available_for_claim') {
    return 'confirm_turnover'
  }
  if (item?.type === 'found' && item.status === 'available_for_claim' && targetStatus === 'returned') {
    return 'mark_returned'
  }
  return null
}

module.exports = { resolveItemStatusTransition }
