const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const { calculateAllPayroll } = require('./payrollEngine');


const { generatePayslipPDF } = require('./pdfGenerator');
const { sendBulkPayslips, sendBulkAttendanceReminders } = require('./emailService');
const Payroll = require('../models/Payroll');

let cronStatus = {
  payrollCalc: { lastRun: null, nextRun: null, status: 'idle' },
  emailBlast: { lastRun: null, nextRun: null, status: 'idle' },
  isEnabled: false
};

// ============================================================
// INITIALIZE CRON JOBS
// Only active when explicitly enabled or in production
// ============================================================
function initCronJobs() {
  const enableCron = process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production';

  if (!enableCron) {
    console.log('⏸️  Cron Jobs DISABLED (set ENABLE_CRON=true to enable)');
    cronStatus.isEnabled = false;
    return;
  }

  cronStatus.isEnabled = true;
  console.log('🕐 Cron Jobs ENABLED');

  // ---- JOB 1: Auto Calculate Payroll (Tanggal 25, jam 00:00) ----
  cron.schedule('0 0 25 * *', async () => {
    console.log('🤖 [CRON] Running auto payroll calculation...');
    cronStatus.payrollCalc.status = 'running';
    cronStatus.payrollCalc.lastRun = new Date();

    try {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      await calculateAllPayroll(month, year, 'system-cron');
      cronStatus.payrollCalc.status = 'completed';
      console.log('✅ [CRON] Payroll calculation completed');
    } catch (err) {
      cronStatus.payrollCalc.status = 'error';
      console.error('❌ [CRON] Payroll calculation failed:', err.message);
    }
  }, { timezone: 'Asia/Jakarta' });

  // ---- JOB 2: Auto Send Email Payslips (Tanggal 25, jam 08:00) ----
  cron.schedule('0 8 25 * *', async () => {
    console.log('📧 [CRON] Running auto email blast...');
    cronStatus.emailBlast.status = 'running';
    cronStatus.emailBlast.lastRun = new Date();

    try {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      const records = await Payroll.find({
        'period.month': month,
        'period.year': year,
        status: { $in: ['Finalized', 'Paid'] },
        emailSent: false
      });

      if (records.length > 0) {
        await sendBulkPayslips(records, generatePayslipPDF);
      }

      cronStatus.emailBlast.status = 'completed';
      console.log(`✅ [CRON] Email blast completed: ${records.length} emails processed`);
    } catch (err) {
      cronStatus.emailBlast.status = 'error';
      console.error('❌ [CRON] Email blast failed:', err.message);
    }
  }, { timezone: 'Asia/Jakarta' });

  // ---- JOB 3: Daily Attendance Reminder (Mon-Fri, 08:30 WIB) ----
  cron.schedule('30 8 * * 1-5', async () => {
    console.log('🔔 [CRON] Running attendance reminder check...');
    try {
      const Attendance = mongoose.model('Attendance');
      const jakartaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      const start = new Date(`${jakartaDateStr}T00:00:00.000+07:00`);
      const end = new Date(`${jakartaDateStr}T23:59:59.999+07:00`);

      const allUsers = await User.find({ role: 'Employee' });
      const todayAttendances = await Attendance.find({ timestamp: { $gte: start, $lte: end }, type: 'clock_in' });
      const presentEmails = todayAttendances.map(a => a.email);

      const missingUsers = allUsers.filter(u => !presentEmails.includes(u.email));

      if (missingUsers.length > 0) {
        console.log(`📡 [CRON] Sending reminders to ${missingUsers.length} employees...`);
        const stats = await sendBulkAttendanceReminders(missingUsers);
        console.log(`✅ [CRON] Reminders sent: ${stats.sent} success, ${stats.failed} failed`);
      }
    } catch (err) {
      console.error('❌ [CRON] Attendance reminder check failed:', err.message);
    }
  }, { timezone: 'Asia/Jakarta' });

  console.log('✅ Cron Jobs registered:');
  console.log('   📊 Payroll Calculation: Every 25th at 00:00 WIB');
  console.log('   📧 Email Blast: Every 25th at 08:00 WIB');
  console.log('   🔔 Attendance Reminder: Mon-Fri at 08:30 WIB');
}


function getCronStatus() {
  return cronStatus;
}

module.exports = { initCronJobs, getCronStatus };
