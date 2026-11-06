import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './TransactionReceiptModal.css';

/* ==============================================================================
   Zero-dependency Inline SVG Icons
   ============================================================================== */
function IconPrinter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
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

function IconCheckCircle({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconBuilding({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function IconFileText({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

/**
 * Format Indian Rupee currency safely
 */
function formatINR(val) {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * TransactionReceiptModal Component (Feature 2)
 *
 * Provides a professional, printable transaction proof for cash deposits and cash withdrawals.
 * Supports both Standard A4 layout and Thermal Receipt (80mm) format.
 *
 * @param {object} props
 * @param {object} props.receipt - Authoritative receipt data from GET /api/transactions/:id/receipt
 * @param {Function} props.onClose - Modal close handler
 */
export default function TransactionReceiptModal({ receipt, onClose }) {
  const [layoutMode, setLayoutMode] = useState('standard');
  const [generatedAt] = useState(() => new Date().toLocaleString());
  const modalRef = useRef(null);
  const printBtnRef = useRef(null);

  useEffect(() => {
    printBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!receipt) return null;

  const { bank, transaction, account, balance, employee } = receipt;

  const isDeposit = transaction.type === 'DEPOSIT';
  const isWithdrawal = transaction.type === 'WITHDRAWAL';
  const displayType = transaction.transactionType || (isDeposit ? 'CASH DEPOSIT' : isWithdrawal ? 'CASH WITHDRAWAL' : 'FUND TRANSFER');

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      className="modal-overlay receipt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`modal-card receipt-dialog-card ${layoutMode === 'thermal' ? 'mode-thermal' : 'mode-standard'}`}
      >
        {/* Modal Controls Header (Screen Only) */}
        <div className="receipt-screen-toolbar no-print">
          <div className="toolbar-title-group">
            <IconFileText size={18} className="text-primary" />
            <span id="receipt-dialog-title" className="toolbar-title">Transaction Receipt Proof</span>
          </div>

          <div className="toolbar-actions-group">
            {/* Layout Mode Selector */}
            <div className="layout-toggle-group">
              <button
                type="button"
                className={`btn-layout-toggle ${layoutMode === 'standard' ? 'active' : ''}`}
                onClick={() => setLayoutMode('standard')}
                title="A4 Paper Format"
              >
                Standard (A4)
              </button>
              <button
                type="button"
                className={`btn-layout-toggle ${layoutMode === 'thermal' ? 'active' : ''}`}
                onClick={() => setLayoutMode('thermal')}
                title="80mm Thermal Slip Format"
              >
                Thermal Slip
              </button>
            </div>

            <button
              ref={printBtnRef}
              type="button"
              className="btn-primary-custom btn-print-receipt"
              onClick={handlePrint}
              title="Print official receipt (Ctrl+P)"
            >
              <IconPrinter size={15} />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              className="modal-close-icon-btn"
              onClick={onClose}
              aria-label="Close receipt modal"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="receipt-paper-wrapper">
          <div className={`receipt-paper ${layoutMode === 'thermal' ? 'thermal-receipt' : 'standard-receipt'}`} id="printable-transaction-receipt">
            {/* Header / Bank Branding */}
            <header className="receipt-header">
              <div className="receipt-brand-row">
                <div className="brand-logo-badge">
                  <IconBuilding size={24} />
                </div>
                <div className="brand-text">
                  <h1 className="bank-name">{bank?.name || 'CORE BANK'}</h1>
                  <span className="bank-tagline">Retail Branch Operations &bull; Central Cash Desk</span>
                </div>
              </div>

              <div className="receipt-title-banner">
                <h2 className="receipt-title">{bank?.receiptTitle || 'OFFICIAL TRANSACTION RECEIPT'}</h2>
                <div className="receipt-status-pill">
                  <IconCheckCircle size={14} />
                  <span>TRANSACTION {transaction?.status || 'SUCCESS'}</span>
                </div>
              </div>
            </header>

            <div className="receipt-divider" />

            {/* Core Transaction Highlights */}
            <div className="receipt-summary-grid">
              <div className="summary-field">
                <span className="field-label">Transaction Type</span>
                <strong className={`field-value type-badge ${isDeposit ? 'type-deposit' : 'type-withdraw'}`}>
                  {displayType}
                </strong>
              </div>

              <div className="summary-field">
                <span className="field-label">Transaction Reference</span>
                <strong className="field-value font-mono ref-value">{transaction?.transactionRef}</strong>
              </div>

              <div className="summary-field">
                <span className="field-label">Date &amp; Time</span>
                <span className="field-value font-mono">{transaction?.formattedDate || transaction?.timestamp}</span>
              </div>

              <div className="summary-field">
                <span className="field-label">Operational Status</span>
                <span className="field-value text-success font-semibold">COMPLETED &bull; VERIFIED</span>
              </div>
            </div>

            <div className="receipt-divider" />

            {/* Account & Customer Section */}
            <div className="receipt-section">
              <h3 className="section-heading">Account &amp; Beneficiary Details</h3>
              <div className="receipt-info-grid">
                <div className="info-row">
                  <span className="info-label">Account Number:</span>
                  <span className="info-data font-mono font-bold">{account?.accountNumber}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Account Type:</span>
                  <span className="info-data">{account?.accountType}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Customer Name:</span>
                  <span className="info-data font-semibold">{account?.customerName}</span>
                </div>
              </div>
            </div>

            <div className="receipt-divider" />

            {/* Balance & Ledger Movement Section */}
            <div className="receipt-section">
              <h3 className="section-heading">Financial Settlement</h3>
              <div className="balance-breakdown-table">
                <div className="breakdown-row">
                  <span className="breakdown-label">Previous Balance</span>
                  <span className="breakdown-amount font-mono">
                    {balance?.formattedPreviousBalance || formatINR(balance?.previousBalance)}
                  </span>
                </div>

                <div className={`breakdown-row highlight-amount ${isDeposit ? 'amount-deposit' : 'amount-withdraw'}`}>
                  <span className="breakdown-label">
                    {isDeposit ? 'Amount Deposited (+)' : 'Amount Withdrawn (-)'}
                  </span>
                  <span className="breakdown-amount font-mono font-bold">
                    {isDeposit ? '+ ' : '- '}
                    {balance?.formattedTransactionAmount || formatINR(balance?.transactionAmount || transaction?.amount)}
                  </span>
                </div>

                <div className="breakdown-row resulting-balance">
                  <span className="breakdown-label font-bold">Updated Account Balance</span>
                  <span className="breakdown-amount font-mono font-bold resulting-val">
                    {balance?.formattedUpdatedBalance || formatINR(balance?.updatedBalance)}
                  </span>
                </div>
              </div>
            </div>

            {transaction?.remarks && (
              <div className="receipt-section remarks-section">
                <span className="info-label">Transaction Remarks:</span>
                <p className="remarks-text">{transaction.remarks}</p>
              </div>
            )}

            <div className="receipt-divider" />

            {/* Cashier / Staff Accountability */}
            <div className="receipt-meta-footer">
              <div className="teller-info">
                <span className="meta-label">Processed By Staff:</span>
                <span className="meta-val font-semibold">{employee?.name}</span>
                {employee?.employeeId && <span className="meta-id font-mono">({employee.employeeId})</span>}
                <span className="meta-role">Role: {employee?.role || 'EMPLOYEE'}</span>
              </div>

              <div className="auth-stamp-box">
                <div className="stamp-seal">CORE BANK</div>
                <span className="stamp-sub">ELECTRONICALLY VERIFIED</span>
                <span className="stamp-ref font-mono">{transaction?.transactionRef}</span>
              </div>
            </div>

            {/* Legal / Verification Disclaimer */}
            <footer className="receipt-legal-footer">
              <p>
                This document serves as an official customer receipt and legal acknowledgment of the counter transaction processed across CORE BANK branch infrastructure.
              </p>
              <p className="footer-security-note">
                Verified against core database transaction ledger. No physical branch signature is required.
              </p>
              <div className="footer-timestamp-row">
                <span>Ref: {transaction?.transactionRef}</span>
                <span>Generated: {generatedAt}</span>
              </div>
            </footer>
          </div>
        </div>

        {/* Modal Bottom Bar (Screen Only) */}
        <div className="receipt-screen-bottombar no-print">
          <div className="bottombar-info">
            <span className="text-muted">
              {layoutMode === 'standard' ? 'Formatted for A4 Standard Print & PDF Export' : 'Formatted for 80mm Thermal Receipt Printers'}
            </span>
          </div>

          <div className="bottombar-actions">
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="btn-primary-custom btn-print-receipt"
              onClick={handlePrint}
            >
              <IconPrinter size={15} />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

