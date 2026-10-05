const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON payload')
    return res.status(400).json({
      error: 'Invalid JSON payload'
    })
  }

  console.error('Server Error:', err.message || err)

  res.status(500).json({
    error: 'Internal server error'
  })
}

module.exports = errorHandler
