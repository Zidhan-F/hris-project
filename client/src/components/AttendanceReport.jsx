import React from 'react';
import { formatCurrency, getInitials } from '../utils/helpers';

export default function AttendanceReport({
  user, monthlyReports, isFetchingReports,
  reportMonth, setReportMonth, reportYear, setReportYear,
  fetchMonthlyReports
}) {
  return (
    <div className="attendance-report-view animate-fadeInUp">
      <div className="attendance-personal-header">
        <h3>Monthly Attendance Report</h3>
        <div className="header-filters">
          <select value={reportMonth} onChange={e => { setReportMonth(parseInt(e.target.value)); fetchMonthlyReports(parseInt(e.target.value), reportYear); }}>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select value={reportYear} onChange={e => { setReportYear(parseInt(e.target.value)); fetchMonthlyReports(reportMonth, parseInt(e.target.value)); }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-export-csv" onClick={() => {
            const headers = ['Name', 'Email', 'Position', 'Days Present', 'Late Days', 'Total Hours', 'Rate %'];
            const rows = monthlyReports.map(r => [r.name, r.email, r.position, r.daysPresent, r.lateDays, r.totalHours, r.attendanceRate]);
            const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Attendance_Report_${reportMonth + 1}_${reportYear}.csv`);
            link.click();
          }}>
            <span className="material-icons-outlined">download</span> Export CSV
          </button>
        </div>
      </div>

      {isFetchingReports ? <div className="loading-spinner"></div> : (
        <div className="table-responsive" style={{ background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <table className="request-table">
            <thead>
              <tr><th>Employee</th><th>Days Present</th><th>Late Days</th><th>Total Hours</th><th>Work Rate</th></tr>
            </thead>
            <tbody>
              {monthlyReports.map(report => (
                <tr key={report.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {report.profilePicture ? (
                        <img src={report.profilePicture} alt="" referrerPolicy="no-referrer" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#475569', flexShrink: 0 }}>{getInitials(report.name)}</div>
                      )}
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{report.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{report.position}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="stat-pill-green">{report.daysPresent} days</span></td>
                  <td><span className={report.lateDays > 0 ? 'stat-pill-red' : 'stat-pill-gray'}>{report.lateDays} sessions</span></td>
                  <td><strong>{report.totalHours}h</strong></td>
                  <td>
                    <div className="progress-bar-mini">
                      <div className="progress-fill" style={{ width: `${Math.min(100, report.attendanceRate)}%`, background: parseInt(report.attendanceRate) > 80 ? '#10b981' : '#f59e0b' }}></div>
                    </div>
                    <span className="work-rate-text">{report.attendanceRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
