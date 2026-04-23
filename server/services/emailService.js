const nodemailer = require('nodemailer');
const { getMonthName } = require('./payrollEngine');

let transporterInstance = null;

// ============================================================
// EMAIL TRANSPORTER SETUP
// ============================================================
function createTransporter() {
  if (transporterInstance) return transporterInstance;

  // Use environment variables for SMTP config
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('⚠️ SMTP credentials not configured. Email sending disabled.');
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporterInstance;
}

// ============================================================
// SEND ATTENDANCE REMINDER EMAIL
// ============================================================
async function sendAttendanceReminder(user) {
  const transporter = createTransporter();
  if (!transporter) return { success: false, message: 'SMTP not configured' };

  const mailOptions = {
    from: `"EMS Notification" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `🔔 Pengingat Absensi Hari Ini — ${user.name}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #ef4444; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Pengingat Absensi</h1>
        </div>
        <div style="padding: 30px; background: white;">
          <p style="color: #334155; font-size: 16px;">Halo <strong>${user.name}</strong>,</p>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Kami mencatat bahwa Anda belum melakukan <strong>Clock In</strong> hingga pukul 08:30 WIB hari ini. 
            Mohon segera melakukan absensi melalui aplikasi untuk menghindari potongan keterlambatan.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
               Buka Aplikasi EMS
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; font-style: italic;">
            *Jika Anda sudah melakukan absensi atau sedang cuti/ijin, mohon abaikan pesan ini.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} EMS Technology — Official Notification</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error(`❌ Failed to send reminder to ${user.email}:`, err.message);
    return { success: false, message: err.message };
  }
}

// ============================================================
// SEND BULK ATTENDANCE REMINDERS (Parallel)
// ============================================================
async function sendBulkAttendanceReminders(users) {
  if (!users || users.length === 0) return { sent: 0, failed: 0 };

  console.log(`📡 [EMAIL] Sending parallel reminders to ${users.length} users...`);
  
  const promises = users.map(user => sendAttendanceReminder(user));
  const results = await Promise.allSettled(promises);

  const stats = { sent: 0, failed: 0 };
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value.success) {
      stats.sent++;
    } else {
      stats.failed++;
    }
  });

  return stats;
}

// ============================================================
// SEND SINGLE PAYSLIP EMAIL
// ============================================================
async function sendPayslipEmail(payroll, pdfBuffer) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [MOCK] Email would be sent to ${payroll.email}`);
    return { success: false, message: 'SMTP not configured', mock: true };
  }

  const periodStr = `${getMonthName(payroll.period.month)} ${payroll.period.year}`;
  const formatRupiah = (val) => 'Rp ' + Math.round(val).toLocaleString('id-ID');

  const mailOptions = {
    from: `"EMS Payroll" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to: payroll.email,
    subject: `💰 Slip Gaji ${periodStr} — ${payroll.name}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">OUR Company</h1>
          <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Slip Gaji — ${periodStr}</p>
        </div>

        <!-- Body -->
        <div style="padding: 30px;">
          <p style="color: #334155; font-size: 15px;">Halo <strong>${payroll.name}</strong>,</p>
          <p style="color: #64748b; font-size: 14px;">Berikut adalah slip gaji Anda untuk periode <strong>${periodStr}</strong>:</p>

          <!-- Summary Card -->
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Gaji Pokok</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b;">${formatRupiah(payroll.baseSalary)}</td>
              </tr>
              ${payroll.overtimePay > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Uang Lembur</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">+ ${formatRupiah(payroll.overtimePay)}</td>
              </tr>` : ''}
              ${payroll.mealAllowance > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Uang Makan</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">+ ${formatRupiah(payroll.mealAllowance)}</td>
              </tr>` : ''}
              ${payroll.transportAllowance > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Uang Transport</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">+ ${formatRupiah(payroll.transportAllowance)}</td>
              </tr>` : ''}
              <tr><td colspan="2"><hr style="border: none; border-top: 1px dashed #e2e8f0; margin: 8px 0;"></td></tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Total Potongan</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #ef4444;">- ${formatRupiah(payroll.totalDeductions)}</td>
              </tr>
              <tr><td colspan="2"><hr style="border: none; border-top: 2px solid #e2e8f0; margin: 8px 0;"></td></tr>
              <tr>
                <td style="padding: 12px 0; font-size: 15px; font-weight: 700; color: #1e293b;">Take Home Pay</td>
                <td style="padding: 12px 0; text-align: right; font-size: 20px; font-weight: 700; color: #2563eb;">${formatRupiah(payroll.netPay)}</td>
              </tr>
            </table>
          </div>

          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">
            📎 Slip gaji lengkap terlampir dalam format PDF.<br>
            Dokumen ini bersifat rahasia.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #1e293b; padding: 16px; text-align: center;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${payroll.period.year} EMS Technology — Human Resource Information System</p>
        </div>
      </div>
    `,
    attachments: pdfBuffer ? [{
      filename: `Payslip_${payroll.name.replace(/\s+/g, '_')}_${getMonthName(payroll.period.month)}_${payroll.period.year}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${payroll.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send email to ${payroll.email}:`, err.message);
    return { success: false, message: err.message };
  }
}

// ============================================================
// SEND BULK PAYSLIP EMAILS
// ============================================================
async function sendBulkPayslips(payrollRecords, generatePDF) {
  const results = { sent: 0, failed: 0, skipped: 0, details: [] };

  for (const record of payrollRecords) {
    if (record.emailSent) {
      results.skipped++;
      results.details.push({ email: record.email, status: 'skipped', reason: 'Already sent' });
      continue;
    }

    try {
      // Generate PDF for this record
      let pdfBuffer = null;
      if (generatePDF) {
        pdfBuffer = await generatePDF(record);
      }

      const emailResult = await sendPayslipEmail(record, pdfBuffer);

      if (emailResult.success) {
        // Update payroll record
        const Payroll = require('../models/Payroll');
        await Payroll.findByIdAndUpdate(record._id, {
          emailSent: true,
          emailSentAt: new Date()
        });
        results.sent++;
        results.details.push({ email: record.email, status: 'sent' });
      } else {
        results.failed++;
        results.details.push({ email: record.email, status: 'failed', reason: emailResult.message });
      }
    } catch (err) {
      results.failed++;
      results.details.push({ email: record.email, status: 'failed', reason: err.message });
    }
  }

  return results;
}

module.exports = { sendPayslipEmail, sendBulkPayslips, sendAttendanceReminder, sendBulkAttendanceReminders };

