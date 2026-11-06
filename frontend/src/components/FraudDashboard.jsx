import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getFraudStats,
  getFraudAlerts,
  getFraudAlertDetails,
  createInvestigation,
  getFraudInvestigations,
  getFraudInvestigationDetails,
  updateInvestigation,
  getFraudRules,
  updateFraudRule
} from '../services/api';
import './FraudDashboard.css';

/* ==============================================================================
   Lucide-style Inline SVG Icons
   ============================================================================== */
function IconShield({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconAlertTriangle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconActivity({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconClipboard({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function IconSliders({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function IconCheckCircle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default function FraudDashboard({ currentUser }) {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Active sub-tab: 'overview' | 'alerts' | 'investigations' | 'rules'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Alerts List State
  const [alerts, setAlerts] = useState([]);
  const [alertsPagination, setAlertsPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(null);
  const [alertFilters, setAlertFilters] = useState({
    riskLevel: 'ALL',
    status: 'ALL',
    transactionId: '',
    startDate: '',
    endDate: ''
  });

  // Selected Alert for Details Modal
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [alertDetail, setAlertDetail] = useState(null);
  const [alertDetailLoading, setAlertDetailLoading] = useState(false);
  const [alertDetailError, setAlertDetailError] = useState(null);
  const [investigationNotesInput, setInvestigationNotesInput] = useState('');
  const [creatingInvestigation, setCreatingInvestigation] = useState(false);

  // Investigations List State
  const [investigations, setInvestigations] = useState([]);
  const [invPagination, setInvPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState(null);
  const [invFilters, setInvFilters] = useState({
    status: 'ALL'
  });

  // Selected Investigation for Manage Modal
  const [selectedInvId, setSelectedInvId] = useState(null);
  const [invDetail, setInvDetail] = useState(null);
  const [invDetailLoading, setInvDetailLoading] = useState(false);
  const [invDetailError, setInvDetailError] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [assignedEmpIdInput, setAssignedEmpIdInput] = useState('');
  const [updatingInv, setUpdatingInv] = useState(false);

  // Fraud Rules State
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editRuleThreshold, setEditRuleThreshold] = useState('');
  const [editRuleWeight, setEditRuleWeight] = useState('');
  const [editRuleEnabled, setEditRuleEnabled] = useState(true);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleConfirmOpen, setRuleConfirmOpen] = useState(false);

  // Dynamically compute total configured weight from rules loaded from MongoDB
  const totalConfiguredWeight = useMemo(() => {
    return rules.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  }, [rules]);

  // Success message banner
  const [successBanner, setSuccessBanner] = useState('');

  const showSuccess = (msg) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(''), 4500);
  };

  /* ==============================================================================
     Data Fetching
     ============================================================================== */
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await getFraudStats();
      setStats(data);
    } catch (err) {
      setStatsError(err.message || 'Failed to load fraud statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async (page = 1) => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await getFraudAlerts({
        page,
        limit: alertsPagination.limit,
        riskLevel: alertFilters.riskLevel,
        status: alertFilters.status,
        transactionId: alertFilters.transactionId,
        startDate: alertFilters.startDate,
        endDate: alertFilters.endDate
      });
      setAlerts(res.items || []);
      if (res.pagination) setAlertsPagination(res.pagination);
    } catch (err) {
      setAlertsError(err.message || 'Failed to load fraud alerts');
    } finally {
      setAlertsLoading(false);
    }
  }, [alertsPagination.limit, alertFilters]);

  const loadInvestigations = useCallback(async (page = 1) => {
    setInvLoading(true);
    setInvError(null);
    try {
      const res = await getFraudInvestigations({
        page,
        limit: invPagination.limit,
        status: invFilters.status
      });
      setInvestigations(res.items || []);
      if (res.pagination) setInvPagination(res.pagination);
    } catch (err) {
      setInvError(err.message || 'Failed to load investigations');
    } finally {
      setInvLoading(false);
    }
  }, [invPagination.limit, invFilters]);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const res = await getFraudRules();
      setRules(Array.isArray(res) ? res : res.rules || []);
    } catch (err) {
      setRulesError(err.message || 'Failed to load fraud rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  // Initial load depending on active sub-tab
  useEffect(() => {
    if (activeTab === 'overview') {
      loadStats();
    } else if (activeTab === 'alerts') {
      loadAlerts(1);
    } else if (activeTab === 'investigations') {
      loadInvestigations(1);
    } else if (activeTab === 'rules') {
      loadRules();
    }
  }, [activeTab, loadStats, loadAlerts, loadInvestigations, loadRules]);

  /* ==============================================================================
     Alert Details Drawer / Modal
     ============================================================================== */
  const openAlertDetail = async (alertId) => {
    setSelectedAlertId(alertId);
    setAlertDetail(null);
    setAlertDetailLoading(true);
    setAlertDetailError(null);
    setInvestigationNotesInput('');
    try {
      const data = await getFraudAlertDetails(alertId);
      setAlertDetail(data);
    } catch (err) {
      setAlertDetailError(err.message || 'Failed to load alert details');
    } finally {
      setAlertDetailLoading(false);
    }
  };

  const handleCreateInvestigation = async () => {
    if (!selectedAlertId) return;
    setCreatingInvestigation(true);
    try {
      await createInvestigation(selectedAlertId, {
        notes: investigationNotesInput
      });
      showSuccess('Investigation case opened successfully!');
      // Reload alert detail & lists
      openAlertDetail(selectedAlertId);
      loadStats();
      loadAlerts(alertsPagination.page);
    } catch (err) {
      setAlertDetailError(err.message || 'Failed to create investigation');
    } finally {
      setCreatingInvestigation(false);
    }
  };

  /* ==============================================================================
     Investigation Management Modal
     ============================================================================== */
  const openInvestigationManage = async (invId) => {
    setSelectedInvId(invId);
    setInvDetail(null);
    setInvDetailLoading(true);
    setInvDetailError(null);
    setNewNoteText('');
    setResolutionText('');
    try {
      const data = await getFraudInvestigationDetails(invId);
      setInvDetail(data);
      setNewStatus(data.status);
      setResolutionText(data.resolution || '');
      setAssignedEmpIdInput(data.assignedEmployeeId ? String(data.assignedEmployeeId) : '');
    } catch (err) {
      setInvDetailError(err.message || 'Failed to load investigation details');
    } finally {
      setInvDetailLoading(false);
    }
  };

  const handleUpdateInvestigation = async (e) => {
    e?.preventDefault();
    if (!selectedInvId) return;
    setUpdatingInv(true);
    try {
      const payload = {};
      if (newStatus && newStatus !== invDetail.status) {
        payload.status = newStatus;
      }
      if (newNoteText.trim()) {
        payload.note = newNoteText.trim();
      }
      if (resolutionText.trim() !== (invDetail.resolution || '')) {
        payload.resolution = resolutionText.trim();
      }
      if (assignedEmpIdInput !== '' && Number(assignedEmpIdInput) !== invDetail.assignedEmployeeId) {
        payload.assignedEmployeeId = Number(assignedEmpIdInput);
      }

      await updateInvestigation(selectedInvId, payload);
      showSuccess('Investigation case updated successfully!');
      setNewNoteText('');
      // Reload details & list
      openInvestigationManage(selectedInvId);
      loadInvestigations(invPagination.page);
      loadStats();
    } catch (err) {
      setInvDetailError(err.message || 'Failed to update investigation');
    } finally {
      setUpdatingInv(false);
    }
  };

  /* ==============================================================================
     Fraud Rule Editing (Admin Only)
     ============================================================================== */
  const startEditRule = (rule) => {
    setEditingRule(rule);
    setEditRuleEnabled(rule.enabled);
    setEditRuleWeight(String(rule.weight));
    // Display threshold in rupees for HIGH_AMOUNT, raw number for others
    if (rule.ruleCode === 'HIGH_AMOUNT') {
      setEditRuleThreshold(rule.thresholdInRupees !== null ? String(rule.thresholdInRupees) : String(rule.threshold / 100));
    } else {
      setEditRuleThreshold(String(rule.threshold));
    }
    setRuleConfirmOpen(false);
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    setSavingRule(true);
    try {
      const payload = {
        enabled: editRuleEnabled,
        weight: Number(editRuleWeight)
      };

      if (editingRule.ruleCode === 'HIGH_AMOUNT') {
        payload.thresholdInRupees = parseFloat(editRuleThreshold);
      } else {
        payload.threshold = Number(editRuleThreshold);
      }

      await updateFraudRule(editingRule.ruleCode, payload);
      showSuccess(`Fraud rule ${editingRule.ruleCode} updated successfully! In-memory cache invalidated.`);
      setEditingRule(null);
      setRuleConfirmOpen(false);
      loadRules();
    } catch (err) {
      alert(`Error updating rule: ${err.message}`);
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="fraud-dashboard-container">
      {/* Header & Sub-navigation */}
      <div className="fraud-header">
        <div className="fraud-header-title">
          <h2>
            <IconShield size={24} style={{ color: 'var(--primary)' }} />
            Fraud Monitoring Dashboard
          </h2>
          <p>Real-time threat evaluation, alert auditing, and investigation lifecycle management</p>
        </div>

        <div className="fraud-tabs">
          <button
            type="button"
            className={`fraud-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <IconActivity size={16} />
            Overview
          </button>
          <button
            type="button"
            className={`fraud-tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <IconAlertTriangle size={16} />
            Alerts
            {stats?.totalAlerts > 0 && (
              <span className="badge-risk critical" style={{ marginLeft: '4px', padding: '0.1rem 0.4rem' }}>
                {stats.totalAlerts}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`fraud-tab-btn ${activeTab === 'investigations' ? 'active' : ''}`}
            onClick={() => setActiveTab('investigations')}
          >
            <IconClipboard size={16} />
            Investigations
            {stats?.pendingInvestigations > 0 && (
              <span className="badge-risk high" style={{ marginLeft: '4px', padding: '0.1rem 0.4rem' }}>
                {stats.pendingInvestigations}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`fraud-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            <IconSliders size={16} />
            Fraud Rules
          </button>
        </div>
      </div>

      {/* Global Success Banner */}
      {successBanner && (
        <div className="fraud-banner-success">
          <IconCheckCircle size={18} style={{ marginRight: '6px' }} />
          {successBanner}
        </div>
      )}

      {/* ==============================================================================
         TAB 1: OVERVIEW
         ============================================================================== */}
      {activeTab === 'overview' && (
        <div className="fraud-overview-section">
          {statsError && (
            <div className="fraud-banner-error">
              <span>{statsError}</span>
              <button type="button" className="fraud-btn fraud-btn-secondary" onClick={loadStats}>
                Retry
              </button>
            </div>
          )}

          {statsLoading && !stats ? (
            <div className="fraud-empty-state">
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p>Aggregating fraud metrics from MongoDB...</p>
            </div>
          ) : (
            stats && (
              <>
                {/* 5 Key Metric Cards */}
                <div className="fraud-stats-grid">
                  <div className="fraud-stat-card critical">
                    <div className="fraud-stat-header">
                      <span className="fraud-stat-title">Total Alerts</span>
                      <span className="fraud-stat-icon"><IconAlertTriangle size={16} /></span>
                    </div>
                    <div className="fraud-stat-value">{stats.totalAlerts}</div>
                    <div className="fraud-stat-subtext">
                      {stats.recentAlertCount} alert(s) in last 24h · fraud_alerts
                    </div>
                  </div>

                  <div className="fraud-stat-card primary">
                    <div className="fraud-stat-header">
                      <span className="fraud-stat-title">Total Assessments</span>
                      <span className="fraud-stat-icon"><IconActivity size={16} /></span>
                    </div>
                    <div className="fraud-stat-value">{stats.totalAssessments}</div>
                    <div className="fraud-stat-subtext">
                      Evaluated transactions · risk_assessments
                    </div>
                  </div>

                  <div className="fraud-stat-card high">
                    <div className="fraud-stat-header">
                      <span className="fraud-stat-title">Open Investigations</span>
                      <span className="fraud-stat-icon"><IconClipboard size={16} /></span>
                    </div>
                    <div className="fraud-stat-value">{stats.pendingInvestigations}</div>
                    <div className="fraud-stat-subtext">
                      {stats.resolvedInvestigations} resolved / false positive
                    </div>
                  </div>

                  <div className="fraud-stat-card medium">
                    <div className="fraud-stat-header">
                      <span className="fraud-stat-title">Recent Avg Risk Score</span>
                      <span className="fraud-stat-icon"><IconShield size={16} /></span>
                    </div>
                    <div className="fraud-stat-value">
                      {stats.recentAverageAssessmentScore !== undefined && stats.totalAssessments > 0
                        ? stats.recentAverageAssessmentScore
                        : (stats.recentAverageRiskScore ?? 0)}
                    </div>
                    <div className="fraud-stat-subtext">
                      {stats.totalAssessments > 0
                        ? `Avg of latest 1,000 evaluations (${stats.recentAverageAlertScore || stats.recentAverageRiskScore || 0} for alerts)`
                        : `Average of latest 1,000 alerts (0–100)`}
                    </div>
                  </div>

                  <div className="fraud-stat-card high">
                    <div className="fraud-stat-header">
                      <span className="fraud-stat-title">High & Critical Alerts</span>
                      <span className="fraud-stat-icon"><IconShield size={16} /></span>
                    </div>
                    <div className="fraud-stat-value">{(stats.alertsByRiskLevel?.HIGH || 0) + (stats.alertsByRiskLevel?.CRITICAL || 0)}</div>
                    <div className="fraud-stat-subtext">
                      {(stats.alertsByRiskLevel?.HIGH || 0) + (stats.alertsByRiskLevel?.CRITICAL || 0)} High/Crit · {stats.alertsByRiskLevel?.MEDIUM || 0} Med · {stats.alertsByRiskLevel?.LOW || 0} Low
                    </div>
                  </div>
                </div>

                {/* Visual Charts Grid */}
                <div className="fraud-charts-grid">
                  {/* Risk Distribution Breakdown (Sourced strictly from transaction_risk_assessments) */}
                  <div className="fraud-chart-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0 }}>Risk Level Distribution</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Source: <strong>transaction_risk_assessments</strong>
                      </span>
                    </div>
                    <div className="fraud-dist-list">
                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#fca5a5' }}>
                            CRITICAL (80-100)
                          </span>
                          <span className="fraud-dist-count">{stats.assessmentsByRiskLevel?.CRITICAL || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-critical"
                            style={{
                              width: `${stats.totalAssessments ? ((stats.assessmentsByRiskLevel?.CRITICAL || 0) / stats.totalAssessments) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#fcd34d' }}>
                            HIGH (60-79)
                          </span>
                          <span className="fraud-dist-count">{stats.assessmentsByRiskLevel?.HIGH || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-high"
                            style={{
                              width: `${stats.totalAssessments ? ((stats.assessmentsByRiskLevel?.HIGH || 0) / stats.totalAssessments) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#fde047' }}>
                            MEDIUM (30-59)
                          </span>
                          <span className="fraud-dist-count">{stats.assessmentsByRiskLevel?.MEDIUM || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-medium"
                            style={{
                              width: `${stats.totalAssessments ? ((stats.assessmentsByRiskLevel?.MEDIUM || 0) / stats.totalAssessments) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#93c5fd' }}>
                            LOW (0-29)
                          </span>
                          <span className="fraud-dist-count">{stats.assessmentsByRiskLevel?.LOW || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-low"
                            style={{
                              width: `${stats.totalAssessments ? ((stats.assessmentsByRiskLevel?.LOW || 0) / stats.totalAssessments) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span>Distribution Sum: <strong style={{ color: '#fff' }}>{(stats.assessmentsByRiskLevel?.LOW || 0) + (stats.assessmentsByRiskLevel?.MEDIUM || 0) + (stats.assessmentsByRiskLevel?.HIGH || 0) + (stats.assessmentsByRiskLevel?.CRITICAL || 0)}</strong></span>
                      <span>Total Assessments: <strong style={{ color: 'var(--primary)' }}>{stats.totalAssessments}</strong></span>
                    </div>
                  </div>

                  {/* Alerts Over Time */}
                  <div className="fraud-chart-card">
                    <h3>Alerts Over Time (Past 14 Days)</h3>
                    {stats.alertsOverTime && stats.alertsOverTime.length > 0 ? (
                      <div className="fraud-timeline-container">
                        {stats.alertsOverTime.map((t) => {
                          const maxCount = Math.max(...stats.alertsOverTime.map((item) => item.count), 1);
                          const heightPct = Math.max(10, Math.round((t.count / maxCount) * 100));
                          return (
                            <div key={t.date} className="fraud-timeline-col" title={`${t.date}: ${t.count} alert(s)`}>
                              <div className="fraud-timeline-bar-wrap">
                                <div className="fraud-timeline-bar" style={{ height: `${heightPct}%` }} />
                              </div>
                              <span className="fraud-timeline-date">{t.date.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="fraud-empty-state" style={{ padding: '1.5rem 0' }}>
                        <p>No historical alert activity recorded in the past 14 days.</p>
                      </div>
                    )}
                  </div>

                  {/* Investigation Status Breakdown */}
                  <div className="fraud-chart-card">
                    <h3>Investigation Pipeline</h3>
                    <div className="fraud-dist-list">
                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#fca5a5' }}>OPEN</span>
                          <span className="fraud-dist-count">{stats.investigationsByStatus?.OPEN || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-critical"
                            style={{
                              width: `${stats.totalInvestigations ? ((stats.investigationsByStatus?.OPEN || 0) / stats.totalInvestigations) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#fcd34d' }}>IN PROGRESS / UNDER REVIEW</span>
                          <span className="fraud-dist-count">
                            {(stats.investigationsByStatus?.IN_PROGRESS || 0) + (stats.investigationsByStatus?.UNDER_REVIEW || 0)}
                          </span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-high"
                            style={{
                              width: `${stats.totalInvestigations ? (((stats.investigationsByStatus?.IN_PROGRESS || 0) + (stats.investigationsByStatus?.UNDER_REVIEW || 0)) / stats.totalInvestigations) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#6ee7b7' }}>RESOLVED</span>
                          <span className="fraud-dist-count">{stats.investigationsByStatus?.RESOLVED || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-success"
                            style={{
                              width: `${stats.totalInvestigations ? ((stats.investigationsByStatus?.RESOLVED || 0) / stats.totalInvestigations) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="fraud-dist-item">
                        <div className="fraud-dist-meta">
                          <span className="fraud-dist-label" style={{ color: '#cbd5e1' }}>FALSE POSITIVE</span>
                          <span className="fraud-dist-count">{stats.investigationsByStatus?.FALSE_POSITIVE || 0}</span>
                        </div>
                        <div className="fraud-dist-bar-bg">
                          <div
                            className="fraud-dist-bar-fill bar-low"
                            style={{
                              width: `${stats.totalInvestigations ? ((stats.investigationsByStatus?.FALSE_POSITIVE || 0) / stats.totalInvestigations) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* ==============================================================================
         TAB 2: FRAUD ALERTS TABLE
         ============================================================================== */}
      {activeTab === 'alerts' && (
        <div className="fraud-alerts-section">
          {/* Filters Bar */}
          <div className="fraud-filters-bar">
            <input
              type="text"
              placeholder="Search by Txn ID..."
              className="fraud-filter-input"
              value={alertFilters.transactionId}
              onChange={(e) => setAlertFilters({ ...alertFilters, transactionId: e.target.value })}
            />

            <select
              className="fraud-filter-select"
              value={alertFilters.riskLevel}
              onChange={(e) => setAlertFilters({ ...alertFilters, riskLevel: e.target.value })}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              className="fraud-filter-select"
              value={alertFilters.status}
              onChange={(e) => setAlertFilters({ ...alertFilters, status: e.target.value })}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE POSITIVE</option>
            </select>

            <input
              type="date"
              className="fraud-filter-input"
              value={alertFilters.startDate}
              onChange={(e) => setAlertFilters({ ...alertFilters, startDate: e.target.value })}
              title="Start Date"
            />
            <input
              type="date"
              className="fraud-filter-input"
              value={alertFilters.endDate}
              onChange={(e) => setAlertFilters({ ...alertFilters, endDate: e.target.value })}
              title="End Date"
            />

            <button
              type="button"
              className="fraud-btn"
              onClick={() => loadAlerts(1)}
              disabled={alertsLoading}
            >
              <IconRefresh size={14} />
              Filter
            </button>
          </div>

          {alertsError && (
            <div className="fraud-banner-error">
              <span>{alertsError}</span>
              <button type="button" className="fraud-btn fraud-btn-secondary" onClick={() => loadAlerts(1)}>
                Retry
              </button>
            </div>
          )}

          {/* Alerts Table */}
          <div className="fraud-table-container">
            <table className="fraud-table">
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Triggered Rules</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alertsLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                      Loading fraud alerts...
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No fraud alerts matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => (
                    <tr key={alert.alertId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        #{alert.transactionId}
                      </td>
                      <td>
                        {alert.isUnavailable || alert.transactionType === 'UNAVAILABLE' ? (
                          <span className="badge-status" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                            UNAVAILABLE
                          </span>
                        ) : alert.isArchived ? (
                          <span className="badge-status open" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }} title="Transaction ledger record archived">
                            {alert.transactionType} (Archived)
                          </span>
                        ) : (
                          <span className="badge-status open" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#fff' }}>
                            {alert.transactionType}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {alert.amountFormatted ? (
                          `₹${alert.amountFormatted}`
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }} title="Transaction ledger record unavailable">Unavailable</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {alert.riskScore}
                          </span>
                          <div style={{ width: '50px', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${alert.riskScore}%`,
                                height: '100%',
                                background: alert.riskScore >= 80
                                  ? 'var(--danger)'
                                  : alert.riskScore >= 60
                                  ? 'var(--warning)'
                                  : alert.riskScore >= 30
                                  ? '#fde047'
                                  : 'var(--primary)'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge-risk ${String(alert.riskLevel).toLowerCase()}`}>
                          {alert.riskLevel}
                        </span>
                      </td>
                      <td>
                        <div className="rules-pill-list">
                          {(alert.reasons || []).map((r, i) => (
                            <span key={i} className="rule-pill" title={r}>
                              {r.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge-status ${String(alert.status).toLowerCase()}`}>
                          {alert.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {new Date(alert.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fraud-btn fraud-btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => openAlertDetail(alert.alertId)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="fraud-pagination">
            <span>
              Showing page {alertsPagination.page} of {alertsPagination.totalPages} ({alertsPagination.total} total alerts)
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="fraud-btn fraud-btn-secondary"
                disabled={alertsPagination.page <= 1 || alertsLoading}
                onClick={() => loadAlerts(alertsPagination.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="fraud-btn fraud-btn-secondary"
                disabled={alertsPagination.page >= alertsPagination.totalPages || alertsLoading}
                onClick={() => loadAlerts(alertsPagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
         TAB 3: INVESTIGATIONS TABLE
         ============================================================================== */}
      {activeTab === 'investigations' && (
        <div className="fraud-investigations-section">
          {/* Filters Bar */}
          <div className="fraud-filters-bar">
            <select
              className="fraud-filter-select"
              value={invFilters.status}
              onChange={(e) => setInvFilters({ ...invFilters, status: e.target.value })}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="UNDER_REVIEW">UNDER REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="FALSE_POSITIVE">FALSE POSITIVE</option>
              <option value="CLOSED">CLOSED</option>
            </select>

            <button
              type="button"
              className="fraud-btn"
              onClick={() => loadInvestigations(1)}
              disabled={invLoading}
            >
              <IconRefresh size={14} />
              Filter
            </button>
          </div>

          {invError && (
            <div className="fraud-banner-error">
              <span>{invError}</span>
              <button type="button" className="fraud-btn fraud-btn-secondary" onClick={() => loadInvestigations(1)}>
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="fraud-table-container">
            <table className="fraud-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Txn ID</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Assigned Employee</th>
                  <th>Opened At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invLoading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                      Loading investigations...
                    </td>
                  </tr>
                ) : investigations.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No investigations found. Open one from the Alerts view!
                    </td>
                  </tr>
                ) : (
                  investigations.map((inv) => (
                    <tr key={inv.investigationId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {inv.investigationId.slice(-6).toUpperCase()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        #{inv.transactionId}
                      </td>
                      <td>
                        {inv.isUnavailable || inv.transactionType === 'UNAVAILABLE' ? (
                          <span style={{ color: 'var(--text-muted)' }}>UNAVAILABLE</span>
                        ) : inv.isArchived ? (
                          <span title="Archived transaction record">{inv.transactionType} (Archived)</span>
                        ) : (
                          inv.transactionType
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {inv.amountFormatted ? (
                          `₹${inv.amountFormatted}`
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }} title="Transaction ledger record unavailable">Unavailable</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status ${String(inv.status).toLowerCase()}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {inv.notesCount} note(s)
                        </span>
                      </td>
                      <td>
                        {inv.assignedEmployeeId ? `Employee #${inv.assignedEmployeeId}` : 'Unassigned'}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fraud-btn fraud-btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => openInvestigationManage(inv.investigationId)}
                        >
                          Manage Case
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="fraud-pagination">
            <span>
              Showing page {invPagination.page} of {invPagination.totalPages} ({invPagination.total} total cases)
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="fraud-btn fraud-btn-secondary"
                disabled={invPagination.page <= 1 || invLoading}
                onClick={() => loadInvestigations(invPagination.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="fraud-btn fraud-btn-secondary"
                disabled={invPagination.page >= invPagination.totalPages || invLoading}
                onClick={() => loadInvestigations(invPagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
         TAB 4: FRAUD RULES MANAGEMENT (ADMIN EDIT / EMPLOYEE READ-ONLY)
         ============================================================================== */}
      {activeTab === 'rules' && (
        <div className="fraud-rules-section">
          {!isAdmin && (
            <div className="fraud-banner-success" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--primary)', color: '#93c5fd' }}>
              <strong>Read-only view:</strong> Modifying fraud detection rule parameters requires Administrator permissions.
            </div>
          )}

          {rulesError && (
            <div className="fraud-banner-error">
              <span>{rulesError}</span>
              <button type="button" className="fraud-btn fraud-btn-secondary" onClick={loadRules}>
                Retry
              </button>
            </div>
          )}

          {/* Rules Calibration Summary Header */}
          <div className="fraud-overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.25rem' }}>
            <div className="fraud-card">
              <span className="fraud-card-title">CONFIGURED FRAUD RULES</span>
              <span className="fraud-card-value">{rules.length}</span>
              <span className="fraud-card-subtext">Active rule specifications in MongoDB</span>
            </div>
            <div className="fraud-card">
              <span className="fraud-card-title">TOTAL POSSIBLE RISK SCORE</span>
              <span className="fraud-card-value" style={{ color: totalConfiguredWeight === 100 ? 'var(--success)' : 'var(--warning)' }}>
                {totalConfiguredWeight} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 100</span>
              </span>
              <span className="fraud-card-subtext">
                {totalConfiguredWeight === 100 ? 'Fully calibrated (100 max possible score)' : 'Rule weight capacity'}
              </span>
            </div>
          </div>

          <div className="fraud-table-container">
            <table className="fraud-table">
              <thead>
                <tr>
                  <th>Rule Code</th>
                  <th>Name & Description</th>
                  <th>Status</th>
                  <th>Configured Threshold</th>
                  <th>Weight (Points)</th>
                  <th>Last Modified</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rulesLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                      Loading rules from MongoDB...
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No rules configured in database.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.ruleId || rule.ruleCode}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {rule.ruleCode}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{rule.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {rule.description}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge-status ${rule.enabled ? 'resolved' : 'false_positive'}`}
                        >
                          {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {rule.ruleCode === 'HIGH_AMOUNT' ? (
                          <>
                            <strong>₹{Number(rule.thresholdInRupees || (rule.threshold / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)' }}>
                              ({Number(rule.threshold).toLocaleString()} paise)
                            </div>
                          </>
                        ) : rule.ruleCode === 'HIGH_VELOCITY' ? (
                          <>
                            <strong>&gt; {rule.threshold} txns</strong>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)' }}>
                              in {rule.config?.windowMinutes || 2} mins
                            </div>
                          </>
                        ) : rule.ruleCode === 'UNUSUAL_HOUR' ? (
                          <>
                            <strong>{String(rule.config?.startHour ?? 1).padStart(2, '0')}:00 - {String(rule.config?.endHour ?? 5).padStart(2, '0')}:00</strong>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)' }}>
                              {rule.config?.timezone || 'Asia/Kolkata'}
                            </div>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        +{rule.weight}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      {isAdmin && (
                        <td>
                          <button
                            type="button"
                            className="fraud-btn fraud-btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => startEditRule(rule)}
                          >
                            Configure
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', fontWeight: 600 }}>
                  <td colSpan={4} style={{ textAlign: 'right', padding: '0.85rem 1rem' }}>
                    Total Possible Score (All Rules Combined):
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: totalConfiguredWeight === 100 ? 'var(--success)' : 'var(--warning)' }}>
                    +{totalConfiguredWeight} / 100
                  </td>
                  <td colSpan={isAdmin ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ==============================================================================
         MODAL 1: ALERT DETAILS & QUICK INVESTIGATION CREATION
         ============================================================================== */}
      {selectedAlertId && (
        <div className="fraud-modal-backdrop" onClick={() => setSelectedAlertId(null)}>
          <div className="fraud-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fraud-modal-header">
              <h3>Fraud Alert Details</h3>
              <button
                type="button"
                className="fraud-modal-close"
                onClick={() => setSelectedAlertId(null)}
              >
                ✕
              </button>
            </div>

            {alertDetailLoading && !alertDetail ? (
              <div className="fraud-empty-state">
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p>Loading alert, assessment, and transaction details...</p>
              </div>
            ) : alertDetailError ? (
              <div className="fraud-banner-error">
                <span>{alertDetailError}</span>
              </div>
            ) : (
              alertDetail && (
                <div>
                  {/* Top Summary Banner */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>TRANSACTION</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        #{alertDetail.alert?.transactionId}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {alertDetail.transaction?.transactionRef || 'Ref: N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge-risk ${String(alertDetail.alert?.riskLevel).toLowerCase()}`} style={{ fontSize: '0.875rem' }}>
                        {alertDetail.alert?.riskLevel} ({alertDetail.alert?.riskScore} / 100)
                      </span>
                      <div style={{ marginTop: '0.25rem' }}>
                        <span className={`badge-status ${String(alertDetail.alert?.status).toLowerCase()}`}>
                          {alertDetail.alert?.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Context */}
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Financial Operation Details (MySQL)
                  </h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Type</span>
                      <span className="detail-value">{alertDetail.transaction?.transactionType || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value mono">
                        {alertDetail.transaction ? `₹${alertDetail.transaction.amountFormatted}` : '—'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Customer</span>
                      <span className="detail-value">{alertDetail.transaction?.customerName || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Source Account</span>
                      <span className="detail-value mono">{alertDetail.transaction?.sourceAccountNumber || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Destination Account</span>
                      <span className="detail-value mono">{alertDetail.transaction?.destinationAccountNumber || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Performed By</span>
                      <span className="detail-value">{alertDetail.transaction?.performedByUsername || 'System'}</span>
                    </div>
                  </div>

                  {/* Triggered Rules Breakdown */}
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', marginTop: '1rem' }}>
                    Triggered Fraud Rules (MongoDB)
                  </h4>
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.25rem' }}>
                    {alertDetail.assessment?.triggeredRules && alertDetail.assessment.triggeredRules.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {alertDetail.assessment.triggeredRules.map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span className="rule-pill" style={{ marginRight: '0.5rem', color: 'var(--primary)' }}>
                                {r.ruleCode}
                              </span>
                              <span style={{ fontSize: '0.8125rem' }}>{r.description}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fcd34d' }}>
                              +{r.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {(alertDetail.alert?.reasons || []).join(', ') || 'No triggered rules recorded.'}
                      </div>
                    )}
                  </div>

                  {/* Investigation Section */}
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Investigation Case
                  </h4>
                  {alertDetail.investigation ? (
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>Case Active:</strong> Status{' '}
                        <span className={`badge-status ${String(alertDetail.investigation.status).toLowerCase()}`}>
                          {alertDetail.investigation.status}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {alertDetail.investigation.notes?.length || 0} note(s) logged
                        </div>
                      </div>
                      <button
                        type="button"
                        className="fraud-btn"
                        onClick={() => {
                          const invId = alertDetail.investigation.investigationId;
                          setSelectedAlertId(null);
                          setActiveTab('investigations');
                          openInvestigationManage(invId);
                        }}
                      >
                        Manage Case
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        No investigation case opened yet for this alert.
                      </p>
                      <textarea
                        rows={2}
                        placeholder="Add initial notes for the investigation..."
                        className="fraud-filter-input"
                        style={{ width: '100%', marginBottom: '0.5rem', resize: 'vertical' }}
                        value={investigationNotesInput}
                        onChange={(e) => setInvestigationNotesInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="fraud-btn"
                        disabled={creatingInvestigation}
                        onClick={handleCreateInvestigation}
                      >
                        <IconClipboard size={14} />
                        {creatingInvestigation ? 'Opening Case...' : 'Open Investigation Case'}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ==============================================================================
         MODAL 2: INVESTIGATION CASE MANAGEMENT & NOTES LOG
         ============================================================================== */}
      {selectedInvId && (
        <div className="fraud-modal-backdrop" onClick={() => setSelectedInvId(null)}>
          <div className="fraud-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fraud-modal-header">
              <h3>Investigation Case #{selectedInvId.slice(-6).toUpperCase()}</h3>
              <button
                type="button"
                className="fraud-modal-close"
                onClick={() => setSelectedInvId(null)}
              >
                ✕
              </button>
            </div>

            {invDetailLoading && !invDetail ? (
              <div className="fraud-empty-state">
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p>Loading investigation case history...</p>
              </div>
            ) : invDetailError ? (
              <div className="fraud-banner-error">
                <span>{invDetailError}</span>
              </div>
            ) : (
              invDetail && (
                <form onSubmit={handleUpdateInvestigation}>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Transaction ID</span>
                      <span className="detail-value mono">#{invDetail.transactionId}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value mono">
                        {invDetail.transaction ? `₹${invDetail.transaction.amountFormatted}` : '—'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Customer</span>
                      <span className="detail-value">{invDetail.transaction?.customerName || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Assigned Officer</span>
                      <span className="detail-value">
                        {invDetail.assignedEmployee ? invDetail.assignedEmployee.fullName : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Status & Assignment Row */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                        UPDATE STATUS
                      </label>
                      <select
                        className="fraud-filter-select"
                        style={{ width: '100%' }}
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="UNDER_REVIEW">UNDER REVIEW</option>
                        <option value="RESOLVED">RESOLVED (Confirmed Fraud)</option>
                        <option value="FALSE_POSITIVE">FALSE POSITIVE (Cleared)</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                        ASSIGN EMPLOYEE ID
                      </label>
                      <input
                        type="number"
                        placeholder="Employee ID"
                        className="fraud-filter-input"
                        style={{ width: '100%' }}
                        value={assignedEmpIdInput}
                        onChange={(e) => setAssignedEmpIdInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Resolution Input */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                      RESOLUTION SUMMARY / OUTCOME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared after customer phone verification / Escalated to law enforcement"
                      className="fraud-filter-input"
                      style={{ width: '100%' }}
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                    />
                  </div>

                  {/* Notes Audit Trail */}
                  <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Investigation Notes & Audit Trail
                  </h4>
                  <div className="notes-timeline">
                    {invDetail.notes && invDetail.notes.length > 0 ? (
                      invDetail.notes.map((n, idx) => (
                        <div key={n.noteId || idx} className="note-card">
                          <div className="note-meta">
                            <span className="note-author">
                              {n.authorName || 'Staff'} ({n.authorRole || 'EMPLOYEE'})
                            </span>
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="note-text">{n.text}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                        No notes recorded yet.
                      </div>
                    )}
                  </div>

                  {/* Add New Note */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <textarea
                      rows={2}
                      placeholder="Add an operational note to this investigation (permanent audit log)..."
                      className="fraud-filter-input"
                      style={{ width: '100%', resize: 'vertical' }}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="fraud-btn fraud-btn-secondary"
                      onClick={() => setSelectedInvId(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="fraud-btn"
                      disabled={updatingInv}
                    >
                      {updatingInv ? 'Saving Changes...' : 'Save Case Updates'}
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        </div>
      )}

      {/* ==============================================================================
         MODAL 3: CONFIGURE FRAUD RULE (ADMIN ONLY)
         ============================================================================== */}
      {editingRule && (
        <div className="fraud-modal-backdrop" onClick={() => setEditingRule(null)}>
          <div className="fraud-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fraud-modal-header">
              <h3>Configure Fraud Rule: {editingRule.ruleCode}</h3>
              <button
                type="button"
                className="fraud-modal-close"
                onClick={() => setEditingRule(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              {editingRule.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                  RULE STATUS
                </label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ruleStatus"
                      checked={editRuleEnabled === true}
                      onChange={() => setEditRuleEnabled(true)}
                    />
                    Enabled (Active)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ruleStatus"
                      checked={editRuleEnabled === false}
                      onChange={() => setEditRuleEnabled(false)}
                    />
                    Disabled (Bypassed)
                  </label>
                </div>
              </div>

              {editingRule.ruleCode === 'HIGH_AMOUNT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                    MONETARY THRESHOLD (RUPEES ₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="fraud-filter-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={editRuleThreshold}
                    onChange={(e) => setEditRuleThreshold(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Stored in MongoDB as integer paise:{' '}
                    <strong>{Math.round(parseFloat(editRuleThreshold || 0) * 100).toLocaleString()} paise</strong>
                  </span>
                </div>
              )}

              {editingRule.ruleCode === 'HIGH_VELOCITY' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                    TRANSACTION COUNT THRESHOLD
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="fraud-filter-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={editRuleThreshold}
                    onChange={(e) => setEditRuleThreshold(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Flags transactions when more than this count occur within {editingRule.config?.windowMinutes || 2} minutes.
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.25rem' }}>
                  RISK WEIGHT POINTS (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="fraud-filter-input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  value={editRuleWeight}
                  onChange={(e) => setEditRuleWeight(e.target.value)}
                />
              </div>

              {/* Confirmation Step */}
              {ruleConfirmOpen ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ color: '#fca5a5', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Confirm Rule Parameter Update:
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    This will directly update the MongoDB rule definition and immediately flush the fraud engine's in-memory cache.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="fraud-btn fraud-btn-secondary"
                      onClick={() => setRuleConfirmOpen(false)}
                      disabled={savingRule}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="fraud-btn fraud-btn-danger"
                      onClick={handleSaveRule}
                      disabled={savingRule}
                    >
                      {savingRule ? 'Saving to Database...' : 'Confirm & Apply'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="fraud-btn fraud-btn-secondary"
                    onClick={() => setEditingRule(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="fraud-btn"
                    onClick={() => setRuleConfirmOpen(true)}
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
