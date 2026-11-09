import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyProfile, updateMyProfile } from '../services/api';
import './CustomerProfile.css';

/* ==============================================================================
   Inline SVG Icons (Zero External Dependencies)
   ============================================================================== */
function IconUserCheck({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IconShield({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconLock({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconPhone({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconMapPin({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconCheckCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlertCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconRefreshCw({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function IconArrowLeft({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// Regex for strict contact validation matching backend
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

export default function CustomerProfile({ currentUser, onNavigateToOverview }) {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ phone: '', email: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch authenticated customer profile
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyProfile();
      const data = res?.data || res;
      setProfile(data);
      setFormData({
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || ''
      });
      setFieldErrors({});
    } catch (err) {
      setError(err.message || 'Failed to load customer profile records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Track if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      (formData.phone || '').trim() !== (profile.phone || '').trim() ||
      (formData.email || '').trim().toLowerCase() !== (profile.email || '').trim().toLowerCase() ||
      (formData.address || '').trim() !== (profile.address || '').trim()
    );
  }, [formData, profile]);

  // Client-side validation helper
  const validateForm = () => {
    const errs = {};
    const trimmedPhone = (formData.phone || '').trim();
    const trimmedEmail = (formData.email || '').trim();
    const trimmedAddress = (formData.address || '').trim();

    if (!trimmedPhone) {
      errs.phone = 'Phone number is required';
    } else if (!PHONE_REGEX.test(trimmedPhone)) {
      errs.phone = 'Phone number must be between 7 and 20 digits, +, or hyphens';
    }

    if (!trimmedEmail) {
      errs.email = 'Email address is required';
    } else if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 100) {
      errs.email = 'Please enter a valid email address (max 100 characters)';
    }

    if (!trimmedAddress) {
      errs.address = 'Residential address is required';
    } else if (trimmedAddress.length > 255) {
      errs.address = 'Address must not exceed 255 characters';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (successMsg) setSuccessMsg(null);
    if (error) setError(null);
  };

  const handleReset = () => {
    if (!profile) return;
    setFormData({
      phone: profile.phone || '',
      email: profile.email || '',
      address: profile.address || ''
    });
    setFieldErrors({});
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await updateMyProfile({
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim()
      });

      const updated = res?.data || res;
      setProfile((prev) => ({ ...prev, ...updated }));
      setFormData({
        phone: updated.phone || formData.phone.trim(),
        email: updated.email || formData.email.trim(),
        address: updated.address || formData.address.trim()
      });
      setSuccessMsg('Your contact information has been updated successfully in the core banking system.');
      setFieldErrors({});
    } catch (err) {
      const msg = err.message || 'Failed to update customer profile';
      setError(msg);
      if (err.details && Array.isArray(err.details)) {
        const mapped = {};
        err.details.forEach((item) => {
          if (item.field) mapped[item.field] = item.issue;
        });
        setFieldErrors(mapped);
      }
    } finally {
      setSaving(false);
    }
  };

  // Helper date formatter
  const formatDisplayDate = (d) => {
    if (!d) return '—';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d).slice(0, 10);
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return String(d).slice(0, 10);
    }
  };

  // Avatar Initials
  const initials = useMemo(() => {
    const name = profile?.fullName || currentUser?.displayName || currentUser?.username || 'C';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [profile, currentUser]);

  return (
    <div className="customer-profile-container">
      {/* Top Banner */}
      <div className="customer-profile-banner">
        <div className="profile-banner-left">
          <div className="profile-avatar-circle">
            {initials}
          </div>
          <div className="profile-banner-text">
            <h1>{profile?.fullName || currentUser?.displayName || 'Customer Profile'}</h1>
            <p>
              <span>Personal Online Banking</span>
              <span className="profile-id-pill">Customer ID #{profile?.customerId || currentUser?.customerId || '1'}</span>
              <span className={`profile-status-pill ${profile?.userStatus === 'INACTIVE' ? 'status-inactive' : 'status-active'}`}>
                &bull; {profile?.userStatus || 'ACTIVE'}
              </span>
            </p>
          </div>
        </div>

        <div className="profile-banner-actions">
          {onNavigateToOverview && (
            <button
              type="button"
              className="btn-profile-secondary"
              onClick={onNavigateToOverview}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconArrowLeft size={15} />
              <span>Account Overview</span>
            </button>
          )}
          <button
            type="button"
            className="btn-profile-secondary"
            onClick={loadProfile}
            disabled={loading || saving}
            title="Refresh profile records from database"
          >
            <IconRefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="profile-alert-bar success" role="alert">
          <IconCheckCircle size={20} className="profile-alert-bar-icon" />
          <div className="profile-alert-content">
            <p><strong>Profile Updated:</strong> {successMsg}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="profile-alert-bar error" role="alert">
          <IconAlertCircle size={20} className="profile-alert-bar-icon" />
          <div className="profile-alert-content">
            <p><strong>Update Failed:</strong> {error}</p>
          </div>
        </div>
      )}

      {loading && !profile ? (
        <div className="profile-loading-box">
          <IconRefreshCw size={32} className="spin-icon" style={{ color: '#38bdf8' }} />
          <p>Retrieving verified customer profile records...</p>
        </div>
      ) : (
        <>
          {/* Main Content Grid: Identity & Contact Form */}
          <div className="profile-main-grid">
            {/* Left Card: Verified Identity (Read-only) */}
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-card-title-box">
                  <IconShield size={19} style={{ color: '#38bdf8' }} />
                  <h2>Verified Legal Identity</h2>
                </div>
                <span className="profile-badge-tag tag-verified">Bank Verified</span>
              </div>

              <div className="identity-fields-grid">
                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Full Name</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> Locked</span>
                  </div>
                  <span className="identity-field-value">{profile?.fullName || '—'}</span>
                </div>

                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Customer ID</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> System</span>
                  </div>
                  <span className="identity-field-value highlight-cyan">#{profile?.customerId}</span>
                </div>

                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Portal Username</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> Locked</span>
                  </div>
                  <span className="identity-field-value highlight-mono">@{profile?.username || '—'}</span>
                </div>

                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Date of Birth</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> Locked</span>
                  </div>
                  <span className="identity-field-value highlight-mono">{profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '—'}</span>
                </div>

                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Registration Date</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> Audit</span>
                  </div>
                  <span className="identity-field-value highlight-mono">{formatDisplayDate(profile?.createdAt)}</span>
                </div>

                <div className="identity-field-box">
                  <div className="identity-field-header">
                    <span className="identity-field-label">Operational Status</span>
                    <span className="identity-lock-badge"><IconLock size={12} /> RBAC</span>
                  </div>
                  <span className="identity-field-value" style={{ color: '#34d399' }}>{profile?.userStatus || 'ACTIVE'}</span>
                </div>
              </div>

              {/* Policy Notice Box */}
              <div className="profile-policy-notice">
                <IconLock size={16} className="policy-icon" />
                <div className="policy-text">
                  <strong>Official KYC Verification Policy:</strong> Legal identity details (Full Name and Date of Birth) are verified against government documentation during onboarding and cannot be altered online. To request a legal name or birthdate correction, please present government-issued photo identification at your local branch.
                </div>
              </div>
            </div>

            {/* Right Card: Contact Details (Customer Editable) */}
            <div className="profile-card">
              <div className="profile-card-header">
                <div className="profile-card-title-box">
                  <IconUserCheck size={19} style={{ color: '#34d399' }} />
                  <h2>Contact Information</h2>
                </div>
                <span className="profile-badge-tag tag-editable">Customer Editable</span>
              </div>

              <form onSubmit={handleSubmit} className="profile-edit-form" noValidate>
                {/* Phone Number Field */}
                <div className="profile-input-group">
                  <div className="profile-label-row">
                    <label htmlFor="profile-phone-input" className="profile-input-label">
                      <span>Primary Phone Number</span>
                    </label>
                    <span className="profile-field-hint">e.g. +91 9876543210</span>
                  </div>
                  <div className="profile-input-wrapper">
                    <IconPhone size={15} className="profile-input-icon" />
                    <input
                      id="profile-phone-input"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={`profile-text-input ${fieldErrors.phone ? 'input-error' : ''}`}
                      placeholder="+91 98765 43210"
                      disabled={saving}
                      required
                    />
                  </div>
                  {fieldErrors.phone && (
                    <div className="input-error-msg">
                      <IconAlertCircle size={13} />
                      <span>{fieldErrors.phone}</span>
                    </div>
                  )}
                </div>

                {/* Email Address Field */}
                <div className="profile-input-group">
                  <div className="profile-label-row">
                    <label htmlFor="profile-email-input" className="profile-input-label">
                      <span>Email Address</span>
                    </label>
                    <span className="profile-field-hint">Used for official statements &amp; alerts</span>
                  </div>
                  <div className="profile-input-wrapper">
                    <IconMail size={15} className="profile-input-icon" />
                    <input
                      id="profile-email-input"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`profile-text-input ${fieldErrors.email ? 'input-error' : ''}`}
                      placeholder="customer@example.com"
                      disabled={saving}
                      required
                    />
                  </div>
                  {fieldErrors.email && (
                    <div className="input-error-msg">
                      <IconAlertCircle size={13} />
                      <span>{fieldErrors.email}</span>
                    </div>
                  )}
                </div>

                {/* Residential Address Field */}
                <div className="profile-input-group">
                  <div className="profile-label-row">
                    <label htmlFor="profile-address-input" className="profile-input-label">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><IconMapPin size={14} /> Residential Address</span>
                    </label>
                    <span className="profile-field-hint">
                      {formData.address ? `${formData.address.length}/255 characters` : 'Max 255 chars'}
                    </span>
                  </div>
                  <textarea
                    id="profile-address-input"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className={`profile-textarea ${fieldErrors.address ? 'input-error' : ''}`}
                    placeholder="Enter your current residential address..."
                    disabled={saving}
                    rows={3}
                    maxLength={255}
                    required
                  />
                  {fieldErrors.address && (
                    <div className="input-error-msg">
                      <IconAlertCircle size={13} />
                      <span>{fieldErrors.address}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="btn-profile-secondary"
                    onClick={handleReset}
                    disabled={!isDirty || saving}
                  >
                    Reset Changes
                  </button>
                  <button
                    type="submit"
                    className="btn-profile-primary"
                    disabled={!isDirty || saving}
                  >
                    {saving ? (
                      <>
                        <IconRefreshCw size={14} className="spin-icon" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <IconCheckCircle size={14} />
                        <span>Update Contact Info</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Security & Data Isolation Card */}
          <div className="profile-security-card">
            <div className="profile-card-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.65rem' }}>
              <div className="profile-card-title-box">
                <IconShield size={19} style={{ color: '#38bdf8' }} />
                <h2>Banking Privacy &amp; Data Isolation Guarantees</h2>
              </div>
              <span className="profile-badge-tag tag-verified">Encrypted &amp; Protected</span>
            </div>

            <div className="security-points-grid">
              <div className="security-point-box">
                <IconShield size={18} className="security-point-icon" />
                <div className="security-point-text">
                  <h4>Cryptographic Session Authentication</h4>
                  <p>
                    All banking requests verify identity strictly from your authenticated session cookie. Client-supplied customer IDs cannot bypass backend horizontal isolation checks.
                  </p>
                </div>
              </div>

              <div className="security-point-box">
                <IconLock size={18} className="security-point-icon" />
                <div className="security-point-text">
                  <h4>Multi-Tenant Data Privacy</h4>
                  <p>
                    Your bank accounts, ledger balances, and statement exports are strictly bound to Customer ID #{profile?.customerId}. No other customer or unauthorized party can access your financial records.
                  </p>
                </div>
              </div>

              <div className="security-point-box">
                <IconUserCheck size={18} className="security-point-icon" />
                <div className="security-point-text">
                  <h4>Restricted Infrastructure Telemetry</h4>
                  <p>
                    Detailed database pool diagnostics and server internals are restricted exclusively to system administrators. Retail banking sessions maintain safe, isolated operation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
