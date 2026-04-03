import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FormState, FormErrors, Sex, Location, AgeRange, Category } from '../types';

interface Props {
  onSuccess: (firstName: string) => void;
}

const AttendanceForm: React.FC<Props> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormState>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    category: '' as Category, // Updated to empty to show placeholder
    sex: '' as Sex,           // Updated to empty to show placeholder
    location: 'IGANDO',       // Matching case with updated list
    ageRange: '' as AgeRange,  // Updated to empty to show placeholder
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
    
    // Minimal update to ensure "must actively select" requirement is met
    if (!formData.sex) newErrors.sex = 'Required';
    if (!formData.ageRange) newErrors.ageRange = 'Required';
    if (!formData.category) newErrors.category = 'Required';

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
      const attendanceRef = collection(db, 'attendance');

      // 1. Check for duplicate Email (Normalized to lowercase)
      const qEmail = query(
        attendanceRef, 
        where('email', '==', formData.email.trim().toLowerCase()), 
        limit(1)
      );
      const emailSnapshot = await getDocs(qEmail);

      if (!emailSnapshot.empty) {
        setSubmitError('You have already registered for this event.');
        setLoading(false);
        return;
      }

      // 2. Check for duplicate Phone
      const qPhone = query(
        attendanceRef, 
        where('phone', '==', formData.phone.trim()), 
        limit(1)
      );
      const phoneSnapshot = await getDocs(qPhone);

      if (!phoneSnapshot.empty) {
        setSubmitError('This phone number is already registered.');
        setLoading(false);
        return;
      }

      // 3. If unique, proceed with registration
      await addDoc(attendanceRef, {
        ...formData,
        email: formData.email.trim().toLowerCase(), // Always store normalized email
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

  const SelectField = ({ label, name, value, options, icon, placeholder, error }: { label: string, name: string, value: string, options: string[], icon: string, placeholder?: string, error?: string }) => (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={handleChange}
          required
          className={`w-full px-4 py-4 rounded-xl bg-white/5 text-white outline-none appearance-none font-bold border border-white/10 cursor-pointer pr-10 transition-all focus:ring-2 focus:ring-amber-500/50 ${error ? 'ring-2 ring-red-500/50' : ''}`}
        >
          {placeholder && <option value="" disabled hidden className="bg-slate-900">{placeholder}</option>}
          {options.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-amber-500">
          <i className={`fa-solid ${icon} text-xs`}></i>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
      <div className="p-8 md:p-10 space-y-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Check-in</h2>
          <p className="text-slate-400 text-sm mt-1 font-medium italic">Your abundance journey starts here.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className={`w-full px-4 py-4 rounded-xl bg-white/5 text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all border border-white/10 font-bold placeholder:text-slate-600 ${errors.firstName ? 'ring-2 ring-red-500/50' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className={`w-full px-4 py-4 rounded-xl bg-white/5 text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all border border-white/10 font-bold placeholder:text-slate-600 ${errors.lastName ? 'ring-2 ring-red-500/50' : ''}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="hello@provider.com"
                className={`w-full px-4 py-4 rounded-xl bg-white/5 text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all border border-white/10 font-bold placeholder:text-slate-600 ${errors.email ? 'ring-2 ring-red-500/50' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="080..."
                className={`w-full px-4 py-4 rounded-xl bg-white/5 text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all border border-white/10 font-bold placeholder:text-slate-600 ${errors.phone ? 'ring-2 ring-red-500/50' : ''}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField 
              label="Sex" 
              name="sex" 
              value={formData.sex} 
              options={['Male', 'Female']} 
              icon="fa-venus-mars" 
              placeholder="Choose one"
              error={errors.sex}
            />
            <SelectField 
              label="Age Range" 
              name="ageRange" 
              value={formData.ageRange} 
              options={['under 19', '19-26', '27-36', '37-45', '46-55', '55 and above']} 
              icon="fa-calendar-days" 
              placeholder="Select age range"
              error={errors.ageRange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <SelectField 
              label="Category" 
              name="category" 
              value={formData.category} 
              options={['First Timer/Guest', 'Revisiting/Returning Member', 'Member']} 
              icon="fa-users" 
              placeholder="Choose one"
              error={errors.category}
            />
            <SelectField 
              label="Location" 
              name="location" 
              value={formData.location} 
              options={['OJO', 'IBA', 'AGBARA', 'IGANDO', 'AKESAN', 'IYANA-IPAJA', 'IKOTUN', 'IJEGUN', 'OKE-ODO', 'AYOBO-IPAJA', 'EGBEDA/AKOWONJO', 'IYANA ERA', 'AMUWO ODOFIN']} 
              icon="fa-location-dot" 
            />
          </div>

          {submitError && (
            <div className="flex items-center gap-3 bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-fade-in">
              <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-6 rounded-2xl font-black text-slate-900 transition-all shadow-xl active:scale-95 text-base uppercase tracking-widest ${
              loading ? 'bg-amber-500/50 cursor-not-allowed' : 'bg-[#F59E0B] hover:bg-[#D97706] shadow-amber-500/20 hover:shadow-amber-500/40'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <i className="fa-solid fa-circle-notch animate-spin"></i>
                Verifying...
              </span>
            ) : 'Complete Check-in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AttendanceForm;