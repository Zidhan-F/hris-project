const mongoose = require('mongoose');

const payrollLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'AUTO_CALC', 
            'FINALIZE_SINGLE', 
            'FINALIZE_ALL', 
            'MARK_PAID_SINGLE', 
            'MARK_PAID_ALL', 
            'MARK_UNPAID_SINGLE', 
            'MARK_UNPAID_ALL', 
            'SEND_EMAILS', 
            'EXPORT_BANK', 
            'SINGLE_UPDATE'
        ]
    },
    performedBy: {
        type: String,
        required: true
    },
    period: {
        month: Number,
        year: Number
    },
    entitiesCount: {
        type: Number,
        default: 0
    },
    details: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'payrolllogs'
});

module.exports = mongoose.model('PayrollLog', payrollLogSchema);
