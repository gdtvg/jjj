import { useCallback, useRef, useState } from 'react';
export interface Notice { id: string; text: string; kind: 'info' | 'success' | 'error'; }
export function useNotifications() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());
  const notify = useCallback((text: string, kind: Notice['kind'] = 'info', key?: string) => {
    if (key && seen.current.has(key)) return;
    if (key) seen.current.add(key);
    setNotices(previous => [...previous, { id: crypto.randomUUID(), text, kind }]);
  }, []);
  const dismiss = useCallback((id: string) => setNotices(previous => previous.filter(n => n.id !== id)), []);
  return { notices, notify, dismiss };
}
