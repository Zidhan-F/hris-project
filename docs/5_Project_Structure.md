# Project Structure Template
## EMS — Employee Management System
**Last Updated:** 17 April 2026

---

## Full Directory Tree

```
hris-project/
├── 📁 client/                          # Frontend (React SPA)
│   ├── 📁 public/                      # Static assets
│   ├── 📁 src/
│   │   ├── 📁 assets/                  # Images & icons
│   │   │   ├── hero.png                # Hero/landing image
│   │   │   ├── react.svg               # React logo
│   │   │   └── vite.svg                # Vite logo
│   │   │
│   │   ├── 📁 components/              # Modular UI components
│   │   │   ├── 📁 modals/              # Modal dialogs
│   │   │   │   ├── EditEmployeeModal.jsx    # Admin: manage employee
│   │   │   │   ├── EditPayrollModal.jsx     # Admin: edit payroll
│   │   │   │   ├── EditProfileModal.jsx     # Self: edit profile
│   │   │   │   ├── OfficeSettingsModal.jsx  # Admin: office location
│   │   │   │   └── RequestModal.jsx         # Submit leave/request
│   │   │   │
│   │   │   ├── AttendancePersonal.jsx  # Personal attendance records
│   │   │   ├── AttendanceReport.jsx    # Monthly report (admin)
│   │   │   ├── Dashboard.jsx           # Dashboard (Feed + MyInfo)
│   │   │   ├── EmployeeView.jsx        # Employee list & detail
│   │   │   ├── LeaveView.jsx           # Leave requests & approvals
│   │   │   ├── LoginPage.jsx           # Google OAuth login
│   │   │   ├── PayrollView.jsx         # Payslip & payroll mgmt
│   │   │   ├── ProfileView.jsx         # User profile tabs
│   │   │   ├── ScheduleView.jsx        # Calendar with holidays
│   │   │   ├── Sidebar.jsx             # Navigation sidebar
│   │   │   └── TopNavbar.jsx           # Top header bar
│   │   │
│   │   ├── 📁 utils/                   # Shared utilities
│   │   │   └── helpers.js              # Constants, formatters, Haversine
│   │   │
│   │   ├── App.jsx                     # Root coordinator (state + routing)
│   │   ├── App.css                     # Global styles & design system
│   │   ├── index.css                   # Base CSS reset
│   │   └── main.jsx                    # React entry point
│   │
│   ├── .env                            # Frontend environment variables
│   ├── index.html                      # HTML template
│   ├── package.json                    # Frontend dependencies
│   └── vite.config.js                  # Vite build configuration
│
├── 📁 server/                          # Backend (Express.js)
│   ├── 📁 models/                      # Mongoose schemas
│   │   ├── User.js                     # User collection schema
│   │   ├── Request.js                  # Request collection schema
│   │   └── PayrollLog.js               # Audit log for payroll actions
│   │
│   ├── 📁 services/                    # Background logic
│   │   ├── cronJobs.js                 # Automation (reminders, payroll)
│   │   ├── payrollEngine.js            # Salary calculation logic
│   │   ├── pdfGenerator.js             # Payslip PDF generation
│   │   └── emailService.js             # SMTP/Email sending
│   │
│   ├── index.js                        # Server entry (routes, middleware, inline models)
│   ├── .env                            # Backend environment variables
│   ├── package.json                    # Backend dependencies
│   └── Dockerfile                      # Server container definition
│
├── 📁 scripts/                         # Maintenance scripts
│   └── backup.ps1                      # DB Backup to local storage
│
├── .gitignore                          # Git ignore rules
├── README.md                           # Project readme
├── package.json                        # Root package.json (optional monorepo)
├── docker-compose.yml                  # Full stack orchestration
└── Dockerfile                          # Root or Frontend Dockerfile
```

---

## Component Responsibility Map

### Views (11 components)

| Component | File | Renders When | Key Props |
|-----------|------|-------------|-----------|
| `LoginPage` | `LoginPage.jsx` | `user === null` | loading, handleLoginSuccess |
| `Dashboard` | `Dashboard.jsx` | `activeMenu === 'dashboard'` | user, currentTime, officeSettings, videoRef, history |
| `ProfileView` | `ProfileView.jsx` | `activeMenu === 'profile'` | user, profileTab, handleStartEdit |
| `EmployeeView` | `EmployeeView.jsx` | `activeMenu === 'employee'` | employees, selectedEmployee, handleEditEmployee |
| `PayrollView` | `PayrollView.jsx` | `activeMenu === 'payroll'` | user, employees, payrollTab |
| `LeaveView` | `LeaveView.jsx` | `activeMenu === 'leave'` | requests, pendingRequests, handleApproveRequest |
| `AttendancePersonal` | `AttendancePersonal.jsx` | `activeSubMenu === 'att-personal'` | personalAttendance, selectedMonth/Year |
| `AttendanceReport` | `AttendanceReport.jsx` | `activeSubMenu === 'att-report'` | monthlyReports, reportMonth/Year |
| `ScheduleView` | `ScheduleView.jsx` | `activeSubMenu === 'att-schedule'` | schedDate, scheduleHolidays |
| `Sidebar` | `Sidebar.jsx` | Always (when logged in) | sidebarOpen, activeMenu, handleMenuClick |
| `TopNavbar` | `TopNavbar.jsx` | Always (when logged in) | user, handleLogout |

### Modals (5 components)

| Component | File | Triggered By | Key Props |
|-----------|------|-------------|-----------|
| `EditProfileModal` | `EditProfileModal.jsx` | "Edit Profile" button | editFormData, handleSaveProfile |
| `RequestModal` | `RequestModal.jsx` | Leave/Request type card | selectedRequestType, handleRequestSubmit |
| `EditEmployeeModal` | `EditEmployeeModal.jsx` | "Edit Details" on employee | editEmployeeData, handleSaveEmployee |
| `OfficeSettingsModal` | `OfficeSettingsModal.jsx` | Settings icon on map | editOfficeData, setOfficeSettings |
| `EditPayrollModal` | `EditPayrollModal.jsx` | Edit icon on payroll row | editPayrollData, handleSavePayroll |

### Utilities

| File | Exports | Description |
|------|---------|-------------|
| `helpers.js` | `API_URL`, `DEFAULT_OFFICE`, `MENU_ITEMS`, `WELCOME_MESSAGES` | App constants |
| | `getDistanceMeters()` | Haversine formula for GPS radius |
| | `groupAttendanceByDay()` | Process attendance into daily records |
| | `getInitials()`, `getGreeting()`, `getRequestIcon()` | UI helpers |
| | `formatTime()`, `formatDate()`, `formatTimestamp()`, `formatCurrency()` | Formatters |
| | `safeISO()` | Safe date-to-ISO conversion |

---

## Backend Route Organization

[index.js](file:///c:/Users/Zidhan/OneDrive/Documents/hris-project/server/index.js) structure (1056 lines):

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Security Middleware | 1–76 | Helmet, CORS, Rate Limit, HTTPS |
| Database Connection | 78–83 | MongoDB Atlas via Mongoose |
| Inline Models | 85–101 | Attendance & Settings schemas |
| Security Helpers | 103–117 | `escapeRegex()`, `emailQuery()` |
| Auth Middleware | 119–170 | `verifyGoogleToken()`, `authMiddleware()`, `requireRole()` |
| Input Validators | 172–237 | 4 validation functions |
| Auth Endpoint | 239–340 | Google login + upsert |
| Profile Endpoint | 342–380 | Self-profile update |
| Attendance Endpoints | 382–555 | Submit, history, summary |
| Employee Endpoints | 557–780 | CRUD, payroll update |
| Request Endpoints | 782–950 | CRUD, approval, active-leave |
| Settings Endpoints | 952–1020 | Office location, workdays |
| Schedule Endpoint | 1022–1050 | iCal holidays |
| Server Start | 1052–1056 | `app.listen()` |

---

## Key Configuration Files

### `vite.config.js`
```js
export default defineConfig({
  plugins: [react()],
  // Optional: proxy for development
  // server: { proxy: { '/api': 'http://localhost:5000' } }
})
```

### `.env` (Client)
```
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### `.env` (Server)
```
PORT=5000
MONGO_URI=mongodb+srv://...
GOOGLE_CLIENT_ID=your-google-client-id
FRONTEND_URL=http://localhost:5173
ALLOW_OPEN_REGISTRATION=true
NODE_ENV=development
```
