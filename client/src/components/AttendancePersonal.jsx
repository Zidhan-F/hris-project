import React from 'react';
import { groupAttendanceByDay } from '../utils/helpers';

export default function AttendancePersonal({
  user, personalAttendance, personalLoading, currentTime,
  selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
  fetchPersonalAttendance
}) {
  const processed = groupAttendanceByDay(personalAttendance, currentTime);
  const totalHrs = processed.reduce((acc, curr) => acc + (curr.isValid ? parseFloat(curr.hours || 0) : 0), 0);
  const daysPresent = processed.filter(d => d.isValid).length;
  const onTimeCount = processed.filter(d => d.isValid && d.onTime).length;
  const onTimeRate = daysPresent > 0 ? Math.round((onTimeCount / daysPresent) * 100) : 0;

  return (
    <div className="attendance-personal-view animate-fadeInUp">
      <div className="attendance-personal-header">
        <h3>Personal Attendance</h3>
        <div className="header-filters">
          <select value={selectedMonth} onChange={e => { setSelectedMonth(parseInt(e.target.value)); fetchPersonalAttendance(parseInt(e.target.value), selectedYear); }}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select value={selectedYear} onChange={e => { setSelectedYear(parseInt(e.target.value)); fetchPersonalAttendance(selectedMonth, parseInt(e.target.value)); }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stats-card stats-blue animate-fadeInUp" style={{ animationDelay: '0s' }}>
          <div className="stats-card-icon"><span className="material-icons-outlined">schedule</span></div>
          <div className="stats-card-content"><span className="stats-label">Total Hours</span><span className="stats-value">{totalHrs.toFixed(1)}h</span></div>
        </div>
        <div className="stats-card stats-green animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          <div className="stats-card-icon"><span className="material-icons-outlined">calendar_today</span></div>
          <div className="stats-card-content"><span className="stats-label">Days Present</span><span className="stats-value">{daysPresent}d</span></div>
        </div>
        <div className="stats-card stats-amber animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
          <div className="stats-card-icon"><span className="material-icons-outlined">verified</span></div>
          <div className="stats-card-content"><span className="stats-label">On Time</span><span className="stats-value">{onTimeRate}%</span></div>
        </div>
      </div>

      {personalLoading ? <div className="loading-spinner"></div> : (
        <div className="att-cards-grid">
          {processed.length === 0 ? <div className="empty-state">No records for this period.</div> :
            processed.map((day, idx) => (
              <div key={idx} className="att-card-daily">
                <div className="att-card-header">
                  <div className="att-card-date-box">
                    <div className="att-card-day-circle">
                      <span className="att-card-day-num">{new Date(day.date).getDate()}</span>
                      <span className="att-card-day-name">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    </div>
                    <div className="att-card-date-info">
                      <h4>{new Date(day.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
                      <p>Daily Attendance Log</p>
                    </div>
                  </div>
                </div>
                <div className="att-card-body">
                  <div className="att-card-status-row in">
                    <div className="att-card-status-left"><div className="att-status-icon in"><span className="material-icons-outlined">login</span></div><span className="att-status-label">Clock In</span></div>
                    <span className="att-status-time">{day.in ? new Date(day.in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                  <div className="att-card-status-row out">
                    <div className="att-card-status-left"><div className="att-status-icon out"><span className="material-icons-outlined">logout</span></div><span className="att-status-label">Clock Out</span></div>
                    <span className="att-status-time">{day.out ? new Date(day.out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                </div>
                <div className="att-card-footer">
                  <span className="att-workhours-label">Total Work Hours</span>
                  <div className="att-workhours-value">{day.hours} <span className="att-workhours-unit">hrs</span></div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
