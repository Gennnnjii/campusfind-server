const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const requestLogger = require('./middleware/requestLogger')
const errorHandler = require('./middleware/errorHandler')

const app = express()
const PORT = process.env.PORT || 8000

app.use(cors())
app.use(express.json())
app.use(requestLogger)

app.get('/', (req, res) => {
  res.json({
    message: 'CampusFind API is running',
  })
})

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  })
})

app.use(errorHandler)

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI)

    console.log('MongoDB connected')

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

startServer()
