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
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Updated categories filter order to match requested hierarchy
  const [exportCategory, setExportCategory] = useState<'All' | 'First Timer/Guest' | 'Revisiting/Returning Member' | 'Member'>('All');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
          setFetchError("Connection interrupted.");
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
      showToast("Session Authorized", "success");
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
      a.phone?.includes(lowerQuery) ||
      a.location?.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, attendees]);

  const stats = useMemo(() => {
    const members = attendees.filter(a => a.category === 'Member').length;
    const guests = attendees.filter(a => a.category === 'First Timer/Guest').length;
    const returning = attendees.filter(a => a.category === 'Revisiting/Returning Member').length;
    return { members, guests, returning };
  }, [attendees]);

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
      showToast("No matches for current filters.", "error");
      return;
    }

    const headers = ['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Sex', 'Age Range', 'Category', 'Location', 'Timestamp'];
    const rows = toExport.map(a => [
      `"${(a.firstName || '').replace(/"/g, '""')}"`, 
      `"${(a.lastName || '').replace(/"/g, '""')}"`, 
      `"${(a.email || '').replace(/"/g, '""')}"`, 
      `"${(a.phone || '').replace(/"/g, '""')}"`, 
      `"${(a.sex || '').replace(/"/g, '""')}"`, 
      `"${(a.ageRange || '').replace(/"/g, '""')}"`, 
      `"${(a.category || '').replace(/"/g, '""')}"`, 
      `"${(a.location || '').replace(/"/g, '""')}"`, 
      `"${a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : 'N/A'}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tcn_attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${toExport.length} records.`);
    setIsExportModalOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-lg">
          <i className="fa-solid fa-lock text-3xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-8">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type={showPassword ? "text" : "password"}
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Password"
            className={`w-full px-6 py-4 rounded-2xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 font-bold text-center tracking-widest ${authError ? 'ring-2 ring-red-400' : ''}`}
          />
          <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl relative">
      {toast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[110] px-6 py-4 bg-white rounded-2xl shadow-2xl border border-indigo-50 flex items-center gap-4 animate-bounce-in">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-xmark'}`}></i>
          </div>
          <span className="text-sm font-black text-slate-700">{toast.message}</span>
        </div>
      )}

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsExportModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-10 animate-bounce-in">
             <h3 className="text-2xl font-black text-slate-800 mb-6">Advanced Export</h3>
             <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Category</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {(['All', 'First Timer/Guest', 'Revisiting/Returning Member', 'Member'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setExportCategory(cat)}
                        className={`py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border-2 ${
                          exportCategory === cat 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-slate-100 text-slate-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold" />
                   </div>
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                    <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold" />
                   </div>
                </div>
                <div className="p-6 bg-indigo-50 rounded-2xl flex justify-between items-center">
                   <span className="text-indigo-600 font-black text-sm uppercase">Total Matching Records</span>
                   <span className="text-2xl font-black text-indigo-700">{matchingExportCount}</span>
                </div>
                <button onClick={downloadCSV} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Export CSV Dataset</button>
             </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-white/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter">Attendance Registry</h2>
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">{attendees.length} Total</span>
              <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">{stats.members} Members</span>
              <span className="px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">{stats.guests} Guests</span>
              <span className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-purple-100">{stats.returning} Returning</span>
            </div>
          </div>
          <button onClick={() => setIsExportModalOpen(true)} className="px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3">
             <i className="fa-solid fa-download"></i> Smart Export
          </button>
        </div>

        <div className="relative mb-10">
           <i className="fa-solid fa-magnifying-glass absolute left-8 top-1/2 -translate-y-1/2 text-slate-300"></i>
           <input 
              type="text" 
              placeholder="Filter by name, location, or phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-8 py-6 rounded-3xl bg-slate-50 border-none outline-none font-bold text-slate-700 placeholder:text-slate-300"
           />
        </div>

        <div className="overflow-x-auto rounded-[2rem] border border-slate-50 shadow-sm bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-10 py-6">Participant</th>
                <th className="px-10 py-6">Demographics</th>
                <th className="px-10 py-6">Origin</th>
                <th className="px-10 py-6">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAttendees.map(a => (
                <tr key={a.id} className="hover:bg-indigo-50/20 transition-all">
                  <td className="px-10 py-7">
                    <div className="font-black text-slate-800 text-lg capitalize">{a.firstName} {a.lastName}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{a.phone}</div>
                  </td>
                  <td className="px-10 py-7">
                    <div className="flex gap-2 mb-2">
                       <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg uppercase">{a.sex}</span>
                       <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg uppercase">{a.ageRange}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">{a.email}</div>
                  </td>
                  <td className="px-10 py-7">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                       <i className="fa-solid fa-location-dot text-indigo-300 text-xs"></i>
                       {a.location}
                    </div>
                  </td>
                  <td className="px-10 py-7">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                      a.category === 'Member' ? 'bg-indigo-50 text-indigo-600' : 
                      a.category === 'First Timer/Guest' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {a.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;