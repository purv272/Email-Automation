import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  MapPin, 
  Settings, 
  Database, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  BrainCircuit, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';

function UploadBuyers({ apiFetch }) {
  const [subTab, setSubTab] = useState('import'); // 'import' | 'manage'
  
  // Importer State
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null); // { fileToken, headers, totalRecords }
  const [mappings, setMappings] = useState({
    company_name: '',
    email: '',
    country: '',
    website: '',
    product_interest: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  // Database State
  const [buyers, setBuyers] = useState([]);
  const [search, setSearch] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBuyer, setNewBuyer] = useState({
    company_name: '',
    email: '',
    country: '',
    website: '',
    product_interest: ''
  });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all buyers
  const fetchBuyers = async () => {
    try {
      setDbLoading(true);
      const res = await apiFetch(`/api/buyers?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setBuyers(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load buyers database.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'manage') {
      fetchBuyers();
    }
  }, [subTab, search]);

  // Handle excel/csv file upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setError('');
    setIsUploading(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Direct fetch for multipart
      const token = localStorage.getItem('token');
      const response = await fetch('/api/buyers/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process spreadsheet.');
      }

      setUploadResult(data);
      // Auto map matching columns
      const lowercaseHeaders = data.headers.map(h => h.toLowerCase());
      const tempMappings = { ...mappings };
      
      const compIdx = lowercaseHeaders.findIndex(h => h.includes('company') || h.includes('name') || h === 'buyer');
      if (compIdx !== -1) tempMappings.company_name = data.headers[compIdx];

      const emailIdx = lowercaseHeaders.findIndex(h => h.includes('email') || h.includes('address') || h === 'mail');
      if (emailIdx !== -1) tempMappings.email = data.headers[emailIdx];

      const countryIdx = lowercaseHeaders.findIndex(h => h.includes('country') || h.includes('location') || h.includes('nation'));
      if (countryIdx !== -1) tempMappings.country = data.headers[countryIdx];

      const webIdx = lowercaseHeaders.findIndex(h => h.includes('web') || h.includes('site') || h.includes('url'));
      if (webIdx !== -1) tempMappings.website = data.headers[webIdx];

      const interestIdx = lowercaseHeaders.findIndex(h => h.includes('interest') || h.includes('product') || h.includes('spice'));
      if (interestIdx !== -1) tempMappings.product_interest = data.headers[interestIdx];

      setMappings(tempMappings);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Execute import applying mappings
  const handleExecuteImport = async () => {
    if (!mappings.company_name || !mappings.email) {
      setError('Company Name and Email column mappings are mandatory.');
      return;
    }

    setError('');
    setIsImporting(true);

    try {
      const res = await apiFetch('/api/buyers/import', {
        method: 'POST',
        body: JSON.stringify({
          fileToken: uploadResult.fileToken,
          mappings
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setImportSummary(data);
      setUploadResult(null);
      setFile(null);
      setSuccessMsg('Spreadsheet imported successfully!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Add buyer manually
  const handleAddBuyer = async (e) => {
    e.preventDefault();
    if (!newBuyer.company_name || !newBuyer.email) {
      setError('Company Name and Email are required.');
      return;
    }

    try {
      const res = await apiFetch('/api/buyers', {
        method: 'POST',
        body: JSON.stringify(newBuyer)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Buyer added successfully.');
      setShowAddModal(false);
      setNewBuyer({ company_name: '', email: '', country: '', website: '', product_interest: '' });
      fetchBuyers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete buyer
  const handleDeleteBuyer = async (id) => {
    if (!confirm('Are you sure you want to delete this buyer?')) return;
    try {
      const res = await apiFetch(`/api/buyers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('Buyer deleted.');
        fetchBuyers();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Failed to delete buyer.');
    }
  };

  // Trigger Gemini AI classification
  const handleAiClassify = async (buyer) => {
    setSelectedBuyer(buyer);
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await apiFetch(`/api/buyers/${buyer.id}/classify`, { method: 'POST' });
      const data = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      setError('AI service failed to score buyer.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      {/* Tab Navigation header */}
      <div className="page-header">
        <div className="page-title-container">
          <p>Ve Veyron Exports Buyers</p>
          <h1>Buyer Database Management</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            className={`btn ${subTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('import')}
            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
          >
            <Upload size={14} /> Import Spreadsheets
          </button>
          <button 
            className={`btn ${subTab === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('manage')}
            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
          >
            <Database size={14} /> Database View ({buyers.length || 'Manage'})
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* SUB TAB: IMPORT SPREADSHEETS */}
      {subTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section 1: File selector */}
          {!uploadResult && (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', borderStyle: 'dashed', borderWidth: '2px' }}>
              <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Upload Excel or CSV spreadsheet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Ensure your sheet contains Company Name and Email columns
              </p>
              
              <form onSubmit={handleFileUpload} style={{ display: 'inline-flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--border-color)', 
                    padding: '0.5rem', 
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)' 
                  }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={isUploading || !file}>
                  {isUploading ? 'Parsing Spreadsheet...' : 'Analyze Spreadsheet'}
                </button>
              </form>
            </div>
          )}

          {/* Section 2: Column Mapping Selector */}
          {uploadResult && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Map Spreadsheet Columns</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    Match columns from your uploaded sheet to Ve Veyron Database fields.
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-info">{uploadResult.totalRecords} Rows found</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Company Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select 
                    className="form-control" 
                    value={mappings.company_name}
                    onChange={(e) => setMappings({ ...mappings, company_name: e.target.value })}
                  >
                    <option value="">-- Choose Column --</option>
                    {uploadResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Email Address <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select 
                    className="form-control" 
                    value={mappings.email}
                    onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                  >
                    <option value="">-- Choose Column --</option>
                    {uploadResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Country (Optional)</label>
                  <select 
                    className="form-control" 
                    value={mappings.country}
                    onChange={(e) => setMappings({ ...mappings, country: e.target.value })}
                  >
                    <option value="">-- Skip Field --</option>
                    {uploadResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Website (Optional)</label>
                  <select 
                    className="form-control" 
                    value={mappings.website}
                    onChange={(e) => setMappings({ ...mappings, website: e.target.value })}
                  >
                    <option value="">-- Skip Field --</option>
                    {uploadResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Product Interest (Optional)</label>
                  <select 
                    className="form-control" 
                    value={mappings.product_interest}
                    onChange={(e) => setMappings({ ...mappings, product_interest: e.target.value })}
                  >
                    <option value="">-- Skip Field --</option>
                    {uploadResult.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <button className="btn btn-secondary" onClick={() => setUploadResult(null)}>
                  Cancel Upload
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleExecuteImport}
                  disabled={isImporting || !mappings.company_name || !mappings.email}
                >
                  {isImporting ? 'Executing Import...' : 'Confirm & Execute Import'}
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Import Summary Report */}
          {importSummary && (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CheckCircle style={{ color: 'var(--primary)' }} /> Spreadsheet Import Summary
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Successfully Imported</p>
                  <h4 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginTop: '0.25rem' }}>{importSummary.imported}</h4>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Duplicate Emails Ignored</p>
                  <h4 style={{ fontSize: '1.5rem', color: 'var(--color-pending)', marginTop: '0.25rem' }}>{importSummary.duplicates}</h4>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Invalid / Empty Rows</p>
                  <h4 style={{ fontSize: '1.5rem', color: 'var(--color-failed)', marginTop: '0.25rem' }}>{importSummary.errors}</h4>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB TAB: DATABASE TABLE VIEW */}
      {subTab === 'manage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Search bar & Add manual buyer */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={16} />
              </span>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search by name, email, interest..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} /> Add Buyer manually
            </button>
          </div>

          {/* Table list */}
          <div className="card" style={{ padding: 0 }}>
            {dbLoading ? (
              <div style={{ padding: '2rem', color: 'var(--primary)' }}>Querying database...</div>
            ) : buyers.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No buyers found matching criteria. Upload a list to populate database.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Email</th>
                      <th>Country</th>
                      <th>Product Interest</th>
                      <th>Status</th>
                      <th>Follow-up Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((buyer) => (
                      <tr key={buyer.id}>
                        <td style={{ fontWeight: '600', color: '#fff' }}>{buyer.company_name}</td>
                        <td>{buyer.email}</td>
                        <td>{buyer.country || <span style={{ color: '#4b5563' }}>N/A</span>}</td>
                        <td>{buyer.product_interest || <span style={{ color: '#4b5563' }}>N/A</span>}</td>
                        <td>
                          <span className={`badge ${
                            buyer.status === 'Imported' ? 'badge-info' :
                            buyer.status === 'Emailed' ? 'badge-pending' :
                            buyer.status === 'Replied' ? 'badge-success' : 'badge-info'
                          }`}>
                            {buyer.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            buyer.followup_status === 'None' ? 'badge-secondary' :
                            buyer.followup_status.includes('Sent') ? 'badge-info' : 'badge-success'
                          }`} style={{ backgroundColor: buyer.followup_status === 'None' ? 'rgba(255,255,255,0.03)' : '' }}>
                            {buyer.followup_status}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-secondary btn-icon-only"
                            onClick={() => handleAiClassify(buyer)}
                            title="AI Lead Classifier"
                            style={{ color: 'var(--accent)', border: '1px solid rgba(249,115,22,0.2)' }}
                          >
                            <BrainCircuit size={14} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-icon-only"
                            onClick={() => handleDeleteBuyer(buyer.id)}
                            style={{ color: '#f87171' }}
                            title="Delete"
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
        </div>
      )}

      {/* MODAL: ADD MANUAL BUYER */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create New Buyer Lead</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBuyer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Company Name <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newBuyer.company_name}
                    onChange={(e) => setNewBuyer({ ...newBuyer, company_name: e.target.value })}
                    placeholder="Enter company name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address <span style={{ color: 'red' }}>*</span></label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={newBuyer.email}
                    onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newBuyer.country}
                    onChange={(e) => setNewBuyer({ ...newBuyer, country: e.target.value })}
                    placeholder="e.g. Germany"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newBuyer.website}
                    onChange={(e) => setNewBuyer({ ...newBuyer, website: e.target.value })}
                    placeholder="e.g. www.spicedistributor.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Interest / Spices</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newBuyer.product_interest}
                    onChange={(e) => setNewBuyer({ ...newBuyer, product_interest: e.target.value })}
                    placeholder="e.g. Cumin powder, Turmeric"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AI BUYER CLASSIFICATION */}
      {selectedBuyer && (aiLoading || aiAnalysis) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px', borderLeft: '4px solid var(--accent)' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BrainCircuit style={{ color: 'var(--accent)' }} /> AI Lead Score & Classification
              </h3>
              <button className="modal-close" onClick={() => { setSelectedBuyer(null); setAiAnalysis(null); }}>✕</button>
            </div>
            <div className="modal-body" style={{ color: '#f3f4f6' }}>
              {aiLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <span className="spinner" style={{
                    display: 'block',
                    width: '32px',
                    height: '32px',
                    border: '3px solid var(--accent)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    margin: '0 auto 1rem',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Analyzing {selectedBuyer.company_name}'s trade profile...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</label>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedBuyer.company_name}</span>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Classified Business Segment</label>
                    <span className="badge badge-accent" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem', marginTop: '0.25rem' }}>
                      {aiAnalysis.category}
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Sourcing Requirements</label>
                    <p style={{ marginTop: '0.35rem', lineHeight: '1.4', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                      {aiAnalysis.needsSummary}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Note: Classification is based on company name, website details, and spice product interests processed using Gemini LLM.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setSelectedBuyer(null); setAiAnalysis(null); }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default UploadBuyers;
