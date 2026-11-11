import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { formatTime } from '../utils/format';
import './Panel.css';

export default function TranscriptPanel({ socket, meetingId, supported, captionsOn }) {
  const [entries, setEntries] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    api.get(`/meetings/${meetingId}/transcript`).then((r) => setEntries(r.data)).catch(() => {});
  }, [meetingId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onEntry = (entry) => setEntries((prev) => [...prev, { ...entry, _id: `${entry.at}-${prev.length}` }]);
    socket.on('transcript', onEntry);
    return () => socket.off('transcript', onEntry);
  }, [socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="panel-body">
      <div className="panel-scroll">
        {!supported && (
          <p className="panel-note">Your browser cannot transcribe speech. Use Chrome or Edge to add your voice to the transcript.</p>
        )}
        {supported && !captionsOn && <p className="panel-note">Transcription is off for you. Turn on captions to add your speech.</p>}
        {entries.length === 0 && <p className="panel-empty">Speech appears here as people talk. It feeds the minutes after the meeting.</p>}
        {entries.map((t) => (
          <div key={t._id} className="tr-entry">
            <div className="chat-meta"><strong>{t.speakerName}</strong> <time>{formatTime(t.at)}</time></div>
            <p>{t.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
