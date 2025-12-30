import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const ADMIN_PASSWORD = 'IGANDO_ADMIN_2025';

const AdminDashboard: React.FC = () => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Advanced Filters
  const [filterSex, setFilterSex] = useState<string>('All');
  const [filterAge, setFilterAge] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');

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
        setLoading(false);
      }, (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
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

  // Real-time Summary Stats
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

  const downloadCSV = () => {
    if (filteredAttendees.length === 0) {
      showToast("No data to export", "error");
      return;
    }

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'First Name', 'Last Name', 'Email Address', 'Phone Number', 
      'Sex', 'Age Range', 'Category', 'Location', 'Date Registered'
    ];

    const rows = filteredAttendees.map(a => [
      escapeCsv(a.firstName),
      escapeCsv(a.lastName),
      escapeCsv(a.email),
      escapeCsv(a.phone),
      escapeCsv(a.sex),
      escapeCsv(a.ageRange),
      escapeCsv(a.category),
      escapeCsv(a.location),
      escapeCsv(a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : 'N/A')
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tcn_igando_attendance_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredAttendees.length} records`);
  };

  const StatCard = ({ title, count, colorClass, icon }: { title: string, count: number, colorClass: string, icon: string }) => (
    <div className={`bg-white p-6 rounded-[2rem] shadow-xl border-l-8 ${colorClass} transition-transform hover:scale-[1.02] duration-300`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-4xl font-black text-slate-800">{count.toLocaleString()}</h3>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-400 shadow-inner`}>
          <i className={`fa-solid ${icon} text-lg`}></i>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 text-center relative overflow-hidden border border-white/60">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#5C6BC0]"></div>
        <div className="w-20 h-20 bg-indigo-50 text-[#5C6BC0] rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-lg">
          <i className="fa-solid fa-shield-halved text-3xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">Admin Terminal</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="System Password"
              className={`w-full px-6 py-4 rounded-2xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 font-bold text-center tracking-widest ${authError ? 'ring-2 ring-red-400' : ''}`}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <button type="submit" className="w-full py-5 bg-[#5C6BC0] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all hover:bg-[#4E5BA6] active:scale-95">Verify Identity</button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full lg:max-w-7xl relative px-4 pb-12">
      {toast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[110] px-6 py-4 bg-white rounded-2xl shadow-2xl border border-indigo-50 flex items-center gap-4 animate-bounce-in">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check' : 'fa-xmark'}`}></i>
          </div>
          <span className="text-sm font-black text-slate-700">{toast.message}</span>
        </div>
      )}

      {/* Summary Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Attendance" count={stats.total} colorClass="border-indigo-500" icon="fa-users-line" />
        <StatCard title="First-Time Guests" count={stats.guests} colorClass="border-orange-500" icon="fa-star" />
        <StatCard title="Returning Souls" count={stats.returning} colorClass="border-purple-500" icon="fa-rotate-left" />
        <StatCard title="Total Members" count={stats.members} colorClass="border-emerald-500" icon="fa-id-card-clip" />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 lg:p-10 border border-white/60 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tighter">Attendance Registry</h2>
            <p className="text-slate-400 font-medium mt-2">Managing check-ins for Crossover to Abundance 2026</p>
          </div>
          <button 
            onClick={downloadCSV} 
            className="w-full lg:w-auto px-8 py-5 bg-[#5C6BC0] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-[#4E5BA6] transition-all"
          >
             <i className="fa-solid fa-file-csv text-xl"></i> Export CSV
          </button>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          <div className="relative group">
             <i className="fa-solid fa-magnifying-glass absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
             <input 
                type="text" 
                placeholder="Search by name, email, or mobile..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-16 pr-8 py-6 rounded-3xl bg-slate-50 border-none outline-none font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-lg shadow-inner"
             />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <select 
               value={filterSex} 
               onChange={(e) => setFilterSex(e.target.value)}
               className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-600 text-sm appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
             >
               <option value="All">All Sex</option>
               <option value="Male">Male</option>
               <option value="Female">Female</option>
             </select>

             <select 
               value={filterAge} 
               onChange={(e) => setFilterAge(e.target.value)}
               className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-600 text-sm appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
             >
               <option value="All">All Ages</option>
               <option value="under 19">under 19</option>
               <option value="19-26">19-26</option>
               <option value="27-36">27-36</option>
               <option value="37-45">37-45</option>
               <option value="46-55">46-55</option>
               <option value="55 and above">55 and above</option>
             </select>

             <select 
               value={filterCategory} 
               onChange={(e) => setFilterCategory(e.target.value)}
               className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-600 text-sm appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
             >
               <option value="All">All Categories</option>
               <option value="First Timer/Guest">First Timer/Guest</option>
               <option value="Revisiting/Returning Member">Returning</option>
               <option value="Member">Member</option>
             </select>

             <select 
               value={filterLocation} 
               onChange={(e) => setFilterLocation(e.target.value)}
               className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-600 text-sm appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
             >
               <option value="All">All Locations</option>
               <option value="Egbeda/Akowonjo">Egbeda/Akowonjo</option>
               <option value="Iyana-Ipaja">Iyana-Ipaja</option>
               <option value="Ikotun">Ikotun</option>
               <option value="Igando">Igando</option>
               <option value="Ijegun">Ijegun</option>
               <option value="Oke-Odo">Oke-Odo</option>
               <option value="Ayobo & Ipaja">Ayobo & Ipaja</option>
             </select>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm bg-white">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-slate-50/80 sticky top-0 z-10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <tr>
                <th className="px-6 py-6 border-b border-slate-100">First Name</th>
                <th className="px-6 py-6 border-b border-slate-100">Last Name</th>
                <th className="px-6 py-6 border-b border-slate-100">Email Address</th>
                <th className="px-6 py-6 border-b border-slate-100">Phone Number</th>
                <th className="px-6 py-6 border-b border-slate-100 text-center">Sex</th>
                <th className="px-6 py-6 border-b border-slate-100 text-center">Age Range</th>
                <th className="px-6 py-6 border-b border-slate-100">Category</th>
                <th className="px-6 py-6 border-b border-slate-100">Location</th>
                <th className="px-6 py-6 border-b border-slate-100">Date Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!loading && filteredAttendees.map(a => (
                <tr key={a.id} className="hover:bg-indigo-50/20 transition-all duration-300">
                  <td className="px-6 py-5 font-bold text-slate-800 capitalize">{a.firstName}</td>
                  <td className="px-6 py-5 font-bold text-slate-800 capitalize">{a.lastName}</td>
                  <td className="px-6 py-5 text-sm text-slate-500 font-medium">{a.email}</td>
                  <td className="px-6 py-5 font-mono text-xs text-slate-600 font-bold">{a.phone}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${a.sex === 'Male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                      {a.sex}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase">
                      {a.ageRange}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                      a.category === 'Member' ? 'bg-indigo-50 text-indigo-600' : 
                      a.category === 'First Timer/Guest' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {a.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm font-bold text-slate-600 whitespace-nowrap">{a.location}</td>
                  <td className="px-6 py-5 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                    {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '---'}
                  </td>
                </tr>
              ))}
              
              {loading && (
                <tr>
                  <td colSpan={9} className="py-40 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <i className="fa-solid fa-circle-notch animate-spin text-5xl text-indigo-200"></i>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Accessing Firestore...</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredAttendees.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-40 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-40">
                      <i className="fa-solid fa-folder-open text-6xl text-slate-200"></i>
                      <p className="text-xl font-black text-slate-300">No records matching filters</p>
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