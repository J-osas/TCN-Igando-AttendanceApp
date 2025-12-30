import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

const ADMIN_PASSWORD = 'IGANDO_ADMIN_2025';

const AdminDashboard: React.FC = () => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI States for custom Modals and Toast
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Export Filter States
  const [exportCategory, setExportCategory] = useState<'All' | 'Member' | 'First Timer/Guest'>('All');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Real-time synchronization listener
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      setFetchError(null);
      
      const attendanceRef = collection(db, 'attendance');
      const q = query(attendanceRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAttendees(data);
          setLoading(false);
        }, 
        (error) => {
          console.error("Firestore snapshot error:", error);
          setFetchError("Synchronization interrupted. Please check your connection.");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError(false);
      showToast("Access Authorized", "success");
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return attendees;
    const lowerQuery = searchQuery.toLowerCase();
    return attendees.filter(a => 
      a.firstName?.toLowerCase().includes(lowerQuery) ||
      a.lastName?.toLowerCase().includes(lowerQuery) ||
      a.email?.toLowerCase().includes(lowerQuery) ||
      a.phone?.includes(lowerQuery)
    );
  }, [searchQuery, attendees]);

  const stats = useMemo(() => {
    const members = attendees.filter(a => a.category === 'Member').length;
    const guests = attendees.length - members;
    return { members, guests };
  }, [attendees]);

  // Logic for filtered export preview count
  const matchingExportCount = useMemo(() => {
    return attendees.filter(a => {
      const matchCategory = exportCategory === 'All' || a.category === exportCategory;
      const date = a.createdAt?.toDate ? a.createdAt.toDate() : null;
      
      let matchDate = true;
      if (date) {
        if (exportStartDate) {
          const start = new Date(exportStartDate);
          start.setHours(0, 0, 0, 0);
          if (date < start) matchDate = false;
        }
        if (exportEndDate) {
          const end = new Date(exportEndDate);
          end.setHours(23, 59, 59, 999);
          if (date > end) matchDate = false;
        }
      } else if (exportStartDate || exportEndDate) {
        matchDate = false;
      }
      
      return matchCategory && matchDate;
    }).length;
  }, [attendees, exportCategory, exportStartDate, exportEndDate]);

  const initiateClearAll = () => {
    if (attendees.length === 0) {
      showToast("No records to delete.", "error");
      return;
    }
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };

  const executeClearAll = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setActionLoading(true);
    setIsDeleteModalOpen(false);

    try {
      const batchSize = 500;
      let deletedCount = 0;
      
      for (let i = 0; i < attendees.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = attendees.slice(i, i + batchSize);
        
        chunk.forEach((attendee) => {
          const docRef = doc(db, 'attendance', attendee.id);
          batch.delete(docRef);
          deletedCount++;
        });

        await batch.commit();
      }

      showToast(`Successfully wiped ${deletedCount} records.`);
    } catch (error: any) {
      console.error("Clear error:", error);
      showToast(error.message || 'Error during deletion', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadCSV = () => {
    const toExport = attendees.filter(a => {
      const matchCategory = exportCategory === 'All' || a.category === exportCategory;
      const date = a.createdAt?.toDate ? a.createdAt.toDate() : null;
      
      let matchDate = true;
      if (date) {
        if (exportStartDate) {
          const start = new Date(exportStartDate);
          start.setHours(0, 0, 0, 0);
          if (date < start) matchDate = false;
        }
        if (exportEndDate) {
          const end = new Date(exportEndDate);
          end.setHours(23, 59, 59, 999);
          if (date > end) matchDate = false;
        }
      } else if (exportStartDate || exportEndDate) {
        matchDate = false;
      }
      
      return matchCategory && matchDate;
    });

    if (toExport.length === 0) {
      showToast("No records match your selected filters.", "error");
      return;
    }

    // Individual columns for Email and Phone as requested
    const headers = ['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Category', 'Registration Date'];
    const rows = toExport.map(a => [
      `"${(a.firstName || '').replace(/"/g, '""')}"`, 
      `"${(a.lastName || '').replace(/"/g, '""')}"`, 
      `"${(a.email || '').replace(/"/g, '""')}"`, 
      `"${(a.phone || '').replace(/"/g, '""')}"`, 
      `"${(a.category || '').replace(/"/g, '""')}"`, 
      `"${a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : 'N/A'}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tcn_igando_attendance_${exportCategory.replace(/\//g, '-')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${toExport.length} records successfully.`);
    setIsExportModalOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 animate-fade-in border border-white/60 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-lg">
          <i className="fa-solid fa-shield-halved text-3xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Admin Security</h2>
        <p className="text-slate-400 text-sm mb-8 font-medium">Identify yourself to access the database.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <input
              type={showPassword ? "text" : "password"}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="System Password"
              className={`w-full px-6 py-4 rounded-2xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all border-none font-bold text-center tracking-widest ${authError ? 'ring-2 ring-red-400' : ''}`}
              autoFocus
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          {authError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Incorrect credentials</p>}
          <button
            type="submit"
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl active:scale-95 uppercase tracking-widest"
          >
            Authorize Access
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[110] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 animate-bounce-in ${
          toast.type === 'success' ? 'bg-white border-green-100 text-green-700' : 'bg-white border-red-100 text-red-700'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            toast.type === 'success' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'} text-sm`}></i>
          </div>
          <span className="text-sm font-black tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Export Options Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={() => setIsExportModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl p-10 overflow-hidden animate-bounce-in">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            
            <div className="flex justify-between items-start mb-8">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center rotate-3">
                <i className="fa-solid fa-file-export text-3xl"></i>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 mb-2">Export Filters</h3>
            <p className="text-slate-400 font-medium mb-8 text-sm">Configure your CSV file content below.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">By Category</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['All', 'Member', 'First Timer/Guest'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setExportCategory(cat)}
                      className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-2 ${
                        exportCategory === cat 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none text-slate-600 font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 outline-none text-slate-600 font-bold text-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Size</p>
                  <p className="text-slate-700 font-black text-2xl">{matchingExportCount} <span className="text-slate-400 text-sm font-bold">Records</span></p>
                </div>
                <div className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <i className="fa-solid fa-list-check text-lg"></i>
                </div>
              </div>
              
              <button
                onClick={downloadCSV}
                disabled={matchingExportCount === 0}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
              >
                Download CSV Dataset
              </button>
              
              <button
                onClick={() => {
                  setExportCategory('All');
                  setExportStartDate('');
                  setExportEndDate('');
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Prominent Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-fade-in" onClick={() => !actionLoading && setIsDeleteModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] p-12 overflow-hidden animate-bounce-in border-4 border-red-50">
            <div className="absolute top-0 left-0 w-full h-3 bg-red-600"></div>
            
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mb-10 rotate-6 shadow-xl shadow-red-50/50">
              <i className="fa-solid fa-triangle-exclamation text-4xl"></i>
            </div>
            
            <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Irreversible Action</h3>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed text-lg">
              You are about to <span className="text-red-600 font-black">WIPE</span> the entire database of <span className="bg-red-50 px-2 py-1 rounded-lg text-red-600 font-black">{attendees.length} check-ins</span>.
            </p>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Type "DELETE" to confirm</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="DELETE"
                  className="w-full px-8 py-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-red-100 text-red-600 outline-none transition-all font-black text-center text-xl tracking-[0.5em] placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-200"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase tracking-widest text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={executeClearAll}
                  disabled={deleteConfirmText !== 'DELETE'}
                  className="flex-[2] py-6 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all shadow-2xl shadow-red-200 active:scale-95 disabled:opacity-30 disabled:grayscale uppercase tracking-widest text-sm"
                >
                  Wipe Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-white/60 animate-fade-in">
        {/* Header & Stats */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
          <div>
            <h2 className="text-5xl font-black text-slate-800 tracking-tighter">Database Management</h2>
            <div className="flex flex-wrap items-center gap-4 mt-6">
              <div className="flex items-center gap-3 bg-indigo-50 px-5 py-2.5 rounded-full border border-indigo-100">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">{attendees.length} Records</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 px-5 py-2.5 rounded-full border border-emerald-100">
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">{stats.members} Members</span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 px-5 py-2.5 rounded-full border border-amber-100">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">{stats.guests} Guests</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 w-full lg:w-auto">
            <button 
              onClick={() => setIsExportModalOpen(true)} 
              className="flex-1 lg:flex-none p-5 px-8 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all text-[11px] flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <i className="fa-solid fa-file-csv text-lg"></i> Filtered Export
            </button>
            <button 
              onClick={initiateClearAll} 
              disabled={actionLoading || attendees.length === 0} 
              className="flex-1 lg:flex-none p-5 px-8 bg-red-50 text-red-600 rounded-2xl font-black hover:bg-red-100 transition-all text-[11px] flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
            >
              {actionLoading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-trash-can"></i>} Clear All
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="mb-8 p-6 bg-red-50 border-2 border-red-100 text-red-600 rounded-[2rem] text-sm font-bold flex items-center gap-4 animate-shake">
            <i className="fa-solid fa-circle-exclamation text-xl"></i>
            {fetchError}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-12 group">
          <i className="fa-solid fa-magnifying-glass absolute left-10 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-all text-xl"></i>
          <input 
            type="text" 
            placeholder="Search by name, email or mobile..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-20 pr-10 py-8 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white text-slate-700 outline-none transition-all font-bold placeholder:text-slate-300 shadow-inner text-xl"
          />
        </div>

        {/* Table Container */}
        <div className="overflow-hidden border border-slate-100 rounded-[2.5rem] bg-white shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                <tr>
                  <th className="px-12 py-8">Participant</th>
                  <th className="px-12 py-8">Contact Info</th>
                  <th className="px-12 py-8">Classification</th>
                  <th className="px-12 py-8">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!loading && filteredAttendees.map(a => (
                  <tr key={a.id} className="hover:bg-indigo-50/30 transition-all duration-300 group">
                    <td className="px-12 py-8">
                      <div className="font-black text-slate-800 text-lg capitalize">{a.firstName} {a.lastName}</div>
                    </td>
                    <td className="px-12 py-8">
                      <div className="text-sm font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">{a.email}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-2 flex items-center gap-3">
                        <i className="fa-solid fa-mobile-screen-button text-[10px]"></i> {a.phone}
                      </div>
                    </td>
                    <td className="px-12 py-8">
                      <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest inline-block ${a.category === 'Member' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        {a.category}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-[11px] font-bold text-slate-400 whitespace-nowrap">
                      {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                      <div className="text-[10px] text-slate-300 mt-1">{a.createdAt?.toDate ? a.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </td>
                  </tr>
                ))}
                
                {(loading || actionLoading) && <tr><td colSpan={4} className="py-52 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                       <i className="fa-solid fa-circle-notch animate-spin text-7xl text-indigo-100"></i>
                       <i className="fa-solid fa-database absolute inset-0 flex items-center justify-center text-indigo-300 text-xl"></i>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Synching with Cloud</p>
                  </div>
                </td></tr>}

                {!loading && !actionLoading && filteredAttendees.length === 0 && (
                  <tr><td colSpan={4} className="py-52 text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-200 rotate-6 shadow-inner">
                        <i className="fa-solid fa-folder-open text-5xl"></i>
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-300">No Records Found</h4>
                        <p className="text-[11px] font-black text-slate-200 uppercase tracking-widest mt-2">Adjust your filters or search terms</p>
                      </div>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;