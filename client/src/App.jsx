import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './App.css';

// Default office location (will be overridden by DB settings)
const DEFAULT_OFFICE = { lat: -6.1528, lng: 106.7909, radius: 100, name: 'EMS Office' };

// Fix Leaflet default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Haversine formula — calculate distance between two GPS points in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Auto-recenter map when user location changes
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 17); }, [lat, lng, map]);
  return null;
}

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

const WELCOME_MESSAGES = [
  "Ready to conquer the day?",
  "Let's build something amazing today!",
  "Your dedication drives our success.",
  "Great things are waiting for you!",
  "Every small win counts. Keep it up!",
  "Glad to see you again!",
  "Efficiency is the key to excellence."
];

const MENU_ITEMS = [
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

const getRequestIcon = (type) => {
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

function App() {
  const [user, setUser] = useState(null);
  const [onLeaveToday, setOnLeaveToday] = useState([]);
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
  const [profileTab, setProfileTab] = useState('personal');
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empDetailTab, setEmpDetailTab] = useState('personal');
  const [scheduleHolidays, setScheduleHolidays] = useState([]);
  const [schedDate, setSchedDate] = useState(new Date());

  // Request & Leave States
  const [leaveTab, setLeaveTab] = useState('history');
  const [requests, setRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequestType, setSelectedRequestType] = useState(null);
  const [requestFormData, setRequestFormData] = useState({
    startDate: '', endDate: '', reason: '', amount: ''
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isFetchingRequests, setIsFetchingRequests] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [empAttendanceHistory, setEmpAttendanceHistory] = useState([]);
  const [isFetchingEmpAttendance, setIsFetchingEmpAttendance] = useState(false);

  // Admin Management States
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [editEmployeeData, setEditEmployeeData] = useState({
    position: '', department: '', role: '', employeeId: '', employmentStatus: '', manager: '', teamMembers: [], leaveQuota: 0, contractEnd: ''
  });
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);

  // Camera & Geolocation States
  const [officeSettings, setOfficeSettings] = useState(DEFAULT_OFFICE);
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [editOfficeData, setEditOfficeData] = useState(DEFAULT_OFFICE);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Attendance Personal States
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [personalAttendance, setPersonalAttendance] = useState([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [workDays, setWorkDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Payroll Management States
  const [payrollTab, setPayrollTab] = useState('mine'); // 'mine' | 'manage'
  const [isEditingPayroll, setIsEditingPayroll] = useState(false);
  const [editPayrollData, setEditPayrollData] = useState({
    id: '', name: '', baseSalary: 0, allowance: 0, role: '', bankAccount: '-', payrollStatus: 'Unpaid', leaveQuota: 0, contractEnd: ''
  });
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [welcomeIndex, setWelcomeIndex] = useState(0);

  // Rotate welcome messages
  useEffect(() => {
    const interval = setInterval(() => {
      setWelcomeIndex(prev => (prev + 1) % WELCOME_MESSAGES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load office settings from DB
  const fetchOfficeSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/office`);
      if (res.data.success) setOfficeSettings(res.data.data);
    } catch (err) { console.error('Error fetching office settings:', err); }
  }, []);

  useEffect(() => { fetchOfficeSettings(); }, [fetchOfficeSettings]);

  const fetchWorkDays = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/workdays`);
      if (res.data.success) setWorkDays(res.data.data);
    } catch (err) { console.error('Error fetching work days:', err); }
  }, []);

  useEffect(() => { fetchWorkDays(); }, [fetchWorkDays]);

  const fetchMonthlyReports = useCallback(async (month, year) => {
    setIsFetchingReports(true);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/summary/monthly`, {
        params: { month, year }
      });
      if (res.data.success) setMonthlyReports(res.data.reports);
    } catch (err) { console.error('Error fetching reports:', err); }
    finally { setIsFetchingReports(false); }
  }, []);

  // Dashboard Stats State
  const [attendanceSummary, setAttendanceSummary] = useState({ totalStaff: 0, presentCount: 0, lateCount: 0 });
  const fetchAttendanceSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/attendance/summary/today`);
      if (res.data.success) setAttendanceSummary(res.data);
    } catch (err) { console.error('Error fetching dashboard summary:', err); }
  }, []);

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      fetchAttendanceSummary();
    }
  }, [activeMenu, fetchAttendanceSummary, history.length]);

  // Geolocation tracking
  useEffect(() => {
    if (activeMenu !== 'dashboard' || activeTab !== 'myinfo') return;
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('loading');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const dist = getDistanceMeters(loc.lat, loc.lng, officeSettings.lat, officeSettings.lng);
        setDistanceToOffice(Math.round(dist));
        setLocationStatus(dist <= officeSettings.radius ? 'granted' : 'out_of_range');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeMenu, activeTab, officeSettings]);

  // Camera stream management
  useEffect(() => {
    if (activeMenu !== 'dashboard' || activeTab !== 'myinfo') {
      // Stop camera when leaving My Info
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setCameraStatus('loading');
      setCapturedPhoto(null);
      return;
    }
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraStatus('active');
      } catch {
        setCameraStatus('denied');
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [activeMenu, activeTab]);

  // Capture photo from video
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // mirror
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    setCapturedPhoto(dataUrl);
    return dataUrl;
  };

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

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/employees`);
      if (res.data.success) {
        setEmployees(res.data.employees);
      }
    } catch (err) {
      console.error('Gagal ambil karyawan:', err);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  const fetchRecentActivities = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/api/requests/recent`, {
        params: { email: user.email, role: user.role }
      });
      if (res.data.success) setRecentActivities(res.data.activities);
    } catch (err) { console.error('Error fetching activities:', err); }
  }, [user]);

  const fetchOnLeaveToday = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/requests/active-leave`);
      if (res.data.success) {
        setOnLeaveToday(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching on-leave data:', err);
    }
  }, []);

  const fetchPersonalAttendance = useCallback(async (month, year) => {
    if (!user || !user.email) return;
    setPersonalLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/history`, {
        params: { email: user.email, month, year }
      });
      if (res.data.success) {
        setPersonalAttendance(res.data.records);
      }
    } catch (err) {
      console.error('❌ Gagal ambil absensi:', err);
    } finally {
      setPersonalLoading(false);
    }
  }, [user]);

  // Sync Personal Attendance
  useEffect(() => {
    if (activeMenu === 'attendance' && activeSubMenu === 'att-personal') {
      fetchPersonalAttendance(selectedMonth, selectedYear);
    }
  }, [activeMenu, activeSubMenu, selectedMonth, selectedYear, history.length, fetchPersonalAttendance]);

  const fetchScheduleHolidays = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/schedule/holidays`);
      if (res.data.success) {
        setScheduleHolidays(res.data.holidays);
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  }, []);

  useEffect(() => {
    if (activeMenu === 'attendance' && activeSubMenu === 'att-schedule') {
      fetchScheduleHolidays();
    }
  }, [activeMenu, activeSubMenu, fetchScheduleHolidays]);

  // Group Attendance by Day
  const groupAttendanceByDay = (records) => {
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
        // Masih dalam jam kerja (sebelum jam 7 malam)
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

  // Google Login
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
        // SECURITY: Set auth header for ALL subsequent API requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${credential}`;
        fetchHistory(result.data.user.email);
      }
    } catch (error) {
      console.error('Gagal verifikasi:', error);
      const msg = error.response?.data?.message || 'Gagal memverifikasi akun Google.';
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginError = () => {
    setStatusMsg({ type: 'error', text: 'Login Google gagal. Coba lagi.' });
  };

  // Clock action
  const handleClock = async (type) => {
    if (!token || !user) return;

    const now = new Date();
    const currentHour = now.getHours();

    if (type === 'clock_in' && currentHour < 8) {
      setStatusMsg({ type: 'error', text: 'Absensi masuk baru dibuka jam 08:00 pagi.' });
      return;
    }
    if (type === 'clock_out' && currentHour < 17) {
      alert('Maaf, absen pulang belum bisa dilakukan. Absen harus sesuai jam pulang (setelah jam 05:00 sore).');
      setStatusMsg({ type: 'error', text: 'Absensi keluar baru bisa jam 05:00 sore.' });
      return;
    }

    // Check location
    if (!userLocation) {
      setStatusMsg({ type: 'error', text: 'Lokasi belum terdeteksi. Aktifkan GPS Anda.' });
      return;
    }
    if (distanceToOffice > officeSettings.radius) {
      setStatusMsg({ type: 'error', text: `Anda di luar radius kantor (${distanceToOffice}m). Maksimal ${officeSettings.radius}m.` });
      return;
    }

    // Capture photo
    const photo = capturePhoto();
    if (!photo) {
      setStatusMsg({ type: 'error', text: 'Kamera belum aktif. Izinkan akses kamera.' });
      return;
    }

    // Check work day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];
    if (!workDays.includes(currentDayName) && type === 'clock_in') {
      const confirmProceed = window.confirm(`Hari ini (${currentDayName}) bukan hari kerja wajib sesuai pengaturan. Tetap ingin absen?`);
      if (!confirmProceed) return;
    }

    setClockLoading(true);
    setStatusMsg(null);
    try {
      // SECURITY: Token sent via Authorization header (not body)
      const result = await axios.post(`${API_URL}/api/attendance/submit`, {
        lat: userLocation.lat,
        lng: userLocation.lng,
        type: type
      });
      if (result.data.success) {
        setStatusMsg({
          type: 'success',
          text: `${type === 'clock_in' ? '🟢 Clock In' : '🔴 Clock Out'} berhasil dicatat!`
        });
        fetchHistory(user.email);
        // Reset captured photo after success
        setTimeout(() => setCapturedPhoto(null), 3000);
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: 'Gagal mencatat absensi.' });
    } finally {
      setClockLoading(false);
    }
  };

  const handleFabClick = () => {
    if (activeMenu !== 'dashboard' || activeTab !== 'myinfo') {
      setActiveMenu('dashboard');
      setActiveTab('myinfo');
      
      // Feedback to user that we just navigated them
      setStatusMsg({ type: 'info', text: 'Mengarahkan ke halaman absensi...' });
      setTimeout(() => setStatusMsg(null), 2000);
    } else {
      handleClock(isClockedIn ? 'clock_out' : 'clock_in');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setHistory([]);
    setStatusMsg(null);
    setActiveMenu('dashboard');
    setActiveTab('feed');
    // SECURITY: Remove auth header on logout
    delete axios.defaults.headers.common['Authorization'];
  };

  const openSidebar = () => { setSidebarOpen(true); setSidebarClosing(false); };
  const closeSidebar = () => {
    setSidebarClosing(true);
    setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false); }, 250);
  };

  const handleMenuClick = (menuId) => {
    const item = MENU_ITEMS.find(i => i.id === menuId);
    if (item.hasSubmenu) {
      setExpandedMenu(expandedMenu === menuId ? null : menuId);
    } else {
      setActiveMenu(menuId);
      setActiveSubMenu(null);
      setSelectedEmployee(null);
      closeSidebar();
      if (menuId === 'employee') fetchEmployees();
    }
  };

  const handleSubMenuClick = (menuId, subId) => {
    setActiveMenu(menuId);
    setActiveSubMenu(subId);
    setSelectedEmployee(null);
    if (subId === 'att-personal') fetchPersonalAttendance(selectedMonth, selectedYear);
    if (subId === 'att-report') fetchMonthlyReports(reportMonth, reportYear);
    closeSidebar();
  };

  // Profile Edit Logic
  const handleStartEdit = () => {
    setEditFormData({
      name: user.name,
      bio: user.bio || '',
      phone: user.phone || '',
      address: user.address || '',
      birthday: safeISO(user.birthday),
      gender: user.gender || '-',
      maritalStatus: user.maritalStatus || '-'
    });
    setIsEditingProfile(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setIsSavingProfile(true);
    try {
      const res = await axios.put(`${API_URL}/api/users/profile`, {
        email: user.email,
        ...editFormData
      });
      if (res.data.success) {
        setUser(prev => ({ ...prev, ...res.data.user, picture: prev.picture }));
        setIsEditingProfile(false);
        setStatusMsg({ type: 'success', text: 'Profil diperbarui!' });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error('❌ Gagal simpan profil:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Request Logic
  const fetchRequests = useCallback(async () => {
    if (!user || !user.email) return;
    setIsFetchingRequests(true);
    try {
      const res = await axios.get(`${API_URL}/api/requests?email=${user.email}`);
      if (res.data.success) setRequests(res.data.requests);
    } catch (err) { console.error('Fetch requests error:', err); }
    finally { setIsFetchingRequests(false); }
  }, [user]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/requests/pending`);
      if (res.data.success) setPendingRequests(res.data.requests);
    } catch (err) { console.error('Fetch pending error:', err); }
  }, []);

  const handleOpenRequest = (type) => {
    setSelectedRequestType(type);
    setRequestFormData({ startDate: '', endDate: '', reason: '', amount: '' });
    setShowRequestModal(true);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingRequest(true);
    try {
      if (selectedRequestType === 'Leave') {
        const s = new Date(requestFormData.startDate);
        const e = new Date(requestFormData.endDate);
        const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > (user.leaveQuota || 0)) {
          alert(`Maaf, jatah cuti Anda tidak mencukupi. Tersisa: ${user.leaveQuota || 0} hari, yang diminta: ${diff} hari.`);
          setIsSubmittingRequest(false);
          return;
        }
      }
      const res = await axios.post(`${API_URL}/api/requests`, {
        email: user.email,
        name: user.name,
        type: selectedRequestType,
        ...requestFormData
      });
      if (res.data.success) {
        setShowRequestModal(false);
        fetchRequests();
        // If it was a leave request, we might want to inform the user it needs approval to deduct quota
        const successMsg = selectedRequestType === 'Leave' 
          ? 'Permintaan cuti berhasil dikirim! Jatah akan dikurangi setelah disetujui.' 
          : 'Permintaan berhasil dikirim!';
        setStatusMsg({ type: 'success', text: successMsg });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) { console.error('Submit error:', err); }
    finally { setIsSubmittingRequest(false); }
  };

  const handleApproveRequest = async (id, status) => {
    try {
      const res = await axios.put(`${API_URL}/api/requests/${id}/status`, { status });
      if (res.data.success) {
        fetchPendingRequests();
        setStatusMsg({ type: 'success', text: `Permintaan ${status === 'Approved' ? 'disetujui' : 'ditolak'}!` });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) { console.error('Approval error:', err); }
  };

  // Manage Employee Logic
  const handleEditEmployee = () => {
    if (!selectedEmployee) return;
    
    // Always initialize from selectedEmployee which holds the current truth
    setEditEmployeeData({
      position: selectedEmployee.position || '',
      department: selectedEmployee.department || '',
      role: selectedEmployee.role || 'employee',
      employeeId: selectedEmployee.employeeId || '',
      employmentStatus: selectedEmployee.employmentStatus || 'Full-time',
      manager: selectedEmployee.manager || '',
      teamMembers: [...(selectedEmployee.teamMembers || [])],
      leaveQuota: selectedEmployee.leaveQuota || 0,
      contractEnd: safeISO(selectedEmployee.contractEnd)
    });
    setIsEditingEmployee(true);
  };

  const handleAddTeamMember = (emp) => {
    if (editEmployeeData.teamMembers.find(m => m.email === emp.email)) return;
    const newMember = { name: emp.name, n: emp.name, position: emp.position, p: emp.position, email: emp.email };
    setEditEmployeeData({ ...editEmployeeData, teamMembers: [...editEmployeeData.teamMembers, newMember] });
  };

  const handleRemoveTeamMember = (email) => {
    setEditEmployeeData({ ...editEmployeeData, teamMembers: editEmployeeData.teamMembers.filter(m => m.email !== email) });
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setIsSavingEmployee(true);
    try {
      const res = await axios.put(`${API_URL}/api/employees/${selectedEmployee._id}`, editEmployeeData);
        if (res.data.success && res.data.employee) {
          const freshEmp = res.data.employee;
          
          // 1. Update global list first
          setEmployees(prev => prev.map(e => e._id === freshEmp._id ? freshEmp : e));
          
          // 2. Update the currently viewed employee immediately
          setSelectedEmployee(freshEmp);

          // 3. Update active user if they edited themselves
          if (user && freshEmp.email === user.email) {
            setUser(prev => ({ 
              ...prev, 
              ...freshEmp, 
              picture: freshEmp.profilePicture || prev.picture 
            }));
          }

          setIsEditingEmployee(false);
          setStatusMsg({ type: 'success', text: `Data ${freshEmp.name} berhasil disinkronkan!` });
          setTimeout(() => setStatusMsg(null), 3000);
          
          // Re-fetch to ensure everything is settled with the backend
          fetchEmployees();
        }
    } catch (err) { 
        console.error('Error saving employee:', err);
        setStatusMsg({ type: 'error', text: 'Gagal menyimpan perubahan.' });
    }
    finally { setIsSavingEmployee(false); }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${selectedEmployee.name}? Data ini tidak bisa dikembalikan.`)) return;

    setIsSavingEmployee(true);
    try {
      const res = await axios.delete(`${API_URL}/api/employees/${selectedEmployee._id}`);
      if (res.data.success) {
        setIsEditingEmployee(false);
        setSelectedEmployee(null);
        fetchEmployees();
        setStatusMsg({ type: 'success', text: 'Karyawan berhasil dihapus!' });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) { console.error('Error deleting employee:', err); }
    finally { setIsSavingEmployee(false); }
  };

  const handleDashboardViewMore = () => {
    setActiveMenu('leave');
    if (['manager', 'admin'].includes(user?.role)) {
      setLeaveTab('approval');
      fetchPendingRequests();
    } else {
      setLeaveTab('history');
      fetchRequests();
    }
  };

  useEffect(() => {
    if (activeMenu === 'dashboard' && activeTab === 'feed') {
      fetchOnLeaveToday();
      fetchRecentActivities();
    }
    if (activeMenu === 'leave') {
      fetchRequests();
      if (['manager', 'admin'].includes(user?.role)) fetchPendingRequests();
    }
  }, [activeMenu, fetchRequests, fetchPendingRequests, user?.role]);

  // Format Helpers
  const formatTime = (date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date) => date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTimestamp = (ts) => new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  
  // Safe Date string function to prevent "invalid time value" crashes
  const safeISO = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().substring(0, 10);
    } catch { return ''; }
  };

  const getGreeting = () => {
    const hr = currentTime.getHours();
    if (hr < 10) return 'Good Morning,';
    if (hr < 15) return 'Good Afternoon,';
    if (hr < 18) return 'Good Evening,';
    return 'Good Night,';
  };

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const getPayrollData = () => {
    const base = user.baseSalary || 5000000;
    const bonus = user.allowance || 0;

    return {
      base: base,
      bonus: bonus,
      total: base + bonus
    };
  };

  const handleSavePayroll = async (e) => {
    e.preventDefault();
    setIsSavingPayroll(true);
    try {
      const res = await axios.put(`${API_URL}/api/employees/${editPayrollData.id}/payroll`, {
        baseSalary: editPayrollData.baseSalary,
        allowance: editPayrollData.allowance,
        role: editPayrollData.role,
        bankAccount: editPayrollData.bankAccount,
        payrollStatus: editPayrollData.payrollStatus,
        leaveQuota: editPayrollData.leaveQuota,
        contractEnd: editPayrollData.contractEnd
      });
      
      if (res.data.success && res.data.employee) {
        const freshEmp = res.data.employee;
        
        // ULTIMATE SYNC: Refresh all state sources immediately
        // 1. Update list
        setEmployees(prev => prev.map(e => e._id === freshEmp._id ? freshEmp : e));

        // 2. Update self if applicable
        if (user && freshEmp.email === user.email) {
          setUser(prev => ({ ...prev, ...freshEmp, picture: freshEmp.profilePicture || prev.picture }));
        }

        // 3. Update the targeted employee detail view
        if (selectedEmployee && (freshEmp._id === selectedEmployee._id)) {
          setSelectedEmployee(freshEmp);
        }

        setIsEditingPayroll(false);
        setStatusMsg({ type: 'success', text: `Payroll & Kontrak ${freshEmp.name} berhasil diperbarui!` });
        setTimeout(() => setStatusMsg(null), 3000);
        
        // Final settled fetch
        fetchEmployees();
      }
    } catch (err) { 
        console.error('Error saving payroll:', err);
        setStatusMsg({ type: 'error', text: 'Gagal memperbarui payroll.' });
    }
    finally { setIsSavingPayroll(false); }
  };

  // =============== RENDER ===============

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-brand-bar">
          <div className="login-brand-icon"><span className="material-icons-outlined">verified_user</span></div>
          <div className="login-brand-text"><span className="login-brand-name">EMS</span><span className="login-brand-sub">Employee</span></div>
        </div>
        <div className="login-card-area">
          <div className="login-card">
            <div className="login-card-logo">
              <div className="login-card-logo-icon"><span className="material-icons-outlined">verified_user</span></div>
              <div className="login-card-brand"><span className="login-card-brand-name">EMS</span><span className="login-card-brand-sub">Employee</span></div>
            </div>
            <div className="login-welcome"><h2>Welcome back!</h2><p>Please sign-in with Google Account</p></div>
            <div className="login-auth-area">
              {loading ? <div className="loading-spinner"></div> :
                <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} shape="pill" size="large" width="320" theme="outline" />}
            </div>
            {statusMsg && <div className={`status-message status-${statusMsg.type}`}>{statusMsg.text}</div>}
          </div>
        </div>
      </div>
    );
  }

  const isClockedIn = history.length > 0 && 
    history[0].type === 'clock_in' && 
    new Date(history[0].timestamp).toDateString() === currentTime.toDateString() &&
    currentTime.getHours() < 19;

  return (
    <div className="dashboard-page">
      {/* 7 PM Clock-out Reminder Banner */}
      {(() => {
        const hr = currentTime.getHours();
        const mins = currentTime.getMinutes();
        const totalMins = hr * 60 + mins;
        const deadlineMins = 19 * 60; // 7 PM
        const warningStart = 18 * 60; // 6 PM
        
        if (isClockedIn && totalMins >= warningStart && totalMins < deadlineMins) {
          const minsRemaining = deadlineMins - totalMins;
          return (
            <div className="deadline-reminder-banner animate-fadeInDown">
              <span className="material-icons-outlined">warning</span>
              <p>Peringatan: <strong>{minsRemaining} menit</strong> lagi menuju batas waktu clock-out (19:00). Segera absen pulang!</p>
            </div>
          );
        }
        return null;
      })()}

      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarClosing ? 'sidebar-closing' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close-btn" onClick={closeSidebar}>
            <span className="material-icons-outlined">menu_open</span>
          </button>
          <div className="sidebar-logo"><span className="material-icons-outlined">verified_user</span></div>
          <div className="sidebar-company"><span className="sidebar-company-name">EMS COMPANY</span></div>
        </div>
        <nav className="sidebar-nav">
          {MENU_ITEMS.map((item) => (
            <React.Fragment key={item.id}>
              <button className={`sidebar-menu-item ${activeMenu === item.id && !activeSubMenu ? 'active' : ''} ${expandedMenu === item.id ? 'expanded' : ''}`} onClick={() => handleMenuClick(item.id)}>
                <span className="sidebar-menu-left"><span className="material-icons-outlined">{item.icon}</span>{item.label}</span>
                {item.hasSubmenu && <span className={`material-icons-outlined arrow-icon ${expandedMenu === item.id ? 'rotate' : ''}`}>expand_more</span>}
              </button>
              {item.hasSubmenu && expandedMenu === item.id && item.submenus && (
                <div className="sidebar-submenus">
                  {item.submenus
                    .filter(sub => !(sub.id === 'att-report' && user?.role === 'employee'))
                    .map(sub => (
                      <button key={sub.id} className={`sidebar-submenu-item ${activeSubMenu === sub.id ? 'active' : ''}`} onClick={() => handleSubMenuClick(item.id, sub.id)}>{sub.label}</button>
                    ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>
      </aside>


      <header className="top-navbar">
        <div className="navbar-left">
          {!sidebarOpen && (
            <button className="nav-icon-btn" onClick={openSidebar}>
              <span className="material-icons-outlined">menu</span>
            </button>
          )}
        </div>
        <div className="navbar-right">
          <button className="nav-icon-btn">
            <span className="material-icons-outlined">search</span>
          </button>
          <button className="nav-icon-btn">
            <span className="material-icons-outlined">notifications_none</span>
          </button>
          {user.picture ? (
            <img className="nav-avatar" src={user.picture} alt="" onClick={handleLogout} referrerPolicy="no-referrer" />
          ) : (
            <div className="nav-avatar-placeholder" onClick={handleLogout}>{getInitials(user.name)}</div>
          )}
        </div>
      </header>

      <main className="dashboard-content">
        {/* DASHBOARD VIEW */}
        {activeMenu === 'dashboard' && (
          <div className="dashboard-view animate-fadeInUp">
            {/* Welcome Banner */}
            <div className="welcome-banner">
              {user.picture ? <img className="welcome-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" /> : <div className="welcome-avatar-placeholder">{getInitials(user.name)}</div>}
              <div className="welcome-info">
                <p className="welcome-greeting">{getGreeting()}</p>
                <h2 className="welcome-name">{user.name}!</h2>
                <p className="welcome-dynamic-msg animate-fadeInRight">{WELCOME_MESSAGES[welcomeIndex]}</p>
                <p className="welcome-position"><span className="material-icons-outlined">badge</span>{user.position || 'Staff'} - {user.role || 'Employee'}</p>
                <div className="welcome-badges">
                  <span className="badge badge-department"><span className="material-icons-outlined">apartment</span>General</span>
                  <span className="badge badge-location"><span className="material-icons-outlined">location_on</span>EMS Office</span>
                </div>
              </div>
            </div>

            <div className="stats-grid animate-fadeInScale" style={{ padding: '0 20px', marginBottom: '24px', animationDelay: '0.1s' }}>
              <div className="stat-card glass-panel">
                <div className="stat-label">Total Staff</div>
                <div className="vibrant-value blue">{attendanceSummary.totalStaff}</div>
              </div>
              {['admin', 'manager', 'hrd'].includes(user?.role) && (
                <>
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
                </>
              )}
            </div>

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
                    <span className="feed-updates-title">All Updates <span className="feed-updates-count">{recentActivities.length}</span></span>
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
                {/* Hidden canvas for photo capture */}
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
                        {locationStatus === 'loading' && <><span className="material-icons-outlined spin">sync</span> Detecting...</>}
                        {locationStatus === 'denied' && <><span className="material-icons-outlined">gps_off</span> GPS Off</>}
                        {locationStatus === 'granted' && <><span className="material-icons-outlined">check_circle</span> {distanceToOffice}m</>}
                        {locationStatus === 'out_of_range' && <><span className="material-icons-outlined">warning</span> {distanceToOffice}m</>}
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
                    <button className="btn-clock btn-clock-in" onClick={() => handleClock('clock_in')} disabled={clockLoading || locationStatus !== 'granted' || cameraStatus !== 'active'}>🟢 Clock In</button>
                    <button className="btn-clock btn-clock-out" onClick={() => handleClock('clock_out')} disabled={clockLoading || locationStatus !== 'granted' || cameraStatus !== 'active'}>🔴 Clock Out</button>
                  </div>
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
        )}

        {/* PROFILE VIEW */}
        {activeMenu === 'profile' && (
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
        )}

        {/* EMPLOYEE LIST VIEW */}
        {activeMenu === 'employee' && (
          <div className="employee-container animate-fadeInUp">
            {!selectedEmployee ? (
              <>
                <div className="employee-header">
                  <h2 className="employee-title">Employee List</h2>
                  <div className="employee-search-bar">
                    <span className="material-icons-outlined">search</span>
                    <input type="text" placeholder="Search by name or position..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                {employeesLoading ? <div className="loading-center"><div className="loading-spinner"></div><p>Memuat data karyawan...</p></div> : (
                  <div className="employee-grid">
                    {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.position.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                      <div 
                        key={emp._id} 
                        className={`employee-card ${user?.role === 'employee' ? 'restricted-card' : ''}`}
                        onClick={() => user?.role !== 'employee' && setSelectedEmployee(emp)} 
                        style={{ cursor: user?.role === 'employee' ? 'default' : 'pointer' }}
                      >
                        <div className="employee-card-avatar">{emp.profilePicture ? <img src={emp.profilePicture} alt="" referrerPolicy="no-referrer" /> : <div className="employee-avatar-initials">{getInitials(emp.name)}</div>}</div>
                        <div className="employee-card-info">
                          <h4>{emp.name}</h4>
                          <p>{emp.position}</p>
                          <div className="employee-card-details">
                            <span className="employee-card-dept"><span className="material-icons-outlined">apartment</span>{emp.department || 'General'}</span>
                            <span className="employee-card-id"><span className="material-icons-outlined">badge</span>{emp.employeeId || `EMS-${emp._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span>
                            {emp.contractEnd && user?.role !== 'employee' && (
                              <span className="employee-card-contract" style={{ color: new Date(emp.contractEnd) < new Date() ? '#ef4444' : '#64748b' }}>
                                <span className="material-icons-outlined">event_busy</span>{new Date(emp.contractEnd).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="employee-detail-view animate-fadeInUp">
                <div className="detail-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="back-btn" onClick={() => setSelectedEmployee(null)}>
                    <span className="material-icons-outlined">arrow_back</span> Back to List
                  </button>
                  {['admin', 'manager', 'hrd'].includes(user?.role) && (
                    <button className="profile-edit-btn" onClick={handleEditEmployee}>
                      <span className="material-icons-outlined">manage_accounts</span> Edit Details
                    </button>
                  )}
                </div>

                <div className="profile-header-card">
                  <div className="profile-header-top">
                    {selectedEmployee.profilePicture ? <img className="profile-header-avatar" src={selectedEmployee.profilePicture} alt="" referrerPolicy="no-referrer" /> : <div className="profile-header-avatar-placeholder">{getInitials(selectedEmployee.name)}</div>}
                    <div className="profile-header-main">
                      <h3>{selectedEmployee.name}</h3>
                      <p>{selectedEmployee.position || 'Employee'} • {selectedEmployee.department || 'General'}</p>
                      {selectedEmployee.contractEnd && (
                        <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>event_busy</span> 
                          Contract End: {new Date(selectedEmployee.contractEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="profile-header-tabs">
                    <button className={`profile-tab-btn ${empDetailTab === 'personal' ? 'active' : ''}`} onClick={() => setEmpDetailTab('personal')}>Personal</button>
                    <button className={`profile-tab-btn ${empDetailTab === 'contract' ? 'active' : ''}`} onClick={() => setEmpDetailTab('contract')}>Contract</button>
                    <button className={`profile-tab-btn ${empDetailTab === 'team' ? 'active' : ''}`} onClick={() => setEmpDetailTab('team')}>Team</button>
                    {['admin', 'manager', 'hrd'].includes(user?.role) && (
                      <button className={`profile-tab-btn ${empDetailTab === 'attendance' ? 'active' : ''}`} onClick={() => {
                        setEmpDetailTab('attendance');
                        setIsFetchingEmpAttendance(true);
                        axios.get(`${API_URL}/api/attendance/history`, { params: { email: selectedEmployee.email, month: new Date().getMonth(), year: new Date().getFullYear() } })
                          .then(res => { if (res.data.success) setEmpAttendanceHistory(res.data.records); })
                          .finally(() => setIsFetchingEmpAttendance(false));
                      }}>Attendance</button>
                    )}
                  </div>
                </div>

                <div className="profile-tab-content">
                  {empDetailTab === 'personal' && (
                    <div className="profile-card">
                      <div className="profile-bio-card">
                        <div className="profile-section-header"><span className="material-icons-outlined">info</span> Bio</div>
                        <p className="profile-bio-text">{selectedEmployee.bio || 'No bio provided.'}</p>
                      </div>
                      <div className="profile-info-grid">
                        <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{selectedEmployee.employeeId || `EMS-${selectedEmployee._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Role</span><span className="status-pill approved" style={{ textTransform: 'capitalize' }}>{selectedEmployee.role}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Email</span><span className="profile-info-value">{selectedEmployee.email}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Phone</span><span className="profile-info-value">{selectedEmployee.phone || '-'}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Gender</span><span className="profile-info-value">{selectedEmployee.gender || '-'}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Marital Status</span><span className="profile-info-value">{selectedEmployee.maritalStatus || '-'}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Birthday</span><span className="profile-info-value">{selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString() : '-'}</span></div>
                      <div className="profile-info-item"><span className="profile-info-label">Contract End</span><span className="profile-info-value" style={{ fontWeight: '700', color: (selectedEmployee.contractEnd && new Date(selectedEmployee.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>{selectedEmployee.contractEnd ? new Date(selectedEmployee.contractEnd).toLocaleDateString() : 'Permanent'}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Leave Quota</span><span className="profile-info-value" style={{ fontWeight: '700', color: '#2563eb' }}>{selectedEmployee.leaveQuota || 0} Days</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Address</span><span className="profile-info-value">{selectedEmployee.address || '-'}</span></div>
                      </div>
                    </div>
                  )}
                  {empDetailTab === 'contract' && (
                    <div className="profile-card">
                      <div className="profile-section-header">Employment Details</div>
                      <div className="profile-info-grid">
                        <div className="profile-info-item"><span className="profile-info-label">Employee ID</span><span className="badge-id">{selectedEmployee.employeeId || `EMS-${selectedEmployee._id?.substring(0, 4).toUpperCase() || 'NEW'}`}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Employment Status</span><span className="profile-info-value">{selectedEmployee.employmentStatus || 'Full-time'}</span></div>
                        <div className="profile-info-item"><span className="profile-info-label">Join Date</span><span className="profile-info-value">{selectedEmployee.joinDate ? new Date(selectedEmployee.joinDate).toLocaleDateString() : '-'}</span></div>
                        <div className="profile-info-item">
                          <span className="profile-info-label">Contract End</span>
                          <span className="profile-info-value" style={{ fontWeight: '700', color: (selectedEmployee.contractEnd && new Date(selectedEmployee.contractEnd) < new Date()) ? '#ef4444' : '#1e293b' }}>
                            {selectedEmployee.contractEnd ? new Date(selectedEmployee.contractEnd).toLocaleDateString() : (selectedEmployee.employmentStatus === 'Contract' ? 'Date Not Set' : 'Permanent')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {empDetailTab === 'team' && (
                    <div className="profile-card">
                      <div className="profile-section-header">Organization</div>
                      <div className="manager-info">
                        <div className="manager-avatar-placeholder"><span className="material-icons-outlined">person</span></div>
                        <div className="manager-text"><h5>{selectedEmployee.manager || '-'}</h5><p>Manager</p></div>
                      </div>
                      <div className="team-list" style={{ marginTop: '20px' }}>
                        <div className="profile-section-header" style={{ fontSize: '11px', marginBottom: '10px' }}>Team Members</div>
                        {!selectedEmployee.teamMembers || selectedEmployee.teamMembers.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No team members.</p> : selectedEmployee.teamMembers.map((m, i) => (
                          <div key={i} className="team-member-item" style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                            <div className="member-avatar-mini" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>{getInitials(m.name || m.n)}</div>
                            <div className="member-info-mini"><strong>{m.name || m.n}</strong><p style={{ margin: 0, fontSize: '11px', color: '#888' }}>{m.position || m.p}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {empDetailTab === 'attendance' && (
                    <div className="profile-card">
                      <div className="profile-section-header">Attendance History (Current Month)</div>
                      {isFetchingEmpAttendance ? <div className="loading-center" style={{ padding: '20px' }}><div className="loading-spinner"></div></div> : (
                        <div className="table-responsive">
                          <table className="request-table">
                            <thead><tr><th>Date</th><th>Type</th><th>Time</th></tr></thead>
                            <tbody>
                              {empAttendanceHistory.length === 0 ? <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No records for this month.</td></tr> :
                                empAttendanceHistory.slice(0, 10).map((h, i) => (
                                  <tr key={i}>
                                    <td>{new Date(h.timestamp).toLocaleDateString()}</td>
                                    <td>
                                      <span className={`status-pill ${h.type === 'clock_in' ? 'approved' : 'rejected'}`} style={{ background: h.type === 'clock_in' ? '#dcfce7' : '#fee2e2', color: h.type === 'clock_in' ? '#166534' : '#991b1b' }}>
                                        {h.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                                      </span>
                                    </td>
                                    <td>{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAYROLL VIEW */}
        {activeMenu === 'payroll' && (
          <div className="payroll-container animate-fadeInUp">
            <div className="payroll-header">
              <h2 className="payroll-title">Payroll Management</h2>
              <div className="leave-tabs" style={{ marginTop: '16px' }}>
                <button className={`leave-tab-btn ${payrollTab === 'mine' ? 'active' : ''}`} onClick={() => setPayrollTab('mine')}>My Payslip</button>
                {['manager', 'admin', 'hrd'].includes(user?.role) && (
                  <button className={`leave-tab-btn ${payrollTab === 'manage' ? 'active' : ''}`} onClick={() => { setPayrollTab('manage'); fetchEmployees(); }}>Manage Payroll</button>
                )}
              </div>
            </div>

            {payrollTab === 'mine' ? (
              <div className="my-payslip-content">
                {/* Personal Summary Card */}
                <div className="stat-card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: 'white', position: 'relative' }}>
                  <div className="stat-label" style={{ color: '#bfdbfe' }}>Estimasi Gaji Bersih ({currentTime.toLocaleDateString('id-ID', { month: 'long' })})</div>
                  <div className="stat-value" style={{ fontSize: '28px' }}>{formatCurrency(getPayrollData().total)}</div>
                  <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>Gaji Pokok: {formatCurrency(getPayrollData().base)} + Tunjangan: {formatCurrency(getPayrollData().bonus)}</div>
                  <button onClick={() => window.print()} className="print-btn" title="Download / Print Payslip">
                    <span className="material-icons-outlined">print</span> Print
                  </button>
                </div>

                <div className="payslip-card">
                  <div className="payslip-header">
                    <div className="payslip-branding">
                      <div className="payslip-logo"><span className="material-icons-outlined">verified_user</span></div>
                      <div>
                        <h4>EMS COMPANY</h4>
                        <p>Official Payslip</p>
                      </div>
                    </div>
                    <div className="payslip-meta">
                      <div className="payslip-meta-item"><span>Employee ID</span><strong>{user.employeeId || `EMS-${user._id?.substring(0, 4).toUpperCase() || '101'}`}</strong></div>
                      <div className="payslip-meta-item"><span>Bank Account</span><strong>{user.bankAccount || '-'}</strong></div>
                    </div>
                  </div>

                  <div className="payslip-body">
                    <div className="payslip-section">
                      <div className="payslip-user-info">
                        <h3>{user.name}</h3>
                        <p>{user.position || 'Staff'} • {user.department || 'General'}</p>
                      </div>
                    </div>

                    <div className="payslip-divider"></div>

                    <div className="payslip-details">
                      <div className="payslip-row">
                        <span>Gaji Pokok</span>
                        <strong>{formatCurrency(getPayrollData().base)}</strong>
                      </div>
                      {getPayrollData().bonus > 0 && (
                        <div className="payslip-row highlight">
                          <span>Tunjangan / Bonus</span>
                          <strong>+ {formatCurrency(getPayrollData().bonus)}</strong>
                        </div>
                      )}
                    </div>

                    <div className="payslip-divider"></div>

                    <div className="payslip-total">
                      <span>Total Take Home Pay</span>
                      <h2>{formatCurrency(getPayrollData().total)}</h2>
                    </div>
                  </div>

                  <div className="payslip-footer">
                    <p>Generated automatically on {new Date().toLocaleDateString('id-ID')}</p>
                    <div className={`payslip-status-badge ${user.payrollStatus === 'Paid' ? 'paid' : 'unpaid'}`}>
                      {user.payrollStatus === 'Paid' ? 'PAID' : 'UNPAID'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="payroll-manage-section">
                <div className="employee-header" style={{ padding: '0 0 16px 0' }}>
                  <div className="employee-search-bar" style={{ flex: 1 }}>
                    <span className="material-icons-outlined">search</span>
                    <input type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>

                {/* Aggregate Summary */}
                {!employeesLoading && (
                  <div className="stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="stat-card dark">
                      <div className="stat-label">Total Employees</div>
                      <div className="stat-value">{employees.length}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total Gaji Pokok</div>
                      <div className="stat-value">{formatCurrency(employees.reduce((s, e) => s + (e.baseSalary || 5000000), 0))}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total Tunjangan</div>
                      <div className="stat-value">{formatCurrency(employees.reduce((s, e) => s + (e.allowance || 0), 0))}</div>
                    </div>
                    <div className="stat-card highlight" style={{ gridColumn: '1 / -1' }}>
                      <div className="stat-label">TOTAL PENGELUARAN SELURUH KARYAWAN</div>
                      <div className="stat-value" style={{ color: '#1e40af', fontSize: '32px' }}>
                        {formatCurrency(employees.reduce((s, e) => s + (e.baseSalary || 5000000) + (e.allowance || 0), 0))}
                      </div>
                    </div>
                  </div>
                )}

                {employeesLoading ? <div className="loading-center"><div className="loading-spinner"></div></div> : (
                  <div className="table-responsive">
                    <table className="request-table">
                      <thead>
                        <tr>
                          <th>Karyawan & Rekening</th>
                          <th>Total Gaji (Net)</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                          <tr key={emp._id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {emp.picture ? (
                                  <img className="member-avatar-mini" src={emp.picture} alt="" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="member-avatar-mini">{getInitials(emp.name)}</div>
                                )}
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{emp.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.position} • {emp.bankAccount || '-'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '14px' }}>
                                {formatCurrency((emp.baseSalary || 5000000) + (emp.allowance || 0))}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                Gapok: {formatCurrency(emp.baseSalary || 5000000)}
                              </div>
                            </td>
                            <td>
                              <span className={`payroll-status-badge ${emp.payrollStatus === 'Paid' ? 'paid' : 'unpaid'}`} style={{ padding: '4px 8px', fontSize: '10px' }}>
                                {emp.payrollStatus === 'Paid' ? 'PAID' : 'UNPAID'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn-edit-payroll" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => {
                                setEditPayrollData({
                                  id: emp._id,
                                  name: emp.name,
                                  baseSalary: emp.baseSalary || 5000000,
                                  allowance: emp.allowance || 0,
                                  role: emp.role || 'employee',
                                  bankAccount: emp.bankAccount || '-',
                                  payrollStatus: emp.payrollStatus || 'Unpaid',
                                  leaveQuota: emp.leaveQuota || 0,
                                  contractEnd: safeISO(emp.contractEnd)
                                });
                                setIsEditingPayroll(true);
                              }}>
                                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LEAVE & REQUEST VIEW */}
        {activeMenu === 'leave' && (
          <div className="leave-container animate-fadeInUp">
            <div className="leave-header">
              <h2 className="leave-title">Leave & Attendance Request</h2>
              <div className="leave-tabs">
                <button className={`leave-tab-btn ${leaveTab === 'new' ? 'active' : ''}`} onClick={() => setLeaveTab('new')}>New Request</button>
                <button className={`leave-tab-btn ${leaveTab === 'history' ? 'active' : ''}`} onClick={() => setLeaveTab('history')}>My History</button>
                {['manager', 'admin', 'hrd'].includes(user?.role) && (
                  <button className={`leave-tab-btn ${leaveTab === 'approval' ? 'active' : ''}`} onClick={() => { setLeaveTab('approval'); fetchPendingRequests(); }}>
                    Approvals {pendingRequests.length > 0 && <span className="approve-badge">{pendingRequests.length}</span>}
                  </button>
                )}
              </div>
            </div>

            {leaveTab === 'new' && (
              <div className="request-grid">
                {[
                  { id: 'Leave', icon: 'event_available', color: '#3b82f6', label: 'Leave' },
                  { id: 'Permit', icon: 'fact_check', color: '#10b981', label: 'Permit' },
                  { id: 'Sick', icon: 'medical_services', color: '#f43f5e', label: 'Sick' },
                  { id: 'Overtime', icon: 'more_time', color: '#8b5cf6', label: 'Overtime' },
                  { id: 'Reimbursement', icon: 'payments', color: '#f59e0b', label: 'Reimbursement' },
                  { id: 'Timesheet', icon: 'pending_actions', color: '#6366f1', label: 'Timesheet' },
                  { id: 'Expense', icon: 'receipt_long', color: '#ec4899', label: 'Expense' },
                  { id: 'Other', icon: 'help_outline', color: '#64748b', label: 'Other' }
                ].map(item => (
                  <button key={item.id} className="request-type-card" onClick={() => handleOpenRequest(item.id)}>
                    <div className="req-icon" style={{ backgroundColor: item.color + '15', color: item.color }}><span className="material-icons-outlined">{item.icon}</span></div>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {leaveTab === 'history' && (
              <div className="request-history">
                {isFetchingRequests ? <div className="loading-spinner"></div> : (
                  <>
                    {requests.length === 0 ? <div className="empty-state">No requests yet.</div> : (
                      <div className="table-responsive">
                        <table className="request-table">
                          <thead><tr><th>Type</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                          <tbody>
                            {requests.map(req => (
                              <tr key={req._id}>
                                <td><strong>{req.type}</strong></td>
                                <td>{req.startDate ? new Date(req.startDate).toLocaleDateString() : '-'}</td>
                                <td><p className="reason-cell">{req.reason}</p></td>
                                <td>
                                  <span className={`status-pill ${req.status.toLowerCase()}`}>
                                    <span className="material-icons-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                                      {req.status === 'Approved' ? 'check_circle' : req.status === 'Rejected' ? 'cancel' : req.status === 'Returned' ? 'assignment_return' : 'pending'}
                                    </span>
                                    {req.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {leaveTab === 'approval' && (
              <div className="approval-section">
                {pendingRequests.length === 0 ? <div className="empty-state">No pending approvals.</div> : (
                  <div className="approval-cards">
                    {pendingRequests.map(req => (
                      <div key={req._id} className="approval-card">
                        <div className="approve-header">
                          <div className="approve-user">
                            <div className="approve-avatar">
                              {req.profilePicture ? (
                                <img src={req.profilePicture} alt="" className="approve-avatar-img" referrerPolicy="no-referrer" />
                              ) : (
                                getInitials(req.name)
                              )}
                            </div>
                            <div><h4>{req.name}</h4><p>{req.type}</p></div>
                          </div>
                          <span className="req-date">{new Date(req.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="approve-body">
                          <p><strong>Period:</strong> {new Date(req.startDate).toLocaleDateString()} {req.endDate ? 'to ' + new Date(req.endDate).toLocaleDateString() : ''}</p>
                          <p><strong>Reason:</strong> {req.reason}</p>
                          {req.amount && <p><strong>Amount:</strong> {formatCurrency(req.amount)}</p>}
                        </div>
                        <div className="approve-footer">
                          <button className="btn-reject" onClick={() => handleApproveRequest(req._id, 'Rejected')}>Reject</button>
                          <button className="btn-return" onClick={() => handleApproveRequest(req._id, 'Returned')}>Return</button>
                          <button className="btn-approve" onClick={() => handleApproveRequest(req._id, 'Approved')}>Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeMenu === 'attendance' && activeSubMenu === 'att-schedule' && (
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
                const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon...
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                // Adjust for Monday start: Mon=0, Tue=1... Sun=6
                const leadDays = (firstDayOfMonth + 6) % 7;

                const cells = [];
                const today = new Date();
                const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

                // 1. Empty lead cells
                for (let x = 0; x < leadDays; x++) {
                  cells.push(<div key={`empty-${x}`} className="calendar-day-cell empty"></div>);
                }

                // 2. Actual days
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

                // 3. Fill remaining cells to complete the grid (optional but looks cleaner)
                const totalCells = cells.length;
                const remaining = (7 - (totalCells % 7)) % 7;
                for (let z = 0; z < remaining; z++) {
                  cells.push(<div key={`empty-end-${z}`} className="calendar-day-cell empty"></div>);
                }

                return cells;
              })()}
            </div>
          </div>
        )}

        {/* ATTENDANCE PERSONAL VIEW (Card Style) */}
        {activeMenu === 'attendance' && activeSubMenu === 'att-personal' && (
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

            {(() => {
              const processed = groupAttendanceByDay(personalAttendance);
              const totalHrs = processed.reduce((acc, curr) => acc + (curr.isValid ? parseFloat(curr.hours || 0) : 0), 0);
              const daysPresent = processed.filter(d => d.isValid).length;
              const onTimeCount = processed.filter(d => d.isValid && d.onTime).length;
              const onTimeRate = daysPresent > 0 ? Math.round((onTimeCount / daysPresent) * 100) : 0;

              return (
                <div className="stats-grid">
                  <div className="stats-card stats-blue animate-fadeInUp" style={{ animationDelay: '0s' }}>
                    <div className="stats-card-icon"><span className="material-icons-outlined">schedule</span></div>
                    <div className="stats-card-content">
                      <span className="stats-label">Total Hours</span>
                      <span className="stats-value">{totalHrs.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div className="stats-card stats-green animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                    <div className="stats-card-icon"><span className="material-icons-outlined">calendar_today</span></div>
                    <div className="stats-card-content">
                      <span className="stats-label">Days Present</span>
                      <span className="stats-value">{daysPresent}d</span>
                    </div>
                  </div>
                  <div className="stats-card stats-amber animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                    <div className="stats-card-icon"><span className="material-icons-outlined">verified</span></div>
                    <div className="stats-card-content">
                      <span className="stats-label">On Time</span>
                      <span className="stats-value">{onTimeRate}%</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {personalLoading ? <div className="loading-spinner"></div> : (
              <div className="att-cards-grid">
                {groupAttendanceByDay(personalAttendance).length === 0 ? <div className="empty-state">No records for this period.</div> :
                  groupAttendanceByDay(personalAttendance).map((day, idx) => (
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
        )}

        {/* ATTENDANCE MONTHLY REPORT VIEW */}
        {activeMenu === 'attendance' && activeSubMenu === 'att-report' && user?.role !== 'employee' && (
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
                    <tr>
                      <th>Employee</th>
                      <th>Days Present</th>
                      <th>Late Days</th>
                      <th>Total Hours</th>
                      <th>Work Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReports.map(report => (
                      <tr key={report.id}>
                        <td>
                          <div style={{ fontWeight: '600' }}>{report.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{report.position}</div>
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
        )}
      </main>

      {/* Floating Clock Button */}
      <button className={`fab-clock ${isClockedIn ? 'is-in' : 'is-out'}`} onClick={handleFabClick} disabled={clockLoading}>
        <span className="material-icons-outlined">{clockLoading ? 'sync' : (isClockedIn ? 'logout' : 'login')}</span>
      </button>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="modal-overlay">
          <div className="modal-content animate-fadeInUp">
            <div className="modal-header"><h3>Edit Information</h3><button className="modal-close" onClick={() => setIsEditingProfile(false)}><span className="material-icons-outlined">close</span></button></div>
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
                <button type="button" className="btn-cancel" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={isSavingProfile}>
                  {isSavingProfile ? <div className="loading-spinner"></div> : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Request Modal */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fadeInUp">
            <div className="modal-header"><h3>New {selectedRequestType} Request</h3><button className="modal-close" onClick={() => setShowRequestModal(false)}><span className="material-icons-outlined">close</span></button></div>
            <form onSubmit={handleRequestSubmit} className="request-form">
              {selectedRequestType === 'Leave' && (
                <div className="quota-display" style={{ padding: '12px', background: '#eff6ff', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-icons-outlined" style={{ color: '#3b82f6' }}>event_note</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>Jatah Cuti Tersisa: {user.leaveQuota || 0} Hari</div>
                    <div style={{ fontSize: '11px', color: '#60a5fa' }}>Gunakan jatah cuti tahunan Anda dengan bijak.</div>
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" required value={requestFormData.startDate} onChange={e => setRequestFormData({ ...requestFormData, startDate: e.target.value })} /></div>
                {['Leave', 'Sick', 'Permit'].includes(selectedRequestType) && (
                  <div className="form-group"><label>End Date</label><input type="date" value={requestFormData.endDate} onChange={e => setRequestFormData({ ...requestFormData, endDate: e.target.value })} /></div>
                )}
              </div>
              {['Leave', 'Sick', 'Permit'].includes(selectedRequestType) && requestFormData.startDate && requestFormData.endDate && (
                <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>info</span>
                  Durasi: <strong>{(() => {
                    const s = new Date(requestFormData.startDate);
                    const e = new Date(requestFormData.endDate);
                    if (isNaN(s) || isNaN(e)) return 0;
                    const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
                    return diff;
                  })()} Hari</strong>
                </div>
              )}
              {['Reimbursement', 'Expense'].includes(selectedRequestType) && (
                <div className="form-group"><label>Amount</label><input type="number" required placeholder="0" value={requestFormData.amount} onChange={e => setRequestFormData({ ...requestFormData, amount: e.target.value })} /></div>
              )}
              <div className="form-group"><label>Reason / Description</label><textarea required rows="3" value={requestFormData.reason} onChange={e => setRequestFormData({ ...requestFormData, reason: e.target.value })} placeholder="Give details about your request..."></textarea></div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowRequestModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={isSubmittingRequest}>{isSubmittingRequest ? <div className="loading-spinner"></div> : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Employee Modal (Admin Only) */}
      {isEditingEmployee && (
        <div className="modal-overlay">
          <div className="modal-content animate-fadeInUp">
            <div className="modal-header">
              <h3>Manage Employee: {selectedEmployee.name}</h3>
              <button className="modal-close" onClick={() => setIsEditingEmployee(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="edit-profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Professional Position</label>
                  <input value={editEmployeeData.position} onChange={e => setEditEmployeeData({ ...editEmployeeData, position: e.target.value })} required placeholder="e.g. Software Engineer" />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input value={editEmployeeData.department} onChange={e => setEditEmployeeData({ ...editEmployeeData, department: e.target.value })} required placeholder="e.g. Engineering" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Employee Role</label>
                  <select value={editEmployeeData.role} onChange={e => setEditEmployeeData({ ...editEmployeeData, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="hrd">HRD</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Employment Status</label>
                  <select value={editEmployeeData.employmentStatus} onChange={e => setEditEmployeeData({ ...editEmployeeData, employmentStatus: e.target.value })}>
                    <option value="Probation">Probation</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={editEmployeeData.employeeId} onChange={e => setEditEmployeeData({ ...editEmployeeData, employeeId: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Reporting Manager</label>
                  <select value={editEmployeeData.manager} onChange={e => setEditEmployeeData({ ...editEmployeeData, manager: e.target.value })}>
                    <option value="">(None)</option>
                    {employees.filter(emp => emp.email !== selectedEmployee.email).map(emp => (
                      <option key={emp.email} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Leave Quota (Annual)</label>
                  <input type="number" value={editEmployeeData.leaveQuota} onChange={e => setEditEmployeeData({ ...editEmployeeData, leaveQuota: Number(e.target.value) })} min="0" required />
                </div>
                <div className="form-group">
                  <label>Contract End Date</label>
                  <input type="date" value={editEmployeeData.contractEnd} onChange={e => setEditEmployeeData({ ...editEmployeeData, contractEnd: e.target.value })} />
                </div>
              </div>

              {/* Minimalist Team Management */}
              <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>groups</span> Team Members
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{editEmployeeData.teamMembers.length} Person(s)</span>
                </div>

                <div className="team-edit-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {editEmployeeData.teamMembers.length === 0 ? (
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>No members assigned</p>
                  ) : (
                    editEmployeeData.teamMembers.map((m, idx) => (
                      <div key={m.email || idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                        <span>{m.name || m.n}</span>
                        <button type="button" onClick={() => handleRemoveTeamMember(m.email)} style={{ border: 'none', background: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer' }}>
                          <span className="material-icons-outlined" style={{ fontSize: '12px' }}>close</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <select
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}
                  onChange={(e) => {
                    if (e.target.value) {
                      const emp = employees.find(emp => emp.email === e.target.value);
                      if (emp) handleAddTeamMember(emp);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add Member...</option>
                  {employees.filter(emp => emp.email !== selectedEmployee.email && !editEmployeeData.teamMembers.find(m => m.email === emp.email)).map(emp => (
                    <option key={emp.email} value={emp.email}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-delete" onClick={handleDeleteEmployee} style={{ marginRight: 'auto', background: '#fff1f2', color: '#e11d48', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>Delete Karyawan</button>
                <button type="button" className="btn-cancel" onClick={() => setIsEditingEmployee(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={isSavingEmployee}>
                  {isSavingEmployee ? <div className="loading-spinner"></div> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Office Location Settings Modal (Admin Only) */}
      {showOfficeModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fadeInUp">
            <div className="modal-header">
              <h3>Office Location Settings</h3>
              <button className="modal-close" onClick={() => setShowOfficeModal(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await axios.put(`${API_URL}/api/settings/office`, editOfficeData);
                if (res.data.success) {
                  setOfficeSettings(res.data.data);
                  setShowOfficeModal(false);
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
                <button type="button" className="btn-cancel" onClick={() => setShowOfficeModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">Save Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payroll Modal (Admin/Manager Only) */}
      {isEditingPayroll && (
        <div className="modal-overlay">
          <div className="modal-content animate-fadeInUp">
            <div className="modal-header">
              <h3>Edit Payroll: {editPayrollData.name}</h3>
              <button className="modal-close" onClick={() => setIsEditingPayroll(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSavePayroll} className="edit-profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Basic Salary (IDR)</label>
                  <input type="number" value={editPayrollData.baseSalary} onChange={e => setEditPayrollData({ ...editPayrollData, baseSalary: Number(e.target.value) })} min="0" required />
                </div>
                <div className="form-group">
                  <label>Allowance / Bonus (IDR)</label>
                  <input type="number" value={editPayrollData.allowance} onChange={e => setEditPayrollData({ ...editPayrollData, allowance: Number(e.target.value) })} min="0" required />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Payroll Status</label>
                  <select value={editPayrollData.payrollStatus} onChange={e => setEditPayrollData({ ...editPayrollData, payrollStatus: e.target.value })} required>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Bank Account Number</label>
                  <input value={editPayrollData.bankAccount} onChange={e => setEditPayrollData({ ...editPayrollData, bankAccount: e.target.value })} placeholder="e.g. BCA 12345678" />
                </div>
              </div>


              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                💡 <strong>Total THP:</strong> {formatCurrency(editPayrollData.baseSalary + editPayrollData.allowance)}
              </p>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsEditingPayroll(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={isSavingPayroll}>
                  {isSavingPayroll ? <div className="loading-spinner"></div> : 'Update Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">© 2026 EMS Technology</footer>
    </div>
  );
}

export default App;