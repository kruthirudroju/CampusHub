/** Small shared presentational pieces used across the dashboards. */

const TONE = {
  Available: 'chip-ok', Answered: 'chip-ok', Completed: 'chip-ok', Approved: 'chip-ok', Open: 'chip-ok',
  'In Class': 'chip-warn', 'In Meeting': 'chip-warn', Pending: 'chip-warn', Read: 'chip-warn',
  'In Progress': 'chip-warn', New: 'chip-warn', Claimed: 'chip-warn',
  'Out of Office': 'chip-neutral', Closed: 'chip-neutral', Cancelled: 'chip-neutral',
  Rejected: 'chip-stop', High: 'chip-stop'
};

export function Chip({ label, tone }) {
  const cls = tone || TONE[label] || 'chip-neutral';
  return <span className={`chip ${cls}`}><span className="dot" />{label}</span>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function Loading({ what = 'Loading' }) {
  return <p className="empty">{what}…</p>;
}

export function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3 style={{ marginBottom: subtitle ? 2 : 18 }}>{title}</h3>}
        {subtitle && <p className="muted small" style={{ margin: '0 0 18px' }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field">{label}</label>
      {children}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'is-active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function timeAgo(value) {
  if (!value) return '';
  const s = Math.floor((Date.now() - new Date(value)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
