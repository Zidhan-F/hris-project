import React from 'react';
import { formatCurrency } from '../../utils/helpers';

export default function EditPayrollModal({ editPayrollData, setEditPayrollData, handleSavePayroll, isSavingPayroll, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fadeInUp">
        <div className="modal-header">
          <h3>Edit Payroll: {editPayrollData.name}</h3>
          <button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button>
        </div>
        <form onSubmit={handleSavePayroll} className="edit-profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Basic Salary (IDR)</label>
              <input type="number" value={editPayrollData.baseSalary} onChange={e => setEditPayrollData({ ...editPayrollData, baseSalary: Number(e.target.value) })} min="0" required />
            </div>
            <div className="form-group">
              <label>Allowance / Bonus (IDR)</label>
              <input type="number" value={editPayrollData.allowance} onChange={e => setEditPayrollData({ ...editPayrollData, allowance: Number(e.target.value) })} min="0" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Payroll Status</label>
              <select value={editPayrollData.payrollStatus} onChange={e => setEditPayrollData({ ...editPayrollData, payrollStatus: e.target.value })} required>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div className="form-group">
              <label>Bank Account Number</label>
              <input value={editPayrollData.bankAccount} onChange={e => setEditPayrollData({ ...editPayrollData, bankAccount: e.target.value })} placeholder="e.g. BCA 12345678" />
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            💡 <strong>Total THP:</strong> {formatCurrency(editPayrollData.baseSalary + editPayrollData.allowance)}
          </p>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={isSavingPayroll}>
              {isSavingPayroll ? <div className="loading-spinner"></div> : 'Update Payroll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
