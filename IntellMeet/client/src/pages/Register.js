import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/axios';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit}>
        <h2>Create your account</h2>
        <p className="sub">Start your first meeting in under a minute.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" className="input" name="name" value={form.name} onChange={change} autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" className="input" type="email" name="email" value={form.email} onChange={change} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password (6+ characters)</label>
          <input id="password" className="input" type="password" name="password" value={form.password} onChange={change} autoComplete="new-password" minLength={6} required />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
