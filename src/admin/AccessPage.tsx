import React, { useState } from 'react';
import { call } from '../lib/api';
import { prettyStamp } from '../lib/time';
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Notice, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../components/ui';
import { Perms, useLoad } from './AdminApp';

const AREAS: [string, string, string][] = [
  ['months', 'Months', 'Open months, upload attendance, office schedule, open/pause'],
  ['employees', 'Employees & reviewers', 'HRIS uploads, reviewer overrides, delegates'],
  ['approvals', 'Approvals', 'HR approvals and the Maintenance list'],
  ['mail', 'Supervisors & emails', 'Progress, invitations, reminders'],
  ['bill', 'Bill', 'See and download the bill; close and disburse with Edit'],
  ['settings', 'Rates & settings', 'Rates, signatories, general settings'],
  ['audit', 'Activity log', 'Who did what and when']
];

export function AccessPage({ owner }: { perms: Perms; owner: boolean }) {
  const list = useLoad<any[]>('access.list', {}, []);
  const [edit, setEdit] = useState<any>(null);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-slate-900">Access</h1><p className="text-sm text-slate-500">Who can sign in to this admin panel, and what they can see or change. Only the owner can change this page.</p></div>
        {owner && <Button onClick={() => setEdit({ email: '', name: '', permissions: {}, active: true, isNew: true })}>+ Give someone access</Button>}
      </div>
      <ErrorText error={list.error} />
      <Card>
        {list.busy && !list.data ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><th className={thCls}>Person</th>{AREAS.map(a => <th key={a[0]} className={thCls}>{a[1]}</th>)}<th className={thCls}></th></tr></thead>
              <tbody>{(list.data || []).map(p => (
                <tr key={p.email} className={p.active ? '' : 'opacity-50'}>
                  <td className={tdCls}><div className="font-semibold">{p.email}</div><div className="text-xs text-slate-500">{p.owner ? 'Owner — full access' : `${p.name || ''}${p.addedAt ? ` · added ${prettyStamp(p.addedAt)}` : ''}`}{!p.active && ' · removed'}</div></td>
                  {AREAS.map(a => { const v = p.permissions?.[a[0]] || 'none'; return <td key={a[0]} className={tdCls}>{v === 'edit' ? <Badge tone="green">Edit</Badge> : v === 'view' ? <Badge tone="blue">View</Badge> : <span className="text-xs text-slate-400">—</span>}</td>; })}
                  <td className={tdCls + ' text-right'}>{owner && !p.owner && <Button variant="ghost" onClick={() => setEdit(p)}>Change</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Notice tone="slate">People sign in with a one-time code sent to their DIU email. Removing someone takes effect immediately.</Notice>
      {edit && <EditAccess value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); }} />}
    </div>
  );
}

function EditAccess({ value, onClose, onSaved }: { value: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ email: value.email, name: value.name || '', permissions: { ...(value.permissions || {}) }, active: value.active !== false });
  const a = useAction();
  const toast = useToast();
  const setP = (k: string, v: string) => setF(x => ({ ...x, permissions: { ...x.permissions, [k]: v } }));
  const save = (active: boolean) => a.run(async () => { await call('access.save', { ...f, active }, 'admin'); toast(active ? 'Access saved.' : 'Access removed.'); onSaved(); });
  return (
    <Modal wide title={value.isNew ? 'Give someone access' : `Access for ${value.email}`} onClose={onClose}
      footer={<>{!value.isNew && f.active && <Button variant="danger" loading={a.busy} onClick={() => save(false)}>Remove access</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={a.busy} onClick={() => save(true)}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="DIU email"><Input value={f.email} disabled={!value.isNew} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@daffodilvarsity.edu.bd" /></Field>
          <Field label="Name (for your reference)"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        </div>
        <table className={tableCls}>
          <thead><tr><th className={thCls}>Area</th><th className={thCls}>None</th><th className={thCls}>View</th><th className={thCls}>Edit</th></tr></thead>
          <tbody>{AREAS.map(([k, label, desc]) => (
            <tr key={k}><td className={tdCls}><div className="font-semibold">{label}</div><div className="text-xs text-slate-500">{desc}</div></td>
              {['none', 'view', 'edit'].map(v => <td key={v} className={tdCls}><input type="radio" name={k} checked={(f.permissions[k] || 'none') === v} onChange={() => setP(k, v)} /></td>)}</tr>
          ))}</tbody>
        </table>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => setF(x => ({ ...x, permissions: Object.fromEntries(AREAS.map(a => [a[0], 'view'])) }))}>View everything</Button>
          <Button variant="secondary" onClick={() => setF(x => ({ ...x, permissions: { bill: 'view' } }))}>Only download the bill</Button></div>
        <ErrorText error={a.error} />
      </div>
    </Modal>
  );
}
