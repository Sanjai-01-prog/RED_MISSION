import React, { useState, useEffect } from 'react';
import { X, Heart, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requestApi } from '../../../services/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCY_LEVELS = [
  { value: 'CRITICAL', label: 'CRITICAL (Immediate < 4 hrs)' },
  { value: 'URGENT', label: 'URGENT (< 24 hrs)' },
  { value: 'STANDARD', label: 'STANDARD (< 48 hrs)' }
];

function toLocalDateTimeInputValue(dateMs) {
  const date = new Date(dateMs);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function createInitialFormState() {
  return {
    patientName: '',
    hospitalName: '',
    hospitalCity: '',
    hospitalAddress: '',
    bloodGroup: 'O+',
    unitsRequested: 2,
    urgencyLevel: 'URGENT',
    requiredBy: toLocalDateTimeInputValue(Date.now() + 48 * 3600 * 1000),
    contactPerson: '',
    contactPhone: '',
    clinicalCondition: '',
    notes: ''
  };
}

export default function CreateRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
  currentAdmin
}) {
  const [formData, setFormData] = useState(createInitialFormState);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setFormData(prev => ({
        ...prev,
        requiredBy: prev.requiredBy && new Date(prev.requiredBy).getTime() > Date.now()
          ? prev.requiredBy
          : toLocalDateTimeInputValue(Date.now() + 48 * 3600 * 1000)
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const adminRole = currentAdmin?.roleId || currentAdmin?.role_id || 'ADMIN';
  const roleLabel = adminRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setSuccess('');

    // Client validation aligned with backend rules
    if (
      !formData.patientName.trim() ||
      !formData.hospitalName.trim() ||
      !formData.hospitalCity.trim() ||
      !formData.hospitalAddress.trim()
    ) {
      setError('Please provide patient name, hospital name, city, and hospital address / ward.');
      setLoading(false);
      return;
    }

    if (!formData.contactPerson.trim()) {
      setError('Please provide a contact person name.');
      setLoading(false);
      return;
    }

    const phoneDigits = formData.contactPhone.replace(/\D/g, '');
    if (!formData.contactPhone.trim() || phoneDigits.length < 10) {
      setError('Please provide a valid contact telephone number (at least 10 digits).');
      setLoading(false);
      return;
    }

    const units = Number(formData.unitsRequested);
    if (!Number.isInteger(units) || units < 1 || units > 10) {
      setError('Units needed must be a whole number between 1 and 10.');
      setLoading(false);
      return;
    }

    const requiredByDate = formData.requiredBy ? new Date(formData.requiredBy) : null;
    if (!requiredByDate || isNaN(requiredByDate.getTime()) || requiredByDate.getTime() <= Date.now()) {
      setError('Required-by date and time must be in the future.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        patientName: formData.patientName.trim(),
        hospitalName: formData.hospitalName.trim(),
        hospitalCity: formData.hospitalCity.trim(),
        hospitalAddress: formData.hospitalAddress.trim(),
        bloodGroup: formData.bloodGroup,
        unitsRequested: units,
        urgencyLevel: formData.urgencyLevel,
        requiredBy: requiredByDate.toISOString(),
        contactPerson: formData.contactPerson.trim(),
        contactPhone: formData.contactPhone.trim(),
        clinicalCondition: formData.clinicalCondition.trim(),
        notes: formData.notes.trim()
      };

      const res = await requestApi.create(payload);

      if (res.success) {
        setSuccess(`Emergency Blood Request [${res.request?.id || 'OK'}] published successfully!`);
        if (onRequestCreated) {
          onRequestCreated(res.request);
        }
        setTimeout(() => {
          onClose();
          setFormData(createInitialFormState());
          setSuccess('');
        }, 900);
      } else {
        setError(res.error || 'Failed to create emergency blood request.');
      }
    } catch (err) {
      console.error('Request creation error:', err);
      setError('Network error while dispatching emergency request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-space-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-space-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-space-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-mars-500/10 text-mars-400 border border-mars-500/20">
              <Heart className="w-5 h-5 fill-mars-500/30" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-orbitron">
                Create Blood Request
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Medical Command • Authorized {roleLabel} Publication
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patient Name */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Patient Name <span className="text-mars-400">*</span>
              </label>
              <input
                type="text"
                name="patientName"
                value={formData.patientName}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Blood Group Required <span className="text-mars-400">*</span>
              </label>
              <select
                name="bloodGroup"
                value={formData.bloodGroup}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              >
                {BLOOD_GROUPS.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            {/* Hospital Name */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Hospital Name <span className="text-mars-400">*</span>
              </label>
              <input
                type="text"
                name="hospitalName"
                value={formData.hospitalName}
                onChange={handleChange}
                placeholder="e.g. Lilavati Hospital"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Hospital City */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Hospital City <span className="text-mars-400">*</span>
              </label>
              <input
                type="text"
                name="hospitalCity"
                value={formData.hospitalCity}
                onChange={handleChange}
                placeholder="e.g. Mumbai"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Hospital Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Hospital Address / Ward <span className="text-mars-400">*</span>
              </label>
              <input
                type="text"
                name="hospitalAddress"
                value={formData.hospitalAddress}
                onChange={handleChange}
                placeholder="e.g. Bandra West, ICU Ward 4B"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Units Requested */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Units Needed <span className="text-mars-400">*</span>
              </label>
              <input
                type="number"
                name="unitsRequested"
                min="1"
                max="10"
                value={formData.unitsRequested}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Urgency Level */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Urgency Level <span className="text-mars-400">*</span>
              </label>
              <select
                name="urgencyLevel"
                value={formData.urgencyLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              >
                {URGENCY_LEVELS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            {/* Required By Date & Time */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Required By Date &amp; Time <span className="text-mars-400">*</span>
              </label>
              <input
                type="datetime-local"
                name="requiredBy"
                min={toLocalDateTimeInputValue(Date.now() + 5 * 60 * 1000)}
                value={formData.requiredBy}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Contact Person Name <span className="text-mars-400">*</span>
              </label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                placeholder="e.g. Dr. A. Verma"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Contact Telephone <span className="text-mars-400">*</span>
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                required
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Clinical Condition */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Clinical Condition / Diagnosis
              </label>
              <input
                type="text"
                name="clinicalCondition"
                value={formData.clinicalCondition}
                onChange={handleChange}
                placeholder="e.g. Emergency Cardiac Surgery / Acute blood loss"
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none"
              />
            </div>

            {/* Additional Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Special Instructions / Notes
              </label>
              <textarea
                name="notes"
                rows="2"
                value={formData.notes}
                onChange={handleChange}
                placeholder="e.g. Donor must bring official photo ID to blood bank counter."
                className="w-full px-3 py-2 rounded-xl bg-space-950 border border-white/10 text-white text-xs font-mono focus:border-mars-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-mono bg-space-850 hover:bg-space-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-gradient-to-r from-mars-600 to-mars-flame text-white hover:brightness-110 shadow-lg shadow-mars-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Publishing Request...' : 'Publish Emergency Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
