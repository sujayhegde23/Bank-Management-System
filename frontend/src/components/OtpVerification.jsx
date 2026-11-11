import { useState, useEffect, useRef } from 'react';
import './OtpVerification.css';

/* ==============================================================================
   Inline SVG Icons for OTP Verification Screen
   ============================================================================== */

function IconShieldCheck({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconMail({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconClock({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertTriangle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheckCircle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconArrowLeft({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconLock({ size = 12, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function formatMMSS(totalSeconds) {
  if (totalSeconds <= 0) return '00:00';
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Two-Factor Email OTP Verification Component (Phase 3)
 *
 * @param {object} props
 * @param {object} props.challenge - Active challenge metadata from Stage A
 * @param {string} props.challenge.challengeId
 * @param {string} props.challenge.maskedEmail
 * @param {number} props.challenge.expiresInSeconds
 * @param {number} props.challenge.resendAvailableInSeconds
 * @param {string} [props.challenge.username]
 * @param {(otp: string) => Promise<void>} props.onVerify - Verification handler
 * @param {() => Promise<object>} props.onResend - Resend challenge handler
 * @param {() => void} props.onBack - Return to credentials stage
 * @param {boolean} [props.loading] - External network loading state
 */
export default function OtpVerification({
  challenge,
  onVerify,
  onResend,
  onBack,
  loading = false
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [localLoading, setLocalLoading] = useState(false);
  const [localResending, setLocalResending] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [otpErrorCode, setOtpErrorCode] = useState(null);
  const [resendSuccess, setResendSuccess] = useState(null);

  // Timers
  const [expirySeconds, setExpirySeconds] = useState(
    challenge?.expiresInSeconds ? Number(challenge.expiresInSeconds) : 300
  );
  const [resendSeconds, setResendSeconds] = useState(
    challenge?.resendAvailableInSeconds ? Number(challenge.resendAvailableInSeconds) : 60
  );

  const inputRefs = useRef([]);
  const isSubmitting = loading || localLoading || localResending;

  // 1. Five-minute countdown interval (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setExpirySeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge?.challengeId]);

  // 2. Sixty-second resend cooldown interval
  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds, challenge?.challengeId]);

  // Focus first digit box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle single digit entry and auto-advance
  const handleDigitChange = (index, e) => {
    const val = e.target.value;
    const cleanDigit = val.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = cleanDigit;
    setDigits(newDigits);
    setOtpError(null);
    setResendSuccess(null);

    if (cleanDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace retreat and arrow keys
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Support pasting full 6-digit code
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData?.getData('text') || '';
    const cleanNumbers = pasteData.replace(/\D/g, '').slice(0, 6);
    if (!cleanNumbers) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < cleanNumbers.length; i++) {
      newDigits[i] = cleanNumbers[i];
    }
    setDigits(newDigits);
    setOtpError(null);
    setResendSuccess(null);

    const targetFocus = Math.min(cleanNumbers.length, 5);
    inputRefs.current[targetFocus]?.focus();
  };

  // Form submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const otpCode = digits.join('').trim();

    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 numeric digits of your verification code.');
      setOtpErrorCode('VAL_001');
      return;
    }

    if (expirySeconds <= 0) {
      setOtpError('This verification code has expired. Please click "Resend Code" below to request a new code.');
      setOtpErrorCode('AUTH_004');
      return;
    }

    setLocalLoading(true);
    setOtpError(null);
    setOtpErrorCode(null);
    setResendSuccess(null);

    try {
      await onVerify(otpCode);
    } catch (err) {
      const msg = err.message || 'Verification failed. Please check the code and try again.';
      setOtpError(msg);
      setOtpErrorCode(err.code || null);

      // If locked, disable inputs
      if (err.code === 'AUTH_005') {
        inputRefs.current.forEach((input) => input?.blur());
      } else {
        // Focus and select the first digit box for quick correction
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLocalLoading(false);
    }
  };

  // Resend challenge
  const handleResend = async () => {
    if (resendSeconds > 0 || isSubmitting) return;

    setLocalResending(true);
    setOtpError(null);
    setOtpErrorCode(null);
    setResendSuccess(null);

    try {
      const updated = await onResend();
      setDigits(['', '', '', '', '', '']);
      setExpirySeconds(updated?.expiresInSeconds || 300);
      setResendSeconds(updated?.resendAvailableInSeconds || 60);
      setResendSuccess('A fresh 6-digit security code has been dispatched to your email.');
      inputRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.message || 'Unable to resend verification code. Please try again or return to login.');
      setOtpErrorCode(err.code || null);
    } finally {
      setLocalResending(false);
    }
  };

  const isComplete = digits.every((d) => d !== '');
  const isLocked = otpErrorCode === 'AUTH_005';
  const isExpired = expirySeconds <= 0 || otpErrorCode === 'AUTH_004';

  return (
    <div className="otp-screen-root">
      <div className="otp-screen-card" role="region" aria-labelledby="otp-title">
        <div className="otp-header">
          <div className="otp-icon-badge">
            <IconShieldCheck size={28} />
          </div>
          <h1 id="otp-title" className="otp-title">Verify your email</h1>
          <p className="otp-subtitle">
            Enter the 6-digit security code dispatched to your registered address:
          </p>
          <div className="otp-destination-pill" title="Destination Email">
            <IconMail size={14} />
            <span className="otp-destination-email">{challenge?.maskedEmail || 'registered email'}</span>
          </div>
        </div>

        {/* Error Alert */}
        {otpError && (
          <div className="otp-alert otp-alert-error" role="alert" aria-live="assertive">
            <span className="otp-alert-icon">
              <IconAlertTriangle size={16} />
            </span>
            <div className="otp-alert-content">
              <span>{otpError}</span>
              {isLocked && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="otp-back-btn"
                    onClick={onBack}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <IconArrowLeft size={13} /> Return to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Alert */}
        {resendSuccess && !otpError && (
          <div className="otp-alert otp-alert-success" role="status" aria-live="polite">
            <span className="otp-alert-icon">
              <IconCheckCircle size={16} />
            </span>
            <span>{resendSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="otp-form" noValidate>
          {/* 6 Digit Inputs */}
          <div className="otp-inputs-row" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                id={`otp-digit-${idx}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                className={`otp-digit-input ${digit ? 'has-value' : ''} ${otpError ? 'is-error' : ''}`}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isSubmitting || isLocked}
                aria-label={`Digit ${idx + 1} of 6`}
                required
              />
            ))}
          </div>

          {/* Expiry Countdown & Status */}
          <div className="otp-meta-bar">
            <div
              className={`otp-timer-wrap ${
                isExpired ? 'otp-timer-expired' : expirySeconds < 60 ? 'otp-timer-warning' : ''
              }`}
            >
              <IconClock size={13} />
              {isExpired ? (
                <span className="otp-timer-value">Code Expired</span>
              ) : (
                <span>
                  Expires in <span className="otp-timer-value">{formatMMSS(expirySeconds)}</span>
                </span>
              )}
            </div>

            <div className="otp-cooldown-info">
              {resendSeconds > 0 ? (
                <span>Resend in {resendSeconds}s</span>
              ) : (
                <span style={{ color: '#4ade80' }}>Resend available</span>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            id="otp-verify-submit-btn"
            type="submit"
            className="otp-verify-btn"
            disabled={!isComplete || isSubmitting || isLocked}
          >
            {isSubmitting ? (
              <>
                <div className="otp-spinner" aria-hidden="true" />
                <span>Verifying Code...</span>
              </>
            ) : (
              <span>Verify &amp; Sign In</span>
            )}
          </button>

          {/* Resend Action */}
          <div className="otp-resend-wrap">
            <span>Didn't receive the code?</span>
            <button
              id="otp-resend-btn"
              type="button"
              className="otp-resend-btn"
              onClick={handleResend}
              disabled={resendSeconds > 0 || isSubmitting || isLocked}
            >
              {localResending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </form>

        {/* Footer Navigation */}
        <div className="otp-footer-nav">
          <button
            type="button"
            className="otp-back-btn"
            onClick={onBack}
            disabled={isSubmitting}
          >
            <IconArrowLeft size={13} /> Back to Login
          </button>

          <div className="otp-security-pill">
            <IconLock size={12} />
            <span>Encrypted 2FA Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
