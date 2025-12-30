import React, { useState } from 'react';
// Fixing firestore import errors: Ensuring collection, addDoc, and serverTimestamp are correctly imported from modular SDK
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FormState, FormErrors } from '../types';

interface Props {
  onSuccess: (firstName: string) => void;
}

const AttendanceForm: React.FC<Props> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormState>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    category: 'Member',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'Required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) newErrors.phone = 'Required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError(null);

    try {
      // Using the collection and addDoc functions from firebase/firestore
      const attendanceRef = collection(db, 'attendance');
      await addDoc(attendanceRef, {
        ...formData,
        eventId: 'tcn-igando-crossover-2025',
        createdAt: serverTimestamp(),
      });
      onSuccess(formData.firstName);
    } catch (error: any) {
      console.error("Submission Error:", error);
      setSubmitError('Unable to check-in. Please verify your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/60">
      <div className="p-8 md:p-12 space-y-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Crossover Attendance</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Join us for our service into abundance.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="e.g., John"
                className={`w-full px-4 py-4 rounded-xl bg-[#E8F0FE] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all border-none font-medium ${errors.firstName ? 'ring-2 ring-red-300' : ''}`}
              />
              {errors.firstName && <span className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.firstName}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="e.g., Doe"
                className={`w-full px-4 py-4 rounded-xl bg-[#E8F0FE] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all border-none font-medium ${errors.lastName ? 'ring-2 ring-red-300' : ''}`}
              />
              {errors.lastName && <span className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.lastName}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className={`w-full px-4 py-4 rounded-xl bg-[#E8F0FE] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all border-none font-medium ${errors.email ? 'ring-2 ring-red-300' : ''}`}
            />
            {errors.email && <span className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.email}</span>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+234..."
              className={`w-full px-4 py-4 rounded-xl bg-[#E8F0FE] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 transition-all border-none font-medium ${errors.phone ? 'ring-2 ring-red-300' : ''}`}
            />
            {errors.phone && <span className="text-[10px] text-red-400 font-bold ml-1 uppercase">{errors.phone}</span>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Category</label>
            <div className="relative">
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-4 rounded-xl bg-[#F3E8FF] text-slate-700 outline-none appearance-none font-bold border-none cursor-pointer"
              >
                <option value="Member">Member</option>
                <option value="First Timer/Guest">First Timer/Guest</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                <i className="fa-solid fa-chevron-down text-xs"></i>
              </div>
            </div>
          </div>

          {submitError && <p className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-lg border border-red-100">{submitError}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-xl font-black text-white transition-all shadow-xl active:scale-[0.98] text-base uppercase tracking-widest ${
              loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-[#5C6BC0] hover:bg-[#4E5BA6] hover:shadow-indigo-200'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch animate-spin"></i>
                Recording Check-in...
              </span>
            ) : 'Submit Attendance'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AttendanceForm;