import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import QRCode from 'qrcode';

const ADMIN_PASSWORD = 'IGANDO_ADMIN_2025';

const AdminDashboard: React.FC = () => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [qrScans, setQrScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Dashboard Filters
  const [filterSex, setFilterSex] = useState<string>('All');
  const [filterAge, setFilterAge] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');

  // Export Modal Specific Filters
  const [exportSex, setExportSex] = useState<string>('All');
  const [exportAge, setExportAge] = useState<string>('All');
  const [exportCategory, setExportCategory] = useState<string>('All');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      
      const attendanceRef = collection(db, 'attendance');
      const q = query(attendanceRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAttendees(data);
        setLastUpdated(new Date());
        setLoading(false);
      }, (error) => {
        console.error("Attendance Sync Error:", error);
        setLoading(false);
        showToast("Sync Error: Missing Permissions", "error");
      });

      const scansRef = collection(db, 'qr_scans');
      const qScans = query(scansRef, orderBy('timestamp', 'desc'));
      const unsubscribeScans = onSnapshot(qScans, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setQrScans(data);
      }, (error) => {
        console.error("QR Scans Sync Error:", error);
        showToast("QR Analytics: Missing Permissions", "error");
      });

      return () => {
        unsubscribe();
        unsubscribeScans();
      };
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      showToast("Access Granted", "success");
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const stats = useMemo(() => ({
    total: attendees.length,
    guests: attendees.filter(a => a.category === 'First Timer/Guest').length,
    returning: attendees.filter(a => a.category === 'Revisiting/Returning Member').length,
    members: attendees.filter(a => a.category === 'Member').length,
    qrTotal: qrScans.length,
    qrMobile: qrScans.filter(s => s.device === 'Mobile').length,
    qrDesktop: qrScans.filter(s => s.device === 'Desktop').length,
  }), [attendees, qrScans]);

  const filteredAttendees = useMemo(() => {
    return attendees.filter(a => {
      const matchesSearch = !searchQuery.trim() || 
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.phone?.includes(searchQuery);
      
      const matchesSex = filterSex === 'All' || a.sex === filterSex;
      const matchesAge = filterAge === 'All' || a.ageRange === filterAge;
      const matchesCategory = filterCategory === 'All' || a.category === filterCategory;
      const matchesLocation = filterLocation === 'All' || a.location === filterLocation;

      return matchesSearch && matchesSex && matchesAge && matchesCategory && matchesLocation;
    });
  }, [attendees, searchQuery, filterSex, filterAge, filterCategory, filterLocation]);

  const handleOpenExport = () => {
    setExportSex(filterSex);
    setExportAge(filterAge);
    setExportCategory(filterCategory);
    setShowExportModal(true);
  };

  const handleClearAllData = async () => {
    if (confirmDeleteText.toUpperCase() !== 'DELETE') return;
    setIsClearing(true);
    setShowClearModal(false);
    try {
      const deletePromises = attendees.map(attendee => deleteDoc(doc(db, 'attendance', attendee.id)));
      await Promise.all(deletePromises);
      showToast(`Successfully cleared ${attendees.length} records`, "success");
      setConfirmDeleteText('');
    } catch (error) {
      showToast("Failed to clear database", "error");
    } finally {
      setIsClearing(false);
    }
  };

  const downloadCSV = async () => {
    if (loading || exporting) return;
    const dataToExport = attendees.filter(a => {
      const dateObj = a.createdAt?.toDate ? a.createdAt.toDate() : null;
      const matchesSex = exportSex === 'All' || a.sex === exportSex;
      const matchesAge = exportAge === 'All' || a.ageRange === exportAge;
      const matchesCategory = exportCategory === 'All' || a.category === exportCategory;
      let matchesDate = true;
      if (dateObj) {
        if (exportStartDate) {
          const start = new Date(exportStartDate);
          start.setHours(0, 0, 0, 0);
          if (dateObj < start) matchesDate = false;
        }
        if (exportEndDate) {
          const end = new Date(exportEndDate);
          end.setHours(23, 59, 59, 999);
          if (dateObj > end) matchesDate = false;
        }
      } else if (exportStartDate || exportEndDate) {
        matchesDate = false;
      }
      return matchesSex && matchesAge && matchesCategory && matchesDate;
    });

    if (dataToExport.length === 0) {
      showToast("No records match export criteria", "error");
      return;
    }

    setExporting(true);
    setShowExportModal(false);

    try {
      const escapeCsv = (val: any) => {
        if (val === undefined || val === null) return '""';
        return `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      };

      const columns = [
        { label: 'First Name', key: 'firstName' },
        { label: 'Last Name', key: 'lastName' },
        { label: 'Email Address', key: 'email' },
        { label: 'Phone Number', key: 'phone' },
        { label: 'Sex', key: 'sex' },
        { label: 'Age Range', key: 'ageRange' },
        { label: 'Category', key: 'category' },
        { label: 'Location', key: 'location' },
        { label: 'Reg Date', key: 'date' },
        { label: 'Reg Time', key: 'time' },
      ];

      const csvRows: string[] = [];
      csvRows.push(columns.map(col => escapeCsv(col.label)).join(','));
      dataToExport.forEach(a => {
        const dateObj = a.createdAt?.toDate ? a.createdAt.toDate() : null;
        const rowData = {
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          sex: a.sex,
          ageRange: a.ageRange,
          category: a.category,
          location: a.location,
          date: dateObj ? dateObj.toLocaleDateString('en-GB') : 'N/A',
          time: dateObj ? dateObj.toLocaleTimeString('en-GB') : 'N/A',
        };
        csvRows.push(columns.map(col => escapeCsv(rowData[col.key as keyof typeof rowData])).join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `TCN_Export_${new Date().getTime()}.csv`);
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${dataToExport.length} attendees`);
    } catch (err) {
      showToast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadQR = async (format: 'png' | 'svg') => {
    const url = `${window.location.origin}/?src=qr`;
    try {
      if (format === 'png') {
        const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2 });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'TCN_Igando_QR.png';
        link.click();
      } else {
        const svgString = await QRCode.toString(url, { type: 'svg', margin: 2 });
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'TCN_Igando_QR.svg';
        link.click();
        URL.revokeObjectURL(downloadUrl);
      }
      showToast(`Downloaded QR as ${format.toUpperCase()}`);
    } catch (err) {
      showToast("QR generation failed", "error");
    }
  };

  const StatCard = ({ title, count, colorClass, icon, bgGradient }: { title: string, count: number, colorClass: string, icon: string, bgGradient: string }) => (
    <div className={`relative bg-white p-4 md:p-6 rounded-[0.6em] shadow-xl overflow-hidden group transition-all hover:-translate-y-1 hover:shadow-2xl`}>
      <div className={`absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 -mr-6 md:-mr-8 -mt-6 md:-mt-8 rounded-[0.6em] blur-2xl md:blur-3xl opacity-10 ${bgGradient}`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] md:tracking-[0.2em] mb-1">{title}</p>
          <h3 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">{count.toLocaleString()}</h3>
        </div>
        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-[0.6em] flex items-center justify-center bg-slate-50 text-slate-400 shadow-inner group-hover:bg-white group-hover:scale-110 transition-transform duration-500`}>
          <i className={`fa-solid ${icon} text-sm md:text-xl ${colorClass}`}></i>
        </div>
      </div>
      <div className={`mt-3 md:mt-4 h-0.5 md:h-1 w-8 md:w-12 rounded-[0.6em] ${bgGradient.split(' ')[0]}`}></div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="w-[96%] md:w-full max-w-md bg-white rounded-[0.6em] shadow-2xl p-6 md:p-10 text-center relative overflow-hidden border border-white/60 mx-auto mt-12 md:mt-20">
        <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-50 text-indigo-600 rounded-[0.6em] flex items-center justify-center mx-auto mb-6 md:mb-8 rotate-6 shadow-xl border-4 border-white">
          <i className="fa-solid fa-vault text-2xl md:text-4xl"></i>
        </div>
        <h2 className="text-xl md:text-3xl font-black text-slate-800 mb-1 md:mb-2 tracking-tighter">Command Center</h2>
        <p className="text-slate-400 font-medium mb-6 md:mb-10 text-xs md:text-sm">Enter the system clearance password</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 md:px-8 py-4 md:py-5 rounded-[0.6em] bg-slate-50 text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 font-black text-center tracking-[0.3em] md:tracking-[0.5em] text-lg md:text-xl transition-all ${authError ? 'ring-4 ring-red-100 border-red-200' : 'border-slate-100'}`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500"><i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>
          <button type="submit" className="w-full py-4 md:py-5 bg-[#5C6BC0] text-white rounded-[0.6em] font-black uppercase tracking-widest shadow-xl transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-xs md:text-base">
            <i className="fa-solid fa-fingerprint text-lg md:text-xl"></i> Verify Identity
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-[96%] md:w-full max-w-7xl relative px-2 md:px-4 pb-20 mx-auto">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] px-4 md:px-8 py-3 md:py-4 bg-white/90 backdrop-blur-md rounded-[0.6em] shadow-xl border border-white flex items-center gap-3 animate-bounce-in">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-xmark'}`}></i>
          </div>
          <span className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* Modals for Export and Clear */}
      {showExportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl p-6 bg-white rounded-[0.6em] shadow-2xl border border-white max-h-[90vh] overflow-y-auto">
             <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl md:text-3xl font-black text-slate-900">Export Filter</h3>
              <button onClick={() => setShowExportModal(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600" />
                <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full px-5 py-4 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={exportSex} onChange={(e) => setExportSex(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600"><option value="All">All Genders</option><option value="Male">Male</option><option value="Female">Female</option></select>
                <select value={exportCategory} onChange={(e) => setExportCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600"><option value="All">All Categories</option><option value="First Timer/Guest">First Timer</option><option value="Revisiting/Returning Member">Returning</option><option value="Member">Member</option></select>
                <select value={exportAge} onChange={(e) => setExportAge(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600"><option value="All">All Ages</option><option value="under 19">under 19</option><option value="19-26">19-26</option><option value="27-36">27-36</option><option value="37-45">37-45</option><option value="46-55">46-55</option><option value="55 and above">55 and above</option></select>
              </div>
              <div className="pt-8 flex gap-3">
                <button onClick={() => setShowExportModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[0.6em] font-black uppercase">Cancel</button>
                <button onClick={downloadCSV} className="flex-[2] py-4 bg-indigo-600 text-white rounded-[0.6em] font-black uppercase shadow-xl shadow-indigo-100"><i className="fa-solid fa-file-csv mr-2"></i> Download CSV</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md p-8 bg-white rounded-[0.6em] shadow-2xl border border-white text-center">
            <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-4"></i>
            <h3 className="text-2xl font-black text-slate-900">System Purge</h3>
            <p className="text-slate-400 text-xs font-bold mt-2 uppercase">Permanently delete {attendees.length} records?</p>
            <input type="text" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)} placeholder='Type "DELETE"' className="w-full mt-6 px-5 py-4 bg-slate-50 rounded-[0.6em] border-2 border-slate-100 font-black text-center" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowClearModal(false); setConfirmDeleteText(''); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[0.6em] font-black uppercase">Abort</button>
              <button disabled={confirmDeleteText.toUpperCase() !== 'DELETE'} onClick={handleClearAllData} className="flex-[2] py-4 bg-red-500 text-white rounded-[0.6em] font-black uppercase disabled:opacity-30">Confirm Purge</button>
            </div>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase animate-pulse">Live Feed</span>
            <p className="text-slate-400 text-xs font-bold">Synced: {lastUpdated.toLocaleTimeString()}</p>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">Admin <span className="text-indigo-600">Area</span></h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleOpenExport} 
            disabled={exporting || attendees.length === 0} 
            className="flex-1 md:w-auto px-8 py-4 bg-slate-900 text-white rounded-[0.6em] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-cloud-arrow-down"></i>
            <span>Export</span>
          </button>
          <button 
            onClick={() => setShowClearModal(true)} 
            disabled={isClearing || attendees.length === 0} 
            className="flex-1 md:w-auto px-8 py-4 bg-red-500 text-white rounded-[0.6em] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fa-solid fa-trash-can"></i>
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* QR Hub & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-1 bg-white p-8 rounded-[0.6em] shadow-xl border border-white flex flex-col items-center justify-center text-center">
           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-[0.6em] flex items-center justify-center mb-4">
              <i className="fa-solid fa-qrcode text-2xl"></i>
           </div>
           <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Check-in QR</h3>
           <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6 leading-relaxed">Scan to access the registration portal</p>
           
           <div className="p-4 bg-slate-50 rounded-[0.6em] border-2 border-dashed border-slate-200 mb-6 group cursor-pointer relative overflow-hidden transition-all hover:bg-white hover:border-indigo-200">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?src=qr')}`} 
                alt="Registration QR" 
                className="w-32 h-32 md:w-40 md:h-40 relative z-10"
              />
              <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <i className="fa-solid fa-magnifying-glass-plus text-indigo-600/20 text-4xl"></i>
              </div>
           </div>

           <div className="flex gap-2 w-full">
              <button onClick={() => handleDownloadQR('png')} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-[0.6em] font-black uppercase text-[10px] hover:bg-slate-200 transition-colors">PNG</button>
              <button onClick={() => handleDownloadQR('svg')} className="flex-1 py-3 bg-slate-900 text-white rounded-[0.6em] font-black uppercase text-[10px] hover:bg-indigo-600 transition-colors">SVG</button>
           </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-indigo-600 p-8 rounded-[0.6em] shadow-xl relative overflow-hidden text-white group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-12 -mt-12 rounded-full blur-3xl transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total QR Interactions</p>
                    <h4 className="text-5xl font-black tracking-tighter">{stats.qrTotal.toLocaleString()}</h4>
                 </div>
                 <div className="w-12 h-12 bg-white/20 rounded-[0.6em] flex items-center justify-center backdrop-blur-md">
                    <i className="fa-solid fa-bolt text-xl"></i>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-end border-b border-indigo-400/30 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Device Health</span>
                    <span className="text-xs font-black">Live Pulse</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-black uppercase opacity-60">Mobile</p>
                       <p className="text-xl font-black">{stats.qrMobile.toLocaleString()}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black uppercase opacity-60">Desktop</p>
                       <p className="text-xl font-black">{stats.qrDesktop.toLocaleString()}</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[0.6em] shadow-xl border border-white flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-[0.6em] flex items-center justify-center"><i className="fa-solid fa-chart-simple"></i></div>
                 <h4 className="font-black text-slate-800 uppercase tracking-widest text-[11px]">Usage Metrics</h4>
              </div>
              <div className="space-y-6 flex-1">
                 <div>
                    <div className="flex justify-between mb-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase">Mobile Engagement</span>
                       <span className="text-[10px] font-black text-indigo-600">{stats.qrTotal ? Math.round((stats.qrMobile / stats.qrTotal) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${stats.qrTotal ? (stats.qrMobile / stats.qrTotal) * 100 : 0}%` }}></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between mb-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase">Desktop Engagement</span>
                       <span className="text-[10px] font-black text-slate-600">{stats.qrTotal ? Math.round((stats.qrDesktop / stats.qrTotal) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-400 transition-all duration-1000" style={{ width: `${stats.qrTotal ? (stats.qrDesktop / stats.qrTotal) * 100 : 0}%` }}></div>
                    </div>
                 </div>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-50 flex justify-center">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Real-time Scan Telemetry</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-12">
        <StatCard title="Total Registry" count={stats.total} colorClass="text-indigo-500" icon="fa-chart-pie" bgGradient="bg-indigo-500" />
        <StatCard title="First-Time Guests" count={stats.guests} colorClass="text-orange-500" icon="fa-fire" bgGradient="bg-orange-500" />
        <StatCard title="Returning Members" count={stats.returning} colorClass="text-purple-500" icon="fa-heart" bgGradient="bg-purple-500" />
        <StatCard title="Active Members" count={stats.members} colorClass="text-emerald-500" icon="fa-id-badge" bgGradient="bg-emerald-500" />
        <StatCard title="Total QR Scans" count={stats.qrTotal} colorClass="text-blue-500" icon="fa-bolt" bgGradient="bg-blue-500" />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[0.6em] shadow-xl p-4 md:p-8 border border-white">
        <div className="flex flex-col lg:flex-row gap-4 mb-10">
          <div className="flex-1 relative group">
             <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
             <input type="text" placeholder="Search by name, email or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-16 pr-8 py-5 rounded-[0.6em] bg-slate-100/50 border-2 border-transparent outline-none font-bold text-slate-800 focus:bg-white focus:border-indigo-100 shadow-inner transition-all" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:w-2/3">
             {[
               { value: filterSex, setter: setFilterSex, options: ['All Sex', 'Male', 'Female'], icon: 'fa-venus-mars' },
               { value: filterAge, setter: setFilterAge, options: ['All Ages', 'under 19', '19-26', '27-36', '37-45', '46-55', '55 and above'], icon: 'fa-cake-candles' },
               { value: filterCategory, setter: setFilterCategory, options: ['All Categories', 'First Timer/Guest', 'Revisiting/Returning Member', 'Member'], icon: 'fa-layer-group' },
               { value: filterLocation, setter: setFilterLocation, options: ['All Locations', 'OJO', 'IBA', 'AGBARA', 'IGANDO', 'AKESAN', 'IYANA-IPAJA', 'IKOTUN', 'IJEGUN', 'OKE-ODO', 'AYOBO-IPAJA', 'EGBEDA/AKOWONJO', 'IYANA ERA', 'AMUWO ODOFIN'], icon: 'fa-map-pin' }
             ].map((f, i) => (
               <div key={i} className="relative"><select value={f.value} onChange={(e) => f.setter(e.target.value)} className="w-full pl-10 pr-4 py-4 rounded-[0.6em] bg-white border-2 border-slate-100 outline-none font-bold text-slate-600 text-[10px] appearance-none cursor-pointer hover:border-indigo-100">{f.options.map(o => <option key={o} value={o === f.options[0] ? 'All' : o}>{o}</option>)}</select><i className={`fa-solid ${f.icon} absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]`}></i></div>
             ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-[0.6em] border border-slate-100 bg-white shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50">Attendee Name</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50">Email Address</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50">Phone Number</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50 text-center">Demographics</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50 whitespace-nowrap">Category</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] border-r border-slate-800/50 whitespace-nowrap">Location</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.15em] text-right">Registration Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && filteredAttendees.map((a) => (
                <tr key={a.id} className="group hover:bg-indigo-50/40 transition-all duration-200">
                  <td className="px-6 py-5 border-r border-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[0.6em] bg-indigo-50 text-indigo-400 flex items-center justify-center font-black text-xs group-hover:bg-white transition-colors">
                        {a.firstName?.[0]}{a.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 capitalize text-sm">{a.firstName} {a.lastName}</p>
                        <p className="text-[9px] font-black text-slate-300 uppercase">{a.sex}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-r border-slate-50/50">
                    <p className="text-sm font-medium text-slate-600 truncate max-w-[200px]">{a.email}</p>
                  </td>
                  <td className="px-6 py-5 border-r border-slate-50/50">
                    <p className="text-sm font-mono font-bold text-indigo-400">{a.phone}</p>
                  </td>
                  <td className="px-6 py-5 border-r border-slate-50/50 text-center">
                    <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-[0.6em] text-[10px] font-black uppercase group-hover:bg-white">
                      {a.ageRange}
                    </span>
                  </td>
                  <td className="px-6 py-5 border-r border-slate-50/50">
                    <span className={`whitespace-nowrap px-3 py-1 rounded-[0.6em] text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                      a.category === 'Member' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                      a.category === 'First Timer/Guest' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                      'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                      {a.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 border-r border-slate-50/50">
                    <p className="text-sm font-bold text-slate-600 whitespace-nowrap truncate max-w-[180px]">{a.location}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-[11px] font-black text-slate-800">
                      {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '--'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={7} className="py-48 text-center"><div className="flex flex-col items-center gap-6"><div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Refreshing Registry...</p></div></td></tr>}
              {!loading && filteredAttendees.length === 0 && <tr><td colSpan={7} className="py-48 text-center text-slate-300 text-xl font-black uppercase">Zero Records Found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;