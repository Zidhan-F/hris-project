import React from 'react';
import { getInitials } from '../utils/helpers';
import axios from 'axios';
import { API_URL } from '../utils/helpers';

export default function EmployeeView({
  user, employees, employeesLoading, searchQuery, setSearchQuery,
  selectedEmployee, setSelectedEmployee, empDetailTab, setEmpDetailTab,
  handleEditEmployee, empAttendanceHistory, isFetchingEmpAttendance,
  setEmpAttendanceHistory, setIsFetchingEmpAttendance
}) {
  return (
    <div className="employee-container animate-fadeInUp">
      {!selectedEmployee ? (
        <>
          <div className="employee-header">
            <h2 className="employee-title">Employee List</h2>
            <div className="employee-search-bar">
              <span className="material-icons-outlined">search</span>
              <input type="text" placeholder="Search by name or position..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          {employeesLoading ? <div className="loading-center"><div className="loading-spinner"></div><p>Memuat data karyawan...</p></div> : (
            <div className="employee-grid">
              {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.position.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                <div 
                  key={emp._id} 
                  className={`employee-card ${user?.role === 'employee' ? 'restricted-card' : ''}`}
                  onClick={() => user?.role !== 'employee' && setSelectedEmployee(emp)} 
                  style={{ cursor: user?.role === 'employee' ? 'default' : 'pointer' }}
                >
                  <div className="employee-card-avatar">{emp.profilePicture ? <img src={emp.profilePicture} alt="" referrerPolicy="no-referrer" /> : <div className="employee-avatar-initials">{getInitials(emp.name)}</div>}</div>
                  <div className="employee-card-info">
                    <h4>{emp.name}</h4>
                    <p>{emp.position}</p>
                    <div className="employee-card-details">
                      <span className="employee-card-dept"><span className="material-icons-outlined">apartment</span>{emp.department || 'General'}</span>
                      <span className="employee-card-id"><span className="material-icons-outlined">badge</span>{emp.employeeId || `EMS-${emp._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span>
                      {emp.contractEnd && user?.role !== 'employee' && (
                        <span className="employee-card-contract" style={{ color: new Date(emp.contractEnd) < new Date() ? '#ef4444' : '#64748b' }}>
                          <span className="material-icons-outlined">event_busy</span>{new Date(emp.contractEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="employee-detail-view animate-fadeInUp">
          <div className="detail-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="back-btn" onClick={() => setSelectedEmployee(null)}>
              <span className="material-icons-outlined">arrow_back</span> Back to List
            </button>
            {['admin', 'manager', 'hrd'].includes(user?.role) && (
              <button className="profile-edit-btn" onClick={handleEditEmployee}>
                <span className="material-icons-outlined">manage_accounts</span> Edit Details
              </button>
            )}
          </div>

          <div className="profile-header-card">
            <div className="profile-header-top">
              {selectedEmployee.profilePicture ? <img className="profile-header-avatar" src={selectedEmployee.profilePicture} alt="" referrerPolicy="no-referrer" /> : <div className="profile-header-avatar-placeholder">{getInitials(selectedEmployee.name)}</div>}
              <div className="profile-header-main">
                <h3>{selectedEmployee.name}</h3>
                <p>{selectedEmployee.position || 'Employee'} • {selectedEmployee.department || 'General'}</p>
                {selectedEmployee.contractEnd && (
                  <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>event_busy</span> 
                    Contract End: {new Date(selectedEmployee.contractEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="profile-header-tabs">
              <button className={`profile-tab-btn ${empDetailTab === 'personal' ? 'active' : ''}`} onClick={() => setEmpDetailTab('personal')}>Personal</button>
              <button className={`profile-tab-btn ${empDetailTab === 'contract' ? 'active' : ''}`} onClick={() => setEmpDetailTab('contract')}>Contract</button>
              <button className={`profile-tab-btn ${empDetailTab === 'team' ? 'active' : ''}`} onClick={() => setEmpDetailTab('team')}>Team</button>
              {['admin', 'manager', 'hrd'].includes(user?.role) && (
                <button className={`profile-tab-btn ${empDetailTab === 'attendance' ? 'active' : ''}`} onClick={() => {
                  setEmpDetailTab('attendance');
                  setIsFetchingEmpAttendance(true);
                  axios.get(`${API_URL}/api/attendance/history`, { params: { email: selectedEmployee.email, month: new Date().getMonth(), year: new Date().getFullYear() } })
                    .then(res => { if (res.data.success) setEmpAttendanceHistory(res.data.records); })
                    .finally(() => setIsFetchingEmpAttendance(false));
                }}>Attendance</button>
              )}
            </div>
          </div>

          <div className="profile-tab-content">
            {empDetailTab === 'personal' && (
              <div className="profile-card">
                <div className="profile-bio-card">
                  <div className="profile-section-header"><span className="material-icons-outlined">info</span> Bio</div>
                  <p className="profile-bio-text">{selectedEmployee.bio || 'No bio provided.'}</p>
                </div>
                <div className="profile-info-grid">
                  <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{selectedEmployee.employeeId || `EMS-${selectedEmployee._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Role</span><span className="status-pill approved" style={{ textTransform: 'capitalize' }}>{selectedEmployee.role}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Email</span><span className="profile-info-value">{selectedEmployee.email}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Phone</span><span className="profile-info-value">{selectedEmployee.phone || '-'}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Gender</span><span className="profile-info-value">{selectedEmployee.gender || '-'}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Marital Status</span><span className="profile-info-value">{selectedEmployee.maritalStatus || '-'}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Birthday</span><span className="profile-info-value">{selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString() : '-'}</span></div>
                <div className="profile-info-item"><span className="profile-info-label">Contract End</span><span className="profile-info-value" style={{ fontWeight: '700', color: (selectedEmployee.contractEnd && new Date(selectedEmployee.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>{selectedEmployee.contractEnd ? new Date(selectedEmployee.contractEnd).toLocaleDateString() : 'Permanent'}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Leave Quota</span><span className="profile-info-value" style={{ fontWeight: '700', color: '#2563eb' }}>{selectedEmployee.leaveQuota || 0} Days</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Address</span><span className="profile-info-value">{selectedEmployee.address || '-'}</span></div>
                </div>
              </div>
            )}
            {empDetailTab === 'contract' && (
              <div className="profile-card">
                <div className="profile-section-header">Employment Details</div>
                <div className="profile-info-grid">
                  <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{selectedEmployee.employeeId || `EMS-${selectedEmployee._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Employment Status</span><span className="profile-info-value">{selectedEmployee.employmentStatus || 'Full-time'}</span></div>
                  <div className="profile-info-item"><span className="profile-info-label">Join Date</span><span className="profile-info-value">{selectedEmployee.joinDate ? new Date(selectedEmployee.joinDate).toLocaleDateString() : '-'}</span></div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Contract End</span>
                    <span className="profile-info-value" style={{ fontWeight: '700', color: (selectedEmployee.contractEnd && new Date(selectedEmployee.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>
                      {selectedEmployee.contractEnd ? new Date(selectedEmployee.contractEnd).toLocaleDateString() : (selectedEmployee.employmentStatus === 'Contract' ? 'Date Not Set' : 'Permanent')}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {empDetailTab === 'team' && (
              <div className="profile-card">
                <div className="profile-section-header">Organization</div>
                <div className="manager-info">
                  <div className="manager-avatar-placeholder"><span className="material-icons-outlined">person</span></div>
                  <div className="manager-text"><h5>{selectedEmployee.manager || '-'}</h5><p>Manager</p></div>
                </div>
                <div className="team-list" style={{ marginTop: '20px' }}>
                  <div className="profile-section-header" style={{ fontSize: '11px', marginBottom: '10px' }}>Team Members</div>
                  {!selectedEmployee.teamMembers || selectedEmployee.teamMembers.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No team members.</p> : selectedEmployee.teamMembers.map((m, i) => (
                    <div key={i} className="team-member-item" style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                      <div className="member-avatar-mini" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>{getInitials(m.name || m.n)}</div>
                      <div className="member-info-mini"><strong>{m.name || m.n}</strong><p style={{ margin: 0, fontSize: '11px', color: '#888' }}>{m.position || m.p}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {empDetailTab === 'attendance' && (
              <div className="profile-card">
                <div className="profile-section-header">Attendance History (Current Month)</div>
                {isFetchingEmpAttendance ? <div className="loading-center" style={{ padding: '20px' }}><div className="loading-spinner"></div></div> : (
                  <div className="table-responsive">
                    <table className="request-table">
                      <thead><tr><th>Date</th><th>Type</th><th>Time</th></tr></thead>
                      <tbody>
                        {empAttendanceHistory.length === 0 ? <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No records for this month.</td></tr> :
                          empAttendanceHistory.slice(0, 10).map((h, i) => (
                            <tr key={i}>
                              <td>{new Date(h.timestamp).toLocaleDateString()}</td>
                              <td>
                                <span className={`status-pill ${h.type === 'clock_in' ? 'approved' : 'rejected'}`} style={{ background: h.type === 'clock_in' ? '#dcfce7' : '#fee2e2', color: h.type === 'clock_in' ? '#166534' : '#991b1b' }}>
                                  {h.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                                </span>
                              </td>
                              <td>{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
