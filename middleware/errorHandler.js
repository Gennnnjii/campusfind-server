const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON payload')
    return res.status(400).json({
      message: 'Invalid JSON payload'
    })
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((error) => error.message)
    return res.status(400).json({ message: 'Validation failed', details })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path || 'identifier'}` })
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'A record with that unique value already exists' })
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    })
  }

  console.error('Server error:', err.message || err)

  res.status(500).json({
    message: 'Internal server error'
  })
}

module.exports = errorHandler
