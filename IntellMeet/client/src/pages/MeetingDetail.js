import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiVideo, FiRefreshCw, FiTrash2, FiArrowLeft } from 'react-icons/fi';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatTime } from '../utils/format';
import './MeetingDetail.css';

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('minutes');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const load = useCallback(async () => {
    try {
      const [m, t, c] = await Promise.all([
        api.get(`/meetings/${id}`),
        api.get(`/meetings/${id}/transcript`),
        api.get(`/meetings/${id}/messages`),
      ]);
      setMeeting(m.data);
      setTranscript(t.data);
      setMessages(c.data);
      return m.data;
    } catch (err) {
      setError(errorMessage(err, 'Could not load this meeting.'));
      return null;
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Minutes are generated in the background after a meeting ends; check back briefly.
  useEffect(() => {
    if (!meeting || meeting.status !== 'ended' || meeting.summaryGeneratedAt) return undefined;
    const timer = setInterval(async () => {
      polls.current += 1;
      const m = await load();
      if ((m && m.summaryGeneratedAt) || polls.current >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [meeting, load]);

  const regenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/meetings/${id}/summarize`);
      setMeeting(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (item) => {
    const done = !item.done;
    setMeeting((m) => ({ ...m, actionItems: m.actionItems.map((a) => (a._id === item._id ? { ...a, done } : a)) }));
    try {
      await api.patch(`/meetings/${id}/action-items/${item._id}`, { done });
    } catch (err) {
      setError(errorMessage(err));
      load();
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this meeting and its minutes? This cannot be undone.')) return;
    try {
      await api.delete(`/meetings/${id}`);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (error && !meeting) return <div className="form-error" role="alert">{error}</div>;
  if (!meeting) return <p className="empty">Loading meeting…</p>;

  const isHost = meeting.host._id === user._id;
  const ended = meeting.status === 'ended';
  const hasSummary = !!meeting.summaryGeneratedAt;

  return (
    <div className="md">
      <Link to="/" className="md-back"><FiArrowLeft /> All meetings</Link>

      <header className="md-head">
        <div>
          <h1>{meeting.title}</h1>
          <p className="md-meta">
            {formatDateTime(meeting.scheduledAt)} · hosted by {meeting.host.name}
            {meeting.workspace ? ` · ${meeting.workspace.name}` : ''}
          </p>
          <p className="md-people">With {meeting.participants.map((p) => p.name).join(', ')}</p>
        </div>
        <div className="md-actions">
          {!ended && (
            <button className="btn btn-primary" onClick={() => navigate(`/room/${meeting.roomId}`)}>
              <FiVideo /> {meeting.status === 'live' ? 'Join meeting' : 'Start meeting'}
            </button>
          )}
          {isHost && (
            <button className="btn btn-ghost" onClick={remove}><FiTrash2 /> Delete</button>
          )}
        </div>
      </header>

      {meeting.description && <p className="md-agenda">{meeting.description}</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="md-tabs" role="tablist">
        {[
          ['minutes', 'Minutes'],
          ['transcript', `Transcript (${transcript.length})`],
          ['chat', `Chat (${messages.length})`],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'md-tab on' : 'md-tab'} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'minutes' && (
        <section className="md-minutes">
          {!ended && !hasSummary && <p className="empty">Minutes are written once the meeting ends.</p>}
          {ended && !hasSummary && <p className="empty">Writing the minutes… this page updates when they are ready.</p>}

          {ended && (
            <button className="btn btn-ghost btn-sm md-regen" onClick={regenerate} disabled={busy}>
              <FiRefreshCw /> {busy ? 'Generating…' : hasSummary ? 'Regenerate minutes' : 'Generate minutes now'}
            </button>
          )}

          {hasSummary && (
            <>
              <div className="md-block">
                <h2>Summary</h2>
                <p className="md-summary">{meeting.summary}</p>
              </div>

              <div className="md-two">
                <div className="md-block">
                  <h2>Key points</h2>
                  {meeting.keyPoints.length ? <ul>{meeting.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul> : <p className="empty">None recorded.</p>}
                </div>
                <div className="md-block">
                  <h2>Decisions</h2>
                  {meeting.decisions.length ? <ul>{meeting.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul> : <p className="empty">No decisions recorded.</p>}
                </div>
              </div>

              <div className="md-block">
                <h2>Action items</h2>
                {meeting.actionItems.length === 0 ? (
                  <p className="empty">No action items were found in this meeting.</p>
                ) : (
                  <ul className="md-actions-list">
                    {meeting.actionItems.map((a) => (
                      <li key={a._id} className={a.done ? 'done' : ''}>
                        <label>
                          <input type="checkbox" checked={a.done} onChange={() => toggleItem(a)} />
                          <span className="md-task">{a.task}</span>
                        </label>
                        <span className="md-owner">
                          {a.assignee || 'Unassigned'}{a.dueDate ? ` · due ${a.dueDate}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'transcript' && (
        <section className="md-log">
          {transcript.length === 0 ? (
            <p className="empty">No speech was transcribed. Live captions work in Chrome and Edge with the microphone on.</p>
          ) : (
            transcript.map((t) => (
              <p key={t._id}><time>{formatTime(t.at)}</time> <strong>{t.speakerName}</strong> {t.text}</p>
            ))
          )}
        </section>
      )}

      {tab === 'chat' && (
        <section className="md-log">
          {messages.length === 0 ? (
            <p className="empty">Nobody sent a chat message in this meeting.</p>
          ) : (
            messages.map((m) => (
              <p key={m._id}><time>{formatTime(m.createdAt)}</time> <strong>{m.senderName}</strong> {m.text}</p>
            ))
          )}
        </section>
      )}
    </div>
  );
}
