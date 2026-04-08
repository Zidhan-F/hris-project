const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // Untuk login Google
  googleId: { type: String }, // ID unik dari Google
  role: { type: String, enum: ['employee', 'admin'], default: 'employee' },
  position: { type: String, default: 'Staff' },
  profilePicture: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);