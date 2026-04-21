const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: { 
        type: String, 
        unique: true, 
        required: true 
    },
    value: mongoose.Schema.Types.Mixed,
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    collection: 'settings' // Explicit collection name to avoid pluralization issues
});

module.exports = mongoose.model('Settings', settingsSchema);
