import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Mail, 
  Key, 
  FileUp, 
  Trash2, 
  Check, 
  AlertTriangle,
  Paperclip,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';

function Settings({ apiFetch }) {
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    sender_email: '',
    sending_delay: '3',
    email_signature: '',
    gemini_api_key: '',
    followup_1_delay: '7',
    followup_2_delay: '15',
    followup_1_template_id: '',
    followup_2_template_id: '',
    default_attachments: '[]'
  });

  const [templates, setTemplates] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // SMTP test states
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null); // { success: boolean, msg: string }

  // Attachment upload state
  const [uploadingFile, setUploadingFile] = useState(false);

  const fetchSettingsAndTemplates = async () => {
    try {
      setLoading(true);
      
      // Fetch settings
      const settingsRes = await apiFetch('/api/settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

      if (settingsData.default_attachments) {
        setAttachments(JSON.parse(settingsData.default_attachments));
      }

      // Fetch templates for follow-up selection dropdowns
      const templatesRes = await apiFetch('/api/templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData);

      setError('');
    } catch (err) {
      setError('Failed to load settings configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndTemplates();
  }, []);

  const handleInputChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Test SMTP connection parameters
  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    setError('');

    try {
      const res = await apiFetch('/api/settings/test-smtp', {
        method: 'POST',
        body: JSON.stringify({
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_secure: settings.smtp_secure,
          smtp_user: settings.smtp_user,
          smtp_pass: settings.smtp_pass
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setSmtpTestResult({ success: true, message: 'SMTP Handshake verified successfully! Connection established.' });
      } else {
        setSmtpTestResult({ success: false, message: data.error || 'SMTP Connection failed.' });
      }
    } catch (err) {
      setSmtpTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Save overall Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle uploading default files/PDF catalogs
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setUploadingFile(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/settings/upload-attachment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setAttachments(data.attachmentsList);
      // Update local settings list representation
      handleInputChange('default_attachments', JSON.stringify(data.attachmentsList));
      setSuccessMsg('Attachment added to library.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
      // Reset input element
      e.target.value = '';
    }
  };

  // Delete attachment from settings list
  const handleDeleteAttachment = async (id) => {
    if (!confirm('Remove this document from default attachments?')) return;
    setError('');
    
    try {
      const res = await apiFetch(`/api/settings/attachment/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setAttachments(data.attachmentsList);
      handleInputChange('default_attachments', JSON.stringify(data.attachmentsList));
      setSuccessMsg('Attachment removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--primary)', padding: '2rem' }}>Loading settings...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-container">
          <p>Configure Ve Veyron Exports Console</p>
          <h1>System Configuration</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* SECTION 1: SMTP MAIL CONFIG */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#fff' }}>
            <Mail size={18} style={{ color: 'var(--primary)' }} /> SMTP Mail Server Account
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            
            <div className="form-group">
              <label className="form-label">SMTP Host</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. smtp.gmail.com or mail.veyron.com"
                value={settings.smtp_host}
                onChange={(e) => handleInputChange('smtp_host', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">SMTP Port</label>
              <input 
                type="number" 
                className="form-control"
                placeholder="587"
                value={settings.smtp_port}
                onChange={(e) => handleInputChange('smtp_port', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Connection Security</label>
              <select 
                className="form-control"
                value={settings.smtp_secure}
                onChange={(e) => handleInputChange('smtp_secure', e.target.value)}
              >
                <option value="false">STARTTLS / Port 587 (Standard)</option>
                <option value="true">SSL / Port 465 (Secure)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">SMTP Username / Login ID</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. export@veyronexports.com or api_user"
                value={settings.smtp_user}
                onChange={(e) => handleInputChange('smtp_user', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mail Password / App Key</label>
              <input 
                type="password" 
                className="form-control"
                placeholder="Enter password or 16-character App password"
                value={settings.smtp_pass}
                onChange={(e) => handleInputChange('smtp_pass', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sender Email Address (From)</label>
              <input 
                type="email" 
                className="form-control"
                placeholder="e.g. sales@veyronexports.com"
                value={settings.sender_email || ''}
                onChange={(e) => handleInputChange('sender_email', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sending Delay (Seconds between emails)</label>
              <input 
                type="number" 
                className="form-control"
                placeholder="e.g. 3"
                value={settings.sending_delay || '3'}
                min="1"
                onChange={(e) => handleInputChange('sending_delay', e.target.value)}
              />
            </div>

          </div>

          {/* Connection Test feedback */}
          {smtpTestResult && (
            <div className={`alert ${smtpTestResult.success ? 'alert-success' : 'alert-error'}`} style={{ margin: '1rem 0' }}>
              {smtpTestResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{smtpTestResult.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleTestSmtp}
              disabled={isTestingSmtp || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass}
            >
              {isTestingSmtp ? 'Verifying connection...' : 'Test SMTP Connection'}
            </button>
          </div>
        </div>

        {/* SECTION 2: DEFAULT ATTACHMENTS & PRODUCT CATALOGS */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#fff' }}>
            <Paperclip size={18} style={{ color: 'var(--primary)' }} /> Default Documents & Catalog Library
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Upload standard files (such as Ve Veyron product catalogs, spice specifications, or business licenses) to easily attach during Campaign creation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {attachments.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                No default files uploaded yet.
              </div>
            ) : (
              attachments.map((att) => (
                <div key={att.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'rgba(0,0,0,0.15)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <Paperclip size={14} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontWeight: '600', color: '#fff' }}>{att.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      ({Math.round(att.size / 1024)} KB)
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-icon-only" 
                    onClick={() => handleDeleteAttachment(att.id)}
                    style={{ width: '28px', height: '28px', color: '#f87171' }}
                    title="Delete document"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <input 
              type="file" 
              id="settings-attachment-input"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={uploadingFile}
            />
            <label 
              htmlFor="settings-attachment-input"
              className="btn btn-secondary"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FileUp size={16} /> {uploadingFile ? 'Uploading file...' : 'Upload Document/Catalog'}
            </label>
          </div>
        </div>

        {/* SECTION 3: AUTOMATED FOLLOW-UP CONFIGS */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#fff' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} /> Automatic Follow-Up Intervals & Templates
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Configure default delay times and choose which template copy to send when buyers do not reply to your primary outreach.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
            {/* Follow-up 1 */}
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Follow-up 1 (Stage 2)
              </h4>
              
              <div className="form-group">
                <label className="form-label">Send Delay (Days after initial email)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={settings.followup_1_delay}
                  onChange={(e) => handleInputChange('followup_1_delay', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Outreach Template</label>
                <select 
                  className="form-control"
                  value={settings.followup_1_template_id}
                  onChange={(e) => handleInputChange('followup_1_template_id', e.target.value)}
                >
                  <option value="">-- Use Default Follow-up Copy --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Follow-up 2 */}
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Follow-up 2 (Stage 3)
              </h4>
              
              <div className="form-group">
                <label className="form-label">Send Delay (Days after initial email)</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={settings.followup_2_delay}
                  onChange={(e) => handleInputChange('followup_2_delay', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Outreach Template</label>
                <select 
                  className="form-control"
                  value={settings.followup_2_template_id}
                  onChange={(e) => handleInputChange('followup_2_template_id', e.target.value)}
                >
                  <option value="">-- Use Default Follow-up Copy --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 4: SIGNATURE & FUTURE AI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Signature */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#fff' }}>
              Signature Config
            </h3>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Default Email Signature (Appended to all outgoing mails)</label>
              <textarea 
                className="form-control"
                style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={settings.email_signature}
                onChange={(e) => handleInputChange('email_signature', e.target.value)}
                placeholder="e.g. Regards, Ugam Ve Veyron Exports"
              />
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#fff' }}>
              <Key size={16} style={{ color: 'var(--accent)' }} /> Google Gemini AI Integration
            </h3>
            <div className="form-group" style={{ flexGrow: 1 }}>
              <label className="form-label">Gemini API Key</label>
              <input 
                type="password" 
                className="form-control"
                placeholder="AIzaSy..."
                value={settings.gemini_api_key}
                onChange={(e) => handleInputChange('gemini_api_key', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem', lineHeight: '1.4' }}>
                Integrates the outreach console with Google Gen AI. Enables B2B email rephrasing, automatic buyer classification, and opening lines research.
              </span>
            </div>
          </div>

        </div>

        {/* SAVE CONFIG */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 2.5rem' }}>
            Save Console Configurations
          </button>
        </div>

      </form>
    </div>
  );
}

export default Settings;
