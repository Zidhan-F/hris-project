import React from 'react';
import { getInitials, getRequestIcon, formatCurrency } from '../utils/helpers';

export default function LeaveView({
  user, leaveTab, setLeaveTab, requests, pendingRequests,
  isFetchingRequests, fetchPendingRequests, handleOpenRequest, handleApproveRequest
}) {
  return (
    <div className="leave-container animate-fadeInUp">
      <div className="leave-header">
        <h2 className="leave-title">Leave & Attendance Request</h2>
        <div className="leave-tabs">
          <button className={`leave-tab-btn ${leaveTab === 'new' ? 'active' : ''}`} onClick={() => setLeaveTab('new')}>New Request</button>
          <button className={`leave-tab-btn ${leaveTab === 'history' ? 'active' : ''}`} onClick={() => setLeaveTab('history')}>My History</button>
          {['manager', 'admin', 'hrd'].includes(user?.role) && (
            <button className={`leave-tab-btn ${leaveTab === 'approval' ? 'active' : ''}`} onClick={() => { setLeaveTab('approval'); fetchPendingRequests(); }}>
              Approvals {pendingRequests.length > 0 && <span className="approve-badge">{pendingRequests.length}</span>}
            </button>
          )}
        </div>
      </div>

      {leaveTab === 'new' && (
        <div className="request-grid">
          {[
            { id: 'Leave', icon: 'event_available', color: '#3b82f6', label: 'Leave' },
            { id: 'Permit', icon: 'fact_check', color: '#10b981', label: 'Permit' },
            { id: 'Sick', icon: 'medical_services', color: '#f43f5e', label: 'Sick' },
            { id: 'Overtime', icon: 'more_time', color: '#8b5cf6', label: 'Overtime' },
            { id: 'Reimbursement', icon: 'payments', color: '#f59e0b', label: 'Reimbursement' },
            { id: 'Timesheet', icon: 'pending_actions', color: '#6366f1', label: 'Timesheet' },
            { id: 'Expense', icon: 'receipt_long', color: '#ec4899', label: 'Expense' },
            { id: 'Other', icon: 'help_outline', color: '#64748b', label: 'Other' }
          ].map(item => (
            <button key={item.id} className="request-type-card" onClick={() => handleOpenRequest(item.id)}>
              <div className="req-icon" style={{ backgroundColor: item.color + '15', color: item.color }}><span className="material-icons-outlined">{item.icon}</span></div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {leaveTab === 'history' && (
        <div className="request-history">
          {isFetchingRequests ? <div className="loading-spinner"></div> : (
            <>
              {requests.length === 0 ? <div className="empty-state">No requests yet.</div> : (
                <div className="table-responsive">
                  <table className="request-table">
                    <thead><tr><th>Type</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                    <tbody>
                      {requests.map(req => (
                        <tr key={req._id}>
                          <td><strong>{req.type}</strong></td>
                          <td>{req.startDate ? new Date(req.startDate).toLocaleDateString() : '-'}</td>
                          <td><p className="reason-cell">{req.reason}</p></td>
                          <td>
                            <span className={`status-pill ${req.status.toLowerCase()}`}>
                              <span className="material-icons-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                                {req.status === 'Approved' ? 'check_circle' : req.status === 'Rejected' ? 'cancel' : req.status === 'Returned' ? 'assignment_return' : 'pending'}
                              </span>
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {leaveTab === 'approval' && (
        <div className="approval-section">
          {pendingRequests.length === 0 ? <div className="empty-state">No pending approvals.</div> : (
            <div className="approval-cards">
              {pendingRequests.map(req => (
                <div key={req._id} className="approval-card">
                  <div className="approve-header">
                    <div className="approve-user">
                      <div className="approve-avatar">
                        {req.profilePicture ? (
                          <img src={req.profilePicture} alt="" className="approve-avatar-img" referrerPolicy="no-referrer" />
                        ) : (
                          getInitials(req.name)
                        )}
                      </div>
                      <div><h4>{req.name}</h4><p>{req.type}</p></div>
                    </div>
                    <span className="req-date">{new Date(req.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="approve-body">
                    <p><strong>Period:</strong> {new Date(req.startDate).toLocaleDateString()} {req.endDate ? 'to ' + new Date(req.endDate).toLocaleDateString() : ''}</p>
                    <p><strong>Reason:</strong> {req.reason}</p>
                    {req.amount && <p><strong>Amount:</strong> {formatCurrency(req.amount)}</p>}
                  </div>
                  <div className="approve-footer">
                    <button className="btn-reject" onClick={() => handleApproveRequest(req._id, 'Rejected')}>Reject</button>
                    <button className="btn-return" onClick={() => handleApproveRequest(req._id, 'Returned')}>Return</button>
                    <button className="btn-approve" onClick={() => handleApproveRequest(req._id, 'Approved')}>Approve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
