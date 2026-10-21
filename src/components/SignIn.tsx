import React, { useState } from 'react';
import { call, session, Role } from '../lib/api';
import { Button, ErrorText, Field, Input, useAction } from './ui';

/** Email → 6-digit code → signed in. */
export function SignIn({ role, onDone, intro }: { role: Role; onDone: (email: string, perms?: any) => void; intro?: React.ReactNode }) {
  const [email, setEmail] = useState(session.email(role));
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [info, setInfo] = useState('');
  const { busy, error, run, setError } = useAction();

  const send = () => run(async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Please enter your official email address.');
    const r = await call('auth.sendOtp', { email: e, purpose: role });
    setInfo(r.message); setStep('code'); setCode('');
  });
  const verify = () => run(async () => {
    if (!/^\d{6}$/.test(code.trim())) throw new Error('The code has 6 digits.');
    const r = await call('auth.verify', { email: email.trim().toLowerCase(), code: code.trim(), purpose: role });
    session.save(role, r.token, r.email);
    onDone(r.email, r.perms);
  });

  return (
    <div className="mx-auto w-full max-w-md">
      {intro}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-800">{role === 'admin' ? 'Admin sign-in' : 'Supervisor sign-in'}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {role === 'admin' ? 'Only people the owner has given access can sign in.' : 'Use your official DIU email. You will see the employees you supervise.'}
        </p>
        {step === 'email' ? (
          <form onSubmit={e => { e.preventDefault(); send(); }} className="space-y-4">
            <Field label="Official email">
              <Input type="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="name@daffodilvarsity.edu.bd" />
            </Field>
            <ErrorText error={error} />
            <Button type="submit" loading={busy} className="w-full py-3">Send sign-in code</Button>
          </form>
        ) : (
          <form onSubmit={e => { e.preventDefault(); verify(); }} className="space-y-4">
            <p className="text-sm text-slate-600">{info} <br />Check <b>{email}</b> (and the spam folder).</p>
            <Field label="6-digit code">
              <Input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-bold tracking-[0.5em]" placeholder="••••••" />
            </Field>
            <ErrorText error={error} />
            <Button type="submit" loading={busy} className="w-full py-3">Sign in</Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-slate-500 hover:underline" onClick={() => { setStep('email'); setError(null); }}>Change email</button>
              <button type="button" className="font-semibold text-[#006a4e] hover:underline" onClick={send} disabled={busy}>Send a new code</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
