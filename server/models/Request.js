const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Leave', 'Permit', 'Sick', 'Overtime', 'Reimbursement', 'Timesheet', 'Expense', 'Other'],
    required: true 
  },
  startDate: { type: Date },
  endDate: { type: Date },
  reason: { type: String, required: true },
  amount: { type: Number }, // For Reimbursement/Expense
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Returned'], 
    default: 'Pending' 
  },
  unpaidDays: { type: Number, default: 0 },
  isUnpaid: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }

});

module.exports = mongoose.model('Request', requestSchema);
