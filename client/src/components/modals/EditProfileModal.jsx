import React from 'react';

export default function EditProfileModal({ editFormData, handleEditChange, handleSaveProfile, isSavingProfile, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fadeInUp">
        <div className="modal-header"><h3>Edit Information</h3><button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button></div>
        <form onSubmit={handleSaveProfile} className="edit-profile-form">
          <div className="form-group">
            <label>Full Name</label>
            <input name="name" value={editFormData.name} onChange={handleEditChange} required placeholder="Enter your full name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input name="phone" value={editFormData.phone} onChange={handleEditChange} placeholder="+62..." />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={editFormData.gender} onChange={handleEditChange}>
                <option value="-">- Select -</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Birthday</label>
              <input type="date" name="birthday" value={editFormData.birthday} onChange={handleEditChange} />
            </div>
            <div className="form-group">
              <label>Marital Status</label>
              <select name="maritalStatus" value={editFormData.maritalStatus} onChange={handleEditChange}>
                <option value="-">- Select -</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Bio (Short Description)</label>
            <textarea name="bio" value={editFormData.bio} onChange={handleEditChange} maxLength="250" rows="2" placeholder="Tell us a bit about yourself..."></textarea>
          </div>
          <div className="form-group">
            <label>Current Address</label>
            <textarea name="address" value={editFormData.address} onChange={handleEditChange} rows="2" placeholder="Your current living address..."></textarea>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={isSavingProfile}>
              {isSavingProfile ? <div className="loading-spinner"></div> : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
