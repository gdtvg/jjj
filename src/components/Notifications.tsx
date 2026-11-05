import { useEffect, useState } from 'react';
import { X, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import type { Notice } from '../hooks/useNotifications';
function Notification({ notice, dismiss }: { notice: Notice; dismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setLeaving(true), 10_000); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!leaving) return; const timer = setTimeout(() => dismiss(notice.id), 200); return () => clearTimeout(timer); }, [leaving, dismiss, notice.id]);
  const Icon = notice.kind === 'error' ? AlertCircle : notice.kind === 'success' ? CheckCircle2 : Info;
  return <div className={`game-notice ${leaving ? 'notice-leaving' : ''}`} data-kind={notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}><Icon size={18} /><p>{notice.text}</p><button type="button" aria-label="Meldung schließen" onClick={() => setLeaving(true)}><X size={16} /></button></div>;
}
export function Notifications({ notices, dismiss }: { notices: Notice[]; dismiss: (id: string) => void }) {
  return <aside className="game-notifications" aria-label="Benachrichtigungen">{notices.map(notice => <Notification key={notice.id} notice={notice} dismiss={dismiss} />)}</aside>;
}
