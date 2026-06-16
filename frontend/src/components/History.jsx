import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  MailCheck, 
  AlertCircle, 
  Eye, 
  Calendar,
  XCircle,
  MailQuestion
} from 'lucide-react';

function History({ apiFetch }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected Log Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const url = `/api/history?search=${encodeURIComponent(search)}&status=${statusFilter}&type=${typeFilter}`;
      const res = await apiFetch(url);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      setError('Failed to fetch history logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [search, statusFilter, typeFilter]);

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear ALL sent email history logs? This action is irreversible.')) return;
    try {
      const res = await apiFetch('/api/history/clear', { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('History log cleared.');
        fetchHistory();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Failed to clear logs.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-container">
          <p>Ve Veyron Exports History</p>
          <h1>Sent Outreach Logs</h1>
        </div>
        {history.length > 0 && (
          <button className="btn btn-danger" onClick={handleClearHistory}>
            <Trash2 size={16} /> Clear Logs
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* Filters Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flexGrow: 1, minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={16} />
          </span>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by company, email, subject..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ width: '150px' }}>
          <select 
            className="form-control" 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Deliveries</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Email Stage Type Filter */}
        <div style={{ width: '180px' }}>
          <select 
            className="form-control" 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Stages</option>
            <option value="Primary">Primary Pitch</option>
            <option value="Follow-up 1">Follow-up 1 (Day 7)</option>
            <option value="Follow-up 2">Follow-up 2 (Day 15)</option>
          </select>
        </div>

      </div>

      {/* History Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading && history.length === 0 ? (
          <div style={{ padding: '2rem', color: 'var(--primary)' }}>Retrieving logs...</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No sent logs found matching filter criteria.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Sent Timestamp</th>
                  <th>Company Name</th>
                  <th>Recipient Email</th>
                  <th>Subject</th>
                  <th>Outreach Stage</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Calendar size={12} />
                        {new Date(log.sent_at).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600', color: '#fff' }}>{log.company_name}</td>
                    <td>{log.email_address}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.subject}
                    </td>
                    <td>
                      <span className={`badge ${
                        log.type === 'Primary' ? 'badge-info' : 'badge-success'
                      }`} style={{ fontSize: '0.65rem' }}>
                        {log.type}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        log.status === 'Success' ? 'badge-success' : 'badge-failed'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-icon-only" 
                        onClick={() => setSelectedLog(log)}
                        style={{ width: '28px', height: '28px' }}
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL: READ DISPATCHED EMAIL CONTENT */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedLog.status === 'Success' ? (
                    <MailCheck style={{ color: 'var(--primary)' }} size={20} />
                  ) : (
                    <MailQuestion style={{ color: 'var(--color-failed)' }} size={20} />
                  )}
                  Audit Sent Outreach Mail
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Stage: {selectedLog.type} | Sent: {new Date(selectedLog.sent_at).toLocaleString()}
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Recipient Company</span>
                  <span style={{ fontWeight: '600', color: '#fff' }}>{selectedLog.company_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Target Email</span>
                  <span style={{ fontWeight: '600' }}>{selectedLog.email_address}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Email Subject</span>
                <span style={{ fontWeight: '600', color: '#fff' }}>{selectedLog.subject}</span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Email Body Sent</span>
                <div style={{ 
                  backgroundColor: 'rgba(0,0,0,0.25)', 
                  border: '1px solid var(--border-color)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  maxHeight: '260px', 
                  overflowY: 'auto',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  color: '#e5e7eb'
                }}>
                  {selectedLog.body}
                </div>
              </div>

              {selectedLog.error_message && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#f87171' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', color: 'rgba(248,113,113,0.7)' }}>Error Details</span>
                    <span style={{ fontSize: '0.8rem' }}>{selectedLog.error_message}</span>
                  </div>
                </div>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>Close audit</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default History;
