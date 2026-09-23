import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Chip, Empty, Loading, Modal, Field, formatDate } from '../components/ui';
import { IconInbox, IconCheck, IconCalendar, IconClub, IconWrench } from '../components/icons';

const STATUS_OPTIONS = ['Available', 'In Class', 'In Meeting', 'Out of Office'];

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [myClubs, setMyClubs] = useState([]);

  useEffect(() => {
    api.get(`/faculty/${user.id}`).then((r) => { setStatus(r.data.status); setNote(r.data.note || ''); }).catch(() => {});
    api.get('/clubs').then((r) => setMyClubs(r.data.filter((c) => c.coordinator_id === user.id))).catch(() => {});
  }, [user.id]);

  const save = async (nextStatus, nextNote) => {
    setSaving(true);
    try {
      await api.put('/faculty/status', { status: nextStatus, note: nextNote });
      setStatus(nextStatus);
    } finally { setSaving(false); }
  };

  const sections = [
    { label: 'Messages', items: [
      { key: 'inbox', label: 'Inbox', icon: IconInbox },
      { key: 'answered', label: 'Answered', icon: IconCheck },
    ]},
    { label: 'Campus', items: [
      { key: 'events', label: 'Events', icon: IconCalendar },
      ...(myClubs.length ? [{ key: 'club', label: 'My club', icon: IconClub }] : []),
      { key: 'maintenance', label: 'Maintenance', icon: IconWrench },
    ]}
  ];

  const titles = { inbox: 'Inbox', answered: 'Answered queries', events: 'Campus events', club: 'My club', maintenance: 'Maintenance' };

  return (
    <Layout sections={sections} active={tab} onNavChange={setTab} pageTitle={titles[tab]}>
      {/* availability control */}
      <div className="card" style={{ marginBottom: 26 }}>
        <label className="field">Your availability right now</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} disabled={saving}
                    className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => save(s, note)}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <input placeholder="Optional note students will see, e.g. 'Back at 3pm'"
                 value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: '1 1 260px' }} />
          <button className="btn btn-secondary btn-sm" disabled={saving || !status}
                  onClick={() => save(status, note)}>Save note</button>
        </div>
      </div>

      {tab === 'inbox' && <InboxTab />}
      {tab === 'answered' && <AnsweredTab />}
      {tab === 'events' && <FacultyEventsTab />}
      {tab === 'club' && <MyClubTab clubs={myClubs} />}
      {tab === 'maintenance' && <FacultyMaintenanceTab />}
    </Layout>
  );
}

function InboxTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/messages/inbox', { params: { status: 'Pending' } }),
      api.get('/messages/inbox', { params: { status: 'Read' } })
    ]).then(([p, r]) => {
      setList([...p.data, ...r.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const open = async (m) => {
    setTarget(m); setReply('');
    if (m.status === 'Pending') { try { await api.put(`/messages/${m.id}/read`); load(); } catch {} }
  };

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.put(`/messages/${target.id}/reply`, { reply }); setTarget(null); load(); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading what="Loading your inbox" />;
  if (!list.length) return <Empty>Nothing waiting on you. Nice.</Empty>;

  return (
    <div>
      {list.map((m) => (
        <div key={m.id} className="row">
          <div className="row-head">
            <div>
              <strong>{m.subject || 'Untitled query'}</strong>
              <div className="row-meta">
                {m.student_name}{m.roll_number ? ` (${m.roll_number})` : ''} · {formatDate(m.created_at)}
              </div>
            </div>
            <Chip label={m.status} />
          </div>
          <p style={{ margin: '8px 0 10px', fontSize: 14 }}>{m.content}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => open(m)}>Reply</button>
        </div>
      ))}

      {target && (
        <Modal title={`Reply to ${target.student_name}`} subtitle={target.subject || 'Untitled query'}
               onClose={() => setTarget(null)}>
          <p className="muted small" style={{ background: 'var(--paper-sunken)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            {target.content}
          </p>
          <form onSubmit={send}>
            <Field label="Your reply">
              <textarea required rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reply'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AnsweredTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/messages/inbox', { params: { status: 'Answered' } })
      .then((r) => setList(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!list.length) return <Empty>No answered queries yet.</Empty>;

  return list.map((m) => (
    <div key={m.id} className="row">
      <strong>{m.subject || 'Untitled query'}</strong>
      <div className="row-meta">{m.student_name} · answered {formatDate(m.replied_at)}</div>
      <p style={{ margin: '8px 0 0', fontSize: 14 }}>{m.content}</p>
      <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: '2px solid var(--accent)' }}>
        <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Your reply</div>
        <p style={{ margin: '3px 0 0', fontSize: 14 }}>{m.reply}</p>
      </div>
    </div>
  ));
}

/* ------------------------------------------------------------------ */
function FacultyEventsTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'Workshop', venue: '', event_date: '', start_time: '', organizer: '' });
  const [busy, setBusy] = useState(false);

  const load = () => { setLoading(true); api.get('/events', { params: { scope: 'upcoming' } }).then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/events', form);
      setOpen(false);
      setForm({ title: '', description: '', category: 'Workshop', venue: '', event_date: '', start_time: '', organizer: '' });
      load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Create an event</button>
      </div>

      {loading ? <Loading what="Loading events" /> : !list.length ? <Empty>No upcoming events.</Empty> : (
        list.map((e) => (
          <div key={e.id} className="row">
            <div className="row-head">
              <div>
                <strong>{e.title}</strong>
                <div className="row-meta">{formatDate(e.event_date)}{e.venue ? ` · ${e.venue}` : ''} · {e.registration_count} registered</div>
              </div>
              <Chip label={e.category} tone="chip-neutral" />
            </div>
            {e.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{e.description}</p>}
          </div>
        ))
      )}

      {open && (
        <Modal title="Create a campus event" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Fest', 'Guest Lecture', 'Placement', 'Workshop', 'Sports', 'Exam Notice', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
            <Field label="Start time (optional)"><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
            <Field label="Venue"><input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
            <Field label="Details"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function MyClubTab({ clubs }) {
  const [clubId, setClubId] = useState(clubs[0]?.id ?? null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ type: 'Announcement', title: '', description: '', event_date: '', venue: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback((id) => { if (id) api.get(`/clubs/${id}`).then((r) => setDetail(r.data)); }, []);
  useEffect(() => { load(clubId); }, [clubId, load]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post(`/clubs/${clubId}/posts`, form);
      setForm({ type: 'Announcement', title: '', description: '', event_date: '', venue: '' });
      load(clubId);
    } finally { setBusy(false); }
  };

  const remove = async (postId) => { await api.delete(`/clubs/posts/${postId}`); load(clubId); };

  return (
    <div>
      {clubs.length > 1 && (
        <select value={clubId} onChange={(e) => setClubId(Number(e.target.value))} style={{ maxWidth: 320, marginBottom: 20 }}>
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.club_name}</option>)}
        </select>
      )}

      <h3 style={{ marginBottom: 16 }}>{detail?.club_name}</h3>

      <form onSubmit={submit} className="card" style={{ maxWidth: 480, marginBottom: 28 }}>
        <h4 style={{ marginBottom: 14 }}>Post an update</h4>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Announcement</option><option>Event</option><option>Contest</option>
          </select>
        </Field>
        <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Details"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Date (optional)"><input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
        <Field label="Venue (optional)"><input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
      </form>

      <h4 style={{ marginBottom: 10 }}>Existing posts</h4>
      {!detail ? <Loading /> : !detail.posts.length ? <Empty>Nothing posted yet.</Empty> : (
        detail.posts.map((p) => (
          <div key={p.id} className="row">
            <div className="row-head">
              <div>
                <strong>{p.title}</strong>
                <div className="row-meta">{p.type}{p.event_date ? ` · ${formatDate(p.event_date)}` : ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id)}>Delete</button>
            </div>
            {p.description && <p style={{ margin: '8px 0 0', fontSize: 14 }}>{p.description}</p>}
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function FacultyMaintenanceTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Electrical', location: '', room_number: '', description: '', priority: 'Medium' });
  const [busy, setBusy] = useState(false);

  const load = () => { setLoading(true); api.get('/maintenance/mine').then((r) => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/maintenance', form);
      setOpen(false);
      setForm({ category: 'Electrical', location: '', room_number: '', description: '', priority: 'Medium' });
      load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Report an issue</button>
      </div>
      {loading ? <Loading /> : !list.length ? <Empty>You haven't reported anything.</Empty> : (
        list.map((r) => (
          <div key={r.id} className="row">
            <div className="row-head">
              <div>
                <strong>{r.category} · {r.location}{r.room_number ? ` (${r.room_number})` : ''}</strong>
                <div className="row-meta">{formatDate(r.created_at)} · {r.priority} priority</div>
              </div>
              <Chip label={r.status} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>{r.description}</p>
          </div>
        ))
      )}

      {open && (
        <Modal title="Report a maintenance issue" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Electrical', 'Furniture', 'Internet', 'Cleaning', 'Water', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Location"><input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Room number"><input value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} /></Field>
            <Field label="Details"><textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['Low', 'Medium', 'High'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
