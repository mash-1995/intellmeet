import React, { useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { toLocalInput } from '../utils/format';
import './ScheduleModal.css';

export default function ScheduleModal({ workspaces, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: toLocalInput(new Date(Date.now() + 3600000)), workspace: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/meetings', {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        workspace: form.workspace || undefined,
      });
      onCreated(data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sched-title">
        <h2 id="sched-title">Schedule a meeting</h2>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="m-title">Title</label>
          <input id="m-title" className="input" name="title" value={form.title} onChange={change} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="m-desc">Agenda (optional)</label>
          <textarea id="m-desc" className="input" name="description" value={form.description} onChange={change} />
        </div>
        <div className="modal-row">
          <div className="field">
            <label htmlFor="m-when">Date and time</label>
            <input id="m-when" className="input" type="datetime-local" name="scheduledAt" value={form.scheduledAt} onChange={change} required />
          </div>
          <div className="field">
            <label htmlFor="m-ws">Workspace</label>
            <select id="m-ws" className="input" name="workspace" value={form.workspace} onChange={change}>
              <option value="">Personal</option>
              {workspaces.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Scheduling…' : 'Schedule meeting'}</button>
        </div>
      </form>
    </div>
  );
}
