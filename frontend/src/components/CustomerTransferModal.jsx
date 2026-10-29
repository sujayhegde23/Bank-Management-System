import { useState, useMemo, useEffect } from 'react';
import { transferFunds } from '../services/api';
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

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Derive source account safely without setState in effect
  const activeSourceAccountId = selectedAccountId || (initialSourceAccountId ? String(initialSourceAccountId) : (activeAccounts[0]?.accountId ? String(activeAccounts[0].accountId) : ''));

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

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

  const handleResetForm = () => {
    setDestinationInput('');
    setAmount('');
    setRemarks('');
    setSelectedAccountId('');
    setError(null);
    setSuccessData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedSource) {
      setError('Please select an active source account.');
      return;
    }

    const trimmedDest = destinationInput.trim();
    if (!trimmedDest) {
      setError('Please enter a destination account number or account ID.');
      return;
    }

    if (isSameAccount) {
      setError('Source and destination accounts must be different (TXN_002).');
      return;
    }

    if (!amount || transferAmountNum <= 0) {
      setError('Please enter a transfer amount greater than ₹0.00.');
      return;
    }

    if (isOverdraft) {
      setError(`Insufficient balance. Maximum available to transfer is ${formatINR(currentBalanceNum)} (TXN_001).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const isDigitsOnly = /^\d+$/.test(trimmedDest);
      const payload = {
        sourceAccountId: selectedSource.accountId,
        amount: amount.trim(),
        remarks: remarks.trim() || undefined
      };

      if (isDigitsOnly) {
        payload.destinationAccountId = Number(trimmedDest);
      } else {
        payload.destinationAccountNumber = trimmedDest.toUpperCase();
      }

      const res = await transferFunds(payload);

      setSuccessData({
        reference: res.transactionReference || res.transactionRef || res.transaction_ref || 'COMPLETED',
        amount: res.amount || amount,
        sourceAccount: selectedSource.accountNumber,
        destinationAccount: res.destinationAccountNumber || trimmedDest.toUpperCase(),
        newBalance: res.sourceNewBalance !== undefined ? res.sourceNewBalance : res.newBalance
      });

      if (onTransferSuccess) {
        onTransferSuccess(res);
      }
    } catch (err) {
      console.error('Transfer failed:', err);
      setError(err.message || 'Transfer failed. Please check the beneficiary details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="transfer-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
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
              <h3 id="transfer-modal-title">Direct Customer Fund Transfer</h3>
              <p>Move funds securely between bank accounts (FR-15, FR-17, AC-4)</p>
            </div>
          </div>
          <button
            type="button"
            className="transfer-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close transfer dialog"
          >
            <IconX size={18} />
          </button>
        </div>

        {successData ? (
          /* Success Receipt View */
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
                <span className="receipt-label">Credited To</span>
                <span className="receipt-val mono">{successData.destinationAccount}</span>
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

            <div className="transfer-modal-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={handleResetForm}
              >
                Transfer Again
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
        ) : (
          /* Transfer Input Form */
          <form onSubmit={handleSubmit}>
            <div className="transfer-modal-body">
              {/* Error Banner */}
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
                  <span style={{ color: '#38bdf8', fontSize: '0.72rem' }}>FR-15 Ownership Enforced</span>
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
                    }}
                    disabled={isSubmitting}
                  >
                    {activeAccounts.map((acc) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.accountNumber} ({acc.accountType}) • Available: {formatINR(acc.balance)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destination Account Identifier */}
              <div className="transfer-form-group">
                <label htmlFor="dest-account-input" className="transfer-form-label">
                  <span>Destination Account (Credit)</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Beneficiary Identifier</span>
                </label>
                <input
                  id="dest-account-input"
                  type="text"
                  className="transfer-text-input font-mono"
                  placeholder="e.g. ACC-SB-XXXXXXXX or numeric Account ID"
                  value={destinationInput}
                  onChange={(e) => {
                    setDestinationInput(e.target.value);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                {isSameAccount && (
                  <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                    Destination cannot be the same as the source account (TXN_002).
                  </span>
                )}
              </div>

              {/* Transfer Amount with Currency Flexbox */}
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

              {/* Optional Memo / Remarks */}
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
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary-custom"
                disabled={isSubmitting || !selectedSource || transferAmountNum <= 0 || isOverdraft || isSameAccount}
                style={{ gap: '0.5rem' }}
              >
                <IconSend size={15} />
                <span>
                  {isSubmitting
                    ? 'Processing Transfer...'
                    : transferAmountNum > 0
                    ? `Confirm Transfer ${formatINR(transferAmountNum)}`
                    : 'Confirm Transfer'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
