const express = require('express')
const cors = require('cors')

const requestLogger = require('./middleware/requestLogger')
const errorHandler = require('./middleware/errorHandler')
const claimsRouter = require('./routes/claims')
const activityLogsRouter = require('./routes/activityLogs')
const sdaoRouter = require('./routes/sdao')
const itemClaimsRouter = require('./routes/itemClaims')

const app = express()

app.use(cors())
app.use(express.json())
app.use(requestLogger)

app.get('/', (req, res) => {
  res.json({
    message: 'CampusFind API is running',
  })
})

app.use('/api/claims', claimsRouter)
app.use('/api/activity-logs', activityLogsRouter)
app.use('/api/sdao', sdaoRouter)
app.use('/api/items', itemClaimsRouter)

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  })
})

app.use(errorHandler)

module.exports = app
