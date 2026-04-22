import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { getInitials, getGreeting, getRequestIcon, formatTime, formatDate, formatTimestamp, WELCOME_MESSAGES } from '../utils/helpers';

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 17); }, [lat, lng, map]);
  return null;
}

export default function Dashboard({
  user, currentTime, welcomeIndex, attendanceSummary, activeTab, setActiveTab,
  // Feed
  onLeaveToday, recentActivities, handleDashboardViewMore,
  // My Info
  officeSettings, userLocation, locationStatus, distanceToOffice,
  cameraStatus, capturedPhoto, videoRef, canvasRef,
  setEditOfficeData, setShowOfficeModal,
  // Clock
  clockLoading, statusMsg, handleClock, history, formatTimestampFn,
}) {
  return (
    <div className="dashboard-view animate-fadeInUp">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        {user.picture ? <img className="welcome-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" /> : <div className="welcome-avatar-placeholder">{getInitials(user.name)}</div>}
        <div className="welcome-info">
          <p className="welcome-greeting">{getGreeting(currentTime)}</p>
          <h2 className="welcome-name">{user.name}!</h2>
          <p className="welcome-dynamic-msg animate-fadeInRight">{WELCOME_MESSAGES[welcomeIndex]}</p>
          <p className="welcome-position"><span className="material-icons-outlined">badge</span>{user.position || 'Staff'} - {user.role || 'Employee'}</p>
          <div className="welcome-badges">
            <span className="badge badge-department"><span className="material-icons-outlined">apartment</span>General</span>
            <span className="badge badge-location"><span className="material-icons-outlined">location_on</span>OUR Office</span>
          </div>
        </div>
      </div>

      {['admin', 'manager', 'hrd'].includes(user?.role) && (
        <div className="stats-grid animate-fadeInScale" style={{ padding: '0 20px', marginBottom: '24px', animationDelay: '0.1s' }}>
          <div className="stat-card glass-panel">
            <div className="stat-label">Total Staff</div>
            <div className="vibrant-value blue">{attendanceSummary.totalStaff}</div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Present Today</div>
            <div className="vibrant-value green">
              {attendanceSummary.presentCount}
              <span style={{ fontSize: '12px', marginLeft: '4px', fontWeight: '400', color: '#64748b' }}>
                ({Math.round((attendanceSummary.presentCount / (attendanceSummary.totalStaff || 1)) * 100)}%)
              </span>
            </div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Late Arrivals</div>
            <div className="vibrant-value red">
              {attendanceSummary.lateCount}
            </div>
          </div>
        </div>
      )}

      <div className="tabs-container">
        <div className="tabs-row">
          <button className={`tab-item ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}><span className="material-icons-outlined">dashboard</span>Feed</button>
          <button className={`tab-item ${activeTab === 'myinfo' ? 'active' : ''}`} onClick={() => setActiveTab('myinfo')}><span className="material-icons-outlined">person_outline</span>My Info</button>
        </div>
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="feed-section">
          <div className="feed-date">
            <div className="feed-date-text">
              {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </div>
          </div>

          <div className="feed-updates-header">
            <div className="feed-updates-left">
              <div className="feed-updates-icon"><span className="material-icons-outlined">newspaper</span></div>
              <span className="feed-updates-title">All Updates</span>
            </div>
            <button className="feed-view-more" onClick={handleDashboardViewMore}>View More<span className="material-icons-outlined">arrow_forward</span></button>
          </div>

          <div className="feed-card animate-fadeInScale">
            <div className="feed-card-header"><span className="feed-card-header-icon">🗓️</span><span className="feed-card-header-text">On Leave Today</span></div>
            {onLeaveToday.length === 0 ? (
              <div className="feed-card-empty" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Everyone is present today.
              </div>
            ) : (
              onLeaveToday.map((item, idx) => {
                const iconData = getRequestIcon(item.type);
                return (
                  <div key={item._id || idx} className="feed-card-item">
                    <div className="feed-card-item-avatar">
                      {item.profilePicture ? (
                        <img src={item.profilePicture} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className={`feed-card-item-avatar-placeholder ${idx % 2 === 0 ? 'blue' : 'purple'}`}>
                          {getInitials(item.name)}
                        </div>
                      )}
                    </div>
                    <div className="feed-card-item-info">
                      <div className="feed-card-item-name">{item.name}</div>
                      <div className="feed-card-item-type">
                        <span className="material-icons-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px', color: iconData.color }}>
                          {iconData.icon}
                        </span>
                        {item.type}
                      </div>
                    </div>
                    <div className="feed-card-item-date">
                      {new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {item.endDate && item.startDate !== item.endDate ? ` - ${new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* My Info Tab */}
      {activeTab === 'myinfo' && (
        <div className="myinfo-section">
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* 1. Location Card with Leaflet Map */}
          <div className="location-card animate-fadeInScale">
            <div className="location-card-header">
              <div className="location-card-title">
                <span className="material-icons-outlined">location_on</span>
                <span>{officeSettings.name || 'Your Location'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className={`distance-badge ${locationStatus === 'granted' ? 'in-range' : locationStatus === 'out_of_range' ? 'out-range' : 'loading'}`}>
                  {locationStatus === 'loading' && <><span className="material-icons-outlined spin">sync</span> Sensing...</>}
                  {locationStatus === 'denied' && <><span className="material-icons-outlined">gps_off</span> GPS Hidden</>}
                  {locationStatus === 'granted' && <><span className="material-icons-outlined">check_circle</span> In Range ({distanceToOffice}m)</>}
                  {locationStatus === 'out_of_range' && <><span className="material-icons-outlined">warning</span> Out of Range ({distanceToOffice}m)</>}
                </div>
                <div style={{ fontSize: '11px', color: locationStatus === 'granted' ? '#16a34a' : '#dc2626', fontWeight: '500' }}>
                  {locationStatus === 'granted' ? '✓ Ready for Attendance' : locationStatus === 'out_of_range' ? `✖ Move within ${officeSettings.radius}m` : ''}
                </div>

                {['admin', 'hrd'].includes(user?.role) && (
                  <button className="nav-icon-btn" style={{ width: '32px', height: '32px' }} onClick={() => { setEditOfficeData(officeSettings); setShowOfficeModal(true); }} title="Edit Office Location">
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>settings</span>
                  </button>
                )}
              </div>
            </div>
            <div className="leaflet-map-wrapper">
              <MapContainer center={[officeSettings.lat, officeSettings.lng]} zoom={17} scrollWheelZoom={false} style={{ height: '220px', width: '100%', borderRadius: '12px' }} key={`${officeSettings.lat}-${officeSettings.lng}`}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                <Circle center={[officeSettings.lat, officeSettings.lng]} radius={officeSettings.radius} pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 }} />
                <Marker position={[officeSettings.lat, officeSettings.lng]} />
                {userLocation && (
                  <>
                    <Marker position={[userLocation.lat, userLocation.lng]} />
                    <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />
                  </>
                )}
              </MapContainer>
            </div>
          </div>

          {/* 2. Camera Card */}
          <div className="camera-card animate-fadeInScale" style={{ animationDelay: '0.1s' }}>
            <div className="camera-card-header">
              <div className="camera-card-title">
                <span className="material-icons-outlined">photo_camera</span>
                <span>Camera</span>
              </div>
              <div className={`camera-status-badge ${cameraStatus}`}>
                {cameraStatus === 'loading' && 'Starting...'}
                {cameraStatus === 'active' && '● Live'}
                {cameraStatus === 'denied' && 'Blocked'}
              </div>
            </div>
            <div className="camera-preview-wrapper">
              {cameraStatus === 'denied' ? (
                <div className="camera-denied">
                  <span className="material-icons-outlined">videocam_off</span>
                  <p>Izinkan akses kamera untuk absensi.</p>
                </div>
              ) : capturedPhoto ? (
                <img src={capturedPhoto} alt="Captured" className="camera-captured" />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
              )}
            </div>
          </div>

          {/* 3. Clock Card */}
          <div className="attendance-card animate-fadeInScale" style={{ animationDelay: '0.2s' }}>
            <p className="attendance-time">{formatTime(currentTime)}</p>
            <p className="attendance-date">{formatDate(currentTime)}</p>
            <div className="attendance-buttons">
              <button 
                className="btn-clock btn-clock-in" 
                onClick={() => handleClock('clock_in')} 
                disabled={clockLoading || locationStatus !== 'granted' || cameraStatus !== 'active'}
                title={locationStatus !== 'granted' ? `Anda di luar radius (${distanceToOffice}m > ${officeSettings.radius}m)` : ''}
              >
                🟢 Clock In
              </button>
              <button 
                className="btn-clock btn-clock-out" 
                onClick={() => handleClock('clock_out')} 
                disabled={clockLoading || locationStatus !== 'granted' || cameraStatus !== 'active'}
                title={locationStatus !== 'granted' ? `Anda di luar radius (${distanceToOffice}m > ${officeSettings.radius}m)` : ''}
              >
                🔴 Clock Out
              </button>
            </div>
            {locationStatus === 'out_of_range' && (
              <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                <span className="material-icons-outlined" style={{ fontSize: '13px', verticalAlign: 'middle' }}>info</span>
                Jarak Anda <strong>{distanceToOffice}m</strong>. Maksimal izin adalah <strong>{officeSettings.radius}m</strong>.
              </p>
            )}
            {statusMsg && <div className={`status-message status-${statusMsg.type}`}>{statusMsg.text}</div>}

          </div>

          {/* 4. History Card */}
          <div className="history-card animate-fadeInScale" style={{ animationDelay: '0.3s' }}>
            <div className="history-card-header"><span className="material-icons-outlined">history</span><span className="history-card-title">Recent Activity</span></div>
            {history.length === 0 ? <div className="history-empty"><p>No activity yet.</p></div> : (
              <table className="history-table">
                <thead><tr><th>Time</th><th>Type</th><th>Location</th></tr></thead>
                <tbody>
                  {history.slice(0, 5).map((h, i) => (
                    <tr key={i}>
                      <td>{formatTimestamp(h.timestamp)}</td>
                      <td><span className={`type-badge ${h.type === 'clock_in' ? 'clock-in' : 'clock-out'}`}>{h.type === 'clock_in' ? 'In' : 'Out'}</span></td>
                      <td>{h.latitude?.toFixed(4)}, {h.longitude?.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
