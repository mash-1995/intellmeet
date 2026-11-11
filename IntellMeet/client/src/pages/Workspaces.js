import React, { useEffect, useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import './Workspaces.css';

export default function Workspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api
      .get('/workspaces')
      .then((r) => setWorkspaces(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/workspaces', form);
      setWorkspaces((prev) => [data, ...prev]);
      setForm({ name: '', description: '' });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/workspaces/join', { inviteCode });
      setWorkspaces((prev) => [data, ...prev.filter((w) => w._id !== data._id)]);
      setInviteCode('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const leave = async (id) => {
    if (!window.confirm('Leave this workspace? You will lose access to its meetings.')) return;
    try {
      await api.delete(`/workspaces/${id}/leave`);
      setWorkspaces((prev) => prev.filter((w) => w._id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div>
      <header className="ws-head">
        <h1>Workspaces</h1>
        <p>Group teammates so everyone sees the same meetings, minutes and action items.</p>
      </header>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="ws-forms">
        <form onSubmit={create} className="ws-form">
          <h2>Create a workspace</h2>
          <div className="field">
            <label htmlFor="ws-name">Name</label>
            <input id="ws-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="ws-desc">What is it for? (optional)</label>
            <input id="ws-desc" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn btn-primary">Create workspace</button>
        </form>

        <form onSubmit={join} className="ws-form">
          <h2>Join with an invite code</h2>
          <div className="field">
            <label htmlFor="ws-code">Invite code</label>
            <input id="ws-code" className="input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g. 9A41FC" required />
          </div>
          <button className="btn btn-ghost">Join workspace</button>
        </form>
      </div>

      <section className="ws-list">
        <h2>Your workspaces</h2>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="empty">You are not in a workspace yet. Create one above, or paste an invite code from a teammate.</p>
        ) : (
          workspaces.map((w) => (
            <article key={w._id} className="ws-item">
              <div className="ws-item-top">
                <div>
                  <h3>{w.name}</h3>
                  {w.description && <p className="ws-desc">{w.description}</p>}
                </div>
                <div className="ws-code">
                  <span>Invite code</span>
                  <button onClick={() => copy(w.inviteCode)} aria-label={`Copy invite code ${w.inviteCode}`}>
                    <code>{w.inviteCode}</code> {copied === w.inviteCode ? <FiCheck /> : <FiCopy />}
                  </button>
                </div>
              </div>
              <div className="ws-members">
                {w.members.map((m) => (
                  <span key={m.user._id} className="ws-member" title={m.user.email}>
                    <span className="avatar">{initials(m.user.name)}</span>
                    {m.user.name}{m.role === 'owner' ? ' (owner)' : ''}
                  </span>
                ))}
              </div>
              {w.owner !== user._id && (
                <button className="btn btn-ghost btn-sm" onClick={() => leave(w._id)}>Leave workspace</button>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
