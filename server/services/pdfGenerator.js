const PDFDocument = require('pdfkit');
const { getMonthName } = require('./payrollEngine');

// ============================================================
// FORMAT CURRENCY HELPER
// ============================================================
function formatRupiah(val) {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

// ============================================================
// GENERATE PAYSLIP PDF
// Returns a Buffer containing the PDF
// ============================================================
async function generatePayslipPDF(payroll) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const periodStr = `${getMonthName(payroll.period.month)} ${payroll.period.year}`;

      // ---- HEADER ----
      doc.rect(0, 0, 595.28, 100).fill('#1e3a5f');
      doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
        .text('OUR Company', 50, 30);
      doc.fontSize(10).fillColor('#93c5fd').font('Helvetica')
        .text('Employee Management System — Official Payslip', 50, 58);
      doc.fontSize(10).fillColor('#93c5fd')
        .text(`Periode: ${periodStr}`, 50, 75);

      // Confidential badge
      doc.fontSize(8).fillColor('#fbbf24')
        .text('CONFIDENTIAL', 470, 35, { align: 'right' });

      // ---- EMPLOYEE INFO ----
      const y1 = 120;
      doc.fillColor('#1e293b');
      doc.fontSize(11).font('Helvetica-Bold').text('INFORMASI KARYAWAN', 50, y1);
      doc.moveTo(50, y1 + 16).lineTo(545, y1 + 16).strokeColor('#e2e8f0').lineWidth(1).stroke();

      const y2 = y1 + 25;
      doc.fontSize(9).font('Helvetica').fillColor('#64748b');

      // Left column
      doc.text('Nama Karyawan', 50, y2);
      doc.text('Posisi / Jabatan', 50, y2 + 18);
      doc.text('Departemen', 50, y2 + 36);
      doc.text('No. Rekening', 50, y2 + 54);

      doc.font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(payroll.name, 180, y2);
      doc.text(payroll.position || 'Staff', 180, y2 + 18);
      doc.text(payroll.department || 'General', 180, y2 + 36);
      doc.text(payroll.bankAccount || '-', 180, y2 + 54);

      // Right column
      doc.font('Helvetica').fillColor('#64748b');
      doc.text('Employee ID', 350, y2);
      doc.text('Status PTKP', 350, y2 + 18);
      doc.text('Status Payroll', 350, y2 + 36);

      doc.font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(payroll.employeeCode || 'EMS-000', 470, y2);
      doc.text(payroll.ptkpStatus || 'TK/0', 470, y2 + 18);

      const statusColor = payroll.status === 'Paid' ? '#16a34a' : payroll.status === 'Finalized' ? '#2563eb' : '#f59e0b';
      doc.fillColor(statusColor).text(payroll.status, 470, y2 + 36);

      // ---- ATTENDANCE SUMMARY ----
      const y3 = y2 + 85;
      doc.fillColor('#1e293b');
      doc.fontSize(11).font('Helvetica-Bold').text('RINGKASAN KEHADIRAN', 50, y3);
      doc.moveTo(50, y3 + 16).lineTo(545, y3 + 16).strokeColor('#e2e8f0').lineWidth(1).stroke();

      const y3b = y3 + 28;
      // Attendance boxes
      const boxes = [
        { label: 'Hari Hadir', val: `${payroll.attendanceSummary?.daysPresent || 0} hari`, color: '#2563eb' },
        { label: 'Hari Terlambat', val: `${payroll.attendanceSummary?.daysLate || 0} hari`, color: '#ef4444' },
        { label: 'Jam Lembur', val: `${payroll.attendanceSummary?.overtimeHours || 0} jam`, color: '#8b5cf6' },
        { label: 'Total Jam Kerja', val: `${payroll.attendanceSummary?.totalWorkHours || 0} jam`, color: '#059669' },
      ];

      boxes.forEach((box, i) => {
        const bx = 50 + i * 125;
        doc.rect(bx, y3b, 115, 45).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(box.label, bx + 8, y3b + 8, { width: 100 });
        doc.fontSize(12).fillColor(box.color).font('Helvetica-Bold').text(box.val, bx + 8, y3b + 23, { width: 100 });
      });

      // ---- EARNINGS TABLE ----
      const y4 = y3b + 65;
      doc.fillColor('#1e293b');
      doc.fontSize(11).font('Helvetica-Bold').text('KOMPONEN PENDAPATAN', 50, y4);
      doc.moveTo(50, y4 + 16).lineTo(545, y4 + 16).strokeColor('#e2e8f0').lineWidth(1).stroke();

      const otRate = payroll.overtimeRatePerHour || 30000;
      const mealRate = payroll.mealAllowanceRate || 25000;
      const transRate = payroll.transportAllowanceRate || 20000;
      const lateRate = payroll.latePenaltyPerDay || 50000;
      const bpjsKS = (payroll.bpjsKesehatanRate || 0.01) * 100;
      const bpjsTK = (payroll.bpjsKetenagakerjaanRate || 0.02) * 100;

      const earnings = [
        { label: 'Gaji Pokok', value: payroll.baseSalary },
        { label: `Uang Lembur (${payroll.overtimeHours || 0} jam — Tiered 1.5x/2.0x)`, value: payroll.overtimePay },
        { label: `Uang Makan (${payroll.attendanceSummary?.daysPresent || 0} hari × ${formatRupiah(mealRate)})`, value: payroll.mealAllowance },
        { label: `Uang Transport (${payroll.attendanceSummary?.daysPresent || 0} hari × ${formatRupiah(transRate)})`, value: payroll.transportAllowance },
        { label: 'Reimbursement (Disetujui)', value: payroll.reimbursement },
        { label: 'Tunjangan / Bonus Lain', value: payroll.otherAllowance },
      ];

      let ey = y4 + 26;
      earnings.forEach(item => {
        if (item.value > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#475569').text(item.label, 60, ey);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#16a34a').text(formatRupiah(item.value), 400, ey, { width: 145, align: 'right' });
          ey += 18;
        }
      });

      // Gross Pay line
      doc.moveTo(50, ey + 3).lineTo(545, ey + 3).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      ey += 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text('TOTAL PENDAPATAN KOTOR', 60, ey);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563eb').text(formatRupiah(payroll.grossPay), 400, ey, { width: 145, align: 'right' });

      // ---- DEDUCTIONS TABLE ----
      ey += 30;
      doc.fillColor('#1e293b');
      doc.fontSize(11).font('Helvetica-Bold').text('KOMPONEN POTONGAN', 50, ey);
      doc.moveTo(50, ey + 16).lineTo(545, ey + 16).strokeColor('#e2e8f0').lineWidth(1).stroke();
      ey += 26;

      const deductions = [
        { label: `Potongan Keterlambatan (${payroll.lateDays || 0} hari × ${formatRupiah(lateRate)})`, value: payroll.latePenalty },
        { label: `Potongan Cuti Tidak Dibayar (${payroll.unpaidLeaveDays || 0} hari)`, value: payroll.unpaidLeaveDeduction },
        { label: `BPJS Kesehatan (${bpjsKS}%)`, value: payroll.bpjsKesehatan },
        { label: `BPJS Ketenagakerjaan (${bpjsTK}%)`, value: payroll.bpjsKetenagakerjaan },
        { label: `PPh 21 (PTKP: ${payroll.ptkpStatus || 'TK/0'})`, value: payroll.pph21 },
      ];

      deductions.forEach(item => {
        if (item.value > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#475569').text(item.label, 60, ey);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#ef4444').text(`- ${formatRupiah(item.value)}`, 400, ey, { width: 145, align: 'right' });
          ey += 18;
        }
      });

      // Total Deductions line
      doc.moveTo(50, ey + 3).lineTo(545, ey + 3).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      ey += 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text('TOTAL POTONGAN', 60, ey);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ef4444').text(`- ${formatRupiah(payroll.totalDeductions)}`, 400, ey, { width: 145, align: 'right' });

      // ---- NET PAY BANNER ----
      ey += 30;
      doc.rect(50, ey, 495, 50).fillAndStroke('#1e3a5f', '#1e3a5f');
      doc.fontSize(11).font('Helvetica').fillColor('#93c5fd').text('TAKE HOME PAY (Gaji Bersih)', 70, ey + 10);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text(formatRupiah(payroll.netPay), 300, ey + 10, { width: 230, align: 'right' });

      // ---- FOOTER ----
      ey += 70;
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
        .text(`Dokumen ini di-generate secara otomatis oleh sistem OUR pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, 50, ey, { align: 'center' });
      doc.text('Slip gaji ini bersifat rahasia dan hanya ditujukan untuk karyawan yang bersangkutan.', 50, ey + 12, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePayslipPDF };
