import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar,
  ChevronRight,
  TrendingUp,
  Plus
} from 'lucide-react';

function Dashboard({ apiFetch, setActiveTab }) {
  const [stats, setStats] = useState({
    totalBuyers: 0,
    totalSent: 0,
    totalFailed: 0,
    pendingPrimary: 0,
    pendingFollowups: 0,
    dailyActivity: []
  });
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      // Fetch stats
      const statsRes = await apiFetch('/api/history/stats');
      const statsData = await statsRes.json();
      
      // Fetch active campaigns
      const campaignsRes = await apiFetch('/api/campaigns');
      const campaignsData = await campaignsRes.json();

      setStats(statsData);
      setCampaigns(campaignsData.slice(0, 3)); // show top 3 campaigns
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard metrics.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Poll every 4 seconds to update campaign progress silently in real-time
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Compute stats details
  const successRate = stats.totalSent + stats.totalFailed > 0 
    ? Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100) 
    : 100;

  // Custom SVG line chart plotting helper
  const renderSVGChart = () => {
    const data = stats.dailyActivity || [];
    if (data.length === 0) {
      return (
        <div style={{
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: '0.9rem'
        }}>
          No recent email sending activity recorded.
        </div>
      );
    }

    const height = 180;
    const width = 500;
    const padding = 30;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    const maxCount = Math.max(...data.map(d => d.count), 5); // at least 5 for scale
    
    // Generate coordinate points
    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - (d.count / maxCount) * chartHeight;
      return { x, y, label: d.date.split('-').slice(1).join('/'), count: d.count };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    // Area helper
    const areaD = data.length > 0 
      ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + chartHeight * ratio;
          const val = Math.round(maxCount * (1 - ratio));
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={padding - 5} y={y + 4} fill="#6b7280" fontSize="9" textAnchor="end">{val}</text>
            </g>
          );
        })}

        {/* Shaded Area */}
        {areaD && <path d={areaD} fill="url(#chartGrad)" opacity="0.15" />}

        {/* Main Line */}
        {pathD && <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" />}

        {/* Data points */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={4} fill="#10b981" stroke="#0a0d14" strokeWidth={2} />
            <text x={p.x} y={height - padding + 15} fill="#6b7280" fontSize="9" textAnchor="middle">{p.label}</text>
            <text x={p.x} y={p.y - 8} fill="#f3f4f6" fontSize="8" fontWeight="600" textAnchor="middle">{p.count}</text>
          </g>
        ))}

        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  if (loading) {
    return <div style={{ color: 'var(--primary)', padding: '2rem' }}>Recalculating statistics...</div>;
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-container">
          <p>Welcome back, Admin</p>
          <h1>Ve Veyron Exports Dashboard</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('upload')}>
          <Plus size={16} /> Import Buyers
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-details">
            <p>Total Buyers</p>
            <h3>{stats.totalBuyers}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)' }}>
            <Users size={20} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-details">
            <p>Emails Sent</p>
            <h3>{stats.totalSent}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)' }}>
            <Mail size={20} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-details">
            <p>Primary Queue</p>
            <h3>{stats.pendingPrimary}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-pending)' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-details">
            <p>Follow-ups Active</p>
            <h3>{stats.pendingFollowups}</h3>
          </div>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent)' }}>
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Main Dashboard Segment */}
      <div className="dashboard-grid">
        {/* Chart Card */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> Outreach Success History
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Daily successful email deliveries over past week
              </p>
            </div>
            <div className="badge badge-success">Success Rate: {successRate}%</div>
          </div>
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            {renderSVGChart()}
          </div>
        </div>

        {/* Quality Score & Dials Card */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h3 style={{ fontSize: '1.15rem' }}>Quick Stats</h3>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexDirection: 'column', 
            padding: '1rem',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '10px'
          }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="8" 
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * successRate) / 100}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div style={{ position: 'absolute', fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>
                {successRate}%
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontWeight: '500' }}>
              Delivery Success Accuracy
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> Deliveries
              </span>
              <span style={{ fontWeight: '600' }}>{stats.totalSent}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <XCircle size={14} style={{ color: 'var(--color-failed)' }} /> Bounces / Errors
              </span>
              <span style={{ fontWeight: '600' }}>{stats.totalFailed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns Progress */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>Active Campaigns</h3>
        {campaigns.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>
            No campaigns found. Go to Campaigns tab to build your first email blast.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaigns.map((camp) => {
              const total = camp.total_buyers || 0;
              const sent = camp.sent_count || 0;
              const failed = camp.failed_count || 0;
              const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

              return (
                <div key={camp.id} style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(0, 0, 0, 0.15)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ minWidth: '200px' }}>
                    <h4 style={{ fontSize: '0.95rem', color: '#fff' }}>{camp.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Template: {camp.template_name || 'Deleted Template'} | Created: {new Date(camp.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div style={{ flexGrow: 1, maxWidth: '300px', minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      <span>Progress</span>
                      <span>{sent + failed} / {total} ({progress}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '100px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.3s' }}></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${
                      camp.status === 'Sending' ? 'badge-info' :
                      camp.status === 'Completed' ? 'badge-success' :
                      camp.status === 'Paused' ? 'badge-pending' : 'badge-pending'
                    }`}>
                      {camp.status}
                    </span>
                    <button 
                      onClick={() => setActiveTab('campaigns')} 
                      className="btn btn-secondary btn-icon-only"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
