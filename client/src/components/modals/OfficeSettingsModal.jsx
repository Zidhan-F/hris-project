import React from 'react';
import axios from 'axios';
import { API_URL } from '../../utils/helpers';

export default function OfficeSettingsModal({ editOfficeData, setEditOfficeData, setOfficeSettings, workDays, setWorkDays, setStatusMsg, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fadeInUp">
        <div className="modal-header">
          <h3>Office Location Settings</h3>
          <button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const res = await axios.put(`${API_URL}/api/settings/office`, editOfficeData);
            if (res.data.success) {
              setOfficeSettings(res.data.data);
              onClose();
              setStatusMsg({ type: 'success', text: 'Lokasi kantor diperbarui!' });
              setTimeout(() => setStatusMsg(null), 3000);
            }
          } catch (err) { console.error('Error saving office:', err); }
        }} className="edit-profile-form">
          <div className="form-group">
            <label>Office Name</label>
            <input value={editOfficeData.name} onChange={e => setEditOfficeData({ ...editOfficeData, name: e.target.value })} placeholder="e.g. EMS Head Office" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
              <input type="number" step="any" value={editOfficeData.lat} onChange={e => setEditOfficeData({ ...editOfficeData, lat: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input type="number" step="any" value={editOfficeData.lng} onChange={e => setEditOfficeData({ ...editOfficeData, lng: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Radius (meter)</label>
            <input type="number" value={editOfficeData.radius} onChange={e => setEditOfficeData({ ...editOfficeData, radius: e.target.value })} min="10" max="1000" required />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            💡 Tip: Buka Google Maps, klik kanan pada lokasi kantor, lalu salin koordinatnya.
          </p>

          <div className="form-group" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 'bold' }}>
              <span className="material-icons-outlined">calendar_month</span> Pengaturan Hari Kerja
            </label>
            <div className="workdays-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={workDays.includes(day)}
                    onChange={async (e) => {
                      let newDays;
                      if (e.target.checked) newDays = [...workDays, day];
                      else newDays = workDays.filter(d => d !== day);
                      setWorkDays(newDays);
                      try {
                        await axios.put(`${API_URL}/api/settings/workdays`, { days: newDays });
                      } catch (err) { console.error('Error saving workdays:', err); }
                    }}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">Save Location</button>
          </div>
        </form>
      </div>
    </div>
  );
}
