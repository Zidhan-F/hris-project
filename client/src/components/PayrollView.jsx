import React from 'react';
import { getInitials, formatCurrency, safeISO } from '../utils/helpers';

export default function PayrollView({
  user, currentTime, employees, employeesLoading, searchQuery, setSearchQuery,
  payrollTab, setPayrollTab, fetchEmployees,
  setEditPayrollData, setIsEditingPayroll
}) {
  const getPayrollData = () => {
    const base = user.baseSalary || 5000000;
    const bonus = user.allowance || 0;
    return { base, bonus, total: base + bonus };
  };

  return (
    <div className="payroll-container animate-fadeInUp">
      <div className="payroll-header">
        <h2 className="payroll-title">Payroll Management</h2>
        <div className="leave-tabs" style={{ marginTop: '16px' }}>
          <button className={`leave-tab-btn ${payrollTab === 'mine' ? 'active' : ''}`} onClick={() => setPayrollTab('mine')}>My Payslip</button>
          {['manager', 'admin', 'hrd'].includes(user?.role) && (
            <button className={`leave-tab-btn ${payrollTab === 'manage' ? 'active' : ''}`} onClick={() => { setPayrollTab('manage'); fetchEmployees(); }}>Manage Payroll</button>
          )}
        </div>
      </div>

      {payrollTab === 'mine' ? (
        <div className="my-payslip-content">
          <div className="stat-card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: 'white', position: 'relative' }}>
            <div className="stat-label" style={{ color: '#bfdbfe' }}>Estimasi Gaji Bersih ({currentTime.toLocaleDateString('id-ID', { month: 'long' })})</div>
            <div className="stat-value" style={{ fontSize: '28px' }}>{formatCurrency(getPayrollData().total)}</div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>Gaji Pokok: {formatCurrency(getPayrollData().base)} + Tunjangan: {formatCurrency(getPayrollData().bonus)}</div>
            <button onClick={() => window.print()} className="print-btn" title="Download / Print Payslip">
              <span className="material-icons-outlined">print</span> Print
            </button>
          </div>

          <div className="payslip-card">
            <div className="payslip-header">
              <div className="payslip-branding">
                <div className="payslip-logo"><span className="material-icons-outlined">verified_user</span></div>
                <div><h4>EMS COMPANY</h4><p>Official Payslip</p></div>
              </div>
              <div className="payslip-meta">
                <div className="payslip-meta-item"><span>Employee ID</span><strong>{user.employeeId || `EMS-${user._id?.substring(0, 4).toUpperCase() || '101'}`}</strong></div>
                <div className="payslip-meta-item"><span>Bank Account</span><strong>{user.bankAccount || '-'}</strong></div>
              </div>
            </div>
            <div className="payslip-body">
              <div className="payslip-section">
                <div className="payslip-user-info"><h3>{user.name}</h3><p>{user.position || 'Staff'} • {user.department || 'General'}</p></div>
              </div>
              <div className="payslip-divider"></div>
              <div className="payslip-details">
                <div className="payslip-row"><span>Gaji Pokok</span><strong>{formatCurrency(getPayrollData().base)}</strong></div>
                {getPayrollData().bonus > 0 && (
                  <div className="payslip-row highlight"><span>Tunjangan / Bonus</span><strong>+ {formatCurrency(getPayrollData().bonus)}</strong></div>
                )}
              </div>
              <div className="payslip-divider"></div>
              <div className="payslip-total"><span>Total Take Home Pay</span><h2>{formatCurrency(getPayrollData().total)}</h2></div>
            </div>
            <div className="payslip-footer">
              <p>Generated automatically on {new Date().toLocaleDateString('id-ID')}</p>
              <div className={`payslip-status-badge ${user.payrollStatus === 'Paid' ? 'paid' : 'unpaid'}`}>
                {user.payrollStatus === 'Paid' ? 'PAID' : 'UNPAID'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="payroll-manage-section">
          <div className="employee-header" style={{ padding: '0 0 16px 0' }}>
            <div className="employee-search-bar" style={{ flex: 1 }}>
              <span className="material-icons-outlined">search</span>
              <input type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {!employeesLoading && (
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card dark"><div className="stat-label">Total Employees</div><div className="stat-value">{employees.length}</div></div>
              <div className="stat-card"><div className="stat-label">Total Gaji Pokok</div><div className="stat-value">{formatCurrency(employees.reduce((s, e) => s + (e.baseSalary || 5000000), 0))}</div></div>
              <div className="stat-card"><div className="stat-label">Total Tunjangan</div><div className="stat-value">{formatCurrency(employees.reduce((s, e) => s + (e.allowance || 0), 0))}</div></div>
              <div className="stat-card highlight" style={{ gridColumn: '1 / -1' }}>
                <div className="stat-label">TOTAL PENGELUARAN SELURUH KARYAWAN</div>
                <div className="stat-value" style={{ color: '#1e40af', fontSize: '32px' }}>
                  {formatCurrency(employees.reduce((s, e) => s + (e.baseSalary || 5000000) + (e.allowance || 0), 0))}
                </div>
              </div>
            </div>
          )}

          {employeesLoading ? <div className="loading-center"><div className="loading-spinner"></div></div> : (
            <div className="table-responsive">
              <table className="request-table">
                <thead><tr><th>Karyawan & Rekening</th><th>Total Gaji (Net)</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
                <tbody>
                  {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                    <tr key={emp._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {emp.picture ? (
                            <img className="member-avatar-mini" src={emp.picture} alt="" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                          ) : (
                            <div className="member-avatar-mini">{getInitials(emp.name)}</div>
                          )}
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{emp.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.position} • {emp.bankAccount || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '14px' }}>{formatCurrency((emp.baseSalary || 5000000) + (emp.allowance || 0))}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Gapok: {formatCurrency(emp.baseSalary || 5000000)}</div>
                      </td>
                      <td>
                        <span className={`payroll-status-badge ${emp.payrollStatus === 'Paid' ? 'paid' : 'unpaid'}`} style={{ padding: '4px 8px', fontSize: '10px' }}>
                          {emp.payrollStatus === 'Paid' ? 'PAID' : 'UNPAID'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-edit-payroll" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => {
                          setEditPayrollData({
                            id: emp._id, name: emp.name,
                            baseSalary: emp.baseSalary || 5000000, allowance: emp.allowance || 0,
                            role: emp.role || 'employee', bankAccount: emp.bankAccount || '-',
                            payrollStatus: emp.payrollStatus || 'Unpaid',
                            leaveQuota: emp.leaveQuota || 0, contractEnd: safeISO(emp.contractEnd)
                          });
                          setIsEditingPayroll(true);
                        }}>
                          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
