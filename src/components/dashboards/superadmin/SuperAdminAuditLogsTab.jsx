import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  Clock, 
  ShieldAlert, 
  Eye, 
  X, 
  Copy, 
  Check, 
  Terminal, 
  AlertCircle
} from 'lucide-react';
import { adminApi } from '../../../services/api';

export default function SuperAdminAuditLogsTab({ currentAdmin }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [actorTypeFilter, setActorTypeFilter] = useState('ALL');
  const [limit, setLimit] = useState(100);

  // Inspector modal state
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit };
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await adminApi.getAuditLogs(params);
      if (res.success && res.logs) {
        setLogs(res.logs);
      } else {
        setError(res.error || 'Failed to retrieve security audit logs.');
      }
    } catch (err) {
      console.error('Audit logs error:', err);
      setError('Network error while retrieving audit logs.');
    } finally {
      setLoading(false);
    }
  }, [limit, actionFilter, searchQuery]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Client-side filtering for actor type
  const filteredLogs = logs.filter(log => {
    if (actorTypeFilter === 'ALL') return true;
    return (log.actor_type || '').toUpperCase() === actorTypeFilter;
  });

  const copyDetailsJson = (details) => {
    if (navigator.clipboard) {
      const text = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Color helper for security actions
  const getActionColor = (action) => {
    if (action.includes('REJECT') || action.includes('REVOKE') || action.includes('FAILED') || action.includes('LOCKED')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
    if (action.includes('APPROVED') || action.includes('SUCCESS') || action.includes('ACCEPTED')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (action.includes('CREATED') || action.includes('DISPATCHED') || action.includes('INVITATION')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  };

  return (
    <div className="space-y-6">

      {/* Overview & Security Assertion */}
      <div className="card-glass rounded-2xl p-5 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white">
              Immutable Platform Security Audit Trail
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Server-enforced read-only security event logging for forensic audit and compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>VIEW_AUDIT_LOGS Authorized</span>
        </div>
      </div>

      {/* Error state if fetch failed */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-glass rounded-2xl p-6 border border-white/10 space-y-4">
        
        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action, actor, IP, details..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="ALL">All Actions</option>
              <option value="ADMIN_LOGIN_SUCCESS">ADMIN_LOGIN_SUCCESS</option>
              <option value="ADMIN_ACCOUNT_CREATED_MANUALLY">ADMIN_ACCOUNT_CREATED</option>
              <option value="ADMIN_INVITATION_DISPATCHED">ADMIN_INVITATION_DISPATCHED</option>
              <option value="ADMIN_INVITATION_ACCEPTED">ADMIN_INVITATION_ACCEPTED</option>
              <option value="DONATION_PROOF_APPROVED">DONATION_PROOF_APPROVED</option>
              <option value="DONATION_PROOF_REJECTED">DONATION_PROOF_REJECTED</option>
              <option value="ADMIN_SESSION_REVOKED_BY_SUPER_ADMIN">ADMIN_SESSION_REVOKED</option>
              <option value="ADMIN_PASSWORD_CHANGED">ADMIN_PASSWORD_CHANGED</option>
            </select>

            {/* Actor Type */}
            <select
              value={actorTypeFilter}
              onChange={(e) => setActorTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="ALL">All Actors</option>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>

            {/* Limit */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={200}>Last 200</option>
            </select>
          </div>

          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-space-900 border-b border-white/10 text-slate-400 uppercase text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Actor Type</th>
                <th className="py-2.5 px-3">Actor ID</th>
                <th className="py-2.5 px-3">Security Action</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">Client IP</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  let parsedDetails = log.details;
                  if (typeof parsedDetails === 'string' && (parsedDetails.startsWith('{') || parsedDetails.startsWith('['))) {
                    try {
                      parsedDetails = JSON.parse(parsedDetails);
                    } catch (_) {}
                  }

                  const detailsString = typeof parsedDetails === 'object' 
                    ? JSON.stringify(parsedDetails) 
                    : String(parsedDetails || '—');

                  return (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        <div className="text-white">{new Date(log.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.actor_type === 'ADMIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.actor_type}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-300 font-mono text-[11px] truncate max-w-[120px]" title={log.actor_id}>
                        {log.actor_id}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={detailsString}>
                        {detailsString}
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {log.ip_address}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-slate-300 hover:text-white font-mono text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Inspect structured audit event"
                        >
                          <Eye className="w-3 h-3 text-amber-400" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-10 text-center text-slate-400 text-xs font-mono">
                    {loading ? 'Querying security audit logs...' : 'No security audit events match the filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Audit Event Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full card-glass rounded-3xl p-6 border border-amber-500/30 space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-base text-white">
                    Audit Event Forensic Record
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedLog.id}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-space-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Actor Type</span>
                <div className="font-bold text-amber-300">{selectedLog.actor_type}</div>
              </div>

              <div className="p-3 rounded-xl bg-space-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Actor ID</span>
                <div className="font-bold text-white truncate" title={selectedLog.actor_id}>{selectedLog.actor_id}</div>
              </div>

              <div className="p-3 rounded-xl bg-space-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Client IP</span>
                <div className="font-bold text-slate-300">{selectedLog.ip_address}</div>
              </div>

              <div className="p-3 rounded-xl bg-space-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase">Timestamp</span>
                <div className="font-bold text-slate-300 text-[11px]">{new Date(selectedLog.created_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Event Action Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Recorded Action:</span>
              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getActionColor(selectedLog.action)}`}>
                {selectedLog.action}
              </span>
            </div>

            {/* Structured Details JSON View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">Payload / Event Details:</span>
                <button
                  onClick={() => copyDetailsJson(selectedLog.details)}
                  className="px-2.5 py-1 rounded-lg bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-space-950 border border-white/10 font-mono text-xs text-amber-200 overflow-x-auto max-h-60 select-all">
                <pre>
                  {(() => {
                    let d = selectedLog.details;
                    if (typeof d === 'string' && (d.startsWith('{') || d.startsWith('['))) {
                      try {
                        d = JSON.parse(d);
                      } catch (_) {}
                    }
                    return typeof d === 'object' ? JSON.stringify(d, null, 2) : d;
                  })()}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-white transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
