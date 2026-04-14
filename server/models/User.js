const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // Untuk login Google
  googleId: { type: String }, // ID unik dari Google
  role: { type: String, enum: ['employee', 'hrd', 'manager', 'admin'], default: 'employee' },
  position: { type: String, default: 'Staff' },
  profilePicture: { type: String },
  bio: { type: String, maxlength: 250, default: '-' },
  // Personal Info
  phone: { type: String, default: '-' },
  address: { type: String, default: '-' },
  birthday: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other', '-'], default: '-' },
  maritalStatus: { type: String, default: '-' },
  // Contract Info
  employeeId: { type: String, default: 'EMS-000' },
  joinDate: { type: Date, default: Date.now },
  employmentStatus: { type: String, default: 'Probation' },
  contractEnd: { type: Date },
  // Team Info
  department: { type: String, default: 'General' },
  manager: { type: String, default: 'HR Manager' },
  teamMembers: { type: [Object], default: [] },
  // Payroll Info
  baseSalary: { type: Number, default: 5000000 },
  allowance: { type: Number, default: 0 },
  bankAccount: { type: String, default: '-' },
  payrollStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
  leaveQuota: { type: Number, default: 12 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);