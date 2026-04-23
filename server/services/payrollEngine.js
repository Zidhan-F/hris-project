const User = require('../models/User');
const Payroll = require('../models/Payroll');
const PayrollSettings = require('../models/PayrollSettings');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');



// ============================================================
// KONFIGURASI TARIF (bisa diubah sesuai kebijakan perusahaan)
// ============================================================
const RATES = {
  LATE_PENALTY_PER_DAY: 50000,       // Rp 50.000 per hari terlambat
  OVERTIME_PER_HOUR: 30000,           // Rp 30.000 per jam lembur
  MEAL_ALLOWANCE_PER_DAY: 25000,      // Rp 25.000 per hari hadir
  TRANSPORT_ALLOWANCE_PER_DAY: 20000, // Rp 20.000 per hari hadir
  BPJS_KESEHATAN_RATE: 0.01,          // 1% dari gaji pokok
  BPJS_KETENAGAKERJAAN_RATE: 0.02,    // 2% dari gaji pokok
  WORK_HOURS_START: 9.25,             // 09:15 — batas terlambat
  OVERTIME_START: 17,                  // 17:00 — mulai lembur
  WORKING_DAYS_PER_MONTH: 22,         // Asumsi hari kerja
};

// ============================================================
// PTKP (Penghasilan Tidak Kena Pajak) — 2024
// ============================================================
const PTKP_TABLE = {
  'TK/0': 54000000,    // Tidak Kawin, tanpa tanggungan
  'TK/1': 58500000,    // Tidak Kawin + 1 tanggungan
  'TK/2': 63000000,    // Tidak Kawin + 2 tanggungan
  'TK/3': 67500000,    // Tidak Kawin + 3 tanggungan
  'K/0': 58500000,     // Kawin, tanpa tanggungan
  'K/1': 63000000,     // Kawin + 1 tanggungan
  'K/2': 67500000,     // Kawin + 2 tanggungan
  'K/3': 72000000,     // Kawin + 3 tanggungan
};

// ============================================================
// PPh 21 — Tarif Progresif (PP 58/2023 — berlaku 2024)
// ============================================================
function calculatePPh21Monthly(grossYearly, ptkpStatus) {
  const ptkp = PTKP_TABLE[ptkpStatus] || PTKP_TABLE['TK/0'];
  const pkp = Math.max(0, grossYearly - ptkp); // Penghasilan Kena Pajak

  let tax = 0;
  if (pkp <= 60000000) {
    tax = pkp * 0.05;
  } else if (pkp <= 250000000) {
    tax = 60000000 * 0.05 + (pkp - 60000000) * 0.15;
  } else if (pkp <= 500000000) {
    tax = 60000000 * 0.05 + 190000000 * 0.15 + (pkp - 250000000) * 0.25;
  } else if (pkp <= 5000000000) {
    tax = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + (pkp - 500000000) * 0.30;
  } else {
    tax = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + 4500000000 * 0.30 + (pkp - 5000000000) * 0.35;
  }

  // Return monthly tax (divide yearly by 12)
  return Math.round(tax / 12);
}

// ============================================================
// HITUNG ATTENDANCE SUMMARY DARI DATABASE
// ============================================================
async function getAttendanceSummary(email, month, year, manualOvertimeByDay = {}, preFetchedRecords = null) {
  const Attendance = mongoose.model('Attendance');

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  // Optimasi: Gunakan data yang sudah di-fetch jika tersedia
  const records = preFetchedRecords || await Attendance.find({
    email: { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
    timestamp: { $gte: start, $lte: end }
  }).sort({ timestamp: 1 });

  // Group by date
  const days = {};
  records.forEach(r => {
    const d = new Date(r.timestamp);
    const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    if (!days[dateKey]) days[dateKey] = { ins: [], outs: [] };
    if (r.type === 'clock_in') days[dateKey].ins.push(d);
    if (r.type === 'clock_out') days[dateKey].outs.push(d);
  });

  // Ensure days from manual overtime are included even if no attendance
  Object.keys(manualOvertimeByDay).forEach(dateKey => {
    if (!days[dateKey]) days[dateKey] = { ins: [], outs: [] };
  });

  let daysPresent = 0;
  let daysLate = 0;
  let overtimeHours = 0;
  let totalWorkHours = 0;

  const dailyOvertimeDetails = {};
  Object.entries(days).forEach(([dateStr, times]) => {
    let dailyAutoOvertime = 0;
    
    if (times.ins.length > 0) {
      daysPresent++;
      const firstIn = new Date(Math.min(...times.ins.map(d => d.getTime())));
      const jakartaIn = new Date(firstIn.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const inHour = jakartaIn.getHours() + jakartaIn.getMinutes() / 60;
      if (inHour > RATES.WORK_HOURS_START) daysLate++;

      if (times.outs.length > 0) {
        const lastOut = new Date(Math.max(...times.outs.map(d => d.getTime())));
        const jakartaOut = new Date(lastOut.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const outHour = jakartaOut.getHours() + jakartaOut.getMinutes() / 60;
        
        if (outHour > RATES.OVERTIME_START) {
          dailyAutoOvertime = outHour - RATES.OVERTIME_START;
        }

        const workMs = lastOut.getTime() - firstIn.getTime();
        totalWorkHours += workMs / (1000 * 60 * 60);
      }
    }

    const dailyManualOvertime = manualOvertimeByDay[dateStr] || 0;
    const validatedDailyHours = Math.min(dailyAutoOvertime, 1) + dailyManualOvertime;
    
    overtimeHours += validatedDailyHours;
    if (validatedDailyHours > 0) {
      dailyOvertimeDetails[dateStr] = Math.round(validatedDailyHours * 10) / 10;
    }
  });

  return {
    daysPresent,
    daysLate,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    totalWorkHours: Math.round(totalWorkHours * 10) / 10,
    dailyOvertimeDetails
  };
}

// ============================================================
// HITUNG TOTAL JAM LEMBUR DARI REQUEST YANG APPROVED
// ============================================================
async function getApprovedOvertimeHoursPerDay(email, start, end, preFetchedRequests = null) {
  const Request = mongoose.model('Request');
  
  // Optimasi: Gunakan data yang sudah di-fetch jika tersedia
  const overtimeRequests = preFetchedRequests || await Request.find({
    email: { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
    type: 'Overtime',
    status: 'Approved',
    startDate: { $lte: end },
    endDate: { $gte: start }
  });

  const dailyRequestHours = {};
  overtimeRequests.forEach(req => {
    if (req.startDate && req.endDate) {
      const hours = Math.max(0, (new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60));
      const dateKey = new Date(req.startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      dailyRequestHours[dateKey] = (dailyRequestHours[dateKey] || 0) + hours;
    }
  });
  return dailyRequestHours;
}

// ============================================================
// HITUNG REIMBURSEMENT YANG SUDAH APPROVED
// ============================================================
async function getApprovedReimbursements(email, month, year, preFetchedRequests = null) {
  const Request = mongoose.model('Request');
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  // Optimasi: Gunakan data yang sudah di-fetch jika tersedia
  const reimbursements = preFetchedRequests || await Request.find({
    email: { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
    type: 'Reimbursement',
    status: 'Approved',
    timestamp: { $gte: start, $lte: end }
  });

  return reimbursements.reduce((sum, r) => sum + (r.amount || 0), 0);
}

// ============================================================
// HITUNG UNPAID LEAVE DAYS (Cuti Tidak Dibayar)
// ============================================================
async function getUnpaidLeaveDays(email, month, year, preFetchedRequests = null) {
  const Request = mongoose.model('Request');
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  // Optimasi: Gunakan data yang sudah di-fetch jika tersedia
  const leaves = preFetchedRequests || await Request.find({
    email: { $regex: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i") },
    type: { $in: ['Leave', 'Permit'] },
    status: 'Approved',
    startDate: { $lte: end },
    endDate: { $gte: start }
  });

  let unpaidDaysTotal = 0;
  leaves.forEach(leave => {
    unpaidDaysTotal += (leave.unpaidDays || 0);
  });

  return unpaidDaysTotal;
}

// ============================================================
// CALCULATE PAYROLL FOR SINGLE EMPLOYEE
// ============================================================
async function calculateEmployeePayroll(userId, month, year, calculatedBy = 'system', preFetchedData = null) {
  const user = (preFetchedData && preFetchedData.user) || await User.findById(userId);
  if (!user) throw new Error('User not found');

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  // 1. Manual Overtime Requests
  const manualOvertimeByDay = await getApprovedOvertimeHoursPerDay(
    user.email, start, end, 
    preFetchedData?.requests?.filter(r => r.type === 'Overtime')
  );

  // 2. Attendance Summary
  const attendance = await getAttendanceSummary(
    user.email, month, year, manualOvertimeByDay, 
    preFetchedData?.attendance
  );

  // 3. Reimbursements
  const reimbursement = await getApprovedReimbursements(
    user.email, month, year, 
    preFetchedData?.requests?.filter(r => r.type === 'Reimbursement')
  );

  // 4. Unpaid Leave
  const unpaidLeaveDays = await getUnpaidLeaveDays(
    user.email, month, year, 
    preFetchedData?.requests?.filter(r => ['Leave', 'Permit'].includes(r.type))
  );

  // 5. Global Settings
  let settings = { ...RATES };
  if (preFetchedData && preFetchedData.payrollSettings) {
    const pSettings = preFetchedData.payrollSettings;
    if (pSettings.latePenaltyPerDay !== undefined) settings.LATE_PENALTY_PER_DAY = pSettings.latePenaltyPerDay;
    if (pSettings.overtimeRatePerHour !== undefined) settings.OVERTIME_PER_HOUR = pSettings.overtimeRatePerHour;
    if (pSettings.workHoursStart !== undefined) settings.WORK_HOURS_START = pSettings.workHoursStart;
  } else {
    try {
      const pSettings = await PayrollSettings.findOne();
      if (pSettings) {
        if (pSettings.latePenaltyPerDay !== undefined) settings.LATE_PENALTY_PER_DAY = pSettings.latePenaltyPerDay;
        if (pSettings.overtimeRatePerHour !== undefined) settings.OVERTIME_PER_HOUR = pSettings.overtimeRatePerHour;
        if (pSettings.workHoursStart !== undefined) settings.WORK_HOURS_START = pSettings.workHoursStart;
      }
    } catch (err) {
      console.error('Failed to fetch PayrollSettings:', err.message);
    }
  }

  // 6. Calculate earnings
  const baseSalary = user.baseSalary || 5000000;
  const otherAllowance = user.allowance || 0;
  
  let overtimePay = 0;
  const overtimeRateBase = settings.OVERTIME_PER_HOUR;
  
  if (user.role === 'employee') {
    Object.values(attendance.dailyOvertimeDetails || {}).forEach(hours => {
      if (hours > 0) {
        const firstHour = Math.min(hours, 1);
        overtimePay += firstHour * 1.5 * overtimeRateBase;
        if (hours > 1) {
          const extraHours = hours - 1;
          overtimePay += extraHours * 2.0 * overtimeRateBase;
        }
      }
    });
  }

  const overtimeHoursTotal = Math.round(attendance.overtimeHours * 10) / 10;
  const mealRate = user.mealAllowanceRate ?? settings.MEAL_ALLOWANCE_PER_DAY;
  const transportRate = user.transportAllowanceRate ?? settings.TRANSPORT_ALLOWANCE_PER_DAY;
  const mealAllowance = attendance.daysPresent * mealRate;
  const transportAllowance = attendance.daysPresent * transportRate;

  const grossPay = baseSalary + otherAllowance + overtimePay + mealAllowance + transportAllowance + reimbursement;
  const taxableGross = grossPay - reimbursement;

  const latePenalty = attendance.daysLate * settings.LATE_PENALTY_PER_DAY;
  const unpaidLeaveDeduction = Math.round((baseSalary / 22) * unpaidLeaveDays);

  const bpjsKesehatan = user.bpjsKesehatanAmount === 0 
    ? 0 
    : (user.bpjsKesehatanAmount > 1 
        ? user.bpjsKesehatanAmount 
        : Math.round(baseSalary * RATES.BPJS_KESEHATAN_RATE));
    
  const bpjsKetenagakerjaan = user.bpjsTkAmount === 0 
    ? 0 
    : (user.bpjsTkAmount > 1 
        ? user.bpjsTkAmount 
        : Math.round(baseSalary * RATES.BPJS_KETENAGAKERJAAN_RATE));

  let pph21 = 0;
  let ptkpStatus = user.ptkpStatus || 'TK/0';
  let taxableYearly = taxableGross * 12;

  if (user.pph21Amount === 0) {
    pph21 = 0;
  } else if (user.pph21Amount > 1) {
    pph21 = user.pph21Amount;
  } else {
    pph21 = calculatePPh21Monthly(taxableYearly, ptkpStatus);
  }

  const totalDeductions = latePenalty + unpaidLeaveDeduction + bpjsKesehatan + bpjsKetenagakerjaan + pph21;
  const netPay = Math.max(0, grossPay - totalDeductions);

  const payrollData = {
    employeeId: user._id,
    email: user.email,
    name: user.name,
    position: user.position || 'Staff',
    department: user.department || 'General',
    employeeCode: user.employeeId || 'EMS-000',
    profilePicture: user.profilePicture,
    bankAccount: user.bankAccount || '-',
    bankName: user.bankName || '-',
    period: { month, year },
    baseSalary,
    overtimePay: Math.round(overtimePay),
    overtimeHours: overtimeHoursTotal,
    mealAllowance,
    transportAllowance,
    reimbursement,
    otherAllowance,
    latePenalty,
    lateDays: attendance.daysLate,
    unpaidLeaveDays,
    unpaidLeaveDeduction,
    bpjsKesehatan,
    bpjsKetenagakerjaan,
    pph21,
    grossPay,
    totalDeductions,
    netPay,
    overtimeRatePerHour: settings.OVERTIME_PER_HOUR,
    mealAllowanceRate: mealRate,
    transportAllowanceRate: transportRate,
    latePenaltyPerDay: settings.LATE_PENALTY_PER_DAY,
    bpjsKesehatanRate: RATES.BPJS_KESEHATAN_RATE,
    bpjsKetenagakerjaanRate: RATES.BPJS_KETENAGAKERJAAN_RATE,
    attendanceSummary: attendance,
    ptkpStatus,
    ptkpAmount: PTKP_TABLE[ptkpStatus] || PTKP_TABLE['TK/0'],
    taxableIncomeYearly: Math.max(0, taxableYearly - (PTKP_TABLE[ptkpStatus] || PTKP_TABLE['TK/0'])),
    calculatedAt: new Date(),
    calculatedBy,
    updatedAt: new Date()
  };

  const payroll = await Payroll.findOneAndUpdate(
    { employeeId: user._id, 'period.month': month, 'period.year': year },
    { 
      $set: payrollData, 
      $setOnInsert: { status: 'Draft', emailSent: false, createdAt: new Date() } 
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (payroll.status === 'Finalized') {
    payroll.status = 'Draft';
    await payroll.save();
  }

  return payroll;
}

// ============================================================
// CALCULATE PAYROLL FOR ALL EMPLOYEES (Bulk Optimized)
// ============================================================
async function calculateAllPayroll(month, year, calculatedBy = 'system-cron', ids = []) {
  const query = {};
  if (ids && ids.length > 0) {
    query._id = { $in: ids };
  }
  const users = await User.find(query).sort({ name: 1 });
  
  // BULK FETCHING: Ambil semua data sekaligus untuk menghindari N+1 query
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  console.log(`🚀 [PAYROLL] Starting bulk calculation for ${users.length} users...`);

  const [allAttendance, allRequests, payrollSettings] = await Promise.all([
    mongoose.model('Attendance').find({ timestamp: { $gte: start, $lte: end } }),
    mongoose.model('Request').find({ 
      status: 'Approved',
      $or: [
        { timestamp: { $gte: start, $lte: end } }, // Reimbursements
        { startDate: { $lte: end }, endDate: { $gte: start } } // Leaves/Overtime
      ]
    }),
    PayrollSettings.findOne()
  ]);

  // Group data by email untuk pencarian cepat O(1)
  const attendanceMap = {};
  allAttendance.forEach(a => {
    const email = a.email.toLowerCase();
    if (!attendanceMap[email]) attendanceMap[email] = [];
    attendanceMap[email].push(a);
  });

  const requestMap = {};
  allRequests.forEach(r => {
    const email = r.email.toLowerCase();
    if (!requestMap[email]) requestMap[email] = [];
    requestMap[email].push(r);
  });

  const results = [];
  const errors = [];

  for (const user of users) {
    try {
      const email = user.email.toLowerCase();
      const preFetchedData = {
        user,
        attendance: attendanceMap[email] || [],
        requests: requestMap[email] || [],
        payrollSettings
      };

      const payroll = await calculateEmployeePayroll(user._id, month, year, calculatedBy, preFetchedData);
      results.push(payroll);
    } catch (err) {
      errors.push({ email: user.email, error: err.message });
      console.error(`❌ Payroll error for ${user.email}:`, err.message);
    }
  }

  console.log(`✅ Payroll calculated: ${results.length} success, ${errors.length} errors`);
  return { results, errors, total: users.length };
}

// ============================================================
// GENERATE BANK TRANSFER CSV (With CSV Escaping)
// ============================================================
async function generateBankTransferCSV(month, year, format = 'bca', ids = []) {
  const query = {
    'period.month': month,
    'period.year': year
  };
  
  if (ids && ids.length > 0) {
    query._id = { $in: ids };
  } else {
    // If exporting all, only include those ready for payment
    query.status = { $in: ['Finalized', 'Paid'] };
  }

  const records = await Payroll.find(query).sort({ name: 1 });

  // Helper to escape CSV fields
  const esc = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('|')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (format === 'mandiri') {
    // Mandiri MCM Format: NoRek|NamaRek|Nominal|Keterangan
    let csv = 'No Rekening|Nama Penerima|Jumlah Transfer|Keterangan\n';
    records.forEach(r => {
      const acc = r.bankAccount !== '-' ? r.bankAccount : '';
      csv += `${esc(acc)}|${esc(r.name)}|${r.netPay}|Gaji ${getMonthName(month)} ${year}\n`;
    });
    return { content: csv, filename: `transfer_mandiri_${getMonthName(month)}_${year}.txt` };
  }

  // KlikBCA Bisnis Format: NoRek,NamaPenerima,Nominal,Email,Keterangan
  let csv = 'No Rekening,Nama Penerima,Jumlah Transfer,Email,Keterangan\n';
  records.forEach(r => {
    const acc = r.bankAccount !== '-' ? r.bankAccount : '';
    csv += `${esc(acc)},${esc(r.name)},${r.netPay},${esc(r.email)},Gaji ${getMonthName(month)} ${year}\n`;
  });
  return { content: csv, filename: `transfer_bca_${getMonthName(month)}_${year}.csv` };
}

function getMonthName(month) {
  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return names[month] || 'Unknown';
}

module.exports = {
  calculateEmployeePayroll,
  calculateAllPayroll,
  generateBankTransferCSV,
  RATES,
  PTKP_TABLE,
  getMonthName
};
