import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

// Utils & Constants
import { API_URL, DEFAULT_OFFICE, MENU_ITEMS, getDistanceMeters, getInitials, safeISO, formatTimestamp } from './utils/helpers';

// Components
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import Dashboard from './components/Dashboard';
import ProfileView from './components/ProfileView';
import EmployeeView from './components/EmployeeView';
import PayrollView from './components/PayrollView';
import LeaveView from './components/LeaveView';
import AttendancePersonal from './components/AttendancePersonal';
import AttendanceReport from './components/AttendanceReport';
import ScheduleView from './components/ScheduleView';

// Modals
import EditProfileModal from './components/modals/EditProfileModal';
import RequestModal from './components/modals/RequestModal';
import EditEmployeeModal from './components/modals/EditEmployeeModal';
import OfficeSettingsModal from './components/modals/OfficeSettingsModal';
import EditPayrollModal from './components/modals/EditPayrollModal';

function App() {
  // ==================== STATE ====================
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
  const [requestFormData, setRequestFormData] = useState({ startDate: '', endDate: '', reason: '', amount: '' });
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

  // Payroll States
  const [payrollTab, setPayrollTab] = useState('mine');
  const [isEditingPayroll, setIsEditingPayroll] = useState(false);
  const [editPayrollData, setEditPayrollData] = useState({
    id: '', name: '', baseSalary: 0, allowance: 0, role: '', bankAccount: '-', bankName: '-', ptkpStatus: 'TK/0', mealAllowanceRate: 25000, transportAllowanceRate: 20000, payrollStatus: 'Unpaid', leaveQuota: 0, contractEnd: '',
    bpjsKesehatanAmount: 0, bpjsTkAmount: 0, pph21Amount: 0
  });

  const [isSavingPayroll, setIsSavingPayroll] = useState(false);

  // Payroll Automation States
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState({});
  const [myPayslip, setMyPayslip] = useState(null);
  const [myPayslipHistory, setMyPayslipHistory] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [welcomeIndex, setWelcomeIndex] = useState(0);

  // Dashboard Stats State
  const [attendanceSummary, setAttendanceSummary] = useState({ totalStaff: 0, presentCount: 0, lateCount: 0 });

  // ==================== EFFECTS ====================
  useEffect(() => {
    const interval = setInterval(() => setWelcomeIndex(prev => (prev + 1) % 7), 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOfficeSettings = useCallback(async () => {
    try {
      if(!axios.defaults.headers.common['Authorization']) return;
      const res = await axios.get(`${API_URL}/api/settings/office`);
      if (res.data.success) setOfficeSettings(res.data.data);
    } catch (err) { console.error('Error fetching office settings:', err); }
  }, []);
  useEffect(() => { if (user) fetchOfficeSettings(); }, [fetchOfficeSettings, user]);


  const fetchWorkDays = useCallback(async () => {
    try {
      if(!axios.defaults.headers.common['Authorization']) return;
      const res = await axios.get(`${API_URL}/api/settings/workdays`);
      if (res.data.success) setWorkDays(res.data.data);
    } catch (err) { console.error('Error fetching work days:', err); }
  }, []);
  useEffect(() => { if (user) fetchWorkDays(); }, [fetchWorkDays, user]);

  const fetchMonthlyReports = useCallback(async (month, year) => {
    setIsFetchingReports(true);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/summary/monthly`, { params: { month, year } });
      if (res.data.success) setMonthlyReports(res.data.reports);
    } catch (err) { console.error('Error fetching reports:', err); }
    finally { setIsFetchingReports(false); }
  }, []);

  const fetchAttendanceSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/attendance/summary/today`);
      if (res.data.success) setAttendanceSummary(res.data);
    } catch (err) { console.error('Error fetching dashboard summary:', err); }
  }, []);

  useEffect(() => {
    if (activeMenu === 'dashboard') fetchAttendanceSummary();
  }, [activeMenu, fetchAttendanceSummary, history.length]);

  // Geolocation tracking
  useEffect(() => {
    if (activeMenu !== 'dashboard' || activeTab !== 'myinfo') return;
    if (!navigator.geolocation) { setLocationStatus('denied'); return; }
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
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setCameraStatus('loading'); setCapturedPhoto(null); return;
    }
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraStatus('active');
      } catch { setCameraStatus('denied'); }
    };
    startCamera();
    return () => { cancelled = true; if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  }, [activeMenu, activeTab]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current; const canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d'); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    setCapturedPhoto(dataUrl); return dataUrl;
  };

  // ==================== DATA FETCHING ====================
  const fetchHistory = useCallback(async (email) => {
    try { const res = await axios.get(`${API_URL}/api/attendance/history?email=${email}`); if (res.data.success) setHistory(res.data.records); }
    catch (err) { console.error('Gagal ambil riwayat:', err); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try { const res = await axios.get(`${API_URL}/api/employees`); if (res.data.success) setEmployees(res.data.employees); }
    catch (err) { console.error('Gagal ambil karyawan:', err); }
    finally { setEmployeesLoading(false); }
  }, []);

  const fetchRecentActivities = useCallback(async () => {
    if (!user) return;
    try { const res = await axios.get(`${API_URL}/api/requests/recent`, { params: { email: user.email, role: user.role } }); if (res.data.success) setRecentActivities(res.data.activities); }
    catch (err) { console.error('Error fetching activities:', err); }
  }, [user]);

  const fetchOnLeaveToday = useCallback(async () => {
    try { const res = await axios.get(`${API_URL}/api/requests/active-leave`); if (res.data.success) setOnLeaveToday(res.data.data); }
    catch (err) { console.error('Error fetching on-leave data:', err); }
  }, []);

  const fetchPersonalAttendance = useCallback(async (month, year) => {
    if (!user || !user.email) return;
    setPersonalLoading(true);
    try { const res = await axios.get(`${API_URL}/api/attendance/history`, { params: { email: user.email, month, year } }); if (res.data.success) setPersonalAttendance(res.data.records); }
    catch (err) { console.error('❌ Gagal ambil absensi:', err); }
    finally { setPersonalLoading(false); }
  }, [user]);

  useEffect(() => {
    if (activeMenu === 'attendance' && activeSubMenu === 'att-personal') fetchPersonalAttendance(selectedMonth, selectedYear);
  }, [activeMenu, activeSubMenu, selectedMonth, selectedYear, history.length, fetchPersonalAttendance]);

  const fetchScheduleHolidays = useCallback(async () => {
    try { const res = await axios.get(`${API_URL}/api/schedule/holidays`); if (res.data.success) setScheduleHolidays(res.data.holidays); }
    catch (err) { console.error('Error fetching holidays:', err); }
  }, []);

  useEffect(() => {
    if (activeMenu === 'attendance' && activeSubMenu === 'att-schedule') fetchScheduleHolidays();
  }, [activeMenu, activeSubMenu, fetchScheduleHolidays]);

  const fetchRequests = useCallback(async () => {
    if (!user || !user.email) return;
    setIsFetchingRequests(true);
    try { const res = await axios.get(`${API_URL}/api/requests?email=${user.email}`); if (res.data.success) setRequests(res.data.requests); }
    catch (err) { console.error('Fetch requests error:', err); }
    finally { setIsFetchingRequests(false); }
  }, [user]);

  const fetchPendingRequests = useCallback(async () => {
    try { const res = await axios.get(`${API_URL}/api/requests/pending`); if (res.data.success) setPendingRequests(res.data.requests); }
    catch (err) { console.error('Fetch pending error:', err); }
  }, []);

  useEffect(() => {
    if (activeMenu === 'dashboard' && activeTab === 'feed') { fetchOnLeaveToday(); fetchRecentActivities(); }
    if (activeMenu === 'leave') { fetchRequests(); if (['manager', 'admin'].includes(user?.role)) fetchPendingRequests(); }
    if (activeMenu === 'payroll') {
      fetchMyPayslip(payrollPeriod.month, payrollPeriod.year);
      if (['admin', 'hrd', 'manager'].includes(user?.role)) fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
    }
  }, [activeMenu, fetchRequests, fetchPendingRequests, user?.role]);

  // ==================== HANDLERS ====================
  const handleLoginSuccess = async (response) => {
    const credential = response.credential;
    setLoading(true);
    try {
      const result = await axios.post(`${API_URL}/api/auth/google`, { token: credential });
      if (result.data.success) {
        setUser(result.data.user); setToken(credential);
        axios.defaults.headers.common['Authorization'] = `Bearer ${credential}`;
        fetchHistory(result.data.user.email);
      }
    } catch (error) {
      console.error('Gagal verifikasi:', error);
      setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Gagal memverifikasi akun Google.' });
    } finally { setLoading(false); }
  };

  const handleLoginError = () => { setStatusMsg({ type: 'error', text: 'Login Google gagal. Coba lagi.' }); };

  const handleClock = async (type) => {
    if (!token || !user) return;
    const now = new Date(); const currentHour = now.getHours();
    if (type === 'clock_in' && currentHour < 8) { setStatusMsg({ type: 'error', text: 'Absensi masuk baru dibuka jam 08:00 pagi.' }); return; }
    if (type === 'clock_out' && currentHour < 17) { alert('Maaf, absen pulang belum bisa dilakukan. Absen harus sesuai jam pulang (setelah jam 05:00 sore).'); setStatusMsg({ type: 'error', text: 'Absensi keluar baru bisa jam 05:00 sore.' }); return; }
    if (!userLocation) { setStatusMsg({ type: 'error', text: 'Lokasi belum terdeteksi. Aktifkan GPS Anda.' }); return; }
    if (distanceToOffice > officeSettings.radius) { setStatusMsg({ type: 'error', text: `Anda di luar radius kantor (${distanceToOffice}m). Maksimal ${officeSettings.radius}m.` }); return; }
    const photo = capturePhoto();
    if (!photo) { setStatusMsg({ type: 'error', text: 'Kamera belum aktif. Izinkan akses kamera.' }); return; }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!workDays.includes(dayNames[now.getDay()]) && type === 'clock_in') {
      if (!window.confirm(`Hari ini (${dayNames[now.getDay()]}) bukan hari kerja wajib. Tetap ingin absen?`)) return;
    }
    setClockLoading(true); setStatusMsg(null);
    try {
      const result = await axios.post(`${API_URL}/api/attendance/submit`, { lat: userLocation.lat, lng: userLocation.lng, type });
      if (result.data.success) {
        setStatusMsg({ type: 'success', text: `${type === 'clock_in' ? '🟢 Clock In' : '🔴 Clock Out'} berhasil dicatat!` });
        fetchHistory(user.email); setTimeout(() => setCapturedPhoto(null), 3000);
      }
    } catch { setStatusMsg({ type: 'error', text: 'Gagal mencatat absensi.' }); }
    finally { setClockLoading(false); }
  };

  const handleFabClick = () => {
    if (activeMenu !== 'dashboard' || activeTab !== 'myinfo') {
      setActiveMenu('dashboard'); setActiveTab('myinfo');
      setStatusMsg({ type: 'info', text: 'Mengarahkan ke halaman absensi...' }); setTimeout(() => setStatusMsg(null), 2000);
    } else { handleClock(isClockedIn ? 'clock_out' : 'clock_in'); }
  };

  const handleLogout = () => {
    setUser(null); setToken(null); setHistory([]); setStatusMsg(null);
    setActiveMenu('dashboard'); setActiveTab('feed');
    delete axios.defaults.headers.common['Authorization'];
  };

  const openSidebar = () => { setSidebarOpen(true); setSidebarClosing(false); };
  const closeSidebar = () => { setSidebarClosing(true); setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false); }, 250); };

  const handleMenuClick = (menuId) => {
    const item = MENU_ITEMS.find(i => i.id === menuId);
    if (item.hasSubmenu) { setExpandedMenu(expandedMenu === menuId ? null : menuId); }
    else { setActiveMenu(menuId); setActiveSubMenu(null); setSelectedEmployee(null); closeSidebar(); if (menuId === 'employee') fetchEmployees(); }
  };

  const handleSubMenuClick = (menuId, subId) => {
    setActiveMenu(menuId); setActiveSubMenu(subId); setSelectedEmployee(null);
    if (subId === 'att-personal') fetchPersonalAttendance(selectedMonth, selectedYear);
    if (subId === 'att-report') fetchMonthlyReports(reportMonth, reportYear);
    closeSidebar();
  };

  // Profile Edit
  const handleStartEdit = () => {
    setEditFormData({ name: user.name, bio: user.bio || '', phone: user.phone || '', address: user.address || '', birthday: safeISO(user.birthday), gender: user.gender || '-', maritalStatus: user.maritalStatus || '-' });
    setIsEditingProfile(true);
  };
  const handleEditChange = (e) => { setEditFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleSaveProfile = async (e) => {
    e.preventDefault(); if (!user || !user.email) return; setIsSavingProfile(true);
    try {
      const res = await axios.put(`${API_URL}/api/users/profile`, { email: user.email, ...editFormData });
      if (res.data.success) { setUser(prev => ({ ...prev, ...res.data.user, picture: prev.picture })); setIsEditingProfile(false); setStatusMsg({ type: 'success', text: 'Profil diperbarui!' }); setTimeout(() => setStatusMsg(null), 3000); }
    } catch (err) { console.error('❌ Gagal simpan profil:', err); }
    finally { setIsSavingProfile(false); }
  };

  // Request handlers
  const handleOpenRequest = (type) => { setSelectedRequestType(type); setRequestFormData({ startDate: '', endDate: '', reason: '', amount: '' }); setShowRequestModal(true); };
  const handleRequestSubmit = async (e) => {
    e.preventDefault(); setIsSubmittingRequest(true);
    try {
      if (selectedRequestType === 'Leave') {
        const s = new Date(requestFormData.startDate); const end = new Date(requestFormData.endDate);
        const diff = Math.ceil(Math.abs(end - s) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > (user.leaveQuota || 0)) { alert(`Maaf, jatah cuti Anda tidak mencukupi. Tersisa: ${user.leaveQuota || 0} hari, yang diminta: ${diff} hari.`); setIsSubmittingRequest(false); return; }
      }
      const res = await axios.post(`${API_URL}/api/requests`, { email: user.email, name: user.name, type: selectedRequestType, ...requestFormData });
      if (res.data.success) { setShowRequestModal(false); fetchRequests(); setStatusMsg({ type: 'success', text: selectedRequestType === 'Leave' ? 'Permintaan cuti berhasil dikirim! Jatah akan dikurangi setelah disetujui.' : 'Permintaan berhasil dikirim!' }); setTimeout(() => setStatusMsg(null), 3000); }
    } catch (err) { console.error('Submit error:', err); }
    finally { setIsSubmittingRequest(false); }
  };
  const handleApproveRequest = async (id, status) => {
    try { const res = await axios.put(`${API_URL}/api/requests/${id}/status`, { status }); if (res.data.success) { fetchPendingRequests(); setStatusMsg({ type: 'success', text: `Permintaan ${status === 'Approved' ? 'disetujui' : 'ditolak'}!` }); setTimeout(() => setStatusMsg(null), 3000); } }
    catch (err) { console.error('Approval error:', err); }
  };

  // Employee Management
  const handleEditEmployee = () => {
    if (!selectedEmployee) return;
    setEditEmployeeData({ position: selectedEmployee.position || '', department: selectedEmployee.department || '', role: selectedEmployee.role || 'employee', employeeId: selectedEmployee.employeeId || '', employmentStatus: selectedEmployee.employmentStatus || 'Full-time', manager: selectedEmployee.manager || '', teamMembers: [...(selectedEmployee.teamMembers || [])], leaveQuota: selectedEmployee.leaveQuota || 0, contractEnd: safeISO(selectedEmployee.contractEnd) });
    setIsEditingEmployee(true);
  };
  const handleAddTeamMember = (emp) => {
    if (editEmployeeData.teamMembers.find(m => m.email === emp.email)) return;
    setEditEmployeeData({ ...editEmployeeData, teamMembers: [...editEmployeeData.teamMembers, { name: emp.name, n: emp.name, position: emp.position, p: emp.position, email: emp.email }] });
  };
  const handleRemoveTeamMember = (email) => { setEditEmployeeData({ ...editEmployeeData, teamMembers: editEmployeeData.teamMembers.filter(m => m.email !== email) }); };
  const handleSaveEmployee = async (e) => {
    e.preventDefault(); setIsSavingEmployee(true);
    try {
      const res = await axios.put(`${API_URL}/api/employees/${selectedEmployee._id}`, editEmployeeData);
      if (res.data.success && res.data.employee) {
        const freshEmp = res.data.employee;
        setEmployees(prev => prev.map(e => e._id === freshEmp._id ? freshEmp : e)); setSelectedEmployee(freshEmp);
        if (user && freshEmp.email === user.email) setUser(prev => ({ ...prev, ...freshEmp, picture: freshEmp.profilePicture || prev.picture }));
        setIsEditingEmployee(false); setStatusMsg({ type: 'success', text: `Data ${freshEmp.name} berhasil disinkronkan!` }); setTimeout(() => setStatusMsg(null), 3000); fetchEmployees();
      }
    } catch (err) { console.error('Error saving employee:', err); setStatusMsg({ type: 'error', text: 'Gagal menyimpan perubahan.' }); }
    finally { setIsSavingEmployee(false); }
  };
  const handleDeleteEmployee = async () => {
    if (!selectedEmployee || !window.confirm(`Apakah Anda yakin ingin menghapus ${selectedEmployee.name}?`)) return;
    setIsSavingEmployee(true);
    try { const res = await axios.delete(`${API_URL}/api/employees/${selectedEmployee._id}`); if (res.data.success) { setIsEditingEmployee(false); setSelectedEmployee(null); fetchEmployees(); setStatusMsg({ type: 'success', text: 'Karyawan berhasil dihapus!' }); setTimeout(() => setStatusMsg(null), 3000); } }
    catch (err) { console.error('Error deleting employee:', err); }
    finally { setIsSavingEmployee(false); }
  };

  const handleDashboardViewMore = () => {
    setActiveMenu('leave');
    if (['manager', 'admin'].includes(user?.role)) { setLeaveTab('approval'); fetchPendingRequests(); }
    else { setLeaveTab('history'); fetchRequests(); }
  };

  // Payroll
  const handleSavePayroll = async (e) => {
    e.preventDefault(); setIsSavingPayroll(true);
    try {
      const res = await axios.put(`${API_URL}/api/employees/${editPayrollData.id}/payroll`, { 
        baseSalary: editPayrollData.baseSalary, 
        allowance: editPayrollData.allowance, 
        role: editPayrollData.role, 
        bankAccount: editPayrollData.bankAccount, 
        bankName: editPayrollData.bankName, 
        ptkpStatus: editPayrollData.ptkpStatus, 
        mealAllowanceRate: editPayrollData.mealAllowanceRate, 
        transportAllowanceRate: editPayrollData.transportAllowanceRate, 
        payrollStatus: editPayrollData.payrollStatus, 
        leaveQuota: editPayrollData.leaveQuota, 
        contractEnd: editPayrollData.contractEnd,
        bpjsKesehatanAmount: editPayrollData.bpjsKesehatanAmount,
        bpjsTkAmount: editPayrollData.bpjsTkAmount,
        pph21Amount: editPayrollData.pph21Amount
      });

      if (res.data.success && res.data.employee) {
        const freshEmp = res.data.employee;
        setEmployees(prev => prev.map(e => e._id === freshEmp._id ? freshEmp : e));
        if (user && freshEmp.email === user.email) setUser(prev => ({ ...prev, ...freshEmp, picture: freshEmp.profilePicture || prev.picture }));
        if (selectedEmployee && freshEmp._id === selectedEmployee._id) setSelectedEmployee(freshEmp);
        setIsEditingPayroll(false); setStatusMsg({ type: 'success', text: `Payroll & Kontrak ${freshEmp.name} berhasil diperbarui!` }); setTimeout(() => setStatusMsg(null), 3000); fetchEmployees();
      }
    } catch (err) { console.error('Error saving payroll:', err); setStatusMsg({ type: 'error', text: 'Gagal memperbarui payroll.' }); }
    finally { setIsSavingPayroll(false); }
  };

  // ==================== PAYROLL AUTOMATION HANDLERS ====================
  const fetchPayrollRecords = useCallback(async (month, year) => {
    const m = month ?? payrollPeriod.month;
    const y = year ?? payrollPeriod.year;
    try {
      const res = await axios.get(`${API_URL}/api/payroll/records`, { params: { month: m, year: y } });
      if (res.data.success) { setPayrollRecords(res.data.records); setPayrollSummary(res.data.summary); }
    } catch (err) { console.error('Fetch payroll records error:', err); }
  }, [payrollPeriod]);

  const fetchMyPayslip = useCallback(async (month, year) => {
    const m = month ?? payrollPeriod.month;
    const y = year ?? payrollPeriod.year;
    try {
      const res = await axios.get(`${API_URL}/api/payroll/my-payslip`, { params: { month: m, year: y } });
      if (res.data.success) { setMyPayslip(res.data.payslip); setMyPayslipHistory(res.data.history || []); }
    } catch (err) { console.error('Fetch my payslip error:', err); }
  }, [payrollPeriod]);

  const handleRunPayroll = async (ids = []) => {
    const isSelective = ids && ids.length > 0;
    if (!window.confirm(isSelective ? `Hitung payroll untuk ${ids.length} karyawan terpilih?` : `Hitung payroll untuk semua karyawan?`)) return;
    setIsCalculating(true);
    try {
      const res = await axios.post(`${API_URL}/api/payroll/calculate`, { month: payrollPeriod.month, year: payrollPeriod.year, ids });
      if (res.data.success) {
        setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 4000);
        fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
      }
    } catch (err) { console.error('Run payroll error:', err); setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menghitung payroll.' }); }
    finally { setIsCalculating(false); }
  };


  const handleFinalizeAll = async (ids = []) => {
    const isSelective = ids && ids.length > 0;
    if (!window.confirm(isSelective ? `Finalize ${ids.length} payroll terpilih?` : 'Finalize semua payroll Draft?')) return;
    try {
      const res = await axios.put(`${API_URL}/api/payroll/finalize-all`, { month: payrollPeriod.month, year: payrollPeriod.year, ids });
      if (res.data.success) { setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year); }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal finalize.' }); }
  };


  const handleMarkAllPaid = async (ids = []) => {
    const isSelective = ids && ids.length > 0;
    if (!window.confirm(isSelective ? `Tandai ${ids.length} payroll terpilih sebagai PAID?` : 'Tandai semua payroll Finalized sebagai PAID?')) return;
    try {
      const res = await axios.put(`${API_URL}/api/payroll/mark-all-paid`, { month: payrollPeriod.month, year: payrollPeriod.year, ids });
      if (res.data.success) { 
        setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); 
        fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
        fetchEmployees(); // Sync Data Karyawan
      }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal mark as paid.' }); }
  };



  const handleFinalize = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/api/payroll/${id}/finalize`);
      if (res.data.success) { setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year); }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal finalize.' }); }
  };

  const handleMarkPaid = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/api/payroll/${id}/mark-paid`);
      if (res.data.success) { 
        setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); 
        fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
        fetchEmployees(); // Sync Data Karyawan
      }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal mark as paid.' }); }
  };

  const handleMarkUnpaid = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/api/payroll/${id}/mark-unpaid`);
      if (res.data.success) { 
        setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); 
        fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
        fetchEmployees(); // Sync Data Karyawan
      }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal mark as unpaid.' }); }
  };

  const handleMarkAllUnpaid = async (ids = []) => {
    const isSelective = ids && ids.length > 0;
    if (!window.confirm(isSelective ? `Tandai ${ids.length} payroll terpilih sebagai UNPAID?` : 'Tandai semua payroll Paid sebagai UNPAID?')) return;
    try {
      const res = await axios.put(`${API_URL}/api/payroll/mark-all-unpaid`, { month: payrollPeriod.month, year: payrollPeriod.year, ids });
      if (res.data.success) { 
        setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 3000); 
        fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year);
        fetchEmployees(); // Sync Data Karyawan
      }
    } catch (err) { setStatusMsg({ type: 'error', text: 'Gagal mark all as unpaid.' }); }
  };


  const handleDownloadPDF = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/api/payroll/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `payslip_${id}.pdf`; document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) { console.error('Download PDF error:', err); setStatusMsg({ type: 'error', text: 'Gagal download PDF.' }); }
  };

  const handleExportBank = async (format, ids = []) => {
    try {
      const params = { month: payrollPeriod.month, year: payrollPeriod.year, format };
      if (ids && ids.length > 0) params.ids = ids.join(',');
      const res = await axios.get(`${API_URL}/api/payroll/export-bank`, { params, responseType: 'blob' });
      const ext = format === 'mandiri' ? 'txt' : 'csv';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `transfer_${format}_${payrollPeriod.month + 1}_${payrollPeriod.year}.${ext}`; document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      setStatusMsg({ type: 'success', text: `File bank transfer berhasil di-download!` }); setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) { console.error('Export bank error:', err); setStatusMsg({ type: 'error', text: 'Gagal export. Pastikan ada payroll yang sudah finalized.' }); }
  };


  const handleSendEmails = async (ids = []) => {
    const isSelective = ids && ids.length > 0;
    if (!window.confirm(isSelective ? `Kirim slip gaji ke ${ids.length} karyawan terpilih via email?` : 'Kirim slip gaji ke semua karyawan via email?')) return;
    try {
      const res = await axios.post(`${API_URL}/api/payroll/send-emails`, { month: payrollPeriod.month, year: payrollPeriod.year, ids });
      if (res.data.success) { setStatusMsg({ type: 'success', text: res.data.message }); setTimeout(() => setStatusMsg(null), 5000); fetchPayrollRecords(payrollPeriod.month, payrollPeriod.year); }
    } catch (err) { setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Gagal mengirim email.' }); }
  };


  // ==================== DAILY DEADLINE LOGIC ====================
  const hasApprovedOvertimeToday = requests.some(r => 
    r.type === 'Overtime' && 
    r.status === 'Approved' && 
    new Date(r.startDate).toDateString() === currentTime.toDateString()
  );

  const deadlineHour = hasApprovedOvertimeToday ? 20.25 : 19.0; // 20:15 vs 19:00
  const deadlineMins = Math.floor(deadlineHour * 60);

  // ==================== RENDER ====================
  if (!user) return <LoginPage loading={loading} statusMsg={statusMsg} handleLoginSuccess={handleLoginSuccess} handleLoginError={handleLoginError} />;

  const isClockedIn = history.length > 0 && 
    history[0].type === 'clock_in' && 
    new Date(history[0].timestamp).toDateString() === currentTime.toDateString() && 
    (currentTime.getHours() + currentTime.getMinutes() / 60) < deadlineHour;

  return (
    <div className="dashboard-page">
      {/* Clock-out Reminder Banner */}
      {(() => {
        const hr = currentTime.getHours(); const mins = currentTime.getMinutes(); const totalMins = hr * 60 + mins;
        // Start showing reminder 1 hour before deadline
        if (isClockedIn && totalMins >= (deadlineMins - 60) && totalMins < deadlineMins) {
          const timeLeft = deadlineMins - totalMins;
          const deadlineStr = hasApprovedOvertimeToday ? '20:15 (Lembur)' : '19:00';
          return (<div className="deadline-reminder-banner animate-fadeInDown"><span className="material-icons-outlined">warning</span><p>Peringatan: <strong>{timeLeft} menit</strong> lagi menuju batas waktu clock-out ({deadlineStr}). Segera absen pulang!</p></div>);
        }
        return null;
      })()}

      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}
      <Sidebar sidebarOpen={sidebarOpen} sidebarClosing={sidebarClosing} closeSidebar={closeSidebar} activeMenu={activeMenu} activeSubMenu={activeSubMenu} expandedMenu={expandedMenu} user={user} handleMenuClick={handleMenuClick} handleSubMenuClick={handleSubMenuClick} />
      <TopNavbar sidebarOpen={sidebarOpen} openSidebar={openSidebar} user={user} handleLogout={handleLogout} />

      <main className="dashboard-content">
        {activeMenu === 'dashboard' && (
          <Dashboard user={user} currentTime={currentTime} welcomeIndex={welcomeIndex} attendanceSummary={attendanceSummary} activeTab={activeTab} setActiveTab={setActiveTab} onLeaveToday={onLeaveToday} recentActivities={recentActivities} handleDashboardViewMore={handleDashboardViewMore} officeSettings={officeSettings} userLocation={userLocation} locationStatus={locationStatus} distanceToOffice={distanceToOffice} cameraStatus={cameraStatus} capturedPhoto={capturedPhoto} videoRef={videoRef} canvasRef={canvasRef} setEditOfficeData={setEditOfficeData} setShowOfficeModal={setShowOfficeModal} clockLoading={clockLoading} statusMsg={statusMsg} handleClock={handleClock} history={history} />
        )}
        {activeMenu === 'profile' && (
          <ProfileView user={user} profileTab={profileTab} setProfileTab={setProfileTab} handleStartEdit={handleStartEdit} />
        )}
        {activeMenu === 'employee' && (
          <EmployeeView user={user} employees={employees} employeesLoading={employeesLoading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} selectedEmployee={selectedEmployee} setSelectedEmployee={setSelectedEmployee} empDetailTab={empDetailTab} setEmpDetailTab={setEmpDetailTab} handleEditEmployee={handleEditEmployee} empAttendanceHistory={empAttendanceHistory} isFetchingEmpAttendance={isFetchingEmpAttendance} setEmpAttendanceHistory={setEmpAttendanceHistory} setIsFetchingEmpAttendance={setIsFetchingEmpAttendance} />
        )}
        {activeMenu === 'payroll' && (
          <PayrollView user={user} currentTime={currentTime} employees={employees} employeesLoading={employeesLoading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} payrollTab={payrollTab} setPayrollTab={setPayrollTab} fetchEmployees={fetchEmployees} setEditPayrollData={setEditPayrollData} setIsEditingPayroll={setIsEditingPayroll}
            payrollRecords={payrollRecords} payrollSummary={payrollSummary} myPayslip={myPayslip} myPayslipHistory={myPayslipHistory}
            isCalculating={isCalculating} payrollPeriod={payrollPeriod} setPayrollPeriod={setPayrollPeriod}
            handleRunPayroll={handleRunPayroll} handleFinalizeAll={handleFinalizeAll} handleMarkAllPaid={handleMarkAllPaid} handleMarkAllUnpaid={handleMarkAllUnpaid}
            handleFinalize={handleFinalize} handleMarkPaid={handleMarkPaid} handleMarkUnpaid={handleMarkUnpaid} handleDownloadPDF={handleDownloadPDF}
            handleExportBank={handleExportBank} handleSendEmails={handleSendEmails}
            fetchPayrollRecords={fetchPayrollRecords} fetchMyPayslip={fetchMyPayslip}
          />
        )}

        {activeMenu === 'leave' && (
          <LeaveView user={user} leaveTab={leaveTab} setLeaveTab={setLeaveTab} requests={requests} pendingRequests={pendingRequests} isFetchingRequests={isFetchingRequests} fetchPendingRequests={fetchPendingRequests} handleOpenRequest={handleOpenRequest} handleApproveRequest={handleApproveRequest} />
        )}
        {activeMenu === 'attendance' && activeSubMenu === 'att-schedule' && (
          <ScheduleView schedDate={schedDate} setSchedDate={setSchedDate} scheduleHolidays={scheduleHolidays} />
        )}
        {activeMenu === 'attendance' && activeSubMenu === 'att-personal' && (
          <AttendancePersonal user={user} personalAttendance={personalAttendance} personalLoading={personalLoading} currentTime={currentTime} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedYear={selectedYear} setSelectedYear={setSelectedYear} fetchPersonalAttendance={fetchPersonalAttendance} />
        )}
        {activeMenu === 'attendance' && activeSubMenu === 'att-report' && user?.role !== 'employee' && (
          <AttendanceReport user={user} monthlyReports={monthlyReports} isFetchingReports={isFetchingReports} reportMonth={reportMonth} setReportMonth={setReportMonth} reportYear={reportYear} setReportYear={setReportYear} fetchMonthlyReports={fetchMonthlyReports} />
        )}
      </main>

      {/* Floating Clock Button */}
      <button className={`fab-clock ${isClockedIn ? 'is-in' : 'is-out'}`} onClick={handleFabClick} disabled={clockLoading}>
        <span className="material-icons-outlined">{clockLoading ? 'sync' : (isClockedIn ? 'logout' : 'login')}</span>
      </button>

      {/* Modals */}
      {isEditingProfile && <EditProfileModal editFormData={editFormData} handleEditChange={handleEditChange} handleSaveProfile={handleSaveProfile} isSavingProfile={isSavingProfile} onClose={() => setIsEditingProfile(false)} />}
      {showRequestModal && <RequestModal user={user} selectedRequestType={selectedRequestType} requestFormData={requestFormData} setRequestFormData={setRequestFormData} handleRequestSubmit={handleRequestSubmit} isSubmittingRequest={isSubmittingRequest} onClose={() => setShowRequestModal(false)} />}
      {isEditingEmployee && <EditEmployeeModal selectedEmployee={selectedEmployee} employees={employees} editEmployeeData={editEmployeeData} setEditEmployeeData={setEditEmployeeData} handleSaveEmployee={handleSaveEmployee} handleDeleteEmployee={handleDeleteEmployee} handleAddTeamMember={handleAddTeamMember} handleRemoveTeamMember={handleRemoveTeamMember} isSavingEmployee={isSavingEmployee} onClose={() => setIsEditingEmployee(false)} />}
      {showOfficeModal && <OfficeSettingsModal editOfficeData={editOfficeData} setEditOfficeData={setEditOfficeData} setOfficeSettings={setOfficeSettings} workDays={workDays} setWorkDays={setWorkDays} setStatusMsg={setStatusMsg} onClose={() => setShowOfficeModal(false)} />}
      {isEditingPayroll && <EditPayrollModal editPayrollData={editPayrollData} setEditPayrollData={setEditPayrollData} handleSavePayroll={handleSavePayroll} isSavingPayroll={isSavingPayroll} onClose={() => setIsEditingPayroll(false)} />}

      <footer className="dashboard-footer">© 2026 EMS Technology</footer>
    </div>
  );
}

export default App;