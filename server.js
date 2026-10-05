const mongoose = require('mongoose')
require('dotenv').config()

const app = require('./app')

const PORT = process.env.PORT || 8000

async function startServer() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required. Copy .env.example to .env and configure it.')
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('MongoDB connected')

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message)
  process.exit(1)
})
