import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import { timeAgo } from './ui';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    api.get('/notifications')
      .then((res) => { setCount(res.data.count); setItems(res.data.notifications); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      try { await api.put('/notifications/checked'); setCount(0); } catch {}
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        aria-label={`Notifications${count ? `, ${count} new` : ''}`}
        style={{
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)',
          color: '#E8E4DB', borderRadius: 6, padding: '7px 13px', fontSize: 13.5, position: 'relative'
        }}
      >
        Notifications
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -7, right: -7, minWidth: 19, height: 19, padding: '0 5px',
            background: '#C8453F', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{count > 9 ? '9+' : count}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 330, maxWidth: '86vw',
          maxHeight: 420, overflowY: 'auto', background: 'var(--paper-raised)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)', zIndex: 80, color: 'var(--ink)'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 14 }}>
            Recent activity
          </div>
          {items.length === 0 && <p className="muted small" style={{ padding: 16, margin: 0 }}>Nothing new right now.</p>}
          {items.map((n, i) => (
            <div key={i} style={{ padding: '11px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <p style={{ margin: 0, fontSize: 13.5 }}>{n.text}</p>
              <span className="muted" style={{ fontSize: 11.5 }}>{timeAgo(n.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
