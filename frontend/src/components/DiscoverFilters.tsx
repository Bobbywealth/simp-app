import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FiltersProps {
  open: boolean;
  onClose: () => void;
  minAge: number;
  maxAge: number;
  onApply: (minAge: number, maxAge: number) => void;
}

const MIN = 18;
const MAX = 80;

export function DiscoverFilters({ open, onClose, minAge, maxAge, onApply }: FiltersProps) {
  const [localMin, setLocalMin] = useState(minAge);
  const [localMax, setLocalMax] = useState(maxAge);

  useEffect(() => {
    if (open) {
      setLocalMin(minAge);
      setLocalMax(maxAge);
    }
  }, [open, minAge, maxAge]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="filters"
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
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Filter deck</p>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">Age range</p>
                <p className="text-sm text-white">
                  {localMin} – {localMax}
                </p>
              </div>

              <div className="mt-4">
                <label className="label-luxe">Min age: {localMin}</label>
                <input
                  type="range"
                  min={MIN}
                  max={MAX}
                  value={localMin}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setLocalMin(v);
                    if (v > localMax) setLocalMax(v);
                  }}
                  className="w-full accent-gold-400"
                />
              </div>
              <div className="mt-3">
                <label className="label-luxe">Max age: {localMax}</label>
                <input
                  type="range"
                  min={MIN}
                  max={MAX}
                  value={localMax}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setLocalMax(v);
                    if (v < localMin) setLocalMin(v);
                  }}
                  className="w-full accent-gold-400"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={() => onApply(localMin, localMax)}
                className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setLocalMin(18);
                  setLocalMax(99);
                }}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70"
              >
                Reset
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
