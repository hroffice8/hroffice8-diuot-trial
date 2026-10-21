import React, { useEffect, useState } from 'react';
import { apiUrl, rememberApiUrl } from './lib/api';
import { ToastProvider, Button, Input, Notice } from './components/ui';
import SupervisorApp from './supervisor/SupervisorApp';
import AdminApp from './admin/AdminApp';

const isAdmin = () => location.hash.startsWith('#/admin');

/** Shown only when the portal has not been connected to its Apps Script backend yet. */
function Connect() {
  const [url, setUrl] = useState('');
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Notice tone="amber" title="The portal is not connected to its backend yet">
        Paste the Apps Script web app address (it ends with <code>/exec</code>). This is saved only in this browser — to connect it for everyone, set <code>VITE_API_URL</code> in the hosting settings.
      </Notice>
      <div className="mt-4 flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
        <Button disabled={!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url.trim())} onClick={() => { rememberApiUrl(url); location.reload(); }}>Connect</Button>
      </div>
    </div>
  );
}

export default function App() {
  const [admin, setAdmin] = useState(isAdmin());
  useEffect(() => { const f = () => setAdmin(isAdmin()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return <ToastProvider>{!apiUrl() ? <Connect /> : admin ? <AdminApp /> : <SupervisorApp />}</ToastProvider>;
}
