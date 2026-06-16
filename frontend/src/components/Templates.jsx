import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Wand2, 
  Braces, 
  ArrowRight,
  Sparkles,
  Check
} from 'lucide-react';

function Templates({ apiFetch }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null); // template object or 'new'
  const [form, setForm] = useState({ name: '', subject: '', body: '' });

  // AI Refine State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRefinedBody, setAiRefinedBody] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleEditClick = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      subject: template.subject,
      body: template.body
    });
    setError('');
  };

  const handleCreateClick = () => {
    setEditingTemplate('new');
    setForm({ name: '', subject: '', body: '' });
    setError('');
  };

  const handleDeleteClick = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await apiFetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Template deleted.');
      fetchTemplates();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.subject || !form.body) {
      setError('Name, Subject, and Body are required.');
      return;
    }

    try {
      const method = editingTemplate === 'new' ? 'POST' : 'PUT';
      const url = editingTemplate === 'new' ? '/api/templates' : `/api/templates/${editingTemplate.id}`;

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(editingTemplate === 'new' ? 'Template created.' : 'Template updated.');
      setEditingTemplate(null);
      fetchTemplates();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Helper to insert variables into textarea
  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-body-textarea');
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = form.body;

    const newBody = text.substring(0, startPos) + variable + text.substring(endPos, text.length);
    setForm({ ...form, body: newBody });
    
    // Reset focus
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = startPos + variable.length;
    }, 50);
  };

  // Trigger Gemini AI refinement
  const handleAiRefine = async () => {
    if (!form.body) {
      setError('Please write some draft in the template body first.');
      return;
    }
    if (!aiInstruction) {
      alert('Please enter instructions on how the AI should rewrite the email.');
      return;
    }

    setAiLoading(true);
    setAiRefinedBody('');
    setError('');

    try {
      const res = await apiFetch('/api/ai/refine', {
        method: 'POST',
        body: JSON.stringify({
          content: form.body,
          instruction: aiInstruction
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAiRefinedBody(data.refined);
    } catch (err) {
      console.error(err);
      setError('AI Rephraser error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiRefinement = () => {
    setForm({ ...form, body: aiRefinedBody });
    setShowAiModal(false);
    setAiInstruction('');
    setAiRefinedBody('');
  };

  if (loading && templates.length === 0) {
    return <div style={{ color: 'var(--primary)', padding: '2rem' }}>Loading templates...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-container">
          <p>Ve Veyron Exports Campaigns</p>
          <h1>Email Template Library</h1>
        </div>
        {!editingTemplate && (
          <button className="btn btn-primary" onClick={handleCreateClick}>
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* VIEW: MAIN LIST OF TEMPLATES */}
      {!editingTemplate && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {templates.map((tpl) => (
            <div key={tpl.id} className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <FileText size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.05rem', color: '#fff', wordBreak: 'break-word' }}>{tpl.name}</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '600', marginBottom: '0.5rem' }}>
                Subject: {tpl.subject}
              </p>
              <p style={{ 
                color: 'var(--text-muted)', 
                fontSize: '0.85rem', 
                flexGrow: 1, 
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: '4',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '1rem'
              }}>
                {tpl.body}
              </p>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)' 
              }}>
                <span>Saved: {new Date(tpl.created_at).toLocaleDateString()}</span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button 
                    className="btn btn-secondary btn-icon-only" 
                    onClick={() => handleEditClick(tpl)}
                    style={{ width: '28px', height: '28px' }}
                    title="Edit Template"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    className="btn btn-secondary btn-icon-only" 
                    onClick={() => handleDeleteClick(tpl.id)}
                    style={{ width: '28px', height: '28px', color: '#f87171' }}
                    title="Delete Template"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW: CREATE/EDIT TEMPLATE FORM */}
      {editingTemplate && (
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', color: '#fff' }}>
            {editingTemplate === 'new' ? 'Create Outreach Template' : `Edit Template: ${editingTemplate.name}`}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. Primary Spice Buyer Pitch"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Subject Line</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. Spice Import Requirements - Ve Veyron Exports"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>

            {/* Variable insertion bar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              flexWrap: 'wrap',
              marginBottom: '0.5rem', 
              padding: '0.5rem', 
              backgroundColor: 'rgba(0,0,0,0.2)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)' 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Braces size={12} /> Dynamic Tags:
              </span>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => insertVariable('{{Company_Name}}')}>
                Company Name
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => insertVariable('{{Country}}')}>
                Country
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => insertVariable('{{Product_Interest}}')}>
                Product Interest
              </button>

              <button 
                type="button" 
                className="btn btn-accent" 
                onClick={() => setShowAiModal(true)}
                style={{ padding: '0.2rem 0.75rem', fontSize: '0.7rem', marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}
              >
                <Wand2 size={12} /> Gemini AI Rephrase
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Email Body Content</label>
              <textarea 
                id="template-body-textarea"
                className="form-control"
                style={{ minHeight: '260px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.5' }}
                placeholder="Dear {{Company_Name}} Team,..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingTemplate(null)}>
                Discard Changes
              </button>
              <button type="submit" className="btn btn-primary">
                Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: AI REPHRASE WRITER */}
      {showAiModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', borderLeft: '4px solid var(--primary)' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles style={{ color: 'var(--primary)' }} /> Gemini B2B Email Refiner
              </h3>
              <button className="modal-close" onClick={() => setShowAiModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              
              <div className="form-group">
                <label className="form-label">Refinement Instructions</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Make it shorter and highly persuasive, focusing on Turmeric supply."
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleAiRefine}
                  disabled={aiLoading || !aiInstruction}
                >
                  {aiLoading ? 'AI Rephrasing...' : 'Generate AI Rephrase'}
                </button>
              </div>

              {/* Side by side preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Original Draft</h4>
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    padding: '0.75rem', 
                    backgroundColor: 'rgba(0,0,0,0.2)', 
                    borderRadius: '6px', 
                    fontSize: '0.75rem', 
                    lineHeight: '1.4', 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace' 
                  }}>
                    {form.body}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Gemini Suggestion
                  </h4>
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    padding: '0.75rem', 
                    backgroundColor: 'rgba(16,185,129,0.03)', 
                    border: '1px solid rgba(16,185,129,0.15)', 
                    borderRadius: '6px', 
                    fontSize: '0.75rem', 
                    lineHeight: '1.4', 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace',
                    color: '#fff' 
                  }}>
                    {aiLoading ? 'Waiting for response...' : (aiRefinedBody || 'No draft generated yet. Fill in instruction and click write.')}
                  </div>
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAiModal(false)}>Discard Draft</button>
              <button 
                className="btn btn-primary" 
                onClick={applyAiRefinement}
                disabled={!aiRefinedBody}
                style={{ display: 'flex', gap: '0.25rem' }}
              >
                <Check size={14} /> Apply AI Rephrase
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Templates;
