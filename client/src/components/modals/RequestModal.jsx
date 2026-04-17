import React from 'react';

export default function RequestModal({ user, selectedRequestType, requestFormData, setRequestFormData, handleRequestSubmit, isSubmittingRequest, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fadeInUp">
        <div className="modal-header"><h3>New {selectedRequestType} Request</h3><button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button></div>
        <form onSubmit={handleRequestSubmit} className="request-form">
          {selectedRequestType === 'Leave' && (
            <div className="quota-display" style={{ padding: '12px', background: '#eff6ff', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-icons-outlined" style={{ color: '#3b82f6' }}>event_note</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>Jatah Cuti Tersisa: {user.leaveQuota || 0} Hari</div>
                <div style={{ fontSize: '11px', color: '#60a5fa' }}>Gunakan jatah cuti tahunan Anda dengan bijak.</div>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group"><label>Start Date</label><input type="date" required value={requestFormData.startDate} onChange={e => setRequestFormData({ ...requestFormData, startDate: e.target.value })} /></div>
            {['Leave', 'Sick', 'Permit'].includes(selectedRequestType) && (
              <div className="form-group"><label>End Date</label><input type="date" value={requestFormData.endDate} onChange={e => setRequestFormData({ ...requestFormData, endDate: e.target.value })} /></div>
            )}
          </div>
          {['Leave', 'Sick', 'Permit'].includes(selectedRequestType) && requestFormData.startDate && requestFormData.endDate && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>info</span>
              Durasi: <strong>{(() => {
                const s = new Date(requestFormData.startDate);
                const e = new Date(requestFormData.endDate);
                if (isNaN(s) || isNaN(e)) return 0;
                return Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
              })()} Hari</strong>
            </div>
          )}
          {['Reimbursement', 'Expense'].includes(selectedRequestType) && (
            <div className="form-group"><label>Amount</label><input type="number" required placeholder="0" value={requestFormData.amount} onChange={e => setRequestFormData({ ...requestFormData, amount: e.target.value })} /></div>
          )}
          <div className="form-group"><label>Reason / Description</label><textarea required rows="3" value={requestFormData.reason} onChange={e => setRequestFormData({ ...requestFormData, reason: e.target.value })} placeholder="Give details about your request..."></textarea></div>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={isSubmittingRequest}>{isSubmittingRequest ? <div className="loading-spinner"></div> : 'Submit Request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
