import React, { useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000';

// Menu items for sidebar
const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hasSubmenu: false },
  { id: 'profile', label: 'Profile', icon: 'person_outline', hasSubmenu: true },
  { id: 'employee', label: 'Employee', icon: 'groups', hasSubmenu: true },
  { id: 'attendance', label: 'Attendance', icon: 'schedule', hasSubmenu: true },
  { id: 'finance', label: 'Finance', icon: 'attach_money', hasSubmenu: true },
  { id: 'payroll', label: 'Payroll', icon: 'account_balance_wallet', hasSubmenu: true },
  { id: 'leave', label: 'Leave', icon: 'event_busy', hasSubmenu: true },
  { id: 'training', label: 'Training', icon: 'school', hasSubmenu: true },
  { id: 'form', label: 'Form', icon: 'description', hasSubmenu: true },
];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [history, setHistory] = useState([]);
  const [token, setToken] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('feed');

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async (email) => {
    try {
      const res = await axios.get(`${API_URL}/api/attendance/history?email=${email}`);
      if (res.data.success) {
        setHistory(res.data.records);
      }
    } catch (err) {
      console.error('Gagal ambil riwayat:', err);
    }
  }, []);

  // Google Login Success
  const handleLoginSuccess = async (response) => {
    const credential = response.credential;
    setLoading(true);

    try {
      const result = await axios.post(`${API_URL}/api/auth/google`, {
        token: credential
      });

      if (result.data.success) {
        setUser(result.data.user);
        setToken(credential);
        fetchHistory(result.data.user.email);
      }
    } catch (error) {
      console.error('Gagal verifikasi:', error);
      setStatusMsg({
        type: 'error',
        text: 'Gagal memverifikasi akun Google. Pastikan server nyala!'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginError = () => {
    setStatusMsg({ type: 'error', text: 'Login Google gagal. Coba lagi.' });
  };

  // Clock In/Out
  const handleClock = async (type) => {
    if (!token || !user) return;
    setClockLoading(true);
    setStatusMsg(null);

    try {
      const result = await axios.post(`${API_URL}/api/attendance/submit`, {
        token: token,
        lat: -6.1528,
        lng: 106.7909,
        type: type
      });

      if (result.data.success) {
        setStatusMsg({
          type: 'success',
          text: `${type === 'clock_in' ? '🟢 Clock In' : '🔴 Clock Out'} berhasil dicatat!`
        });
        fetchHistory(user.email);
      }
    } catch (error) {
      setStatusMsg({
        type: 'error',
        text: 'Gagal mencatat absensi. Coba lagi.'
      });
    } finally {
      setClockLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setHistory([]);
    setStatusMsg(null);
    setActiveMenu('dashboard');
    setActiveTab('feed');
  };

  // Sidebar handlers
  const openSidebar = () => {
    setSidebarOpen(true);
    setSidebarClosing(false);
  };

  const closeSidebar = () => {
    setSidebarClosing(true);
    setTimeout(() => {
      setSidebarOpen(false);
      setSidebarClosing(false);
    }, 250);
  };

  const handleMenuClick = (menuId) => {
    setActiveMenu(menuId);
    closeSidebar();
  };

  // Format helpers
  const formatTime = (date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  const formatShortDate = (date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatDayName = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'short' });

  const formatTimestamp = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 10) return 'Good Morning,';
    if (hour < 15) return 'Good Afternoon,';
    if (hour < 18) return 'Good Evening,';
    return 'Good Night,';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // =============== RENDER ===============

  // LOGIN VIEW
  if (!user) {
    return (
      <div className="login-page">
        {/* Top brand bar */}
        <div className="login-brand-bar">
          <div className="login-brand-icon">
            <span className="material-icons-outlined">verified_user</span>
          </div>
          <div className="login-brand-text">
            <span className="login-brand-name">EMS</span>
            <span className="login-brand-sub">Employee</span>
          </div>
        </div>

        {/* Login card */}
        <div className="login-card-area">
          <div className="login-card">
            <div className="login-card-logo">
              <div className="login-card-logo-icon">
                <span className="material-icons-outlined">verified_user</span>
              </div>
              <div className="login-card-brand">
                <span className="login-card-brand-name">EMS</span>
                <span className="login-card-brand-sub">Employee</span>
              </div>
            </div>

            <div className="login-welcome">
              <h2>Welcome to EMS!</h2>
              <p>Please sign-in with your account</p>
            </div>

            <div className="login-auth-area">
              {loading ? (
                <div className="loading-center">
                  <div className="loading-spinner"></div>
                  <p>Memverifikasi akun...</p>
                </div>
              ) : (
                <div className="google-btn-wrapper">
                  <GoogleLogin
                    onSuccess={handleLoginSuccess}
                    onError={handleLoginError}
                    shape="pill"
                    size="large"
                    width="320"
                    text="continue_with"
                    theme="outline"
                  />
                </div>
              )}
            </div>

            {statusMsg && (
              <div className={`status-message status-${statusMsg.type}`}>
                {statusMsg.type === 'error' ? '⚠️' : '✅'} {statusMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer-bar">
          <button className="login-footer-btn">
            <span className="material-icons-outlined">settings</span>
          </button>
          <button className="login-footer-btn">
            <span className="material-icons-outlined">language</span>
            English
          </button>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="dashboard-page">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className={`sidebar ${sidebarClosing ? 'sidebar-closing' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <span className="material-icons-outlined">verified_user</span>
            </div>
            <div className="sidebar-company">
              <div className="sidebar-company-dropdown">
                <span className="sidebar-company-name">EMS COMPANY</span>
                <span className="material-icons-outlined">expand_more</span>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`sidebar-menu-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => handleMenuClick(item.id)}
              >
                <span className="sidebar-menu-left">
                  <span className="material-icons-outlined">{item.icon}</span>
                  {item.label}
                </span>
                {item.hasSubmenu && (
                  <span className="sidebar-menu-right">
                    <span className="material-icons-outlined">chevron_right</span>
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-lang">
              <span className="material-icons-outlined">language</span>
              English
            </div>
            <div className="sidebar-brand-footer">
              <div className="sidebar-brand-footer-icon">
                <span className="material-icons-outlined">verified_user</span>
              </div>
              <div className="sidebar-brand-footer-text">
                <span className="sidebar-brand-footer-name">EMS</span>
                <span className="sidebar-brand-footer-sub">Employee</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="navbar-left">
          <button className="nav-icon-btn" onClick={openSidebar} id="menu-toggle">
            <span className="material-icons-outlined">menu</span>
          </button>
          <button className="nav-icon-btn">
            <span className="material-icons-outlined">search</span>
          </button>
        </div>
        <div className="navbar-right">
          <button className="nav-icon-btn">
            <span className="material-icons-outlined">menu_book</span>
          </button>
          <button className="nav-icon-btn">
            <span className="material-icons-outlined">notifications_none</span>
          </button>
          {user.picture ? (
            <img
              className="nav-avatar"
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              onClick={handleLogout}
              title="Klik untuk logout"
            />
          ) : (
            <div className="nav-avatar-placeholder" onClick={handleLogout} title="Klik untuk logout">
              {getInitials(user.name)}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="dashboard-content">
        {/* Welcome Banner */}
        <div className="welcome-banner">
          {user.picture ? (
            <img
              className="welcome-avatar"
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="welcome-avatar-placeholder">
              {getInitials(user.name)}
            </div>
          )}
          <div className="welcome-info">
            <p className="welcome-greeting">{getGreeting()}</p>
            <h2 className="welcome-name">{user.name}!</h2>
            <p className="welcome-position">
              <span className="material-icons-outlined">badge</span>
              {user.position || 'Staff'} - {user.role || 'Employee'}
            </p>
            <div className="welcome-badges">
              <span className="badge badge-department">
                <span className="material-icons-outlined">apartment</span>
                {user.position || 'General'}
              </span>
              <span className="badge badge-location">
                <span className="material-icons-outlined">location_on</span>
                EMS Office
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <div className="tabs-row">
            <button
              className={`tab-item ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              <span className="material-icons-outlined">dashboard</span>
              Feed
            </button>
            <button
              className={`tab-item ${activeTab === 'myinfo' ? 'active' : ''}`}
              onClick={() => setActiveTab('myinfo')}
            >
              <span className="material-icons-outlined">person_outline</span>
              My Info
            </button>
          </div>
        </div>

        {/* Feed Tab */}
        {activeTab === 'feed' && (
          <div className="feed-section">
            {/* Date Header */}
            <div className="feed-date">
              <div className="feed-date-text">
                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
              <button className="feed-eye-btn">
                <span className="material-icons-outlined">visibility_off</span>
              </button>
            </div>

            {/* All Updates */}
            <div className="feed-updates-header">
              <div className="feed-updates-left">
                <div className="feed-updates-icon">
                  <span className="material-icons-outlined">newspaper</span>
                </div>
                <span className="feed-updates-title">
                  All Updates
                  <span className="feed-updates-count">
                    {history.filter(h => {
                      const d = new Date(h.timestamp);
                      return d.toDateString() === currentTime.toDateString();
                    }).length || 2}
                  </span>
                </span>
              </div>
              <button className="feed-view-more">
                View More
                <span className="material-icons-outlined">arrow_forward</span>
              </button>
            </div>

            {/* On Leave Today Card */}
            <div className="feed-card">
              <div className="feed-card-header">
                <span className="feed-card-header-icon">🌴</span>
                <span className="feed-card-header-text">On Leave Today</span>
              </div>
              <div className="feed-card-item">
                <div className="feed-card-item-avatar-placeholder pink">
                  <span className="material-icons-outlined">person</span>
                </div>
                <div className="feed-card-item-info">
                  <div className="feed-card-item-name"></div>
                  <div className="feed-card-item-type">Annual Leave</div>
                </div>
                <div className="feed-card-item-date">
                  {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="feed-card-item">
                <div className="feed-card-item-avatar-placeholder orange">
                  <span className="material-icons-outlined">person</span>
                </div>
                <div className="feed-card-item-info">
                  <div className="feed-card-item-name"></div>
                  <div className="feed-card-item-type">Annual Leave</div>
                </div>
                <div className="feed-card-item-date">
                  {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Info Tab */}
        {activeTab === 'myinfo' && (
          <div className="myinfo-section">
            {/* Profile Info Card */}
            <div className="myinfo-card">
              <div className="myinfo-card-header">
                <div className="myinfo-card-icon blue">
                  <span className="material-icons-outlined">person</span>
                </div>
                <span className="myinfo-card-title">Informasi Profil</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Nama Lengkap</span>
                <span className="myinfo-value">{user.name}</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Email</span>
                <span className="myinfo-value">{user.email}</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Jabatan</span>
                <span className="myinfo-value">{user.position || 'Staff'}</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Role</span>
                <span className="myinfo-value" style={{ textTransform: 'capitalize' }}>
                  {user.role || 'employee'}
                </span>
              </div>
            </div>

            {/* Attendance Card */}
            <div className="attendance-card">
              <p className="attendance-time">{formatTime(currentTime)}</p>
              <p className="attendance-date">{formatDate(currentTime)}</p>

              <div className="attendance-buttons">
                <button
                  className="btn-clock btn-clock-in"
                  onClick={() => handleClock('clock_in')}
                  disabled={clockLoading}
                >
                  {clockLoading ? <span className="loading-spinner" style={{
                    width: 16, height: 16, borderWidth: 2
                  }}></span> : '🟢'}
                  Clock In
                </button>
                <button
                  className="btn-clock btn-clock-out"
                  onClick={() => handleClock('clock_out')}
                  disabled={clockLoading}
                >
                  {clockLoading ? <span className="loading-spinner" style={{
                    width: 16, height: 16, borderWidth: 2,
                    borderColor: 'rgba(33,150,243,0.2)',
                    borderTopColor: '#1E88E5'
                  }}></span> : '🔴'}
                  Clock Out
                </button>
              </div>

              {statusMsg && (
                <div className={`status-message status-${statusMsg.type}`}>
                  {statusMsg.type === 'error' ? '⚠️' : '✅'} {statusMsg.text}
                </div>
              )}
            </div>

            {/* Verification Info Card */}
            <div className="myinfo-card">
              <div className="myinfo-card-header">
                <div className="myinfo-card-icon green">
                  <span className="material-icons-outlined">verified</span>
                </div>
                <span className="myinfo-card-title">Status Verifikasi</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Metode Login</span>
                <span className="myinfo-value">Google OAuth 2.0</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Token JWT</span>
                <span className="myinfo-value" style={{ color: '#2E7D32' }}>✅ Terverifikasi</span>
              </div>
              <div className="myinfo-row">
                <span className="myinfo-label">Status</span>
                <span className="myinfo-value" style={{ color: '#2E7D32' }}>🟢 Aktif</span>
              </div>
            </div>

            {/* History Card */}
            <div className="history-card">
              <div className="history-card-header">
                <span className="material-icons-outlined">history</span>
                <span className="history-card-title">Riwayat Absensi</span>
              </div>
              {history.length === 0 ? (
                <div className="history-empty">
                  <span className="history-empty-icon">📭</span>
                  <p>Belum ada riwayat absensi.</p>
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Tipe</th>
                      <th>Lokasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, idx) => (
                      <tr key={idx}>
                        <td>{formatTimestamp(record.timestamp)}</td>
                        <td>
                          <span className={`type-badge ${record.type === 'clock_in' ? 'clock-in' : 'clock-out'}`}>
                            {record.type === 'clock_in' ? '🟢 In' : '🔴 Out'}
                          </span>
                        </td>
                        <td>
                          {record.latitude?.toFixed(4)}, {record.longitude?.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button className="fab">
        <span className="material-icons-outlined">call</span>
      </button>

      {/* Footer */}
      <div className="dashboard-footer">
        © 2026 EMS Technology
      </div>
    </div>
  );
}

export default App;