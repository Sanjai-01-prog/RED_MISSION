import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Key, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Building2, 
  Award,
  Sparkles,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { adminApi } from '../../services/api';
import LiveDateTime from '../shared/LiveDateTime';

export default function AdminAuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [step, setStep] = useState('credentials'); // 'credentials' | 'dual_otp' | 'change_password' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step 1: Credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Dual 2FA State
  const [preAuthToken, setPreAuthToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [demoMobileOtp, setDemoMobileOtp] = useState(null);
  const [demoEmailOtp, setDemoEmailOtp] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 3: Mandatory Password Change & Recovery Show/Hide Toggles
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChannel, setForgotChannel] = useState('EMAIL');
  const [forgotStep, setForgotStep] = useState(1);
  const [resetTokenOrOtp, setResetTokenOrOtp] = useState('');
  const [demoResetToken, setDemoResetToken] = useState(null);

  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isOpen) {
      setStep('credentials');
      setIdentifier('');
      setPassword('');
      setMobileOtp('');
      setEmailOtp('');
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // ==========================================
  // STEP 1: VERIFY CREDENTIALS -> TRIGGER DUAL 2FA
  // ==========================================
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your Admin username or registered email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);

    const res = await adminApi.loginStep1(cleanIdentifier, password);
    setLoading(false);

    if (res.success) {
      setPreAuthToken(res.preAuthToken);
      setMaskedPhone(res.maskedPhone);
      setMaskedEmail(res.maskedEmail);
      setDemoMobileOtp(res.demoMobileOtp);
      setDemoEmailOtp(res.demoEmailOtp);
      setStep('dual_otp');
      setResendCooldown(30);
    } else {
      setErrorMessage(res.error || 'Invalid credentials or account locked.');
    }
  };

  // ==========================================
  // STEP 2: VERIFY BOTH OTPS (MOBILE + EMAIL)
  // ==========================================
  const handleDualOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanMobileOtp = mobileOtp.trim();
    const cleanEmailOtp = emailOtp.trim();

    if (!cleanMobileOtp || cleanMobileOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit Mobile verification OTP.');
      return;
    }
    if (!cleanEmailOtp || cleanEmailOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit Email verification OTP.');
      return;
    }

    setLoading(true);

    const res = await adminApi.loginVerifyOtps(preAuthToken, cleanMobileOtp, cleanEmailOtp);
    setLoading(false);

    if (res.success) {
      if (res.admin.mustChangePassword) {
        setStep('change_password');
        setSuccessMessage('First login detected: You must change your temporary password to continue.');
      } else {
        setSuccessMessage(`Authenticated as ${res.admin.roleName || res.admin.roleId}! Launching Medical Command...`);
        setTimeout(() => {
          onAuthSuccess(res.admin);
          onClose();
        }, 700);
      }
    } else {
      setErrorMessage(res.error || 'Failed to verify dual OTPs.');
    }
  };

  // ==========================================
  // STEP 3: MANDATORY PASSWORD CHANGE
  // ==========================================
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }
    if (newPassword === password) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    setLoading(true);

    const res = await adminApi.changePassword(password, newPassword, confirmPassword);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Password successfully updated! Launching Medical Command...');
      setTimeout(async () => {
        const me = await adminApi.getProfile();
        onAuthSuccess(me.admin);
        onClose();
      }, 700);
    } else {
      setErrorMessage(res.error || 'Failed to update password.');
    }
  };

  // ==========================================
  // FORGOT ADMIN PASSWORD
  // ==========================================
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await adminApi.forgotPasswordRequest(forgotIdentifier, forgotChannel);
    setLoading(false);

    if (res.success) {
      setForgotStep(2);
      if (res.demoOtp) setDemoResetToken(res.demoOtp);
      else if (res.demoLink) setDemoResetToken(res.demoLink.split('token=')[1]);
      setSuccessMessage('Administrative recovery instructions dispatched.');
    } else {
      setErrorMessage(res.error || 'Failed to send recovery instructions.');
    }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const payload = {
      identifier: forgotIdentifier,
      newPassword,
      confirmPassword
    };

    if (forgotChannel === 'MOBILE') payload.otp = resetTokenOrOtp;
    else payload.resetToken = resetTokenOrOtp;

    const res = await adminApi.forgotPasswordReset(payload);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Admin password updated! Please log in.');
      setTimeout(() => {
        setStep('credentials');
        setForgotStep(1);
        setSuccessMessage('');
      }, 1500);
    } else {
      setErrorMessage(res.error || 'Failed to update admin password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/90 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-lg card-glass rounded-3xl border border-amber-500/30 shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        
        {/* Top Control Bar */}
        <div className="pb-4 border-b border-white/10 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-orbitron font-bold text-white text-base">
                  RED<span className="text-amber-400">COMMAND</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 block -mt-1">
                  CENTRAL MEDICAL GOVERNANCE
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              aria-label="Close Admin Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <LiveDateTime variant="compact" accent="amber" />
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <div>{successMessage}</div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 1: CREDENTIALS (USERNAME/EMAIL + PASSWORD)     */}
        {/* ==================================================== */}
        {step === 'credentials' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-mono mb-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>RESTRICTED ACCESS // NO PUBLIC SIGNUP</span>
              </div>
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Admin Authentication
              </h3>
              <p className="text-xs text-slate-400">
                Enter your administrative credentials to initiate dual 2FA multi-factor verification.
              </p>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Username or Admin Email <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="e.g. superadmin or admin@redmission.org"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Password <span className="text-amber-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('forgot');
                      setErrorMessage('');
                    }}
                    className="text-xs font-mono text-amber-400 hover:text-white underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter admin password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim() || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-amber-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  'PROCEED TO DUAL 2FA VERIFICATION →'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 2: DUAL 2FA OTP VERIFICATION (MOBILE + EMAIL)  */}
        {/* ==================================================== */}
        {step === 'dual_otp' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Dual 2FA Verification
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                For supreme security, RED MISSION Medical Command requires verification from <strong className="text-white">BOTH</strong> your registered channels.
              </p>
            </div>

            {/* Development Demo OTP Chips */}
            {(demoMobileOtp || demoEmailOtp) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Demo Mobile OTP: <strong>{demoMobileOtp}</strong></span>
                  <button
                    type="button"
                    onClick={() => setMobileOtp(demoMobileOtp)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 underline text-[11px]"
                  >
                    Fill Mobile
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                  <span>Demo Email OTP: <strong>{demoEmailOtp}</strong></span>
                  <button
                    type="button"
                    onClick={() => setEmailOtp(demoEmailOtp)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 underline text-[11px]"
                  >
                    Fill Email
                  </button>
                </div>
                <div className="text-right pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOtp(demoMobileOtp);
                      setEmailOtp(demoEmailOtp);
                    }}
                    className="text-[11px] font-bold text-white underline"
                  >
                    Autofill Both Codes
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleDualOtpSubmit} className="space-y-4">
              {/* Input 1: Mobile OTP */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 flex items-center justify-between">
                  <span>1. Mobile OTP (Dispatched to {maskedPhone})</span>
                  <span className="text-amber-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(e.target.value)}
                    placeholder="Enter 6-digit Mobile OTP"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Input 2: Email OTP */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 flex items-center justify-between">
                  <span>2. Email OTP (Dispatched to {maskedEmail})</span>
                  <span className="text-amber-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="Enter 6-digit Email OTP"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="hover:text-white"
                >
                  ← Back to Credentials
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleCredentialsSubmit}
                  className="text-amber-400 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Both Codes'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || mobileOtp.length < 6 || emailOtp.length < 6}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-amber-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating Command...</span>
                  </>
                ) : (
                  'VERIFY BOTH CODES & ENTER COMMAND'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 3: MANDATORY PASSWORD CHANGE                    */}
        {/* ==================================================== */}
        {step === 'change_password' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Set Permanent Password
              </h3>
              <p className="text-xs text-slate-400">
                Your temporary administrator password must be updated before accessing Medical Command.
              </p>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  New Administrative Password <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Min 8 chars with upper, lower, number, symbol"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  Confirm New Password <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-amber-600/30 hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving New Password...</span>
                  </>
                ) : (
                  'UPDATE PASSWORD & ACTIVATE COMMAND'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 4: ADMIN FORGOT PASSWORD                        */}
        {/* ==================================================== */}
        {step === 'forgot' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Admin Password Recovery
              </h3>
              <p className="text-xs text-slate-400">
                Recover administrative access via verified emergency email or mobile.
              </p>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-space-900 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setForgotChannel('EMAIL')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      forgotChannel === 'EMAIL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Email Recovery Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotChannel('MOBILE')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      forgotChannel === 'MOBILE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mobile OTP Recovery
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    Administrative Username, Email, or Mobile
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. superadmin"
                    className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('credentials')}
                    className="text-xs font-mono text-slate-400 hover:text-white"
                  >
                    ← Back to Login
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !forgotIdentifier.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      'Send Recovery Code →'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotReset} className="space-y-4">
                {demoResetToken && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>Demo Token/OTP: <strong>{demoResetToken}</strong></span>
                    <button
                      type="button"
                      onClick={() => setResetTokenOrOtp(demoResetToken)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 underline text-[11px]"
                    >
                      Autofill
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    Enter Recovery Code / Token <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={resetTokenOrOtp}
                    onChange={(e) => {
                      setResetTokenOrOtp(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter recovery code or token"
                    className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    New Password <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Min 8 chars with upper, lower, number, symbol"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    Confirm New Password <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Repeat new password"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs font-mono text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !resetTokenOrOtp.trim() || !newPassword || !confirmPassword}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Resetting...</span>
                      </>
                    ) : (
                      'Update Password & Return to Login'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
