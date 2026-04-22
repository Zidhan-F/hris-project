const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  position: { type: String, default: 'Staff' },
  department: { type: String, default: 'General' },
  employeeCode: { type: String, default: 'EMS-000' },
  bankAccount: { type: String, default: '-' },
  bankName: { type: String, default: '-' },
  profilePicture: { type: String },


  // Period
  period: {
    month: { type: Number, required: true }, // 0-11
    year: { type: Number, required: true }
  },

  // === KOMPONEN PENDAPATAN ===
  baseSalary: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  mealAllowance: { type: Number, default: 0 },
  transportAllowance: { type: Number, default: 0 },
  reimbursement: { type: Number, default: 0 },
  otherAllowance: { type: Number, default: 0 },

  // === KOMPONEN POTONGAN ===
  latePenalty: { type: Number, default: 0 },
  lateDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  unpaidLeaveDeduction: { type: Number, default: 0 },
  bpjsKesehatan: { type: Number, default: 0 },
  bpjsKetenagakerjaan: { type: Number, default: 0 },
  pph21: { type: Number, default: 0 },

  // === SUMMARY ===
  grossPay: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netPay: { type: Number, default: 0 },

  // === RATES USED (Historical Accuracy) ===
  overtimeRatePerHour: { type: Number },
  mealAllowanceRate: { type: Number },
  transportAllowanceRate: { type: Number },
  latePenaltyPerDay: { type: Number },
  bpjsKesehatanRate: { type: Number },
  bpjsKetenagakerjaanRate: { type: Number },

  // === ATTENDANCE SUMMARY ===
  attendanceSummary: {
    daysPresent: { type: Number, default: 0 },
    daysLate: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    totalWorkHours: { type: Number, default: 0 }
  },

  // === TAX INFO ===
  ptkpStatus: { type: String, default: 'TK/0' },
  ptkpAmount: { type: Number, default: 54000000 },
  taxableIncomeYearly: { type: Number, default: 0 },

  // === STATUS ===
  status: {
    type: String,
    enum: ['Draft', 'Finalized', 'Paid'],
    default: 'Draft'
  },

  // === METADATA ===
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  calculatedAt: { type: Date, default: Date.now },
  calculatedBy: { type: String, default: 'system' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index: one payroll record per employee per period
payrollSchema.index({ employeeId: 1, 'period.month': 1, 'period.year': 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
