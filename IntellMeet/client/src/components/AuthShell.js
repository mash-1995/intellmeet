import React from 'react';
import { FiVideo } from 'react-icons/fi';
import '../pages/Auth.css';

export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <section className="auth-aside">
        <div className="auth-brand">
          <span className="brand-mark"><FiVideo /></span> IntellMeet
        </div>
        <div className="auth-pitch">
          <h1>Meetings that write their own minutes.</h1>
          <p>Talk with your team over video. When you hang up, the summary, decisions and action items are already waiting.</p>
        </div>
        <div className="minutes-sample" aria-hidden="true">
          <h2>Product sync: minutes</h2>
          <ul>
            <li><span>Decided</span> Ship the new onboarding flow on Friday.</li>
            <li><span>Priya</span> Send the pricing draft to legal by Wednesday.</li>
            <li><span>Marcus</span> Book usability sessions for next week.</li>
          </ul>
        </div>
      </section>
      <section className="auth-main">{children}</section>
    </div>
  );
}
