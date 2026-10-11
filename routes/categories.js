const Category = require('../models/Category')
const createReferenceManagementRouter = require('./referenceManagement')

module.exports = createReferenceManagementRouter({
  Model: Category,
  label: 'Category',
  itemReferenceField: 'category'
})
