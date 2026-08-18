import { useNavigate } from 'react-router-dom';

const LIBRARIES = [
  ['React', 'MIT'], ['React Router', 'MIT'], ['Zustand', 'MIT'], ['Framer Motion', 'MIT'],
  ['Socket.IO Client', 'MIT'], ['Zod', 'MIT'], ['React Hook Form', 'MIT'], ['Capacitor', 'MIT'],
  ['vite-plugin-pwa / Workbox', 'MIT'], ['Tailwind CSS', 'MIT'],
];

export default function Licenses() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-ink-950 px-5 pb-16 pt-safe text-white">
      <main className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between py-5"><button type="button" onClick={() => navigate(-1)} className="min-h-11 text-xs uppercase tracking-[0.16em] text-white/50">Back</button><h1 className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-300">Licenses</h1><span className="w-11" /></header>
        <p className="text-sm leading-relaxed text-white/55">SIMP is built with open-source software. Copyright remains with each project’s contributors.</p>
        <ul className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">{LIBRARIES.map(([name, license]) => <li key={name} className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4 last:border-0"><span className="text-sm text-white/75">{name}</span><span className="text-xs text-white/35">{license}</span></li>)}</ul>
        <p className="mt-6 text-xs leading-relaxed text-white/35">Full license texts are included with their packages in the source distribution.</p>
      </main>
    </div>
  );
}
