import { useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Live speech-to-text using the browser's Web Speech API (Chrome / Edge).
 * Each participant transcribes their own microphone; the server stores and broadcasts the text,
 * so the final transcript is correctly attributed to each speaker.
 */
export default function useTranscription(socket, active) {
  const supported = !!SpeechRecognition;

  useEffect(() => {
    if (!socket || !active || !supported) return undefined;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    let stopped = false;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (text) socket.emit('transcript', { text });
        }
      }
    };
    rec.onend = () => {
      if (!stopped) {
        try { rec.start(); } catch { /* already started */ }
      }
    };
    rec.onerror = () => {};

    try { rec.start(); } catch { /* ignore */ }
    return () => {
      stopped = true;
      try { rec.stop(); } catch { /* ignore */ }
    };
  }, [socket, active, supported]);

  return supported;
}
