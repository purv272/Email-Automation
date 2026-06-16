import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Eye, 
  Paperclip, 
  UserCheck, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

function Campaigns({ apiFetch }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Wizard States
  const [isCreating, setIsCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [defaultAttachments, setDefaultAttachments] = useState([]);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedBuyerIds, setSelectedBuyerIds] = useState([]);
  const [selectedAttachments, setSelectedAttachments] = useState([]); // array of file paths

  // Customizations State: { [buyerId]: { custom_subject, custom_body } }
  const [customizations, setCustomizations] = useState({});
  const [previewBuyerIndex, setPreviewBuyerIndex] = useState(0);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');

  // Detail Modal State
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState(null);
  const [campaignBuyers, setCampaignBuyers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiFetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      setError('Failed to fetch campaigns.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Poll every 4 seconds to update campaigns list silently in real-time
    const interval = setInterval(() => {
      fetchCampaigns(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Initialize wizard data
  const startWizard = async () => {
    setError('');
    try {
      // 1. Fetch templates
      const templatesRes = await apiFetch('/api/templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData);

      // 2. Fetch buyers
      const buyersRes = await apiFetch('/api/buyers');
      const buyersData = await buyersRes.json();
      setBuyers(buyersData);

      // 3. Fetch default attachments from settings
      const settingsRes = await apiFetch('/api/settings');
      const settingsData = await settingsRes.json();
      if (settingsData.default_attachments) {
        setDefaultAttachments(JSON.parse(settingsData.default_attachments));
      }

      setIsCreating(true);
      setWizardStep(1);
      setCampaignName(`USA Spice Buyers - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
      setSelectedTemplateId('');
      setSelectedBuyerIds([]);
      setSelectedAttachments([]);
      setCustomizations({});
      setPreviewBuyerIndex(0);

    } catch (err) {
      setError('Failed to initialize Campaign wizard.');
    }
  };

  // Run Campaign Start
  const handleStartCampaign = async (id) => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/start`, { method: 'POST' });
      const data = await res.json();
      setSuccessMsg(data.message);
      fetchCampaigns();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to start campaign.');
    }
  };

  // Run Campaign Pause
  const handlePauseCampaign = async (id) => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/pause`, { method: 'POST' });
      const data = await res.json();
      setSuccessMsg(data.message);
      fetchCampaigns();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to pause campaign.');
    }
  };

  // Run Campaign Delete
  const handleDeleteCampaign = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign? It will remove all scheduling parameters.')) return;
    try {
      const res = await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('Campaign deleted.');
        fetchCampaigns();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Failed to delete campaign.');
    }
  };

  // Load preview templates logic
  const loadPreviewForBuyer = (index) => {
    if (selectedBuyerIds.length === 0 || !selectedTemplateId) return;
    const buyerId = selectedBuyerIds[index];
    const buyer = buyers.find(b => b.id === buyerId);
    const template = templates.find(t => t.id === parseInt(selectedTemplateId, 10));

    if (!buyer || !template) return;

    // Check if customization exists
    if (customizations[buyerId]) {
      setPreviewSubject(customizations[buyerId].custom_subject);
      setPreviewBody(customizations[buyerId].custom_body);
    } else {
      // Personalize on the fly
      const personalize = (text) => {
        return text
          .replace(/{{Company_Name}}/g, buyer.company_name)
          .replace(/{{Country}}/g, buyer.country || '')
          .replace(/{{Product_Interest}}/g, buyer.product_interest || '');
      };
      setPreviewSubject(personalize(template.subject));
      setPreviewBody(personalize(template.body));
    }
    setPreviewBuyerIndex(index);
  };

  // Save changes to individual preview
  const saveCustomization = () => {
    const buyerId = selectedBuyerIds[previewBuyerIndex];
    setCustomizations({
      ...customizations,
      [buyerId]: {
        custom_subject: previewSubject,
        custom_body: previewBody
      }
    });
    alert('Customization saved for this buyer!');
  };

  // Toggle attachment selections
  const toggleAttachment = (pathStr) => {
    if (selectedAttachments.includes(pathStr)) {
      setSelectedAttachments(selectedAttachments.filter(p => p !== pathStr));
    } else {
      setSelectedAttachments([...selectedAttachments, pathStr]);
    }
  };

  // Toggle buyer selection checkbox
  const toggleBuyerSelection = (id) => {
    if (selectedBuyerIds.includes(id)) {
      setSelectedBuyerIds(selectedBuyerIds.filter(bid => bid !== id));
    } else {
      setSelectedBuyerIds([...selectedBuyerIds, id]);
    }
  };

  const toggleSelectAllBuyers = () => {
    if (selectedBuyerIds.length === buyers.length) {
      setSelectedBuyerIds([]);
    } else {
      setSelectedBuyerIds(buyers.map(b => b.id));
    }
  };

  // Final submit handler for campaign
  const handleCreateCampaignSubmit = async (shouldStartImmediately) => {
    if (!campaignName || !selectedTemplateId || selectedBuyerIds.length === 0) {
      setError('Form verification failed. Please review steps.');
      return;
    }

    // Prepare customizations payload: array of { buyer_id, custom_subject, custom_body }
    const customizationsPayload = Object.entries(customizations).map(([buyerId, content]) => ({
      buyer_id: parseInt(buyerId, 10),
      custom_subject: content.custom_subject,
      custom_body: content.custom_body
    }));

    try {
      const res = await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          template_id: parseInt(selectedTemplateId, 10),
          buyer_ids: selectedBuyerIds,
          attachments: selectedAttachments,
          customizations: customizationsPayload
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (shouldStartImmediately) {
        await apiFetch(`/api/campaigns/${data.id}/start`, { method: 'POST' });
      }

      setSuccessMsg('Campaign created successfully!');
      setIsCreating(false);
      fetchCampaigns();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Load Campaign Detail for Modal
  const loadCampaignDetail = async (campaign) => {
    setSelectedCampaignDetail(campaign);
    setDetailLoading(true);
    setCampaignBuyers([]);
    try {
      const res = await apiFetch(`/api/campaigns/${campaign.id}`);
      const data = await res.json();
      setCampaignBuyers(data.buyers);
    } catch (err) {
      setError('Failed to load campaign buyers details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Navigation wizard controls
  const nextWizardStep = () => {
    if (wizardStep === 1) {
      if (!campaignName || !selectedTemplateId) {
        alert('Please specify Campaign Name and Select a Template.');
        return;
      }
    }
    if (wizardStep === 2) {
      if (selectedBuyerIds.length === 0) {
        alert('Please choose at least one buyer to send the email campaign.');
        return;
      }
    }
    if (wizardStep === 3) {
      // Load first preview
      loadPreviewForBuyer(0);
    }

    setWizardStep(wizardStep + 1);
  };

  const prevWizardStep = () => {
    setWizardStep(wizardStep - 1);
  };

  if (loading && campaigns.length === 0) {
    return <div style={{ color: 'var(--primary)', padding: '2rem' }}>Loading campaigns module...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-container">
          <p>Ve Veyron Exports Campaigns</p>
          <h1>Campaign & outreach center</h1>
        </div>
        {!isCreating && (
          <button className="btn btn-primary" onClick={startWizard}>
            <Plus size={16} /> Create Campaign
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* VIEW: MAIN LIST OF CAMPAIGNS */}
      {!isCreating && (
        <div className="card" style={{ padding: 0 }}>
          {campaigns.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No campaigns defined. Start a campaign using the creator wizard.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Outreach Template</th>
                    <th style={{ textAlign: 'center' }}>Total Buyers</th>
                    <th style={{ textAlign: 'center' }}>Success</th>
                    <th style={{ textAlign: 'center' }}>Errors</th>
                    <th style={{ textAlign: 'center' }}>Pending</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp) => (
                    <tr key={camp.id}>
                      <td style={{ fontWeight: '600', color: '#fff' }}>{camp.name}</td>
                      <td>{camp.template_name || <span style={{ color: '#ef4444' }}>Deleted</span>}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{camp.total_buyers}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: '600' }}>{camp.sent_count}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-failed)', fontWeight: '600' }}>{camp.failed_count}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-pending)', fontWeight: '600' }}>{camp.pending_count}</td>
                      <td>
                        <span className={`badge ${
                          camp.status === 'Sending' ? 'badge-info' :
                          camp.status === 'Completed' ? 'badge-success' :
                          camp.status === 'Paused' ? 'badge-pending' : 'badge-secondary'
                        }`}>
                          {camp.status}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-icon-only" 
                          onClick={() => loadCampaignDetail(camp)}
                          title="View Progress details"
                        >
                          <Eye size={14} />
                        </button>
                        {camp.status === 'Paused' || camp.status === 'Draft' ? (
                          <button 
                            className="btn btn-primary btn-icon-only" 
                            style={{ backgroundColor: 'var(--primary)', color: '#0b0f19' }}
                            onClick={() => handleStartCampaign(camp.id)}
                            title="Start Campaign"
                          >
                            <Play size={14} fill="#0b0f19" />
                          </button>
                        ) : null}
                        {camp.status === 'Sending' ? (
                          <button 
                            className="btn btn-secondary btn-icon-only" 
                            style={{ color: 'var(--color-pending)', borderColor: 'rgba(245,158,11,0.2)' }}
                            onClick={() => handlePauseCampaign(camp.id)}
                            title="Pause Campaign"
                          >
                            <Pause size={14} />
                          </button>
                        ) : null}
                        <button 
                          className="btn btn-secondary btn-icon-only" 
                          onClick={() => handleDeleteCampaign(camp.id)}
                          style={{ color: '#f87171' }}
                          title="Delete Campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: CREATOR WIZARD FORM */}
      {isCreating && (
        <div className="card">
          {/* Wizard Tracker */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Step {wizardStep} of 5: {
                wizardStep === 1 ? 'Configure Template' :
                wizardStep === 2 ? 'Target Audience' :
                wizardStep === 3 ? 'Choose Attachments' :
                wizardStep === 4 ? 'Preview & Customizations' : 'Verify & Launch'
              }
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} style={{ 
                  width: '24px', 
                  height: '4px', 
                  borderRadius: '100px', 
                  backgroundColor: wizardStep >= s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  transition: 'background-color 0.2s'
                }}></div>
              ))}
            </div>
          </div>

          {/* STEP 1: CAMPAIGN METADATA */}
          {wizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Campaign Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. USA Spice Buyers June 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Outreach Template</label>
                {templates.length === 0 ? (
                  <div style={{ color: 'var(--color-failed)', fontSize: '0.85rem' }}>
                    No templates saved. Please configure an outreach template under Email Templates.
                  </div>
                ) : (
                  <select 
                    className="form-control"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Template --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE AUDIENCE */}
          {wizardStep === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Selected: {selectedBuyerIds.length} of {buyers.length} Leads
                </span>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={toggleSelectAllBuyers}>
                  {selectedBuyerIds.length === buyers.length ? 'Clear Selection' : 'Select All'}
                </button>
              </div>

              <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedBuyerIds.length === buyers.length && buyers.length > 0}
                          onChange={toggleSelectAllBuyers}
                        />
                      </th>
                      <th>Company Name</th>
                      <th>Email</th>
                      <th>Country</th>
                      <th>Interest</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((b) => (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => toggleBuyerSelection(b.id)}>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedBuyerIds.includes(b.id)}
                            onChange={() => toggleBuyerSelection(b.id)}
                          />
                        </td>
                        <td style={{ fontWeight: '600', color: '#fff' }}>{b.company_name}</td>
                        <td>{b.email}</td>
                        <td>{b.country || 'N/A'}</td>
                        <td>{b.product_interest || 'N/A'}</td>
                        <td>
                          <span className={`badge ${
                            b.status === 'Imported' ? 'badge-info' : 'badge-pending'
                          }`} style={{ fontSize: '0.65rem' }}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: SELECT ATTACHMENTS */}
          {wizardStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>Select outreach documents</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Check which default PDF catalogs or files to include in this campaign. Upload attachments in settings.
              </p>

              {defaultAttachments.length === 0 ? (
                <div style={{ padding: '1.5rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No default attachments configured in Settings. You can skip this step or cancel to add files.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {defaultAttachments.map((att) => (
                    <div key={att.id} 
                      onClick={() => toggleAttachment(att.path)}
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        backgroundColor: selectedAttachments.includes(att.path) ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.15)',
                        border: '1px solid',
                        borderColor: selectedAttachments.includes(att.path) ? 'var(--primary)' : 'var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Paperclip size={18} style={{ color: selectedAttachments.includes(att.path) ? 'var(--primary)' : 'var(--text-muted)' }} />
                        <div>
                          <h4 style={{ fontSize: '0.9rem', color: '#fff' }}>{att.name}</h4>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Size: {Math.round(att.size / 1024)} KB
                          </span>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={selectedAttachments.includes(att.path)}
                        onChange={() => {}} // handled by div click
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PREVIEW & CUSTOMIZE INDIVIDUAL EMAILS */}
          {wizardStep === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
              {/* Buyer index selector panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto', borderRight: '1px solid var(--border-color)', paddingRight: '0.75rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recipients</h4>
                {selectedBuyerIds.map((bid, idx) => {
                  const b = buyers.find(buyer => buyer.id === bid);
                  const isCustomized = !!customizations[bid];
                  return (
                    <button
                      key={bid}
                      type="button"
                      className="btn"
                      onClick={() => loadPreviewForBuyer(idx)}
                      style={{ 
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', 
                        fontSize: '0.8rem',
                        backgroundColor: previewBuyerIndex === idx ? 'rgba(16,185,129,0.06)' : 'transparent',
                        borderColor: previewBuyerIndex === idx ? 'var(--primary)' : 'transparent',
                        color: previewBuyerIndex === idx ? '#fff' : 'var(--text-muted)',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.company_name}
                      </span>
                      {isCustomized && (
                        <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.1rem 0.3rem' }}>
                          Edit saved
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Email Content customizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                    Personalizing Email for: {buyers.find(b => b.id === selectedBuyerIds[previewBuyerIndex])?.company_name}
                  </span>
                  <button type="button" className="btn btn-accent" style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }} onClick={saveCustomization}>
                    Save Custom Edit
                  </button>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Subject line</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={previewSubject}
                    onChange={(e) => setPreviewSubject(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Body content</label>
                  <textarea 
                    className="form-control"
                    style={{ minHeight: '220px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}
                    value={previewBody}
                    onChange={(e) => setPreviewBody(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Custom changes will bypass default template variables for this company.</span>
                  <span>Buyer {previewBuyerIndex + 1} of {selectedBuyerIds.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: VERIFY AND LAUNCH */}
          {wizardStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '10px' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Review Campaign Package</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Campaign Name</span>
                  <span style={{ fontWeight: '600', color: '#fff' }}>{campaignName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Outreach Template</span>
                  <span style={{ fontWeight: '600' }}>{templates.find(t => t.id === parseInt(selectedTemplateId, 10))?.name}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Recipients</span>
                  <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)' }}>
                    <UserCheck size={16} /> {selectedBuyerIds.length} companies
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Individual Customizations</span>
                  <span style={{ fontWeight: '600', color: 'var(--accent)' }}>
                    {Object.keys(customizations).length} customized templates
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Attachments included ({selectedAttachments.length})</span>
                {selectedAttachments.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedAttachments.map(p => (
                      <span key={p} className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {p.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem', backgroundColor: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <CheckCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.15rem' }} />
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.25rem' }}>Scheduler ready</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    If started immediately, the background mail service will deliver these emails sequentially with safety delays. Multi-stage follow-ups (Day 7 / Day 15) will also be scheduled automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', marginTop: '2rem', paddingTop: '1.25rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={wizardStep === 1 ? () => setIsCreating(false) : prevWizardStep}
            >
              <ArrowLeft size={16} /> Back
            </button>

            {wizardStep < 5 ? (
              <button type="button" className="btn btn-primary" onClick={nextWizardStep}>
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => handleCreateCampaignSubmit(false)}
                >
                  Save Draft
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => handleCreateCampaignSubmit(true)}
                  style={{ backgroundColor: 'var(--primary)', color: '#0b0f19' }}
                >
                  Launch & Start Sending <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL: CAMPAIGN BUYERS & INDIVIDUAL STATUS */}
      {selectedCampaignDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ color: '#fff' }}>Campaign Execution Log</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  {selectedCampaignDetail.name}
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelectedCampaignDetail(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ padding: 0 }}>
              {detailLoading ? (
                <div style={{ padding: '2rem', color: 'var(--primary)' }}>Retrieving buyer logs...</div>
              ) : (
                <div className="table-container" style={{ borderRadius: 0, border: 'none', maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Company Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Follow-up 1</th>
                        <th>Follow-up 2</th>
                        <th>Errors / Logs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignBuyers.map((cb) => (
                        <tr key={cb.buyer_id}>
                          <td style={{ fontWeight: '600', color: '#fff' }}>{cb.company_name}</td>
                          <td>{cb.email}</td>
                          <td>
                            <span className={`badge ${
                              cb.status === 'Sent' ? 'badge-success' :
                              cb.status === 'Failed' ? 'badge-failed' : 'badge-pending'
                            }`}>
                              {cb.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              cb.followup_1_status === 'Sent' ? 'badge-success' :
                              cb.followup_1_status === 'Failed' ? 'badge-failed' :
                              cb.followup_1_status === 'Skipped' ? 'badge-secondary' : 'badge-pending'
                            }`} style={{ fontSize: '0.65rem' }}>
                              {cb.followup_1_status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              cb.followup_2_status === 'Sent' ? 'badge-success' :
                              cb.followup_2_status === 'Failed' ? 'badge-failed' :
                              cb.followup_2_status === 'Skipped' ? 'badge-secondary' : 'badge-pending'
                            }`} style={{ fontSize: '0.65rem' }}>
                              {cb.followup_2_status}
                            </span>
                          </td>
                          <td style={{ color: cb.error_message ? 'var(--color-failed)' : 'var(--text-muted)' }}>
                            {cb.error_message || (cb.sent_at ? `Sent at ${new Date(cb.sent_at).toLocaleDateString()}` : 'Queued')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCampaignDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Campaigns;
