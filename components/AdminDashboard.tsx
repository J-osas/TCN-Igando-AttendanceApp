import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

const ADMIN_PASSWORD = 'IGANDO_ADMIN_2025';

const AdminDashboard: React.FC = () => {
  const [attendees, setAttendees] = useState<any[]>([]);
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
        console.error("Firestore error:", error);
        setLoading(false);
        showToast("Database connection error", "error");
      });
      return () => unsubscribe();
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

  const stats = useMemo(() => {
    return {
      total: attendees.length,
      guests: attendees.filter(a => a.category === 'First Timer/Guest').length,
      returning: attendees.filter(a => a.category === 'Revisiting/Returning Member').length,
      members: attendees.filter(a => a.category === 'Member').length,
    };
  }, [attendees]);

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
      const deletePromises = attendees.map(attendee => 
        deleteDoc(doc(db, 'attendance', attendee.id))
      );
      
      await Promise.all(deletePromises);
      showToast(`Successfully cleared ${attendees.length} records`, "success");
      setConfirmDeleteText('');
    } catch (error) {
      console.error("Clear data error:", error);
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
        const str = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${str}"`;
      };

      const columns = [
        { label: 'First Name', key: 'firstName' },
        { label: 'Last Name', key: 'lastName' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
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
        const row = columns.map(col => escapeCsv(rowData[col.key as keyof typeof rowData]));
        csvRows.push(row.join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `TCN_Export_${timestamp}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast(`Exported ${dataToExport.length} attendees`);
    } catch (err) {
      console.error("Export Error:", err);
      showToast("Export failed", "error");
    } finally {
      setExporting(false);
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
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <button type="submit" className="w-full py-4 md:py-5 bg-[#5C6BC0] text-white rounded-[0.6em] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-xs md:text-base">
            <i className="fa-solid fa-fingerprint text-lg md:text-xl"></i> Verify Identity
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-[96%] md:w-full max-w-7xl relative px-2 md:px-4 pb-20 mx-auto">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[110] px-4 md:px-8 py-3 md:py-4 bg-white/90 backdrop-blur-md rounded-[0.6em] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white flex items-center gap-3 md:gap-4 animate-bounce-in">
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-[0.6em] flex items-center justify-center shadow-lg ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-xmark'} text-base md:text-lg`}></i>
          </div>
          <span className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">{toast.message}</span>
        </div>
      )}

      {/* Export Configuration Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 overflow-hidden bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl p-6 md:p-10 bg-white rounded-[0.6em] shadow-2xl border border-white transform transition-all animate-bounce-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Export Filter</h3>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Configure export criteria</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 md:w-12 md:h-12 rounded-[0.6em] bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Date Range (Optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input 
                      type="date" 
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 rounded-[0.6em] border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-slate-600"
                    />
                    <span className="absolute -top-2 left-3 px-1 bg-white text-[8px] font-black text-slate-300 uppercase">From</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 rounded-[0.6em] border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 font-bold text-slate-600"
                    />
                    <span className="absolute -top-2 left-3 px-1 bg-white text-[8px] font-black text-slate-300 uppercase">To</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Sex Filter</span>
                  <select 
                    value={exportSex} 
                    onChange={(e) => setExportSex(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600 outline-none"
                  >
                    <option value="All">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Category</span>
                  <select 
                    value={exportCategory} 
                    onChange={(e) => setExportCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600 outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="First Timer/Guest">First Timer</option>
                    <option value="Revisiting/Returning Member">Returning</option>
                    <option value="Member">Member</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Age Range</span>
                  <select 
                    value={exportAge} 
                    onChange={(e) => setExportAge(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-[0.6em] border border-slate-100 font-bold text-slate-600 outline-none"
                  >
                    <option value="All">All Ages</option>
                    <option value="under 19">under 19</option>
                    <option value="19-26">19-26</option>
                    <option value="27-36">27-36</option>
                    <option value="37-45">37-45</option>
                    <option value="46-55">46-55</option>
                    <option value="55 and above">55 and above</option>
                  </select>
                </div>
              </div>

              <div className="pt-8 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[0.6em] font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={downloadCSV}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-[0.6em] font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all"
                >
                  <i className="fa-solid fa-file-csv"></i> Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Purge) */}
      {showClearModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 overflow-hidden bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md p-8 bg-white rounded-[0.6em] shadow-2xl border border-white transform transition-all animate-bounce-in">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[0.6em] flex items-center justify-center text-2xl shadow-inner">
                <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">System Purge</h3>
                <p className="text-slate-400 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed">
                  You are about to permanently delete <span className="text-red-500">{attendees.length}</span> records. This action cannot be undone.
                </p>
              </div>
              
              <div className="w-full pt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-left ml-2">Type "DELETE" to confirm</p>
                <input 
                  type="text" 
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="Type here..."
                  className="w-full px-5 py-4 bg-slate-50 rounded-[0.6em] border-2 border-slate-100 outline-none focus:border-red-200 transition-all font-black text-center tracking-widest text-slate-700"
                />
              </div>

              <div className="flex gap-3 w-full pt-4">
                <button 
                  onClick={() => { setShowClearModal(false); setConfirmDeleteText(''); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-[0.6em] font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors"
                >
                  Abort
                </button>
                <button 
                  disabled={confirmDeleteText.toUpperCase() !== 'DELETE'}
                  onClick={handleClearAllData}
                  className="flex-[2] py-4 bg-red-500 text-white rounded-[0.6em] font-black uppercase tracking-widest text-[10px] hover:bg-red-600 shadow-xl shadow-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Confirm Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6 mb-8 md:mb-10">
        <div>
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <span className="px-2 md:px-3 py-0.5 md:py-1 bg-indigo-100 text-indigo-600 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest animate-pulse whitespace-nowrap">Live Feed</span>
            <p className="text-slate-400 text-[9px] md:text-xs font-bold">Synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter">Admin <span className="text-indigo-600">Area</span></h2>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button 
            onClick={handleOpenExport} 
            disabled={exporting || isClearing || attendees.length === 0}
            className={`group relative w-full md:w-auto px-6 md:px-8 py-3 md:py-4 text-white rounded-[0.6em] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-3 overflow-hidden text-[10px] md:text-sm ${
              exporting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-indigo-600'
            }`}
          >
             <span className="relative z-10 flex items-center gap-2 md:gap-3">
               <i className={`fa-solid ${exporting ? 'fa-circle-notch animate-spin' : 'fa-cloud-arrow-down'} text-sm md:text-lg`}></i> 
               {exporting ? 'Generating...' : 'Export Filter'}
             </span>
             <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          <button 
            onClick={() => setShowClearModal(true)}
            disabled={exporting || isClearing || attendees.length === 0}
            className={`group relative w-full md:w-auto px-6 md:px-8 py-3 md:py-4 text-white rounded-[0.6em] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-3 overflow-hidden text-[10px] md:text-sm ${
              isClearing ? 'bg-red-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
             <span className="relative z-10 flex items-center gap-2 md:gap-3">
               <i className={`fa-solid ${isClearing ? 'fa-circle-notch animate-spin' : 'fa-trash-can'} text-sm md:text-lg`}></i> 
               {isClearing ? 'Purging...' : 'Clear All'}
             </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-12">
        <StatCard title="Total Registry" count={stats.total} colorClass="text-indigo-500" icon="fa-chart-pie" bgGradient="bg-indigo-500" />
        <StatCard title="First-Time Guests" count={stats.guests} colorClass="text-orange-500" icon="fa-fire" bgGradient="bg-orange-500" />
        <StatCard title="Returning Members" count={stats.returning} colorClass="text-purple-500" icon="fa-heart" bgGradient="bg-purple-500" />
        <StatCard title="Active Members" count={stats.members} colorClass="text-emerald-500" icon="fa-id-badge" bgGradient="bg-emerald-500" />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[0.6em] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-4 md:p-12 border border-white relative overflow-hidden">
        <div className="space-y-4 md:space-y-6 mb-8 md:mb-12">
          <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative group">
               <i className="fa-solid fa-magnifying-glass absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors text-base md:text-xl"></i>
               <input 
                  type="text" 
                  placeholder="Quick search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 md:pl-16 pr-6 md:pr-8 py-4 md:py-6 rounded-[0.6em] bg-slate-100/50 border-2 border-transparent outline-none font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50 transition-all text-base md:text-xl shadow-inner"
               />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 lg:w-2/3">
               {[
                 { value: filterSex, setter: setFilterSex, options: ['All Sex', 'Male', 'Female'], icon: 'fa-venus-mars' },
                 { value: filterAge, setter: setFilterAge, options: ['All Ages', 'under 19', '19-26', '27-36', '37-45', '46-55', '55 and above'], icon: 'fa-cake-candles' },
                 { value: filterCategory, setter: setFilterCategory, options: ['All Categories', 'First Timer/Guest', 'Revisiting/Returning Member', 'Member'], icon: 'fa-layer-group' },
                 { value: filterLocation, setter: setFilterLocation, options: ['All Locations', 'Egbeda/Akowonjo', 'Iyana-Ipaja', 'Ikotun', 'Igando', 'Ijegun', 'Oke-Odo', 'Ayobo & Ipaja'], icon: 'fa-map-pin' }
               ].map((filter, idx) => (
                 <div key={idx} className="relative group/filter">
                   <select 
                     value={filter.value} 
                     onChange={(e) => filter.setter(e.target.value)}
                     className="w-full pl-8 md:pl-10 pr-2 md:pr-4 py-3 md:py-5 rounded-[0.6em] bg-white border-2 border-slate-100 outline-none font-bold text-slate-600 text-[9px] md:text-xs appearance-none cursor-pointer hover:border-indigo-200 hover:shadow-lg transition-all"
                   >
                     {filter.options.map(opt => <option key={opt} value={opt === filter.options[0] ? 'All' : opt}>{opt}</option>)}
                   </select>
                   <i className={`fa-solid ${filter.icon} absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300 text-[8px] md:text-[10px] pointer-events-none group-hover/filter:text-indigo-400 transition-colors`}></i>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[0.6em] border border-slate-100 bg-white/50 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1000px] md:min-w-[1200px]">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-4 md:px-8 py-6 md:py-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Full Name</th>
                <th className="px-4 md:px-8 py-6 md:py-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Contact Details</th>
                <th className="px-4 md:px-8 py-6 md:py-8 text-center text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Demographics</th>
                <th className="px-4 md:px-8 py-6 md:py-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Classification</th>
                <th className="px-4 md:px-8 py-6 md:py-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Region</th>
                <th className="px-4 md:px-8 py-6 md:py-8 text-right text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-80">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && filteredAttendees.map((a) => (
                <tr key={a.id} className="group hover:bg-indigo-50/40 transition-all duration-300">
                  <td className="px-4 md:px-8 py-4 md:py-8">
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-[0.6em] bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs md:text-lg group-hover:bg-white group-hover:text-indigo-600 transition-all shadow-inner">
                        {a.firstName?.[0]}{a.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 capitalize text-sm md:text-lg tracking-tight">{a.firstName} {a.lastName}</p>
                        <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{a.sex}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-8">
                    <div className="space-y-0.5 md:space-y-1">
                      <p className="text-[10px] md:text-sm font-bold text-slate-700">{a.email}</p>
                      <p className="text-[9px] md:text-xs font-mono font-black text-indigo-400">{a.phone}</p>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-8 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-[0.6em] text-[7px] md:text-[10px] font-black uppercase group-hover:bg-white">
                        {a.ageRange}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-8">
                    <span className={`px-2 md:px-5 py-1 md:py-2 rounded-[0.6em] text-[7px] md:text-[10px] font-black uppercase tracking-widest inline-block border shadow-sm ${
                      a.category === 'Member' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                      a.category === 'First Timer/Guest' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                    }`}>
                      {a.category}
                    </span>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-8">
                    <p className="text-[10px] md:text-sm font-black text-slate-600 group-hover:text-slate-900 transition-colors">{a.location}</p>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-8 text-right">
                    <div className="space-y-0.5 md:space-y-1">
                      <p className="text-[8px] md:text-[11px] font-black text-slate-800">
                        {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '---'}
                      </p>
                      <p className="text-[7px] md:text-[10px] font-bold text-slate-400">
                        {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
              
              {loading && (
                <tr>
                  <td colSpan={6} className="py-32 md:py-48 text-center">
                    <div className="flex flex-col items-center gap-4 md:gap-6">
                      <div className="relative">
                        <div className="w-12 h-12 md:w-20 md:h-20 border-2 md:border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <i className="fa-solid fa-satellite-dish absolute inset-0 flex items-center justify-center text-indigo-600 text-lg md:text-2xl animate-pulse"></i>
                      </div>
                      <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">Syncing Attendance Registry...</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredAttendees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-32 md:py-48 text-center">
                    <div className="flex flex-col items-center gap-6 md:gap-8 group">
                      <div className="w-20 h-20 md:w-32 md:h-32 bg-slate-50 rounded-[0.6em] flex items-center justify-center text-slate-200 group-hover:scale-110 transition-transform duration-700">
                        <i className="fa-solid fa-ghost text-4xl md:text-6xl"></i>
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-black text-slate-300 tracking-tight">Zero Matches Found</p>
                        <p className="text-slate-400 text-[8px] md:text-xs mt-1 md:mt-2 uppercase tracking-widest font-bold">Try adjusting your filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;