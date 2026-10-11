const Location = require('../models/Location')
const createReferenceManagementRouter = require('./referenceManagement')

module.exports = createReferenceManagementRouter({
  Model: Location,
  label: 'Location',
  itemReferenceField: 'location'
})
