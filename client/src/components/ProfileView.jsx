import React from 'react';
import { getInitials } from '../utils/helpers';

export default function ProfileView({ user, profileTab, setProfileTab, handleStartEdit }) {
  return (
    <div className="profile-container animate-fadeInUp">
      <div className="profile-header-card">
        <div className="profile-header-top">
          {user.picture ? <img className="profile-header-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" /> : <div className="profile-header-avatar-placeholder">{getInitials(user.name)}</div>}
          <div className="profile-header-main">
            <div className="profile-name-group">
              <h3>{user.name}</h3>
              {user.contractEnd && (
                <span className="employee-card-contract">
                  <span className="material-icons-outlined">event_busy</span>
                  {new Date(user.contractEnd) < new Date() ? 'EXPIRED' : `Valid thru ${new Date(user.contractEnd).toLocaleDateString()}`}
                </span>
              )}
            </div>
            <p>{user.position || 'Employee'} • {user.department || 'General'}</p>
          </div>
          <button className="profile-edit-btn" onClick={handleStartEdit}>
            <span className="material-icons-outlined">edit</span> Edit Profile
          </button>
        </div>
        <div className="profile-header-tabs">
          <button className={`profile-tab-btn ${profileTab === 'personal' ? 'active' : ''}`} onClick={() => setProfileTab('personal')}>Personal</button>
          <button className={`profile-tab-btn ${profileTab === 'contract' ? 'active' : ''}`} onClick={() => setProfileTab('contract')}>Contract</button>
          <button className={`profile-tab-btn ${profileTab === 'team' ? 'active' : ''}`} onClick={() => setProfileTab('team')}>Team</button>
        </div>
      </div>

      <div className="profile-tab-content">
        {profileTab === 'personal' && (
          <div className="profile-card">
            <div className="profile-bio-card">
              <div className="profile-section-header"><span className="material-icons-outlined">info</span> Bio</div>
              <p className="profile-bio-text">{user.bio || 'No bio provided.'}</p>
            </div>
            <div className="profile-info-grid">
              <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{user.employeeId || `EMS-${user._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Role</span><span className="status-pill approved" style={{ textTransform: 'capitalize' }}>{user.role}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Email</span><span className="profile-info-value">{user.email}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Phone</span><span className="profile-info-value">{user.phone || '-'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Gender</span><span className="profile-info-value">{user.gender || '-'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Marital Status</span><span className="profile-info-value">{user.maritalStatus || '-'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Birthday</span><span className="profile-info-value">{user.birthday ? new Date(user.birthday).toLocaleDateString() : '-'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Contract End</span><span className="profile-info-value" style={{ fontWeight: '700', color: (user.contractEnd && new Date(user.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>{user.contractEnd ? new Date(user.contractEnd).toLocaleDateString() : 'Permanent'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Leave Quota</span><span className="profile-info-value" style={{ fontWeight: '700', color: '#2563eb' }}>{user.leaveQuota || 0} Days</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Address</span><span className="profile-info-value">{user.address || '-'}</span></div>
            </div>
          </div>
        )}
        {profileTab === 'contract' && (
          <div className="profile-card">
            <div className="profile-section-header">Employment Details</div>
            <div className="profile-info-grid">
              <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{user.employeeId || `EMS-${user._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Employment Status</span><span className="profile-info-value">{user.employmentStatus || 'Probation'}</span></div>
              <div className="profile-info-item"><span className="profile-info-label">Join Date</span><span className="profile-info-value">{user.joinDate ? new Date(user.joinDate).toLocaleDateString() : '-'}</span></div>
              <div className="profile-info-item">
                <span className="profile-info-label">Contract End</span>
                <span className="profile-info-value" style={{ fontWeight: '700', color: (user.contractEnd && new Date(user.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>
                  {user.contractEnd ? new Date(user.contractEnd).toLocaleDateString() : (user.employmentStatus === 'Contract' ? 'Date Not Set' : 'Permanent')}
                </span>
              </div>
            </div>
          </div>
        )}
        {profileTab === 'team' && (
          <div className="profile-card">
            <div className="profile-section-header">Organization</div>
            <div className="manager-info">
              <div className="manager-avatar-placeholder"><span className="material-icons-outlined">person</span></div>
              <div className="manager-text"><h5>{user.manager || '-'}</h5><p>Manager</p></div>
            </div>
            <div className="team-list" style={{ marginTop: '20px' }}>
              <div className="profile-section-header" style={{ fontSize: '11px', marginBottom: '10px' }}>Team Members</div>
              {!user.teamMembers || user.teamMembers.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No team members.</p> : user.teamMembers.map((m, i) => (
                <div key={i} className="team-member-item" style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <div className="member-avatar-mini" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>{getInitials(m.name || m.n)}</div>
                  <div className="member-info-mini"><strong>{m.name || m.n}</strong><p style={{ margin: 0, fontSize: '11px', color: '#888' }}>{m.position || m.p}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
