import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SimpLogo } from "../components/SimpLogo";
import { haptics } from "../lib/haptics";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-black text-white">
      <img
        src="/editorial/welcome.jpg"
        alt="A SIMP member enjoying an evening out"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/45 to-transparent" />

      <main className="relative z-10 flex w-full flex-col justify-between px-6 pb-safe pt-safe sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="flex items-center justify-between pt-5"
        >
          <SimpLogo size={48} variant="emblem" />
          <p className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-gold-200 backdrop-blur-md">
            Private by design
          </p>
        </motion.div>

        <div className="max-w-md pb-8 pt-40">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-200"
          >
            The intentional way to meet
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="display-heading mt-4 max-w-sm text-5xl font-light leading-[0.94] sm:text-6xl"
          >
            People, not profiles.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-5 max-w-xs text-sm leading-relaxed text-white/75"
          >
            A more considered space for chemistry, conversation, and plans worth
            making.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mb-4 rounded-[1.75rem] border border-white/15 bg-black/45 p-3 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => {
              haptics.medium();
              navigate("/onboarding");
            }}
            className="btn-gold w-full"
            data-testid="get-started"
          >
            Begin your edit
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              navigate("/login");
            }}
            className="mt-2 w-full py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 hover:text-white"
          >
            Log in
          </button>
          <p className="px-2 pb-1 text-center text-[9px] leading-relaxed text-white/45">
            Thoughtful introductions. Quiet verification. You set the pace.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
