import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';

const ROLE_META = {
  student: { label: 'Student', idLabel: 'Institution email', idPlaceholder: (d) => d ? `you@${d}` : 'you@college.edu' },
  faculty: { label: 'Faculty', idLabel: 'Institution email', idPlaceholder: (d) => d ? `you@${d}` : 'you@college.edu' },
  admin:   { label: 'Administrator', idLabel: 'Admin email', idPlaceholder: () => 'admin@college.edu' }
};

export default function Login() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [institution, setInstitution] = useState(null);
  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('student');
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'student', department: '', rollNumber: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    api.get(`/institutions/${slug}`).then((res) => setInstitution(res.data)).catch(() => setLoadFailed(true));
  }, [slug]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const domains = (institution?.email_domains || '').split(',').map((d) => d.trim()).filter(Boolean);
  const meta = ROLE_META[accountType];

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'login') {
        const res = await api.post('/auth/login', { institutionSlug: slug, email: form.email, password: form.password });
        const actualRole = res.data.user.role;

        if (actualRole !== accountType) {
          // Let them in regardless -- the account type selector is a convenience,
          // not a gate -- but tell them so the mismatch isn't confusing.
          setNotice(`Signed in as ${ROLE_META[actualRole]?.label || actualRole} (your account's actual role).`);
        }

        const u = { ...res.data.user, institutionName: institution?.name, institutionSlug: slug };
        login(res.data.token, u);
        navigate(actualRole === 'student' ? '/student' : actualRole === 'faculty' ? '/faculty' : '/admin', { replace: true });
      } else {
        await api.post('/auth/signup', {
          institutionSlug: slug, name: form.name, email: form.email, password: form.password,
          role: form.role, department: form.department || null, rollNumber: form.rollNumber || null
        });
        setNotice('Account created. You can sign in now.');
        setMode('login');
        setForm({ ...form, password: '' });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  if (loadFailed) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Institution not found</h2>
        <p className="muted" style={{ marginTop: 8 }}>That link doesn't match any registered institution.</p>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: 18 }}>Back to the list</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexWrap: 'wrap' }}>
      {/* Left panel */}
      <div style={{
        flex: '1 1 380px', background: 'var(--ink)', color: '#DCE3F5',
        padding: 'calc(48px + env(safe-area-inset-top,0px)) 40px 48px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 260
      }}>
        <div>
          <Link to="/" style={{ color: '#8CA0D6', fontSize: 13 }}>← Change institution</Link>
          <div style={{ marginTop: 26 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, marginBottom: 18,
              background: institution?.accent_color || 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17
            }}>
              {(institution?.short_name || institution?.name || 'CH').slice(0, 3).toUpperCase()}
            </div>
            <h1 style={{ color: '#fff', fontSize: 27 }}>Welcome back</h1>
            <p style={{ color: '#9AACD9', marginTop: 8, fontSize: 14.5 }}>
              Sign in to access {institution?.name || 'your institution'}'s CampusHub portal.
            </p>
          </div>
        </div>
        <p style={{ color: '#7C8EBD', fontSize: 13, maxWidth: 320, marginTop: 32 }}>
          Faculty availability, campus queries, maintenance, transport, clubs and events — all in one place.
        </p>
      </div>

      {/* Right panel: form */}
      <div style={{ flex: '1 1 420px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ marginBottom: 4 }}>{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
          <p className="muted small" style={{ marginBottom: 22 }}>
            {mode === 'login' ? 'Use your institution credentials.' : `Open to ${domains.map((d) => '@' + d).join(' and ')} addresses.`}
          </p>

          {notice && <div className="banner banner-info">{notice}</div>}
          {error && <div className="banner banner-err">{error}</div>}

          {mode === 'login' && (
            <Field label="Account type">
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Administrator</option>
              </select>
            </Field>
          )}

          {mode === 'signup' && (
            <>
              <Field label="Full name"><input required value={form.name} onChange={set('name')} /></Field>
              <Field label="I am a">
                <select value={form.role} onChange={set('role')}>
                  <option value="student">Student</option>
                  <option value="faculty">Faculty member</option>
                </select>
              </Field>
              <Field label="Department (optional)"><input value={form.department} onChange={set('department')} placeholder="e.g. CSE" /></Field>
              {form.role === 'student' && (
                <Field label="Roll number (optional)"><input value={form.rollNumber} onChange={set('rollNumber')} /></Field>
              )}
            </>
          )}

          <Field label={mode === 'login' ? meta.idLabel : 'Institution email'}>
            <input type="email" required value={form.email} onChange={set('email')}
                   autoComplete="username" placeholder={mode === 'login' ? meta.idPlaceholder(domains[0]) : (domains[0] ? `you@${domains[0]}` : '')} />
          </Field>

          <Field label="Password">
            <input type="password" required value={form.password} onChange={set('password')}
                   autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'signup' && <p className="muted small" style={{ marginTop: 6 }}>At least 8 characters, with a letter and a number.</p>}
          </Field>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="small" style={{ textAlign: 'center', marginTop: 20 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
