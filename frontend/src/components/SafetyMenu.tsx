import { useState } from 'react';
import { motion } from 'framer-motion';

interface SafetyMenuProps {
  onClose: () => void;
}

interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

const MOCK_CONTACTS: TrustedContact[] = [
  { id: '1', name: 'Mom', phone: '+1 ' },
  { id: '2', name: 'Best Friend', phone: '+1 ' },
];

const EMERGENCY_NUMBERS = [
  { name: 'Emergency Services', number: '911' },
  { name: 'National DV Hotline', number: '1-800-799-7233' },
  { name: 'RAINN Sexual Assault', number: '1-800-656-4673' },
];

export function SafetyMenu({ onClose }: SafetyMenuProps) {
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [locationShared, setLocationShared] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);

  function toggleContact(id: string) {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function shareLocation() {
    if (!navigator.geolocation) {
      alert('Location not available on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
        const message = `Emergency: I'm sharing my location with you. My current location: ${mapsLink}`;
        
        // In production, this would SMS contacts via backend
        // For now, just show confirmation
        setLocationShared(true);
        setShowShareConfirm(true);
        console.log('Location shared:', { latitude, longitude, message });
      },
      (error) => {
        console.error('Location error:', error);
        alert('Could not get your location. Please check location permissions.');
      }
    );
  }

  function callEmergency(number: string) {
    window.location.href = `tel:${number}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        
        <div className="flex items-center justify-between">
          <h2 className="display-heading text-xl font-light">Safety Center</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {/* SOS Button */}
          <button
            onClick={shareLocation}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 p-4 text-left transition hover:border-red-500 hover:bg-red-500/20"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-300">Share Location Now</p>
              <p className="text-sm text-white/60">Send your location to trusted contacts</p>
            </div>
          </button>

          {/* Trusted Contacts */}
          <button
            onClick={() => setShowContacts(!showContacts)}
            className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gold-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Trusted Contacts</p>
              <p className="text-sm text-white/60">Manage who sees your location</p>
            </div>
            <svg viewBox="0 0 24 24" className={`h-5 w-5 text-white/40 transition ${showContacts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showContacts && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="mb-3 text-xs text-white/50">Select contacts to share with:</p>
              {MOCK_CONTACTS.map((contact) => (
                <label key={contact.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedContacts.has(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    className="h-5 w-5 rounded accent-gold-400"
                  />
                  <div>
                    <p className="text-sm text-white">{contact.name}</p>
                    <p className="text-xs text-white/40">{contact.phone}</p>
                  </div>
                </label>
              ))}
              {selectedContacts.size > 0 && (
                <button
                  onClick={shareLocation}
                  className="mt-3 w-full rounded-lg bg-gold-400 py-2 text-sm font-semibold text-black"
                >
                  Share Location with {selectedContacts.size} Contact{selectedContacts.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Emergency Numbers */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">Emergency Numbers</p>
            <div className="space-y-2">
              {EMERGENCY_NUMBERS.map((num) => (
                <button
                  key={num.number}
                  onClick={() => callEmergency(num.number)}
                  className="flex w-full items-center justify-between py-2 text-left transition hover:text-red-300"
                >
                  <span className="text-sm text-white/80">{num.name}</span>
                  <span className="text-sm font-medium text-red-400">{num.number}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Safety Tips */}
          <button
            onClick={() => alert('Safety tips coming soon!')}
            className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gold-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Safety Tips</p>
              <p className="text-sm text-white/60">Guidelines for safe dating</p>
            </div>
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Location Shared Confirmation */}
        {showShareConfirm && locationShared && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-semibold text-emerald-300">Location shared successfully!</p>
            <p className="mt-1 text-sm text-white/70">Your trusted contacts have been notified.</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-white/40">
          Your safety is paramount. All features are confidential.
        </p>
      </motion.div>
    </motion.div>
  );
}
