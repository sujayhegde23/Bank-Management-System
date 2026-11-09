import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { transferFunds, verifyBeneficiary, getTransactionReceipt } from '../services/api';
import TransactionReceiptModal from './TransactionReceiptModal';
import './CustomerTransferModal.css';

/* Lucide-style Inline SVG Icons */
function IconSend({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconX({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function IconCheckCircle({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconShieldCheck({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconArrowRight({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconFileText({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconUserCheck({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function formatINR(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export default function CustomerTransferModal({
  isOpen,
  onClose,
  accounts = [],
  initialSourceAccountId = null,
  onTransferSuccess = null
}) {
  const activeAccounts = useMemo(() => {
    return (accounts || []).filter((a) => a.status === 'ACTIVE');
  }, [accounts]);

  // Modal Step: 'INPUT' | 'CONFIRM' | 'SUCCESS'
  const [step, setStep] = useState('INPUT');

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  // Beneficiary verification state
  const [beneficiary, setBeneficiary] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(null);

  // Receipt modal state
  const [receiptData, setReceiptData] = useState(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  // Derive source account safely without setState in effect
  const activeSourceAccountId = selectedAccountId || (initialSourceAccountId ? String(initialSourceAccountId) : (activeAccounts[0]?.accountId ? String(activeAccounts[0].accountId) : ''));

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && !isVerifying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isVerifying, onClose]);

  if (!isOpen) return null;

  const selectedSource = activeAccounts.find((a) => String(a.accountId) === String(activeSourceAccountId)) || activeAccounts[0] || null;
  const currentBalanceNum = selectedSource ? Number(selectedSource.balance) : 0;
  const transferAmountNum = Number(amount) || 0;
  const projectedBalance = currentBalanceNum - transferAmountNum;
  const isOverdraft = transferAmountNum > currentBalanceNum;

  const isSameAccount = selectedSource && destinationInput.trim() && (
    destinationInput.trim().toUpperCase() === String(selectedSource.accountNumber).toUpperCase() ||
    destinationInput.trim() === String(selectedSource.accountId)
  );

  const handleAmountChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*(\.\d{0,2})?$/.test(val)) {
      setAmount(val);
      setError(null);
    }
  };

  const handleQuickAdd = (addAmt) => {
    const current = Number(amount) || 0;
    const next = (current + addAmt).toFixed(2);
    setAmount(next);
    setError(null);
  };

  const handleQuickMax = () => {
    if (selectedSource) {
      setAmount(Number(selectedSource.balance).toFixed(2));
      setError(null);
    }
  };

  // Reset verification whenever destination input changes
  const handleDestinationChange = (e) => {
    setDestinationInput(e.target.value);
    setBeneficiary(null);
    setVerifyError(null);
    setError(null);
  };

  // Beneficiary verification action
  const handleVerifyBeneficiary = async () => {
    const trimmedDest = destinationInput.trim();
    if (!trimmedDest) {
      setVerifyError('Please enter a destination account number or account ID to verify.');
      return;
    }

    if (isSameAccount) {
      setVerifyError('Source and destination accounts must be different.');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    setError(null);

    try {
      const payload = {
        destinationAccount: trimmedDest,
        sourceAccountId: selectedSource?.accountId
      };
      const res = await verifyBeneficiary(payload);
      setBeneficiary(res);
    } catch (err) {
      console.error('Beneficiary verification failed:', err);
      setBeneficiary(null);
      setVerifyError(err.message || 'Beneficiary account verification failed. Please verify the account number.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetForm = () => {
    setDestinationInput('');
    setAmount('');
    setRemarks('');
    setSelectedAccountId('');
    setBeneficiary(null);
    setVerifyError(null);
    setError(null);
    setSuccessData(null);
    setReceiptData(null);
    setIdempotencyKey(null);
    setStep('INPUT');
  };

  // Move from INPUT to CONFIRM step
  const handleReviewTransfer = (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedSource) {
      setError('Please select an active source account.');
      return;
    }

    if (!destinationInput.trim()) {
      setError('Please enter a destination account identifier.');
      return;
    }

    if (!beneficiary) {
      setError('Please verify the destination beneficiary before proceeding.');
      return;
    }

    if (isSameAccount) {
      setError('Source and destination accounts must be different.');
      return;
    }

    if (!amount || transferAmountNum <= 0) {
      setError('Please enter a transfer amount greater than ₹0.00.');
      return;
    }

    if (isOverdraft) {
      setError(`Insufficient balance. Maximum available to transfer is ${formatINR(currentBalanceNum)}.`);
      return;
    }

    const generatedKey = 'TRF-IDEMP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    setIdempotencyKey(generatedKey);
    setStep('CONFIRM');
  };

  // Execute the transfer atomically
  const handleExecuteTransfer = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedDest = destinationInput.trim();
      const isDigitsOnly = /^\d+$/.test(trimmedDest);

      const payload = {
        sourceAccountId: selectedSource.accountId,
        amount: amount.trim(),
        remarks: remarks.trim() || undefined,
        idempotencyKey: idempotencyKey || ('TRF-' + Date.now())
      };

      if (isDigitsOnly) {
        payload.destinationAccountId = Number(trimmedDest);
      } else {
        payload.destinationAccountNumber = trimmedDest.toUpperCase();
      }

      const res = await transferFunds(payload);

      setSuccessData({
        transactionId: res.transactionId,
        reference: res.transactionReference || res.transactionRef || res.transaction_ref || 'COMPLETED',
        amount: res.amount || amount,
        sourceAccount: selectedSource.accountNumber,
        destinationAccount: res.destinationAccountNumber || trimmedDest.toUpperCase(),
        beneficiaryName: beneficiary?.beneficiaryName || 'Beneficiary',
        maskedDestination: beneficiary?.maskedAccountNumber || (res.destinationAccountNumber || trimmedDest.toUpperCase()),
        newBalance: res.sourceBalanceAfter !== undefined ? res.sourceBalanceAfter : (currentBalanceNum - transferAmountNum)
      });

      setStep('SUCCESS');

      if (onTransferSuccess) {
        onTransferSuccess(res);
      }
    } catch (err) {
      console.error('Transfer execution failed:', err);
      setError(err.message || 'Transfer failed. Please check your account balance and beneficiary details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch and display authoritative receipt
  const handleViewReceipt = async () => {
    if (!successData?.reference && !successData?.transactionId) return;
    setIsLoadingReceipt(true);
    try {
      const receipt = await getTransactionReceipt(successData.reference || successData.transactionId);
      setReceiptData(receipt);
    } catch (err) {
      console.error('Failed to load receipt:', err);
      setError(err.message || 'Could not load official receipt.');
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const isReviewDisabled = !selectedSource ||
    !destinationInput.trim() ||
    !beneficiary ||
    transferAmountNum <= 0 ||
    isOverdraft ||
    isSameAccount ||
    isVerifying ||
    isSubmitting;

  return createPortal(
    <>
      <div
        className="transfer-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting && !isVerifying) onClose();
        }}
      >
        <div className="transfer-modal-card">
          {/* Modal Header */}
          <div className="transfer-modal-header">
            <div className="transfer-header-title">
              <div className="transfer-header-icon">
                <IconSend size={20} />
              </div>
              <div>
                <h3 id="transfer-modal-title">
                  {step === 'CONFIRM' ? 'Review & Confirm Transfer' : step === 'SUCCESS' ? 'Transfer Completed' : 'Direct Customer Fund Transfer'}
                </h3>
                <p>
                  {step === 'CONFIRM'
                    ? 'Review beneficiary and account details before ledger commit'
                    : step === 'SUCCESS'
                    ? 'Funds moved atomically with official ledger proof'
                    : 'Move funds securely between registered bank accounts'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="transfer-close-btn"
              onClick={onClose}
              disabled={isSubmitting || isVerifying}
              aria-label="Close transfer dialog"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: SUCCESS VIEW                                          */}
          {/* ------------------------------------------------------------- */}
          {step === 'SUCCESS' && successData && (
            <div className="transfer-success-body">
              <div className="transfer-success-icon-box">
                <IconCheckCircle size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.25rem 0' }}>
                  Fund Transfer Completed!
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>
                  The debit and credit operations were committed atomically in the core ledger.
                </p>
              </div>

              <div className="transfer-receipt-box">
                <div className="receipt-row">
                  <span className="receipt-label">Amount Transferred</span>
                  <span className="receipt-val highlight">{formatINR(successData.amount)}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Transaction Reference</span>
                  <span className="receipt-val mono" style={{ color: '#38bdf8' }}>{successData.reference}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Debited From</span>
                  <span className="receipt-val mono">{successData.sourceAccount}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Credited To Beneficiary</span>
                  <span className="receipt-val mono">
                    {successData.beneficiaryName} ({successData.maskedDestination})
                  </span>
                </div>
                {successData.newBalance !== undefined && (
                  <div className="receipt-row">
                    <span className="receipt-label">New Available Balance</span>
                    <span className="receipt-val mono" style={{ color: '#34d399', fontWeight: 700 }}>
                      {formatINR(successData.newBalance)}
                    </span>
                  </div>
                )}
              </div>

              <div className="transfer-modal-actions" style={{ width: '100%', justifyContent: 'space-between', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={handleResetForm}
                >
                  Transfer Again
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-receipt-action"
                    onClick={handleViewReceipt}
                    disabled={isLoadingReceipt}
                    title="View official bank receipt proof"
                  >
                    <IconFileText size={15} />
                    <span>{isLoadingReceipt ? 'Loading Proof...' : 'View Receipt'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={onClose}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: CONFIRMATION VIEW (Section 5)                         */}
          {/* ------------------------------------------------------------- */}
          {step === 'CONFIRM' && (
            <div className="transfer-modal-body">
              {error && (
                <div className="transfer-alert-error" role="alert">
                  <IconAlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div className="transfer-confirm-banner">
                <IconShieldCheck size={20} className="shield-icon" />
                <div>
                  <strong>Please Review Transfer Details</strong>
                  <p>Funds will be debited immediately and transferred to the verified beneficiary below.</p>
                </div>
              </div>

              {/* Source Account Details */}
              <div className="transfer-summary-block">
                <span className="summary-block-title">Debit Source Account</span>
                <div className="summary-details-grid">
                  <div className="summary-field">
                    <span className="summary-label">Account Number:</span>
                    <span className="summary-value font-mono">{selectedSource.accountNumber}</span>
                  </div>
                  <div className="summary-field">
                    <span className="summary-label">Account Type:</span>
                    <span className="summary-value">{selectedSource.accountType}</span>
                  </div>
                  <div className="summary-field">
                    <span className="summary-label">Available Balance:</span>
                    <span className="summary-value highlight-green">{formatINR(selectedSource.balance)}</span>
                  </div>
                </div>
              </div>

              {/* Destination Beneficiary Details */}
              <div className="transfer-summary-block beneficiary-block">
                <div className="summary-block-title-row">
                  <span className="summary-block-title">Credit Destination (Beneficiary)</span>
                  <span className="badge-verified-pill">
                    <IconUserCheck size={13} />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="summary-details-grid">
                  <div className="summary-field">
                    <span className="summary-label">Beneficiary Name:</span>
                    <span className="summary-value font-bold" style={{ color: '#f8fafc' }}>
                      {beneficiary.beneficiaryName}
                    </span>
                  </div>
                  <div className="summary-field">
                    <span className="summary-label">Destination Account:</span>
                    <span className="summary-value font-mono">{beneficiary.maskedAccountNumber}</span>
                  </div>
                  <div className="summary-field">
                    <span className="summary-label">Account Type:</span>
                    <span className="summary-value">{beneficiary.accountType}</span>
                  </div>
                </div>
              </div>

              {/* Transfer Particulars */}
              <div className="transfer-summary-block txn-block">
                <span className="summary-block-title">Transfer Particulars</span>
                <div className="summary-details-grid">
                  <div className="summary-field">
                    <span className="summary-label">Transfer Amount:</span>
                    <span className="summary-value font-bold highlight-cyan" style={{ fontSize: '1.15rem' }}>
                      {formatINR(transferAmountNum)}
                    </span>
                  </div>
                  <div className="summary-field">
                    <span className="summary-label">Projected Source Balance:</span>
                    <span className="summary-value font-mono">{formatINR(projectedBalance)}</span>
                  </div>
                  {remarks && (
                    <div className="summary-field full-width">
                      <span className="summary-label">Remarks / Memo:</span>
                      <span className="summary-value italic">{remarks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirm Actions */}
              <div className="transfer-modal-actions">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setStep('INPUT')}
                  disabled={isSubmitting}
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  className="btn-primary-custom"
                  onClick={handleExecuteTransfer}
                  disabled={isSubmitting}
                  style={{ gap: '0.5rem' }}
                >
                  <IconSend size={15} />
                  <span>
                    {isSubmitting ? 'Transferring Funds Atomically...' : `Confirm & Transfer ${formatINR(transferAmountNum)}`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: INPUT FORM (Sections 1, 2, 3)                         */}
          {/* ------------------------------------------------------------- */}
          {step === 'INPUT' && (
            <form onSubmit={handleReviewTransfer}>
              <div className="transfer-modal-body">
                {/* Global Error Banner */}
                {error && (
                  <div className="transfer-alert-error" role="alert">
                    <IconAlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Source Account Selector */}
                <div className="transfer-form-group">
                  <label htmlFor="source-account-select" className="transfer-form-label">
                    <span>Source Account (Debit)</span>
                    <span style={{ color: '#38bdf8', fontSize: '0.72rem' }}>Ownership &amp; Status Enforced</span>
                  </label>
                  {activeAccounts.length === 0 ? (
                    <div className="transfer-alert-warning">
                      No active accounts eligible for transfers. Please contact branch staff.
                    </div>
                  ) : (
                    <select
                      id="source-account-select"
                      className="transfer-select-input"
                      value={activeSourceAccountId}
                      onChange={(e) => {
                        setSelectedAccountId(e.target.value);
                        setError(null);
                        if (beneficiary) {
                          // Re-verify if source changes
                          setBeneficiary(null);
                        }
                      }}
                      disabled={isSubmitting || isVerifying}
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.accountId} value={acc.accountId}>
                          {acc.accountNumber} ({acc.accountType}) • Available: {formatINR(acc.balance)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Destination Beneficiary Input + Verification */}
                <div className="transfer-form-group">
                  <label htmlFor="dest-account-input" className="transfer-form-label">
                    <span>Destination Beneficiary (Credit)</span>
                    <span style={{ color: beneficiary ? '#34d399' : '#f59e0b', fontSize: '0.72rem' }}>
                      {beneficiary ? 'Beneficiary Verified ✓' : 'Verification Required'}
                    </span>
                  </label>

                  <div className="beneficiary-input-row">
                    <input
                      id="dest-account-input"
                      type="text"
                      className="transfer-text-input font-mono"
                      placeholder="e.g. ACC-SB-XXXXXXXX or numeric Account ID"
                      value={destinationInput}
                      onChange={handleDestinationChange}
                      disabled={isSubmitting || isVerifying}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      id="btn-verify-beneficiary"
                      className={`btn-verify-beneficiary ${beneficiary ? 'verified' : ''}`}
                      onClick={handleVerifyBeneficiary}
                      disabled={isVerifying || isSubmitting || !destinationInput.trim()}
                      title="Verify beneficiary account before confirming transfer"
                    >
                      {isVerifying ? (
                        <span>Verifying...</span>
                      ) : beneficiary ? (
                        <>
                          <IconCheckCircle size={15} />
                          <span>Verified</span>
                        </>
                      ) : (
                        <>
                          <IconShieldCheck size={15} />
                          <span>Verify</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Verification Error */}
                  {verifyError && (
                    <div className="beneficiary-error-pill" role="alert">
                      <IconAlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  {/* Verified Beneficiary Card (Section 3) */}
                  {beneficiary && (
                    <div className="beneficiary-verified-card" id="beneficiary-verified-card">
                      <div className="verified-card-header">
                        <div className="verified-card-title">
                          <IconUserCheck size={16} className="verified-icon" />
                          <span>Beneficiary Confirmed</span>
                        </div>
                        <span className="verified-status-tag">ACTIVE &amp; VERIFIED</span>
                      </div>
                      <div className="verified-card-grid">
                        <div className="verified-item">
                          <span className="v-label">Beneficiary Name</span>
                          <span className="v-val highlight" id="beneficiary-name">{beneficiary.beneficiaryName}</span>
                        </div>
                        <div className="verified-item">
                          <span className="v-label">Masked Account</span>
                          <span className="v-val font-mono" id="beneficiary-masked-acc">{beneficiary.maskedAccountNumber}</span>
                        </div>
                        <div className="verified-item">
                          <span className="v-label">Account Type</span>
                          <span className="v-val" id="beneficiary-acc-type">{beneficiary.accountType}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {isSameAccount && (
                    <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                      Destination cannot be the same as the source account.
                    </span>
                  )}
                </div>

                {/* Transfer Amount */}
                <div className="transfer-form-group">
                  <label htmlFor="transfer-amount-input" className="transfer-form-label">
                    <span>Transfer Amount</span>
                    <span style={{ color: '#f59e0b', fontSize: '0.72rem' }}>INR (₹)</span>
                  </label>
                  <div className="transfer-currency-container">
                    <span className="transfer-currency-prefix">₹</span>
                    <input
                      id="transfer-amount-input"
                      type="text"
                      inputMode="decimal"
                      className="transfer-currency-input"
                      placeholder="0.00"
                      value={amount}
                      onChange={handleAmountChange}
                      disabled={isSubmitting || !selectedSource}
                      autoComplete="off"
                    />
                  </div>

                  {/* Quick Add Chips */}
                  <div className="transfer-quick-chips">
                    <span className="transfer-chip-label">Quick Add:</span>
                    <button
                      type="button"
                      className="transfer-chip-btn"
                      onClick={() => handleQuickAdd(500)}
                      disabled={isSubmitting || !selectedSource}
                    >
                      +₹500
                    </button>
                    <button
                      type="button"
                      className="transfer-chip-btn"
                      onClick={() => handleQuickAdd(1000)}
                      disabled={isSubmitting || !selectedSource}
                    >
                      +₹1,000
                    </button>
                    <button
                      type="button"
                      className="transfer-chip-btn"
                      onClick={() => handleQuickAdd(2500)}
                      disabled={isSubmitting || !selectedSource}
                    >
                      +₹2,500
                    </button>
                    <button
                      type="button"
                      className="transfer-chip-btn"
                      onClick={() => handleQuickAdd(5000)}
                      disabled={isSubmitting || !selectedSource}
                    >
                      +₹5,000
                    </button>
                    <button
                      type="button"
                      className="transfer-chip-btn chip-max"
                      onClick={handleQuickMax}
                      disabled={isSubmitting || !selectedSource || currentBalanceNum <= 0}
                      title="Transfer entire available balance"
                    >
                      Max Available
                    </button>
                  </div>
                </div>

                {/* Live Balance Projection Card */}
                {selectedSource && (
                  <div className={`transfer-projection-card ${isOverdraft ? 'overdraft' : ''}`}>
                    <div className="transfer-proj-label">
                      <span>{isOverdraft ? 'Projected Overdraft (Blocked)' : 'Projected Balance After Debit'}</span>
                      <span className="math">
                        {formatINR(currentBalanceNum)} &minus; {formatINR(transferAmountNum)}
                      </span>
                    </div>
                    <div className="transfer-proj-val">
                      {isOverdraft ? 'INSUFFICIENT FUNDS' : formatINR(Math.max(0, projectedBalance))}
                    </div>
                  </div>
                )}

                {/* Optional Remarks */}
                <div className="transfer-form-group">
                  <label htmlFor="transfer-remarks-input" className="transfer-form-label">
                    <span>Transfer Remarks (Optional Memo)</span>
                  </label>
                  <input
                    id="transfer-remarks-input"
                    type="text"
                    className="transfer-text-input"
                    placeholder="e.g. Rent share, invoice payment, monthly allowance"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={255}
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="transfer-modal-actions">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={onClose}
                  disabled={isSubmitting || isVerifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-review-transfer"
                  className="btn-primary-custom"
                  disabled={isReviewDisabled}
                  style={{ gap: '0.5rem' }}
                >
                  <span>
                    {!beneficiary
                      ? 'Verify Beneficiary to Continue'
                      : transferAmountNum > 0
                      ? `Review Transfer ${formatINR(transferAmountNum)}`
                      : 'Review Transfer Details'}
                  </span>
                  <IconArrowRight size={15} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Official Transaction Receipt Modal if requested */}
      {receiptData && (
        <TransactionReceiptModal
          receipt={receiptData}
          onClose={() => setReceiptData(null)}
        />
      )}
    </>,
    document.body
  );
}
