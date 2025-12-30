
import React, { useState, useEffect } from 'react';
import AttendanceForm from './components/AttendanceForm';
import AdminDashboard from './components/AdminDashboard';
import { db } from './firebase/config';
import { collection, onSnapshot, query } from 'firebase/firestore';

const App: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [attendeeName, setAttendeeName] = useState('');
  const [aiMessage, setAiMessage] = useState<string>('');
  const [count, setCount] = useState(0);
  const [view, setView] = useState<'form' | 'admin'>('form');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'attendance'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
    });
    return () => unsubscribe();
  }, []);

  // SECURE VERSION: Calls our internal API instead of exposing the Gemini Key
  useEffect(() => {
    if (submitted && attendeeName) {
      const fetchAiMessage = async () => {
        try {
          const response = await fetch('/api/prophetic-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: attendeeName }),
          });
          
          if (!response.ok) throw new Error('API request failed');
          
          const data = await response.json();
          setAiMessage(data.text);
        } catch (err) {
          console.error('Prophetic word error:', err);
          setAiMessage("May the Lord bless your crossover into 2026 with infinite favor.");
        }
      };
      fetchAiMessage();
    }
  }, [submitted, attendeeName]);

  const handleSuccess = (firstName: string) => {
    setAttendeeName(firstName);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setAiMessage('');
    setAttendeeName('');
    setImageError(false);
  };

  return (
    <div className="min-h-screen bg-[#F3E8FF] p-4 flex flex-col items-center">
      <div className="w-full max-w-7xl flex justify-between items-center py-6 mb-8 px-2">
        <div className="flex items-center group cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setView('form')}>
          <div className="h-16 md:h-20 flex items-center justify-center">
             <img 
               src="https://joshuaehimare.com/wp-content/uploads/2025/12/igando.png" 
               alt="TCN Igando Logo" 
               className="h-full w-auto object-contain" 
             />
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="bg-[#E9D5FF] px-5 py-2.5 rounded-full flex items-center gap-3 shadow-md border border-white/60 backdrop-blur-sm">
            <div className="w-2.5 h-2.5 bg-[#5C6BC0] rounded-full animate-pulse shadow-[0_0_8px_rgba(92,107,192,0.6)]"></div>
            <span className="text-[#5C6BC0] font-extrabold text-sm md:text-base tracking-tight">
              {count.toLocaleString()} Attendees
            </span>
          </div>
          <button 
            onClick={() => setView(view === 'admin' ? 'form' : 'admin')}
            className="text-[11px] font-bold text-slate-500 hover:text-[#5C6BC0] transition-all flex items-center gap-2 group/btn uppercase tracking-wider"
          >
            <i className={`fa-solid ${view === 'admin' ? 'fa-arrow-left' : 'fa-lock'} text-[10px] group-hover/btn:-translate-x-1 transition-transform`}></i>
            {view === 'admin' ? 'Return to Portal' : 'Admin Area'}
          </button>
        </div>
      </div>

      <div className="w-full flex justify-center pb-20 px-4">
        {view === 'admin' ? (
          <AdminDashboard />
        ) : !submitted ? (
          <div className="flex flex-col items-center w-full max-w-[600px] animate-fade-in">
            <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-2xl mb-8 border-4 border-white/40 bg-slate-100 flex items-center justify-center">
              {!imageError ? (
                <img 
                  src="https://joshuaehimare.com/wp-content/uploads/2025/12/WhatsApp-Image-2025-12-29-at-19.59.20.jpeg" 
                  alt="TCN Igando Crossover 2026 Flyer" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex flex-col items-center p-8 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                    <i className="fa-solid fa-image-slash text-3xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-700">Crossover 2026</h3>
                    <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest">Event Flyer Unavailable</p>
                  </div>
                </div>
              )}
            </div>
            <AttendanceForm onSuccess={handleSuccess} />
          </div>
        ) : (
          <div className="bg-white p-12 rounded-3xl shadow-2xl border border-white max-md w-full mx-auto text-center animate-bounce-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#5C6BC0] to-indigo-300"></div>
            <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-green-50/50">
              <i className="fa-solid fa-check text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Check-in Complete!</h2>
            <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative">
              <i className="fa-solid fa-quote-left absolute top-4 left-4 text-slate-200 text-xl"></i>
              <p className="text-slate-600 italic leading-relaxed text-base font-medium">
                {aiMessage || "Prophetic word loading..."}
              </p>
              {aiMessage && (
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <p className="text-[10px] font-black text-[#5C6BC0] uppercase tracking-[0.2em]">Your 2026 Prophetic Seed</p>
                </div>
              )}
            </div>
            <button onClick={handleReset} className="w-full py-4 px-6 bg-[#5C6BC0] text-white rounded-xl font-bold hover:bg-[#4E5BA6] transition-all shadow-lg active:scale-95 text-base uppercase tracking-widest">
              Done
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.9); } 70% { transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default App;
