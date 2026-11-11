import React, { useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import api from '../api/axios';
import { formatTime } from '../utils/format';
import './Panel.css';

export default function ChatPanel({ socket, meetingId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    api.get(`/meetings/${meetingId}/messages`).then((r) => setMessages(r.data)).catch(() => {});
  }, [meetingId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (msg) => setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
    socket.on('chat-message', onMessage);
    return () => socket.off('chat-message', onMessage);
  }, [socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;
    socket.emit('chat-message', { text });
    setText('');
  };

  return (
    <div className="panel-body">
      <div className="panel-scroll">
        {messages.length === 0 && <p className="panel-empty">No messages yet. Say hello to the room.</p>}
        {messages.map((m) => (
          <div key={m._id} className={`chat-msg${m.sender === user._id ? ' mine' : ''}`}>
            <div className="chat-meta"><strong>{m.sender === user._id ? 'You' : m.senderName}</strong> <time>{formatTime(m.createdAt)}</time></div>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message everyone" aria-label="Chat message" maxLength={2000} />
        <button aria-label="Send message" disabled={!text.trim()}><FiSend /></button>
      </form>
    </div>
  );
}
