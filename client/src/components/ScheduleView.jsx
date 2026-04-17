import React from 'react';

export default function ScheduleView({ schedDate, setSchedDate, scheduleHolidays }) {
  return (
    <div className="attendance-personal-view animate-fadeInUp">
      <div className="attendance-personal-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3>Company Schedule</h3>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>{schedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="schedule-nav-btns">
          <button className="nav-icon-btn" onClick={() => setSchedDate(new Date(schedDate.getFullYear(), schedDate.getMonth() - 1, 1))}>
            <span className="material-icons-outlined">chevron_left</span>
          </button>
          <button className="nav-icon-btn" onClick={() => setSchedDate(new Date())} title="Today">
            <span className="material-icons-outlined">today</span>
          </button>
          <button className="nav-icon-btn" onClick={() => setSchedDate(new Date(schedDate.getFullYear(), schedDate.getMonth() + 1, 1))}>
            <span className="material-icons-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="calendar-weekday-header">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="weekday-name">{d}</div>)}
      </div>

      <div className="schedule-calendar-grid">
        {(() => {
          const year = schedDate.getFullYear();
          const month = schedDate.getMonth();
          const firstDayOfMonth = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const leadDays = (firstDayOfMonth + 6) % 7;
          const cells = [];
          const today = new Date();
          const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

          for (let x = 0; x < leadDays; x++) {
            cells.push(<div key={`empty-${x}`} className="calendar-day-cell empty"></div>);
          }

          for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const localDateString = [
              d.getFullYear(),
              String(d.getMonth() + 1).padStart(2, '0'),
              String(d.getDate()).padStart(2, '0')
            ].join('-');

            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const holiday = scheduleHolidays.find(h => h.date === localDateString);
            const isToday = isCurrentMonth && today.getDate() === i;

            let type = 'work';
            if (holiday) type = 'holiday';
            else if (isWeekend) type = 'weekend';

            cells.push(
              <div key={i} className={`calendar-day-cell ${type} ${isToday ? 'today' : ''}`}>
                <div className="cal-day-header">
                  <span className="cal-day-num">{i}</span>
                  {isToday && <span className="today-badge">TODAY</span>}
                </div>
                <div className="cal-day-content">
                  {type === 'holiday' ? (
                    <span className="cal-holiday-tag" title={holiday.summary}>{holiday.summary}</span>
                  ) : type === 'weekend' ? (
                    <span className="cal-status-text">Weekend</span>
                  ) : null}
                </div>
              </div>
            );
          }

          const totalCells = cells.length;
          const remaining = (7 - (totalCells % 7)) % 7;
          for (let z = 0; z < remaining; z++) {
            cells.push(<div key={`empty-end-${z}`} className="calendar-day-cell empty"></div>);
          }

          return cells;
        })()}
      </div>
    </div>
  );
}
