const mongoose = require('mongoose');

const payrollSettingsSchema = new mongoose.Schema({
    // Global Rates
    latePenaltyPerDay: { type: Number, default: 50000 },
    overtimeRatePerHour: { type: Number, default: 30000 },
    
    // Configurations
    workHoursStart: { type: Number, default: 9.25 }, // 09:15
    overtimeStart: { type: Number, default: 18 },  // 18:00
    workingDaysPerMonth: { type: Number, default: 22 },
    
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String }
});

// Since this is a global configuration, we usually only have ONE record.
// We'll enforce this by always using a specific ID or findOne.

module.exports = mongoose.model('PayrollSettings', payrollSettingsSchema);
