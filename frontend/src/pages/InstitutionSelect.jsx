import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { IconSearch } from '../components/icons';

const RECENT_KEY = 'ch_recent_institutions';
function getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function pushRecent(inst) {
  const list = getRecent().filter((i) => i.slug !== inst.slug);
  list.unshift({ slug: inst.slug, name: inst.name, short_name: inst.short_name, accent_color: inst.accent_color });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 4)));
}

export default function InstitutionSelect() {
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'student' ? '/student' : user.role === 'faculty' ? '/faculty' : '/admin', { replace: true });
      return;
    }
    api.get('/institutions')
      .then((res) => setAll(res.data))
      .catch(() => setError('Could not reach the server. Check that the API is running.'))
      .finally(() => setLoading(false));
    inputRef.current?.focus();
  }, [user, navigate]);

  const go = (inst) => { pushRecent(inst); navigate(`/login/${inst.slug}`); };

  const q = query.trim().toLowerCase();
  const results = q
    ? all.filter((i) => [i.name, i.short_name, i.city, i.state].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    : [];
  const recent = getRecent();

  const onKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { go(results[activeIdx]); }
  };

  const Badge = ({ inst, size = 40 }) => (
    <span style={{
      width: size, height: size, flexShrink: 0, borderRadius: 9,
      background: inst.accent_color || 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.34
    }}>
      {(inst.short_name || inst.name).slice(0, 3).toUpperCase()}
    </span>
  );

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      <header style={{ padding: '22px 28px', display: 'flex', alignItems: 'center' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14
        }}>C</span>
        <span style={{ fontWeight: 700, fontSize: 17, marginLeft: 10 }}>CampusHub</span>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 40px' }}>
        <div style={{ maxWidth: 640, width: '100%', textAlign: 'center' }}>
          <h1>Select your institution</h1>
          <p className="muted" style={{ marginTop: 10, fontSize: 15 }}>
            Start typing your college's name to continue to sign in.
          </p>

          <div style={{ position: 'relative', marginTop: 32 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
              <IconSearch width={17} height={17} />
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
              onKeyDown={onKeyDown}
              placeholder="Type your college name…"
              style={{ width: '100%', padding: '15px 16px 15px 44px', fontSize: 16, borderRadius: 12, boxShadow: 'var(--shadow)' }}
            />
          </div>

          {loading && <p className="empty">Loading institutions…</p>}
          {error && <div className="banner banner-err" style={{ marginTop: 20, textAlign: 'left' }}>{error}</div>}

          {!loading && !error && (
            <div style={{ marginTop: 28, textAlign: 'left' }}>
              {q ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                    Results
                  </div>
                  {results.length === 0 && <p className="empty">No institutions match "{query}".</p>}
                  <div style={{ display: 'grid', gap: 8 }}>
                    {results.map((inst, i) => (
                      <button key={inst.id} onClick={() => go(inst)} className="card"
                              style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer',
                                       borderColor: i === activeIdx ? 'var(--ink)' : 'var(--line)' }}>
                        <Badge inst={inst} />
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontWeight: 700 }}>{inst.name}</span>
                          <span className="muted small">{[inst.city, inst.state].filter(Boolean).join(', ')}</span>
                        </span>
                        <span className="muted">→</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : recent.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                    Recent
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recent.map((inst) => (
                      <button key={inst.slug} onClick={() => navigate(`/login/${inst.slug}`)} className="card"
                              style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
                        <Badge inst={inst} />
                        <span style={{ flex: 1, fontWeight: 700 }}>{inst.name}</span>
                        <span className="muted">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!q && recent.length === 0 && all.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                    All institutions
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {all.map((inst) => (
                      <button key={inst.id} onClick={() => go(inst)} className="card"
                              style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
                        <Badge inst={inst} />
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontWeight: 700 }}>{inst.name}</span>
                          <span className="muted small">{[inst.city, inst.state].filter(Boolean).join(', ')}</span>
                        </span>
                        <span className="muted">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 12.5 }}>
        © {new Date().getFullYear()} CampusHub. All rights reserved.
      </footer>
    </div>
  );
}
