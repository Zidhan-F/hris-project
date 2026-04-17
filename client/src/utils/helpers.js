import L from 'leaflet';

// Default office location (will be overridden by DB settings)
export const DEFAULT_OFFICE = { lat: -6.1528, lng: 106.7909, radius: 100, name: 'EMS Office' };

// Fix Leaflet default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

export const WELCOME_MESSAGES = [
  "Ready to conquer the day?",
  "Let's build something amazing today!",
  "Your dedication drives our success.",
  "Great things are waiting for you!",
  "Every small win counts. Keep it up!",
  "Glad to see you again!",
  "Efficiency is the key to excellence."
];

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', hasSubmenu: false },
  { id: 'profile', label: 'Profile', icon: 'person_outline', hasSubmenu: false },
  { id: 'employee', label: 'Employee', icon: 'groups', hasSubmenu: false },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: 'schedule',
    hasSubmenu: true,
    submenus: [
      { id: 'att-personal', label: 'Personal' },
      { id: 'att-schedule', label: 'Schedule' },
      { id: 'att-report', label: 'Monthly Report' }
    ]
  },
  { id: 'payroll', label: 'Payroll', icon: 'account_balance_wallet', hasSubmenu: false },
  { id: 'leave', label: 'Leave', icon: 'event_busy', hasSubmenu: false },
];

// Haversine formula — calculate distance between two GPS points in meters
export function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getRequestIcon = (type) => {
  const types = {
    'Leave': { icon: 'event_available', color: '#3b82f6' },
    'Permit': { icon: 'fact_check', color: '#10b981' },
    'Sick': { icon: 'medical_services', color: '#f43f5e' },
    'Overtime': { icon: 'more_time', color: '#8b5cf6' },
    'Reimbursement': { icon: 'payments', color: '#f59e0b' },
    'Timesheet': { icon: 'pending_actions', color: '#6366f1' },
    'Expense': { icon: 'receipt_long', color: '#ec4899' },
    'Other': { icon: 'help_outline', color: '#64748b' }
  };
  return types[type] || types['Other'];
};

// Format Helpers
export const formatTime = (date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const formatDate = (date) => date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
export const formatTimestamp = (ts) => new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
export const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

// Safe Date string function to prevent "invalid time value" crashes
export const safeISO = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().substring(0, 10);
  } catch { return ''; }
};

export const getGreeting = (currentTime) => {
  const hr = currentTime.getHours();
  if (hr < 10) return 'Good Morning,';
  if (hr < 15) return 'Good Afternoon,';
  if (hr < 18) return 'Good Evening,';
  return 'Good Night,';
};

// Group Attendance by Day
export const groupAttendanceByDay = (records, currentTime) => {
  if (!records || records.length === 0) return [];
  const days = {};
  records.forEach(repo => {
    const d = new Date(repo.timestamp);
    if (isNaN(d.getTime())) return;
    const dateKey = d.toDateString();
    if (!days[dateKey]) days[dateKey] = { in: null, out: null };
    if (repo.type === 'clock_in') {
      if (!days[dateKey].in || d < days[dateKey].in) {
        days[dateKey].in = d;
      }
    }
    if (repo.type === 'clock_out') {
      if (!days[dateKey].out || d > days[dateKey].out) {
        days[dateKey].out = d;
      }
    }
  });

  const now = currentTime;
  const todayStr = now.toDateString();
  const currentHour = now.getHours();

  return Object.entries(days).map(([date, times]) => {
    let hours = 0;
    let isValid = false;
    const isToday = date === todayStr;

    if (times.in && times.out) {
      hours = Math.abs(times.out - times.in) / (1000 * 60 * 60);
      isValid = true;
    } else if (times.in && isToday && currentHour < 19) {
      isValid = true;
    }

    return { 
      date, 
      in: times.in, 
      out: times.out, 
      hours: hours.toFixed(2), 
      isValid,
      onTime: times.in ? (times.in.getHours() < 9 || (times.in.getHours() === 9 && times.in.getMinutes() <= 30)) : false
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
};
