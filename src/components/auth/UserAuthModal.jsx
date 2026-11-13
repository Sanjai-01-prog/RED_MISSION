import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Droplet, 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  Heart,
  Key,
  Loader2,
  Camera,
  Upload,
  Check
} from 'lucide-react';
import { userApi } from '../../services/api';
import { validateAndPrepareDonorPhoto } from '../../utils/donorPhotoValidator';
import LiveDateTime from '../shared/LiveDateTime';
import { RED_MISSION_TERMS, TERMS_VERSION, PRIVACY_POLICY_VERSION } from '../../data/termsAndPrivacyData';
import PrivacyPolicyModal from '../common/PrivacyPolicyModal';

export default function UserAuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Terms and Privacy modal state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(null);

  // Multi-step Registration State (Steps 1 to 6)
  const [regStep, setRegStep] = useState(1);
  const [regData, setRegData] = useState({
    fullName: '',
    mobileNumber: '',
    email: '',
    age: '',
    bloodGroup: 'O+',
    city: ''
  });
  const [regSelfieImage, setRegSelfieImage] = useState(null);
  const [regPhotoConsent, setRegPhotoConsent] = useState(false);
  const [regPhotoTab, setRegPhotoTab] = useState('upload'); // 'upload' | 'camera'
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  const [regToken, setRegToken] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [demoMobileOtp, setDemoMobileOtp] = useState(null);
  const [demoEmailOtp, setDemoEmailOtp] = useState(null);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChannel, setForgotChannel] = useState('EMAIL'); // 'EMAIL' or 'MOBILE'
  const [forgotStep, setForgotStep] = useState(1); // 1: request, 2: reset
  const [resetTokenOrOtp, setResetTokenOrOtp] = useState('');
  const [demoResetToken, setDemoResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage('');
    setSuccessMessage('');
    if (!isOpen) {
      setTermsAccepted(false);
      setIsPrivacyModalOpen(false);
    }
  }, [initialMode, isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle ESC key press & scroll locking
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

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (!isOpen || mode !== 'register' || regStep !== 1) {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [isOpen, mode, regStep]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!streamActive || !video || !stream) return;

    video.srcObject = stream;
    let cancelled = false;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        if (cancelled) return;
        setCameraError('Camera detected, but video preview could not start. Please use photo file upload.');
        stopCameraStream();
        setRegPhotoTab('upload');
      }
    };
    startPlayback();

    return () => {
      cancelled = true;
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [streamActive]);

  if (!isOpen) return null;

  // ==========================================
  // HANDLERS: LOGIN
  // ==========================================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanIdentifier = (loginIdentifier || '').trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your mobile number or email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    const res = await userApi.login(cleanIdentifier, loginPassword, rememberMe);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Login successful! Redirecting to your donor portal...');
      setTimeout(() => {
        onAuthSuccess(res.user, res);
        onClose();
      }, 700);
    } else {
      setErrorMessage(res.error || 'Login failed. Please verify credentials.');
      if (res.code === 'ACCOUNT_LOCKED') {
        setLockoutMinutes(30);
      }
    }
  };

  // ==========================================
  // HANDLERS: MULTI-STEP REGISTRATION & DONOR PHOTO
  // ==========================================

  const startRegCamera = async () => {
    setCameraError('');
    setErrorMessage('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam capture is not supported in this browser. Please upload an image file.');
      setRegPhotoTab('upload');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      setStreamActive(true);
    } catch {
      setCameraError('Camera access was denied or unavailable. Please upload a valid donor photo instead.');
      stopCameraStream();
      setRegPhotoTab('upload');
    }
  };

  const captureRegSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const startX = ((video.videoWidth || size) - size) / 2;
    const startY = ((video.videoHeight || size) - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    let dataUrl = canvas.toDataURL('image/webp', 0.88);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    }
    setRegSelfieImage(dataUrl);
    setErrorMessage('');
    stopCameraStream();
  };

  const handleRegPhotoFileChange = async (e) => {
    setErrorMessage('');
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await validateAndPrepareDonorPhoto(file);
    if (!result.valid) {
      setErrorMessage(result.error);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setRegSelfieImage(result.dataUrl);
  };

  // Step 1: Submit 6 details + Mandatory Donor Photo + Consent + Terms Acceptance
  const handleRegStep1 = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!regSelfieImage) {
      setErrorMessage('Please upload or capture your mandatory donor profile photograph before proceeding.');
      return;
    }

    if (!regPhotoConsent) {
      setErrorMessage('Please confirm consent for capturing and securely storing your donor verification photograph.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('You must review and accept the RED MISSION Terms & Conditions to proceed.');
      return;
    }

    setLoading(true);
    const res = await userApi.registerStep1({
      ...regData,
      selfieImage: regSelfieImage,
      photoConsent: true,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      privacyPolicyAccepted: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION
    });
    setLoading(false);

    if (res.success) {
      setRegToken(res.registrationToken);
      setDemoMobileOtp(res.demoOtp);
      stopCameraStream();
      setRegStep(2); // Go to Mobile OTP verification
      setResendCooldown(30);
    } else {
      setErrorMessage(res.error || 'Failed to submit registration details. Please ensure the backend server is running.');
    }
  };

  // Step 2: Verify Mobile OTP
  const handleVerifyMobile = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await userApi.registerVerifyMobile(regToken, mobileOtp);
    setLoading(false);

    if (res.success) {
      setDemoEmailOtp(res.demoOtp);
      setRegStep(3); // Go to Email OTP verification
      setResendCooldown(30);
    } else {
      setErrorMessage(res.error || 'Incorrect mobile verification code.');
    }
  };

  // Step 3: Verify Email OTP
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await userApi.registerVerifyEmail(regToken, emailOtp);
    setLoading(false);

    if (res.success) {
      setRegStep(4); // Go to Password Creation
    } else {
      setErrorMessage(res.error || 'Incorrect email verification code.');
    }
  };

  // Step 4: Advance to Review Confirmation
  const handleStep4ToReview = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (regPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setRegStep(5); // Go to Review step
  };

  // Step 5: Final Submission & Account Activation
  const handleFinalActivation = async () => {
    setErrorMessage('');
    setLoading(true);

    const res = await userApi.registerComplete(regToken, regPassword, regConfirmPassword);
    setLoading(false);

    if (res.success) {
      setRegStep(6); // Success Step
    } else {
      setErrorMessage(res.error || 'Failed to activate account.');
    }
  };

  // Resend OTP
  const handleResendOtp = async (type) => {
    if (resendCooldown > 0) return;
    setLoading(true);
    const res = await userApi.registerResendOtp(regToken, type);
    setLoading(false);
    if (res.success) {
      setResendCooldown(45);
      if (type === 'mobile') setDemoMobileOtp(res.demoOtp);
      else setDemoEmailOtp(res.demoOtp);
    } else {
      setErrorMessage(res.error || 'Failed to resend code.');
    }
  };

  // ==========================================
  // HANDLERS: FORGOT PASSWORD
  // ==========================================
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await userApi.forgotPasswordRequest(forgotIdentifier, forgotChannel);
    setLoading(false);

    if (res.success) {
      setForgotStep(2);
      if (res.demoOtp) setDemoResetToken(res.demoOtp);
      else if (res.demoLink) setDemoResetToken(res.demoLink.split('token=')[1]);
      setSuccessMessage('Recovery code / link dispatched. Please set your new password.');
    } else {
      setErrorMessage(res.error || 'Failed to initiate password recovery.');
    }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const payload = {
      identifier: forgotIdentifier,
      newPassword,
      confirmPassword: confirmNewPassword
    };

    if (forgotChannel === 'MOBILE') {
      payload.otp = resetTokenOrOtp;
    } else {
      payload.resetToken = resetTokenOrOtp;
    }

    const res = await userApi.forgotPasswordReset(payload);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Password successfully updated! You can now log in.');
      setTimeout(() => {
        setMode('login');
        setForgotStep(1);
        setSuccessMessage('');
      }, 1500);
    } else {
      setErrorMessage(res.error || 'Failed to reset password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] bg-mars-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-lg card-glass rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        
        {/* Top Header */}
        <div className="pb-4 border-b border-white/10 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center text-mars-400">
                <Droplet className="w-4 h-4 fill-mars-400" />
              </div>
              <div>
                <span className="font-orbitron font-bold text-white text-base">
                  RED<span className="text-mars-500">MISSION</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 block -mt-1">
                  CITIZEN &amp; DONOR PORTAL
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              aria-label="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <LiveDateTime variant="compact" />
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
        {/* MODE 1: USER LOGIN                                  */}
        {/* ==================================================== */}
        {mode === 'login' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Welcome Back
              </h3>
              <p className="text-xs text-slate-400">
                Sign in to manage your donations, track emergency alerts, and view lifesaver certificates.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Identifier Input (Email OR Mobile Number) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                  Mobile Number or Email Address <span className="text-mars-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {loginIdentifier.includes('@') ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => {
                      setLoginIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="+91 98XXX XXXXX or donor@redmission.org"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 font-mono transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password Input with Show/Hide Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
                    Password <span className="text-mars-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage('');
                    }}
                    className="text-xs font-mono text-mars-400 hover:text-white underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 transition-colors"
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

              {/* Remember Me */}
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-space-900 border-white/20 text-mars-600 focus:ring-mars-500"
                  />
                  <span>Remember me on this browser</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !loginIdentifier.trim() || !loginPassword}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN TO RED MISSION</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Registration */}
            <div className="pt-4 border-t border-white/10 text-center space-y-2">
              <p className="text-xs text-slate-400">
                New to RED MISSION?
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setRegStep(1);
                  setErrorMessage('');
                }}
                className="w-full py-2.5 rounded-xl bg-space-900 hover:bg-space-850 border border-white/10 text-xs font-semibold font-orbitron text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-mars-400" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODE 2: MULTI-STEP USER REGISTRATION (STEPS 1 TO 6)  */}
        {/* ==================================================== */}
        {mode === 'register' && (
          <div className="space-y-6">
            
            {/* Multi-step Progress Header */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                <span className="text-mars-400 font-bold uppercase">
                  Step {regStep} of 6: {
                    regStep === 1 ? 'Personal Details' :
                    regStep === 2 ? 'Mobile Verification' :
                    regStep === 3 ? 'Email Verification' :
                    regStep === 4 ? 'Create Password' :
                    regStep === 5 ? 'Confirm Details' : 'Account Activated'
                  }
                </span>
                <span>{Math.round((regStep / 6) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-space-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-mars-600 to-mars-flame transition-all duration-300"
                  style={{ width: `${(regStep / 6) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* STEP 1: Personal Details & Mandatory Donor Photograph */}
            {regStep === 1 && (
              <form onSubmit={handleRegStep1} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2 space-y-1">
                    <label htmlFor="reg-full-name" className="block text-[11px] font-mono uppercase text-slate-300">
                      Full Legal Name <span className="text-mars-400">*</span>
                    </label>
                    <input
                      id="reg-full-name"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      value={regData.fullName}
                      onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                      placeholder="e.g. Ananya Deshmukh"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-mobile" className="block text-[11px] font-mono uppercase text-slate-300">
                      Mobile Number <span className="text-mars-400">*</span>
                    </label>
                    <input
                      id="reg-mobile"
                      name="mobileNumber"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={regData.mobileNumber}
                      onChange={(e) => setRegData({ ...regData, mobileNumber: e.target.value })}
                      placeholder="98XXXXXXXX"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-email" className="block text-[11px] font-mono uppercase text-slate-300">
                      Email Address <span className="text-mars-400">*</span>
                    </label>
                    <input
                      id="reg-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={regData.email}
                      onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                      placeholder="donor@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-age" className="block text-[11px] font-mono uppercase text-slate-300">
                      Age (18 - 65) <span className="text-mars-400">*</span>
                    </label>
                    <input
                      id="reg-age"
                      name="age"
                      type="number"
                      inputMode="numeric"
                      min="18"
                      max="65"
                      value={regData.age}
                      onChange={(e) => setRegData({ ...regData, age: e.target.value })}
                      placeholder="e.g. 25"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-blood-group" className="block text-[11px] font-mono uppercase text-slate-300">
                      Blood Group <span className="text-mars-400">*</span>
                    </label>
                    <select
                      id="reg-blood-group"
                      name="bloodGroup"
                      value={regData.bloodGroup}
                      onChange={(e) => setRegData({ ...regData, bloodGroup: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg} className="bg-space-900 text-white">
                          {bg} {bg === 'O-' ? '(Universal Donor)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label htmlFor="reg-city" className="block text-[11px] font-mono uppercase text-slate-300">
                      City / Location <span className="text-mars-400">*</span>
                    </label>
                    <input
                      id="reg-city"
                      name="city"
                      type="text"
                      autoComplete="address-level2"
                      value={regData.city}
                      onChange={(e) => setRegData({ ...regData, city: e.target.value })}
                      placeholder="e.g. Mumbai, Maharashtra"
                      className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500"
                      required
                    />
                  </div>
                </div>

                {/* Mandatory Donor Verification Photograph */}
                <div className="p-3.5 rounded-2xl bg-space-900/90 border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-[11px] font-mono uppercase text-slate-200 font-semibold">
                        Donor Profile Photo <span className="text-mars-400">*</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Required for official donor registration (JPEG, PNG, WebP · Max 3 MB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-space-950 p-1 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setRegPhotoTab('upload');
                          stopCameraStream();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                          regPhotoTab === 'upload'
                            ? 'bg-mars-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRegPhotoTab('camera');
                          startRegCamera();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                          regPhotoTab === 'camera'
                            ? 'bg-mars-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Camera className="w-3 h-3" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>

                  {cameraError && (
                    <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 font-mono">
                      {cameraError}
                    </p>
                  )}

                  {regSelfieImage ? (
                    <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-space-950/70 border border-emerald-500/30">
                      <img
                        src={regSelfieImage}
                        alt="Selected donor verification preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/60 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-bold">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Photo Ready &amp; Verified</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          This photo will be linked confidentially to your official RED MISSION donor profile.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRegSelfieImage(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          if (regPhotoTab === 'camera') startRegCamera();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-300 border border-white/10 cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : regPhotoTab === 'camera' ? (
                    <div className="flex flex-col items-center gap-2.5 p-3 rounded-xl bg-space-950/80 border border-white/10">
                      {streamActive ? (
                        <>
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-40 h-40 rounded-full object-cover border-2 border-mars-500/60"
                          />
                          <button
                            type="button"
                            onClick={captureRegSnapshot}
                            className="px-4 py-1.5 rounded-lg bg-mars-600 hover:bg-mars-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Capture Photo</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={startRegCamera}
                          className="px-4 py-2 rounded-lg bg-space-900 hover:bg-space-850 border border-white/10 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-mars-400" />
                          <span>Start Camera Preview</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="reg-donor-photo"
                        className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl border border-dashed border-mars-500/40 bg-space-950/60 hover:bg-space-950 text-xs font-mono text-slate-200 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4 text-mars-400 shrink-0" />
                        <span>Select Clear Profile Photo (JPEG, PNG, WebP)</span>
                      </label>
                      <input
                        ref={fileInputRef}
                        id="reg-donor-photo"
                        name="selfieImage"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleRegPhotoFileChange}
                        className="sr-only"
                      />
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />

                  <label htmlFor="reg-photo-consent" className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      id="reg-photo-consent"
                      name="photoConsent"
                      type="checkbox"
                      checked={regPhotoConsent}
                      onChange={(e) => {
                        setRegPhotoConsent(e.target.checked);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-space-950 text-mars-500 focus:ring-mars-500 shrink-0"
                    />
                    <span className="text-[11px] text-slate-300 leading-snug">
                      I consent to capturing and securely storing my profile photograph for official RED MISSION donor identity verification. Photographs are visible only to me and authorized administrators unless I opt in later. <span className="text-mars-400">*</span>
                    </span>
                  </label>
                </div>

                {/* Terms & Conditions Section */}
                <div className="p-3.5 rounded-2xl bg-space-900/90 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-200 font-semibold tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-mars-400" />
                      RED MISSION — TERMS &amp; CONDITIONS
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      v{TERMS_VERSION}
                    </span>
                  </div>

                  {/* Scrollable Document Container */}
                  <div 
                    tabIndex={0}
                    role="region"
                    aria-label="RED MISSION Terms and Conditions document"
                    className="h-44 overflow-y-auto pr-2 rounded-xl bg-space-950/80 border border-white/5 p-3 text-[11px] text-slate-300 font-sans leading-relaxed space-y-3.5 focus:outline-none focus:ring-1 focus:ring-mars-500/50"
                  >
                    <p className="text-slate-400 italic text-[10px] font-mono border-b border-white/5 pb-2">
                      Last updated: {RED_MISSION_TERMS.lastUpdated} • Please read the complete terms before registering.
                    </p>
                    {RED_MISSION_TERMS.sections.map((sec) => (
                      <div key={sec.id} className="space-y-1">
                        <h5 className="font-semibold text-white text-[11px] flex items-center gap-1.5 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-mars-500"></span>
                          {sec.title}
                        </h5>
                        <p className="text-slate-300 text-[11px] whitespace-pre-line pl-3 leading-normal">
                          {sec.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Mandatory Acceptance Checkbox (Unchecked by default) */}
                  <label htmlFor="reg-terms-accepted" className="flex items-start gap-2.5 cursor-pointer pt-1">
                    <input
                      id="reg-terms-accepted"
                      name="termsAccepted"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-space-950 text-mars-500 focus:ring-mars-500 shrink-0"
                    />
                    <span className="text-[11px] text-slate-200 leading-snug">
                      I have read, understood, and accept the <span className="font-semibold text-white">RED MISSION Terms &amp; Conditions</span>. <span className="text-mars-400">*</span>
                    </span>
                  </label>

                  {/* Independent Privacy Policy Link */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Personal data protection details:</span>
                    <button
                      type="button"
                      onClick={() => setIsPrivacyModalOpen(true)}
                      className="text-mars-400 hover:text-white underline font-mono text-[11px] cursor-pointer transition-colors"
                    >
                      Privacy Policy (v{PRIVACY_POLICY_VERSION}) ↗
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      setMode('login');
                    }}
                    className="text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    ← Back to Login
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-mars-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      'Next: Mobile Verification →'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Mobile OTP Verification */}
            {regStep === 2 && (
              <form onSubmit={handleVerifyMobile} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center mx-auto text-mars-400">
                    <Phone className="w-6 h-6" />
                  </div>
                  <h4 className="font-orbitron font-bold text-lg text-white">
                    Verify Your Mobile Number
                  </h4>
                  <p className="text-xs text-slate-400">
                    Enter the 6-digit code sent to <span className="text-mars-400 font-mono font-semibold">{regData.mobileNumber}</span>.
                  </p>
                </div>

                {demoMobileOtp && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>Demo SMS OTP: <strong className="text-white text-sm tracking-widest">{demoMobileOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setMobileOtp(demoMobileOtp)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-[11px] underline cursor-pointer"
                    >
                      Autofill
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="reg-mobile-otp" className="sr-only">
                    Mobile 6-digit verification code
                  </label>
                  <input
                    id="reg-mobile-otp"
                    name="mobileOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-center text-xl font-mono tracking-widest py-3 rounded-xl bg-space-900 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-mars-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="hover:text-white"
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={() => handleResendOtp('mobile')}
                    className="text-mars-400 hover:text-white disabled:opacity-50 cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Mobile Code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || mobileOtp.length < 6}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-mars-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Mobile...</span>
                    </>
                  ) : (
                    'Verify Mobile & Proceed →'
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: Email OTP Verification */}
            {regStep === 3 && (
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-xl bg-mars-500/10 border border-mars-500/30 flex items-center justify-center mx-auto text-mars-400">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h4 className="font-orbitron font-bold text-lg text-white">
                    Verify Your Email Address
                  </h4>
                  <p className="text-xs text-slate-400">
                    Enter the 6-digit code dispatched to <span className="text-mars-400 font-mono font-semibold">{regData.email}</span>.
                  </p>
                </div>

                {demoEmailOtp && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>Demo Email OTP: <strong className="text-white text-sm tracking-widest">{demoEmailOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setEmailOtp(demoEmailOtp)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-[11px] underline cursor-pointer"
                    >
                      Autofill
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="reg-email-otp" className="sr-only">
                    Email 6-digit verification code
                  </label>
                  <input
                    id="reg-email-otp"
                    name="emailOtp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="Enter 6-digit Email OTP"
                    className="w-full text-center text-xl font-mono tracking-widest py-3 rounded-xl bg-space-900 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-mars-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <button
                    type="button"
                    onClick={() => setRegStep(2)}
                    className="hover:text-white"
                  >
                    ← Back to Mobile
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={() => handleResendOtp('email')}
                    className="text-mars-400 hover:text-white disabled:opacity-50 cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email Code'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || emailOtp.length < 6}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-mars-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Email...</span>
                    </>
                  ) : (
                    'Verify Email & Create Password →'
                  )}
                </button>
              </form>
            )}

            {/* STEP 4: Password Creation */}
            {regStep === 4 && (
              <form onSubmit={handleStep4ToReview} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-orbitron font-bold text-lg text-white">
                    Create Secure Password
                  </h4>
                  <p className="text-xs text-slate-400">
                    Dual verification complete! Set a strong password for your donor account.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="block text-xs font-mono uppercase text-slate-300">
                    Create Password (Min 8 Characters) <span className="text-mars-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-password"
                      name="password"
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Enter secure password"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-confirm-password" className="block text-xs font-mono uppercase text-slate-300">
                    Confirm Password <span className="text-mars-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-confirm-password"
                      name="confirmPassword"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(3)}
                    className="text-xs font-mono text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-mars-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    Review Details →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 5: Review & Confirmation */}
            {regStep === 5 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h4 className="font-orbitron font-bold text-lg text-white">
                    Confirm Your Details
                  </h4>
                  <p className="text-xs text-slate-400">
                    Please verify your information and donor photograph before activating your life-saving donor profile.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-space-900 border border-white/10 space-y-3 text-xs font-mono">
                  {regSelfieImage && (
                    <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                      <img
                        src={regSelfieImage}
                        alt={`${regData.fullName || 'Donor'} preview`}
                        className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/50 shrink-0"
                      />
                      <div>
                        <p className="text-white font-bold text-xs">{regData.fullName}</p>
                        <p className="text-emerald-400 text-[11px] flex items-center gap-1 mt-0.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>Mandatory Donor Photo &amp; Consent Verified</span>
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Full Name:</span>
                      <span className="text-white font-bold">{regData.fullName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Mobile Number:</span>
                      <span className="text-emerald-400 font-bold">{regData.mobileNumber} (Verified)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Email Address:</span>
                      <span className="text-emerald-400 font-bold">{regData.email} (Verified)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Age:</span>
                      <span className="text-white">{regData.age} Years</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Blood Group:</span>
                      <span className="text-mars-400 font-bold">{regData.bloodGroup}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">City:</span>
                      <span className="text-white">{regData.city}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Terms &amp; Conditions:</span>
                      <span className="text-emerald-400 font-bold">Accepted (v{TERMS_VERSION})</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Privacy Policy:</span>
                      <span className="text-emerald-400 font-bold">Accepted (v{PRIVACY_POLICY_VERSION})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    ← Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalActivation}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating...</span>
                      </>
                    ) : (
                      'CONFIRM & ACTIVATE DONOR ACCOUNT'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: Success & Activation */}
            {regStep === 6 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-orbitron font-bold text-2xl text-white">
                    Donor Account Activated!
                  </h4>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Welcome, <span className="text-white font-semibold">{regData.fullName}</span>! Your dual-verified RED MISSION account and official <span className="text-mars-400 font-mono font-bold">{regData.bloodGroup}</span> donor profile are now live.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const emailForLogin = regData.email;
                      setRegSelfieImage(null);
                      setRegPhotoConsent(false);
                      setRegPassword('');
                      setRegConfirmPassword('');
                      setRegToken('');
                      setMode('login');
                      setLoginIdentifier(emailForLogin);
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-lg shadow-mars-600/30 cursor-pointer"
                  >
                    Proceed to Login
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================================================== */}
        {/* MODE 3: FORGOT PASSWORD                              */}
        {/* ==================================================== */}
        {mode === 'forgot' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="font-orbitron font-extrabold text-2xl text-white">
                Recover Password
              </h3>
              <p className="text-xs text-slate-400">
                Recover access using your registered email address or verified mobile number.
              </p>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-space-900 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setForgotChannel('EMAIL')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      forgotChannel === 'EMAIL' ? 'bg-mars-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Email Recovery Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotChannel('MOBILE')}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      forgotChannel === 'MOBILE' ? 'bg-mars-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mobile OTP Recovery
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    {forgotChannel === 'EMAIL' ? 'Registered Email Address' : 'Registered Mobile Number'}
                  </label>
                  <input
                    type={forgotChannel === 'EMAIL' ? 'email' : 'tel'}
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder={forgotChannel === 'EMAIL' ? 'donor@example.com' : '+91 98XXX XXXXX'}
                    className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-mars-500 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs font-mono text-slate-400 hover:text-white"
                  >
                    ← Back to Login
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !forgotIdentifier.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-mars-600 to-mars-flame text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-mars-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    <span>Demo Recovery Token/OTP: <strong>{demoResetToken}</strong></span>
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
                    Enter Recovery Code / Token <span className="text-mars-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={resetTokenOrOtp}
                    onChange={(e) => {
                      setResetTokenOrOtp(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter code or paste token"
                    className="w-full px-3 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    New Password <span className="text-mars-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Min 8 characters"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-slate-300">
                    Confirm New Password <span className="text-mars-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Repeat new password"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-space-900 border border-white/10 text-xs text-white focus:outline-none focus:border-mars-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      aria-label={showForgotConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    disabled={loading || !resetTokenOrOtp.trim() || !newPassword || !confirmNewPassword}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-orbitron font-semibold text-xs tracking-wider shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      'Update Password & Log In'
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* Privacy Policy Modal */}
        <PrivacyPolicyModal 
          isOpen={isPrivacyModalOpen} 
          onClose={() => setIsPrivacyModalOpen(false)} 
        />

      </div>
    </div>
  );
}
