import React from 'react';
import { getInitials } from '../../utils/helpers';

export default function EditEmployeeModal({
  selectedEmployee, employees, editEmployeeData, setEditEmployeeData,
  handleSaveEmployee, handleDeleteEmployee, handleAddTeamMember, handleRemoveTeamMember,
  isSavingEmployee, onClose
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fadeInUp">
        <div className="modal-header">
          <h3>Manage Employee: {selectedEmployee.name}</h3>
          <button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button>
        </div>
        <form onSubmit={handleSaveEmployee} className="edit-profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Professional Position</label>
              <input value={editEmployeeData.position} onChange={e => setEditEmployeeData({ ...editEmployeeData, position: e.target.value })} required placeholder="e.g. Software Engineer" />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input value={editEmployeeData.department} onChange={e => setEditEmployeeData({ ...editEmployeeData, department: e.target.value })} required placeholder="e.g. Engineering" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Employee Role</label>
              <select value={editEmployeeData.role} onChange={e => setEditEmployeeData({ ...editEmployeeData, role: e.target.value })}>
                <option value="employee">Employee</option>
                <option value="hrd">HRD</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Employment Status</label>
              <select value={editEmployeeData.employmentStatus} onChange={e => setEditEmployeeData({ ...editEmployeeData, employmentStatus: e.target.value })}>
                <option value="Probation">Probation</option>
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Employee ID</label>
              <input value={editEmployeeData.employeeId} onChange={e => setEditEmployeeData({ ...editEmployeeData, employeeId: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Reporting Manager</label>
              <select value={editEmployeeData.manager} onChange={e => setEditEmployeeData({ ...editEmployeeData, manager: e.target.value })}>
                <option value="">(None)</option>
                {employees.filter(emp => emp.email !== selectedEmployee.email).map(emp => (
                  <option key={emp.email} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Leave Quota (Annual)</label>
              <input type="number" value={editEmployeeData.leaveQuota} onChange={e => setEditEmployeeData({ ...editEmployeeData, leaveQuota: Number(e.target.value) })} min="0" required />
            </div>
            <div className="form-group">
              <label>Contract End Date</label>
              <input type="date" value={editEmployeeData.contractEnd} onChange={e => setEditEmployeeData({ ...editEmployeeData, contractEnd: e.target.value })} />
            </div>
          </div>

          {/* Team Management */}
          <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>groups</span> Team Members
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{editEmployeeData.teamMembers.length} Person(s)</span>
            </div>
            <div className="team-edit-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {editEmployeeData.teamMembers.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>No members assigned</p>
              ) : (
                editEmployeeData.teamMembers.map((m, idx) => (
                  <div key={m.email || idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                    <span>{m.name || m.n}</span>
                    <button type="button" onClick={() => handleRemoveTeamMember(m.email)} style={{ border: 'none', background: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '12px' }}>close</span>
                    </button>
                  </div>
                ))
              )}
            </div>
            <select
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}
              onChange={(e) => {
                if (e.target.value) {
                  const emp = employees.find(emp => emp.email === e.target.value);
                  if (emp) handleAddTeamMember(emp);
                  e.target.value = '';
                }
              }}
            >
              <option value="">+ Add Member...</option>
              {employees.filter(emp => emp.email !== selectedEmployee.email && !editEmployeeData.teamMembers.find(m => m.email === emp.email)).map(emp => (
                <option key={emp.email} value={emp.email}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn-delete" onClick={handleDeleteEmployee} style={{ marginRight: 'auto', background: '#fff1f2', color: '#e11d48', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>Delete Karyawan</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={isSavingEmployee}>
              {isSavingEmployee ? <div className="loading-spinner"></div> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
