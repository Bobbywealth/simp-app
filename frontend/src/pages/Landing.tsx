import { useEffect, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import approvedLanding from '../content/landing.html?raw';

const css = approvedLanding.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const markup = approvedLanding.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';

/** The approved landing design; links stay in-app on web and Capacitor. */
export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    const previous = document.title;
    document.title = 'SIMP · Your kind of people. Your kind of plans.';
    return () => { document.title = previous; };
  }, []);
  function followLink(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest('a');
    const destination = anchor?.getAttribute('href');
    if (destination === '/signup' || destination === '/login') {
      event.preventDefault();
      navigate(destination);
    }
  }
  return <><style>{css}</style><div className="simp-public-landing" onClick={followLink} dangerouslySetInnerHTML={{ __html: markup }} /></>;
}
