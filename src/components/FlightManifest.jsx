import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  X, 
  Ticket, 
  ShieldCheck, 
  Sparkles, 
  Phone 
} from 'lucide-react';
import { UPCOMING_CAMPS } from '../data/missionData';
import { FALLBACK_CAMP_SVG } from '../utils/imageFallbacks';

export default function FlightManifest() {
  const [camps, setCamps] = useState(UPCOMING_CAMPS);
  const [selectedCampForBooking, setSelectedCampForBooking] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('10:00 AM - 11:00 AM');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingPassId, setBookingPassId] = useState('');

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedCampForBooking(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scrolling when booking modal is open
  useEffect(() => {
    if (selectedCampForBooking) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedCampForBooking]);

  const handleBookSlot = (e) => {
    e.preventDefault();
    if (!donorName.trim() || !donorPhone.trim()) return;

    const passId = `PASS-CMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setBookingPassId(passId);
    setBookingConfirmed(true);

    // Increment registered count for the camp
    setCamps((prev) =>
      prev.map((c) =>
        c.id === selectedCampForBooking.id
          ? { ...c, registeredDonors: c.registeredDonors + 1 }
          : c
      )
    );
  };

  const openBookingModal = (camp) => {
    setSelectedCampForBooking(camp);
    setBookingConfirmed(false);
    setDonorName('');
    setDonorPhone('');
  };

  return (
    <section id="camps" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mars-500/10 border border-mars-500/30 text-mars-400 text-xs font-mono uppercase tracking-widest">
            <Building2 className="w-3.5 h-3.5" />
            <span>Community Outreach &amp; Mega Drives</span>
          </div>

          <h2 className="font-orbitron font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            BLOOD DONATION <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-500 to-mars-flame">CAMPS</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Join thousands of citizens donating at certified hospital mobile blood drives and college campuses. Reserve your preferred donation time slot with zero waiting time.
          </p>
        </div>

        {/* Camps Grid (2x2 on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {camps.map((camp) => {
            const fillPercentage = Math.min(100, Math.round((camp.registeredDonors / camp.targetUnits) * 100));

            return (
              <div
                key={camp.id}
                className="card-glass rounded-2xl overflow-hidden card-glass-hover flex flex-col justify-between border border-white/10 group"
              >
                <div>
                  {/* Camp Image / Graphic */}
                  <div className="relative h-56 overflow-hidden bg-space-900">
                    <img
                      src={camp.image}
                      alt={camp.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = FALLBACK_CAMP_SVG;
                      }}
                      className="w-full h-full object-cover filter brightness-90 contrast-110 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-space-950 via-space-950/40 to-transparent"></div>

                    {/* Status Pill */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-space-950/80 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{camp.status}</span>
                    </div>

                    {/* City Badge */}
                    <div className="absolute bottom-3 left-3 text-xs font-mono text-white bg-space-950/80 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-mars-400" />
                      <span>{camp.city}</span>
                    </div>
                  </div>

                  {/* Camp Details */}
                  <div className="p-6 space-y-4">
                    <div>
                      <span className="text-[11px] font-mono text-mars-400 font-semibold block uppercase">
                        Organized by {camp.organizer}
                      </span>
                      <h3 className="font-orbitron font-bold text-xl text-white group-hover:text-mars-300 transition-colors mt-0.5">
                        {camp.title}
                      </h3>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-mars-400 shrink-0" />
                        <span className="line-clamp-1">{camp.venue}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                        <span className="flex items-center gap-1 text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{camp.date}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{camp.timing}</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar (Registered vs Target) */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Pledged Donors:</span>
                        <span className="text-white font-bold">{camp.registeredDonors} / {camp.targetUnits} Units ({fillPercentage}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-space-900 overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-mars-600 to-mars-flame rounded-full transition-all duration-500"
                          style={{ width: `${fillPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Amenities list */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {camp.amenities.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded text-[10px] font-mono bg-space-900 border border-white/5 text-slate-300">
                          ✓ {a}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 pt-1">
                      <span className="text-slate-500">Coordinator: </span>
                      <span className="text-slate-300">{camp.contact}</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-6 pt-0">
                  <button
                    onClick={() => openBookingModal(camp)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-mars-600 via-mars-500 to-mars-flame hover:brightness-110 text-xs font-orbitron font-bold text-white shadow-lg shadow-mars-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>BOOK DONATION TIME SLOT</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal: Book Camp Donation Slot */}
        {selectedCampForBooking && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedCampForBooking(null)}
          >
            <div
              className="relative w-full max-w-lg card-glass rounded-2xl overflow-hidden border border-mars-500/40 shadow-2xl p-6 sm:p-8 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono text-mars-400 uppercase font-bold tracking-wider">
                    RESERVE COMPLIMENTARY TIME SLOT
                  </span>
                  <h3 className="font-orbitron font-bold text-lg text-white">
                    {selectedCampForBooking.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {selectedCampForBooking.date} • {selectedCampForBooking.venue}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCampForBooking(null)}
                  className="p-1 rounded-lg bg-space-850 border border-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {bookingConfirmed ? (
                <div className="text-center py-6 space-y-4 animate-in fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-orbitron font-bold text-xl text-white">
                    DONATION SLOT CONFIRMED!
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                    Thank you, <strong className="text-white">{donorName}</strong>! Your VIP fast-track donation slot has been reserved. Please show this digital pass at the reception desk.
                  </p>
                  
                  {/* Digital Booking Pass Badge */}
                  <div className="p-4 rounded-xl bg-space-900 border border-mars-500/40 font-mono text-xs text-left space-y-1.5 max-w-sm mx-auto">
                    <div className="flex items-center justify-between text-mars-400 font-bold border-b border-white/5 pb-1">
                      <span>BOOKING PASS: #{bookingPassId}</span>
                      <span className="text-[10px] text-emerald-400">CONFIRMED</span>
                    </div>
                    <div><span className="text-slate-500">Slot Time:</span> <span className="text-white">{selectedSlot}</span></div>
                    <div><span className="text-slate-500">Venue:</span> <span className="text-white">{selectedCampForBooking.venue}</span></div>
                    <div><span className="text-slate-500">Phone:</span> <span className="text-slate-300">{donorPhone}</span></div>
                  </div>

                  <button
                    onClick={() => setSelectedCampForBooking(null)}
                    className="px-6 py-2.5 rounded-xl bg-mars-600 hover:bg-mars-500 text-white font-semibold text-xs transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookSlot} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Your Full Name <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="e.g. Ananya Sharma"
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Contact Phone <span className="text-mars-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      placeholder="+91 98XXX XXXXX"
                      className="w-full px-4 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                      Preferred Donation Time Slot
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        '09:00 AM - 10:30 AM',
                        '10:30 AM - 12:00 PM',
                        '12:30 PM - 02:00 PM',
                        '02:30 PM - 04:00 PM'
                      ].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2 rounded-xl text-left text-xs font-mono transition-all border ${
                            selectedSlot === slot
                              ? 'bg-mars-600 text-white border-mars-400 shadow-md shadow-mars-600/30'
                              : 'bg-space-900 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-space-900/60 border border-white/5 text-[11px] text-slate-400">
                    💡 Please drink 500ml of water and have a light meal before arriving at the camp.
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold text-xs shadow-lg shadow-mars-600/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>CONFIRM APPOINTMENT PASS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCampForBooking(null)}
                      className="px-4 py-3 rounded-xl bg-space-850 border border-white/10 text-slate-400 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
