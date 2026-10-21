import React, { useMemo, useState } from 'react';
import { prettyStamp } from '../lib/time';
import { Card, ErrorText, Input, Spinner, tableCls, tdCls, thCls } from '../components/ui';
import { useLoad } from './AdminApp';

export function AuditPage() {
  const log = useLoad<any[]>('audit.list', { limit: 1000 }, []);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (log.data || []).filter(r => !s || `${r.actor} ${r.action} ${r.month} ${r.details}`.toLowerCase().includes(s));
  }, [log.data, q]);
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Activity log</h1><p className="text-sm text-slate-500">Every sign-in, upload, approval change, submission, email and status change (latest 1,000).</p></div>
      <ErrorText error={log.error} />
      <Card actions={<Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search person, action, employee ID…" className="!w-72 !py-1.5" />} title={`${rows.length} entries`}>
        {log.busy && !log.data ? <Spinner /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className={tableCls}>
              <thead><tr>{['When', 'Who', 'What', 'Month', 'Details'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i}><td className={tdCls + ' whitespace-nowrap text-xs'}>{prettyStamp(r.at)}</td><td className={tdCls + ' text-xs'}>{r.actor}</td><td className={tdCls + ' text-xs font-semibold'}>{r.action}</td>
                  <td className={tdCls + ' text-xs'}>{r.month}</td><td className={tdCls + ' max-w-xl break-all text-xs text-slate-600'}>{r.details}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
