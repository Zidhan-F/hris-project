import React, { useState, useEffect } from 'react';
import axios from 'axios';


import { getInitials, formatCurrency, API_URL } from '../utils/helpers';


const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PTKP_TABLE = {
  'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
  'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
};

function calculatePPh21(baseSalary, ptkpStatus) {
  const annualGross = baseSalary * 12;
  const ptkp = PTKP_TABLE[ptkpStatus] || PTKP_TABLE['TK/0'];
  const pkp = Math.max(0, annualGross - ptkp);
  let tax = 0;
  if (pkp <= 60000000) tax = pkp * 0.05;
  else if (pkp <= 250000000) tax = 60000000 * 0.05 + (pkp - 60000000) * 0.15;
  else if (pkp <= 500000000) tax = 60000000 * 0.05 + 190000000 * 0.15 + (pkp - 250000000) * 0.25;
  else tax = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + (pkp - 500000000) * 0.30;
  return Math.round(tax / 12);
}

// Reusable: Period Selector (Moved OUTSIDE main component to prevent remounts)
const PeriodSelector = React.memo(({ payrollPeriod, setPayrollPeriod, onChange }) => {
  const now = new Date();
  const currentMonth = payrollPeriod?.month ?? now.getMonth();
  const currentYear = payrollPeriod?.year ?? now.getFullYear();

  return (
    <div className="payroll-period-selector">
      <select 
        value={currentMonth} 
        onChange={e => {
          const newPeriod = { 
            ...(payrollPeriod || {}), 
            month: parseInt(e.target.value), 
            year: currentYear 
          };
          setPayrollPeriod(newPeriod);
          onChange?.(newPeriod);
        }}
      >
        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select 
        value={currentYear} 
        onChange={e => {
          const newPeriod = { 
            ...(payrollPeriod || {}), 
            year: parseInt(e.target.value), 
            month: currentMonth 
          };
          setPayrollPeriod(newPeriod);
          onChange?.(newPeriod);
        }}
      >
        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.payrollPeriod?.month === nextProps.payrollPeriod?.month && 
         prevProps.payrollPeriod?.year === nextProps.payrollPeriod?.year;
});

export default function PayrollView({

  user, currentTime, employees, employeesLoading, searchQuery, setSearchQuery,
  payrollTab, setPayrollTab, fetchEmployees,
  setEditPayrollData, setIsEditingPayroll,
  // Payroll automation props
  payrollRecords, payrollSummary, myPayslip, myPayslipHistory,
  isCalculating, payrollPeriod, setPayrollPeriod,
  handleRunPayroll, handleFinalizeAll, handleMarkAllPaid, handleMarkAllUnpaid,
  handleFinalize, handleMarkPaid, handleMarkUnpaid, handleDownloadPDF,
  handleExportBank, handleSendEmails,
  fetchPayrollRecords, fetchMyPayslip

}) {
  const [bankFormat, setBankFormat] = useState('bca');
  const [showHistoryDetail, setShowHistoryDetail] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [payrollSettings, setPayrollSettings] = useState({
    latePenalty: 50000,
    overtimeRate: 30000
  });
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const periodLabel = `${MONTH_NAMES[payrollPeriod?.month ?? currentTime.getMonth()]} ${payrollPeriod?.year ?? currentTime.getFullYear()}`;
  const isAdmin = ['admin', 'hrd', 'manager'].includes(user?.role);

  // Fetch settings on mount
  useEffect(() => {
    if (isAdmin) {
      axios.get(`${API_URL}/api/settings/payroll`)
        .then(res => {
          if (res.data.success && res.data.settings) {
            setPayrollSettings({
              latePenalty: res.data.settings.LATE_PENALTY_PER_DAY,
              overtimeRate: res.data.settings.OVERTIME_RATE_PER_HOUR
            });
          }
        })
        .catch(err => console.error('Failed to fetch settings:', err));
    }
  }, [isAdmin]);

  const handleUpdateSettings = async () => {
    setIsSavingSetting(true);
    try {
      const res = await axios.put(`${API_URL}/api/settings/payroll`, { 
        settings: {
          LATE_PENALTY_PER_DAY: payrollSettings.latePenalty,
          OVERTIME_RATE_PER_HOUR: payrollSettings.overtimeRate
        }
      });
      if (res.data.success) {
        setIsEditingSettings(false);
        alert('Pengaturan payroll berhasil diperbarui! Mohon lakukan "Run Payroll" ulang untuk memperbarui perhitungan pada data yang sudah ada.');
      } else {
        alert(res.data.message || 'Gagal memperbarui pengaturan.');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Network error updating settings.');
    } finally {
      setIsSavingSetting(false);
    }
  };






  // Helper: Format safe number
  const safeISO = (d) => {
    if (!d) return '';
    try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
  };

  // Helper: Open Edit Modal for an employee
  const openEditModal = (emp) => {
    const baseVal = emp.baseSalary || 0;
    const ptkpVal = emp.ptkpStatus || 'TK/0';
    
    setEditPayrollData({
      id: emp._id,
      name: emp.name,
      baseSalary: baseVal,
      allowance: emp.allowance || 0,
      role: emp.role || 'employee',
      bankAccount: emp.bankAccount || '-',
      bankName: emp.bankName || '-',
      ptkpStatus: ptkpVal,
      mealAllowanceRate: emp.mealAllowanceRate ?? 25000,
      transportAllowanceRate: emp.transportAllowanceRate ?? 20000,
      payrollStatus: emp.payrollStatus || 'Unpaid',
      leaveQuota: emp.leaveQuota || 0,
      contractEnd: safeISO(emp.contractEnd),
      // Preserve original values (1=Auto, 0=None, >1=Manual)
      bpjsKesehatanAmount: emp.bpjsKesehatanAmount !== undefined ? emp.bpjsKesehatanAmount : 1,
      bpjsTkAmount: emp.bpjsTkAmount !== undefined ? emp.bpjsTkAmount : 1,
      pph21Amount: emp.pph21Amount !== undefined ? emp.pph21Amount : 1
    });
    setIsEditingPayroll(true);
  };



  // ====== TAB 1: My Payslip ======
  const renderMyPayslip = () => {
    const p = myPayslip;

    return (
      <div className="my-payslip-content animate-fadeInUp">
        <div className="payroll-top-bar">
          <h3>Slip Gaji Saya</h3>
          <PeriodSelector 
            payrollPeriod={payrollPeriod}
            setPayrollPeriod={setPayrollPeriod}
            onChange={(period) => fetchMyPayslip?.(period.month, period.year)} 
          />
        </div>

        {!p ? (
          <div className="payroll-empty-state">
            <span className="material-icons-outlined" style={{ fontSize: 56, color: '#cbd5e1' }}>receipt_long</span>
            <h4>Belum Ada Payslip</h4>
            <p>Payroll untuk periode {periodLabel} belum dihitung oleh HRD.</p>
          </div>
        ) : (
          <>
            {/* Net Pay Hero Card */}
            <div className="payroll-hero-card">
              <div className="payroll-hero-left">
                <div className="payroll-hero-label">Take Home Pay — {periodLabel}</div>
                <div className="payroll-hero-amount">{formatCurrency(p.netPay)}</div>
                <div className="payroll-hero-sub">
                  Gross: {formatCurrency(p.grossPay)} &nbsp;|&nbsp; Potongan: {formatCurrency(p.totalDeductions)}
                </div>
              </div>
              <div className="payroll-hero-actions">
                <span className={`payroll-status-badge-lg ${p.status?.toLowerCase()}`}>{p.status}</span>
                {p._id && (
                  <button className="btn-download-pdf" onClick={() => handleDownloadPDF?.(p._id)}>
                    <span className="material-icons-outlined">picture_as_pdf</span> Download PDF
                  </button>
                )}
              </div>
            </div>

            {/* Detail Breakdown */}
            <div className="payroll-breakdown-grid">
              {/* Earnings */}
              <div className="payroll-breakdown-card earnings">
                <div className="payroll-breakdown-header">
                  <span className="material-icons-outlined">trending_up</span>
                  <h4>Pendapatan</h4>
                </div>
                <div className="payroll-breakdown-items">
                  <div className="pb-item"><span>Gaji Pokok</span><strong>{formatCurrency(p.baseSalary)}</strong></div>
                  {p.overtimePay > 0 && <div className="pb-item accent"><span>Lembur ({p.overtimeHours} jam)</span><strong>+ {formatCurrency(p.overtimePay)}</strong></div>}
                  {p.mealAllowance > 0 && <div className="pb-item accent"><span>Uang Makan ({p.attendanceSummary?.daysPresent} hari)</span><strong>+ {formatCurrency(p.mealAllowance)}</strong></div>}
                  {p.transportAllowance > 0 && <div className="pb-item accent"><span>Uang Transport ({p.attendanceSummary?.daysPresent} hari)</span><strong>+ {formatCurrency(p.transportAllowance)}</strong></div>}
                  {p.reimbursement > 0 && <div className="pb-item accent"><span>Reimbursement</span><strong>+ {formatCurrency(p.reimbursement)}</strong></div>}
                  {p.otherAllowance > 0 && <div className="pb-item accent"><span>Tunjangan Lain</span><strong>+ {formatCurrency(p.otherAllowance)}</strong></div>}
                </div>
                <div className="pb-total green">
                  <span>Total Pendapatan Kotor</span>
                  <strong>{formatCurrency(p.grossPay)}</strong>
                </div>
              </div>

              {/* Deductions */}
              <div className="payroll-breakdown-card deductions">
                <div className="payroll-breakdown-header">
                  <span className="material-icons-outlined">trending_down</span>
                  <h4>Potongan</h4>
                </div>
                <div className="payroll-breakdown-items">
                  {p.latePenalty > 0 && <div className="pb-item danger"><span>Keterlambatan ({p.lateDays} hari)</span><strong>- {formatCurrency(p.latePenalty)}</strong></div>}
                  {p.unpaidLeaveDeduction > 0 && <div className="pb-item danger"><span>Unpaid Leave ({p.unpaidLeaveDays} hari)</span><strong>- {formatCurrency(p.unpaidLeaveDeduction)}</strong></div>}
                  <div className="pb-item"><span>BPJS Kesehatan (1%)</span><strong>- {formatCurrency(p.bpjsKesehatan)}</strong></div>
                  <div className="pb-item"><span>BPJS Ketenagakerjaan (2%)</span><strong>- {formatCurrency(p.bpjsKetenagakerjaan)}</strong></div>
                  {p.pph21 > 0 && <div className="pb-item"><span>PPh 21 (PTKP: {p.ptkpStatus})</span><strong>- {formatCurrency(p.pph21)}</strong></div>}
                </div>
                <div className="pb-total red">
                  <span>Total Potongan</span>
                  <strong>- {formatCurrency(p.totalDeductions)}</strong>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="payroll-attendance-summary">
              <h4><span className="material-icons-outlined">event_available</span> Ringkasan Kehadiran</h4>
              <div className="payroll-att-grid">
                <div className="payroll-att-item blue"><div className="att-num">{p.attendanceSummary?.daysPresent || 0}</div><div className="att-label">Hari Hadir</div></div>
                <div className="payroll-att-item red"><div className="att-num">{p.attendanceSummary?.daysLate || 0}</div><div className="att-label">Hari Terlambat</div></div>
                <div className="payroll-att-item purple"><div className="att-num">{p.attendanceSummary?.overtimeHours || 0}</div><div className="att-label">Jam Lembur</div></div>
                <div className="payroll-att-item green"><div className="att-num">{p.attendanceSummary?.totalWorkHours || 0}</div><div className="att-label">Total Jam Kerja</div></div>
              </div>
            </div>

            {/* Payslip History */}
            {myPayslipHistory && myPayslipHistory.length > 1 && (
              <div className="payroll-history-section">
                <h4><span className="material-icons-outlined">history</span> Riwayat Payslip</h4>
                <div className="payroll-history-list">
                  {myPayslipHistory.map(h => (
                    <div key={h._id} className={`payroll-history-item ${showHistoryDetail === h._id ? 'expanded' : ''}`}
                      onClick={() => setShowHistoryDetail(showHistoryDetail === h._id ? null : h._id)}>
                      <div className="ph-main">
                        <div className="ph-period">{MONTH_NAMES[h.period.month]} {h.period.year}</div>
                        <div className="ph-amount">{formatCurrency(h.netPay)}</div>
                        <span className={`payroll-status-mini ${h.status?.toLowerCase()}`}>{h.status}</span>
                        {h._id && <button className="ph-pdf-btn" onClick={(e) => { e.stopPropagation(); handleDownloadPDF?.(h._id); }}>
                          <span className="material-icons-outlined">download</span>
                        </button>}
                      </div>
                      {showHistoryDetail === h._id && (
                        <div className="ph-detail">
                          <span>Gaji Pokok: {formatCurrency(h.baseSalary)}</span>
                          <span>Lembur: {formatCurrency(h.overtimePay)}</span>
                          <span>Potongan: -{formatCurrency(h.totalDeductions)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ====== TAB 2: Kelola Payroll ======
  const renderManagePayroll = () => {
    const records = payrollRecords || [];
    const summary = payrollSummary || {};
    const filtered = records.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSelectAll = (e) => {
      if (e.target.checked) {
        setSelectedIds(filtered.map(r => r._id));
      } else {
        setSelectedIds([]);
      }
    };

    const handleSelectRow = (e, id) => {
      e.stopPropagation();
      if (e.target.checked) {
        setSelectedIds(prev => [...prev, id]);
      } else {
        setSelectedIds(prev => prev.filter(item => item !== id));
      }
    };

    return (
      <div className="payroll-manage-section animate-fadeInUp">

        {/* Toolbar */}
        <div className="payroll-toolbar">
          <PeriodSelector 
            payrollPeriod={payrollPeriod}
            setPayrollPeriod={setPayrollPeriod}
            onChange={(period) => fetchPayrollRecords?.(period.month, period.year)} 
          />
          <div className="payroll-toolbar-actions">
            <button className="payroll-action-btn primary" onClick={() => { handleRunPayroll?.(selectedIds); setSelectedIds([]); }} disabled={isCalculating}>
              <span className="material-icons-outlined">{isCalculating ? 'sync' : 'calculate'}</span>
              {isCalculating ? 'Menghitung...' : (selectedIds.length > 0 ? `Run (Draft: ${selectedIds.length})` : 'Run Payroll')}
            </button>
            <button className="payroll-action-btn warning-outline" onClick={() => { handleFinalizeAll?.(selectedIds); setSelectedIds([]); }} style={{ border: '1px solid #f59e0b', color: '#f59e0b', background: 'transparent' }}>
              <span className="material-icons-outlined">verified</span>
              {selectedIds.length > 0 ? `Finalize (${selectedIds.length})` : 'Finalize All'}
            </button>
            <button className="payroll-action-btn warning" onClick={() => { handleMarkAllPaid?.(selectedIds); setSelectedIds([]); }}>
              <span className="material-icons-outlined">paid</span>
              {selectedIds.length > 0 
                ? `Mark Paid (${records.filter(r => selectedIds.includes(r._id) && r.status === 'Finalized').length})` 
                : 'Mark All Paid'}
            </button>
            <button className="payroll-action-btn error-outline" onClick={() => { handleMarkAllUnpaid?.(selectedIds); setSelectedIds([]); }} style={{ border: '1px solid #ef4444', color: '#ef4444', background: 'transparent' }}>
              <span className="material-icons-outlined">undo</span>
              {selectedIds.length > 0 ? `Unpaid (${selectedIds.length})` : 'Mark All Unpaid'}
            </button>
            <button className={`payroll-action-btn ${isEditingSettings ? 'active' : ''}`} onClick={() => setIsEditingSettings(!isEditingSettings)} style={{ background: isEditingSettings ? '#f1f5f9' : 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <span className="material-icons-outlined">settings</span>
              Config
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {isEditingSettings && (
          <div className="payroll-settings-panel animate-fadeInDown" style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>Sanksi Terlambat (Rp/Hari):</label>
                <input 
                  type="number" 
                  value={payrollSettings.latePenalty} 
                  onChange={(e) => setPayrollSettings({...payrollSettings, latePenalty: parseInt(e.target.value)})}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '13px' }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>Tarif Lembur (Rp/Jam):</label>
                <input 
                  type="number" 
                  value={payrollSettings.overtimeRate} 
                  onChange={(e) => setPayrollSettings({...payrollSettings, overtimeRate: parseInt(e.target.value)})}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '13px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                className="payroll-action-btn primary" 
                onClick={handleUpdateSettings}
                disabled={isSavingSetting}
                style={{ padding: '10px 24px', fontWeight: 600 }}
              >
                {isSavingSetting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <button 
                className="payroll-action-btn" 
                onClick={() => setIsEditingSettings(false)}
                style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}
              >
                Batal
              </button>
              <div style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto', padding: '10px 15px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', maxWidth: '400px' }}>
                <span className="material-icons-outlined" style={{ fontSize: 16, color: '#f59e0b', verticalAlign: 'middle', marginRight: '6px' }}>info</span>
                <strong>Catatan:</strong> Perubahan ini akan diterapkan pada kalkulasi payroll berikutnya.
              </div>
            </div>
          </div>
        )}


        {/* Summary Cards */}
        {records.length > 0 && (
          <div className="payroll-summary-grid">
            <div className="payroll-summary-card blue">
              <span className="material-icons-outlined">groups</span>
              <div><div className="ps-value">{summary.totalEmployees || 0}</div><div className="ps-label">Total Karyawan</div></div>
            </div>
            <div className="payroll-summary-card green">
              <span className="material-icons-outlined">account_balance_wallet</span>
              <div><div className="ps-value">{formatCurrency(summary.totalGross || 0)}</div><div className="ps-label">Total Gross</div></div>
            </div>
            <div className="payroll-summary-card red">
              <span className="material-icons-outlined">money_off</span>
              <div><div className="ps-value">{formatCurrency(summary.totalDeductions || 0)}</div><div className="ps-label">Total Potongan</div></div>
            </div>
            <div className="payroll-summary-card dark">
              <span className="material-icons-outlined">money</span>
              <div><div className="ps-value">{formatCurrency(summary.totalNet || 0)}</div><div className="ps-label">Total Net Pay</div></div>
            </div>
          </div>
        )}

        {/* Status Progress */}
        {summary.statusCounts && (
          <div className="payroll-status-bar">
            <div className="psb-item draft"><span className="psb-dot"></span> Draft: {summary.statusCounts.draft || 0}</div>
            <div className="psb-item finalized"><span className="psb-dot"></span> Finalized: {summary.statusCounts.finalized || 0}</div>
            <div className="psb-item paid"><span className="psb-dot"></span> Paid: {summary.statusCounts.paid || 0}</div>
          </div>
        )}

        {/* Search */}
        <div className="employee-header" style={{ padding: '0 0 16px 0' }}>
          <div className="employee-search-bar" style={{ flex: 1 }}>
            <span className="material-icons-outlined">search</span>
            <input type="text" placeholder="Cari karyawan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Payroll Table */}
        {records.length === 0 ? (
          <div className="payroll-empty-state">
            <span className="material-icons-outlined" style={{ fontSize: 56, color: '#cbd5e1' }}>calculate</span>
            <h4>Belum Ada Data Payroll</h4>
            <p>Klik <strong>"Run Payroll"</strong> untuk menghitung gaji periode {periodLabel}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="request-table payroll-table">
              <thead>
                <tr>
                  <th className="col-selection">
                    <input type="checkbox" 
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="col-karyawan">Karyawan</th>
                  <th className="col-hadir">Hadir</th>
                  <th className="col-gross">Gross Pay</th>
                  <th className="col-deduction">Potongan</th>
                  <th className="col-net">Net Pay</th>
                  <th className="col-status">Status</th>

                  <th className="col-actions">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(r => (
                  <React.Fragment key={r._id}>
                    <tr className={`payroll-table-row ${expandedRow === r._id ? 'expanded' : ''} ${selectedIds.includes(r._id) ? 'selected' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === r._id ? null : r._id)}
                      style={{ cursor: 'pointer' }}>
                      <td className="col-selection" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" 
                          checked={selectedIds.includes(r._id)}
                          onChange={(e) => handleSelectRow(e, r._id)}
                        />
                      </td>
                      <td className="col-karyawan" style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="member-avatar-mini" style={{ flexShrink: 0 }}>
                            {r.profilePicture ? (
                              <img src={r.profilePicture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                            ) : (
                              getInitials(r.name)
                            )}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div className="employee-name-cell">{r.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.position} • {r.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-hadir">
                        <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.attendanceSummary?.daysPresent || 0} hari</div>
                        {r.attendanceSummary?.daysLate > 0 && <div style={{ fontSize: '10px', color: '#ef4444' }}>{r.attendanceSummary.daysLate} terlambat</div>}
                      </td>
                      <td className="col-gross"><div style={{ fontWeight: 600, color: '#16a34a', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatCurrency(r.grossPay)}</div></td>
                      <td className="col-deduction"><div style={{ fontWeight: 600, color: '#ef4444', fontSize: '13px', whiteSpace: 'nowrap' }}>-{formatCurrency(r.totalDeductions)}</div></td>
                      <td className="col-net"><div style={{ fontWeight: 700, color: '#2563eb', fontSize: '14px', whiteSpace: 'nowrap' }}>{formatCurrency(r.netPay)}</div></td>

                      <td className="col-status" style={{ textAlign: 'center' }}>
                        <span className={`payroll-status-badge ${r.status?.toLowerCase()}`}>{r.status}</span>
                      </td>

                      <td className="col-actions" style={{ textAlign: 'right' }}>
                        <div className="payroll-row-actions" onClick={e => e.stopPropagation()}>
                          {r.status === 'Draft' && (
                            <button className="pr-action-btn warning" title="Finalize" onClick={() => handleFinalize?.(r._id)} style={{ color: '#f59e0b' }}>
                              <span className="material-icons-outlined">verified</span>
                            </button>
                          )}
                          {r.status === 'Finalized' && (
                            <button className="pr-action-btn paid" title="Mark Paid" onClick={() => handleMarkPaid?.(r._id)}>
                              <span className="material-icons-outlined">paid</span>
                            </button>
                          )}
                          {(r.status === 'Paid' || r.status === 'Finalized') && (
                            <button className="pr-action-btn undo" title="Revert to Draft" onClick={() => handleMarkUnpaid?.(r._id)} style={{ color: '#ef4444' }}>
                              <span className="material-icons-outlined">undo</span>
                            </button>
                          )}

                          <button className="pr-action-btn pdf" title="Download PDF" onClick={() => handleDownloadPDF?.(r._id)}>
                            <span className="material-icons-outlined">picture_as_pdf</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Detail Row */}
                    {expandedRow === r._id && (
                      <tr className="payroll-detail-row">
                        <td colSpan="8">
                          <div className="payroll-detail-content animate-fadeInUp">
                            <div className="pd-grid">
                              <div className="pd-section">
                                <h5><span className="material-icons-outlined">trending_up</span> Pendapatan</h5>
                                <div className="pd-item"><span>Gaji Pokok</span><strong>{formatCurrency(r.baseSalary)}</strong></div>
                                {r.overtimePay > 0 && <div className="pd-item accent"><span>Lembur ({r.overtimeHours} jam)</span><strong>+{formatCurrency(r.overtimePay)}</strong></div>}
                                {r.mealAllowance > 0 && <div className="pd-item accent"><span>Uang Makan</span><strong>+{formatCurrency(r.mealAllowance)}</strong></div>}
                                {r.transportAllowance > 0 && <div className="pd-item accent"><span>Uang Transport</span><strong>+{formatCurrency(r.transportAllowance)}</strong></div>}
                                {r.reimbursement > 0 && <div className="pd-item accent"><span>Reimbursement</span><strong>+{formatCurrency(r.reimbursement)}</strong></div>}
                                {r.otherAllowance > 0 && <div className="pd-item accent"><span>Tunjangan Lain</span><strong>+{formatCurrency(r.otherAllowance)}</strong></div>}
                              </div>
                              <div className="pd-section">
                                <h5><span className="material-icons-outlined">trending_down</span> Potongan</h5>
                                {r.latePenalty > 0 && <div className="pd-item danger"><span>Terlambat ({r.lateDays} hari)</span><strong>-{formatCurrency(r.latePenalty)}</strong></div>}
                                <div className="pd-item"><span>BPJS Kesehatan (1%)</span><strong>-{formatCurrency(r.bpjsKesehatan)}</strong></div>
                                <div className="pd-item"><span>BPJS TK (2%)</span><strong>-{formatCurrency(r.bpjsKetenagakerjaan)}</strong></div>
                                {r.pph21 > 0 && <div className="pd-item"><span>PPh 21</span><strong>-{formatCurrency(r.pph21)}</strong></div>}
                                {r.unpaidLeaveDeduction > 0 && <div className="pd-item danger"><span>Unpaid Leave</span><strong>-{formatCurrency(r.unpaidLeaveDeduction)}</strong></div>}
                              </div>
                              <div className="pd-section">
                                <h5><span className="material-icons-outlined">info</span> Info</h5>
                                <div className="pd-item"><span>Bank</span><strong>{r.bankName || '-'} {r.bankAccount || ''}</strong></div>
                                <div className="pd-item"><span>PTKP</span><strong>{r.ptkpStatus || 'TK/0'}</strong></div>
                                <div className="pd-item"><span>Hari Hadir</span><strong>{r.attendanceSummary?.daysPresent || 0} / {r.attendanceSummary?.totalWorkDays || 22}</strong></div>
                                <div className="pd-item"><span>Jam Lembur</span><strong>{r.attendanceSummary?.overtimeHours || 0} jam</strong></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Action Bar */}
        {records.length > 0 && (
          <div className="payroll-bottom-bar">
             <div className="pbb-group">
               <label>Format Bank:</label>
               <select value={bankFormat} onChange={e => setBankFormat(e.target.value)}>
                 <option value="bca">KlikBCA Bisnis (.csv)</option>
                 <option value="mandiri">Mandiri MCM (.txt)</option>
               </select>
               <button className="payroll-action-btn export" onClick={() => { handleExportBank?.(bankFormat, selectedIds); setSelectedIds([]); }}>
                 <span className="material-icons-outlined">download</span> 
                 {selectedIds.length > 0 ? `Export (${selectedIds.length})` : 'Export Transfer'}
               </button>
             </div>
             <button className="payroll-action-btn email" onClick={() => { handleSendEmails?.(selectedIds); setSelectedIds([]); }}>
               <span className="material-icons-outlined">email</span> 
               {selectedIds.length > 0 ? `Kirim (${selectedIds.length}) Payslip` : 'Kirim Semua Payslip'}
             </button>

          </div>
        )}
      </div>
    );
  };

  // ====== TAB 3: Data Karyawan (Employee Payroll Settings) ======
  const renderDataKaryawan = () => {
    const filtered = (employees || []).filter(emp =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="payroll-manage-section animate-fadeInUp">
        <div className="payroll-top-bar">
          <h3>Data Payroll Karyawan</h3>
        </div>

        {/* Info Banner */}
        <div className="payroll-info-banner">
          <span className="material-icons-outlined">info</span>
          <p>Edit gaji pokok, tunjangan, rekening bank, dan status PTKP karyawan di sini. Data ini digunakan oleh sistem payroll otomatis saat menghitung gaji.</p>
        </div>

        {/* Search */}
        <div className="employee-header" style={{ padding: '0 0 16px 0' }}>
          <div className="employee-search-bar" style={{ flex: 1 }}>
            <span className="material-icons-outlined">search</span>
            <input type="text" placeholder="Cari nama atau ID karyawan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {employeesLoading ? (
          <div className="loading-center"><div className="loading-spinner"></div><p>Memuat data...</p></div>
        ) : (
          <div className="table-responsive">
            <table className="request-table payroll-table">
              <thead>
                <tr>
                  <th className="col-karyawan">Karyawan</th>
                  <th className="col-amount">Gaji Pokok</th>
                  <th className="col-amount">Tunjangan</th>
                  <th className="col-bank">Bank</th>
                  <th className="col-account">No. Rekening</th>
                  <th className="col-ptkp">PTKP</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions">Aksi</th>

                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp._id}>
                    <td className="col-karyawan">
                      <div className="employee-cell-main">
                        <div className="member-avatar-mini">
                          {emp.profilePicture ? (
                            <img src={emp.profilePicture} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            getInitials(emp.name)
                          )}
                        </div>
                        <div className="employee-cell-info">
                          <div className="employee-cell-name">{emp.name}</div>
                          <div className="employee-cell-meta">{emp.position} • {emp.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-amount">
                       <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(emp.baseSalary || 0)}</div>
                    </td>
                    <td className="col-amount">
                       <div style={{ color: '#16a34a', fontWeight: 700 }}>{emp.allowance > 0 ? `+ ${formatCurrency(emp.allowance)}` : `Rp 0`}</div>
                    </td>
                    <td className="col-bank">
                      <span className={`bank-tag ${(emp.bankName && emp.bankName !== '-') ? 'filled' : 'empty'}`}>
                        {emp.bankName && emp.bankName !== '-' ? emp.bankName : '—'}
                      </span>
                    </td>
                    <td className="col-account">
                      <div className="account-number-text" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                        {emp.bankAccount && emp.bankAccount !== '-' ? emp.bankAccount : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Belum diisi</span>}
                      </div>
                    </td>
                    <td className="col-ptkp">
                      <span className="ptkp-tag">{emp.ptkpStatus || 'TK/0'}</span>
                    </td>
                    <td className="col-status">
                      <span className={`payroll-status-badge ${emp.payrollStatus?.toLowerCase() || 'unpaid'}`}>
                        {emp.payrollStatus || 'Unpaid'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="pr-action-btn edit" title="Edit Payroll" onClick={() => openEditModal(emp)}>
                          <span className="material-icons-outlined">edit_note</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="empty-row">Tidak ada karyawan ditemukan.</td></tr>
                )}
              </tbody>

            </table>
          </div>
        )}
      </div>
    );
  };

  // ====== MAIN RENDER ======
  return (
    <div className="payroll-container animate-fadeInUp">
      <div className="payroll-header">
        <h2 className="payroll-title">
          <span className="material-icons-outlined" style={{ fontSize: 28, verticalAlign: 'middle', marginRight: 8 }}>account_balance_wallet</span>
          Payroll Management
        </h2>
        <div className="leave-tabs" style={{ marginTop: '16px' }}>
          <button className={`leave-tab-btn ${payrollTab === 'mine' ? 'active' : ''}`} onClick={() => { setPayrollTab('mine'); fetchMyPayslip?.(); }}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>receipt</span> My Payslip
          </button>
          {isAdmin && (
            <>
              <button className={`leave-tab-btn ${payrollTab === 'manage' ? 'active' : ''}`} onClick={() => { setPayrollTab('manage'); fetchPayrollRecords?.(); }}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>calculate</span> Kelola Payroll
              </button>
              <button className={`leave-tab-btn ${payrollTab === 'settings' ? 'active' : ''}`} onClick={() => { setPayrollTab('settings'); fetchEmployees(); }}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>settings</span> Data Karyawan
              </button>
            </>
          )}
        </div>
      </div>

      {payrollTab === 'mine' && renderMyPayslip()}
      {payrollTab === 'manage' && renderManagePayroll()}
      {payrollTab === 'settings' && renderDataKaryawan()}
    </div>
  );
}
