import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Droplet, 
  MapPin, 
  Calendar, 
  BellRing, 
  Eye, 
  EyeOff, 
  Video, 
  VideoOff,
  UserCheck
} from 'lucide-react';
import { donorApi } from '../../services/api';

export default function DonorRegistrationModal({
  isOpen,
  onClose,
  currentUser,
  onRegistrationSuccess
}) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'upload'
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  
  // Donor Specific Fields
  const [pincode, setPincode] = useState('');
  const [isAvailableForEmergency, setIsAvailableForEmergency] = useState(true);
  const [consentEmergencyAlerts, setConsentEmergencyAlerts] = useState(true);
  const [isPhotoPublic, setIsPhotoPublic] = useState(false);
  const [consentDirectoryListing, setConsentDirectoryListing] = useState(false);
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [createdDonorProfile, setCreatedDonorProfile] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera stream when modal closes or unmounts
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setPreviewImage(null);
      setCameraError('');
      setErrorMessage('');
      setRegistrationComplete(false);
    }
    return () => stopCameraStream();
  }, [isOpen]);

  // Start webcam stream
  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam capture is not supported on this browser or connection. Please use file upload.');
      setActiveTab('upload');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });
      streamRef.current = stream;
setStreamActive(true);
    } catch (err) {
      console.warn('[CAMERA ERROR]', err);
      let msg = 'Camera access was denied or is unavailable. Please upload a photo instead.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser or switch to file upload.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No video camera detected on your device. Please choose photo file upload.';
      }
      setCameraError(msg);
      setStreamActive(false);
      setActiveTab('upload');
    }
  };


  // Attach camera stream after React mounts the video element
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;

    if (!streamActive || !video || !stream) return;

    video.srcObject = stream;

    let cancelled = false;

    const playVideo = async () => {
      try {
        await video.play();
        console.log('[CAMERA] Video preview started successfully');
      } catch (err) {
        if (cancelled) return;

        console.error('[CAMERA PLAYBACK ERROR]', err);

        setCameraError(
          'Camera detected, but video preview could not start. Please retry or use photo upload.'
        );

        stream.getTracks().forEach(track => track.stop());

        if (streamRef.current === stream) {
          streamRef.current = null;
        }

        setStreamActive(false);
      }
    };

    playVideo();

    return () => {
      cancelled = true;

      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [streamActive]);

    // Capture snapshot from webcam
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    // Export as WebP (or JPEG fallback)
    const dataUrl = canvas.toDataURL('image/webp', 0.85);
    setPreviewImage(dataUrl);
    stopCameraStream();
  };

  // Handle file input change
  const handleFileChange = (e) => {
    setErrorMessage('');
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMessage(`Image file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 3 MB maximum size.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      // Optional: resize client-side via canvas to ensure standard dimension
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        setPreviewImage(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Retake or reset photo
  const handleRetake = () => {
    setPreviewImage(null);
    setErrorMessage('');
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!previewImage) {
      setErrorMessage('A visual selfie is required to complete voluntary donor registration.');
      return;
    }

    if (!consentGiven) {
      setErrorMessage('Please acknowledge and confirm the photo consent statement.');
      return;
    }

    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage('Please enter a valid 6-digit postal code (PIN code).');
      return;
    }

    if (lastDonationDate) {
      const selected = new Date(lastDonationDate);
      if (selected > new Date()) {
        setErrorMessage('Last donation date cannot be in the future.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await donorApi.register({
        selfieImage: previewImage,
        selfieConsentGiven: true,
        pincode: pincode.trim() || null,
        isAvailableForEmergency,
        consentEmergencyAlerts,
        isPhotoPublic,
        consentDirectoryListing,
        lastDonationDate: lastDonationDate.trim() || null
      });

      setIsSubmitting(false);

      if (res.success && res.donor) {
        setCreatedDonorProfile(res.donor);
        setRegistrationComplete(true);
        if (onRegistrationSuccess) {
          onRegistrationSuccess(res.donor);
        }
      } else {
        setErrorMessage(res.error || 'Failed to complete donor registration. Please try again.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage('Network connection error. Please verify the backend server is running.');
    }
  };

  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-space-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl card-glass rounded-3xl border border-mars-500/30 p-5 sm:p-8 space-y-6 my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-mars-500/10 text-mars-400 border border-mars-500/30">
                <Droplet className="w-4 h-4 fill-mars-400" />
              </span>
              <h3 className="font-orbitron font-extrabold text-xl text-white tracking-tight">
                VOLUNTARY DONOR <span className="text-mars-400">REGISTRATION</span>
              </h3>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Connect your verified citizen account with the 24/7 active emergency blood network.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {registrationComplete ? (
          /* SUCCESS STATE */
          <div className="text-center py-8 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h4 className="font-orbitron font-bold text-xl text-white">
                WELCOME, LIFESAVER!
              </h4>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Your voluntary donor profile is officially registered and active. Your selfie has been saved as your visual profile picture.
              </p>
            </div>

            {createdDonorProfile && (
              <div className="p-4 rounded-2xl bg-space-900 border border-white/10 max-w-sm mx-auto text-left text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Donor Name:</span>
                  <span className="text-white font-bold">{currentUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Blood Group:</span>
                  <span className="text-mars-400 font-bold">{currentUser.bloodGroup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-white">{currentUser.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Emergency Dispatch:</span>
                  <span className="text-emerald-400 font-semibold">Active &amp; Ready</span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold text-xs hover:brightness-110 shadow-lg cursor-pointer"
            >
              Done &amp; Return to Dashboard
            </button>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP A: Inherited Account Profile Badges */}
            <div className="space-y-2">
              <label className="text-xs font-orbitron font-semibold text-slate-300 uppercase tracking-wider block">
                1. Inherited Account Identity
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-space-900 border border-white/5">
                  <span className="text-[10px] text-slate-500 block uppercase">Donor Name</span>
                  <span className="text-white font-semibold truncate block">{currentUser.fullName}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-space-900 border border-mars-500/20 bg-mars-500/5">
                  <span className="text-[10px] text-mars-400 block uppercase">Blood Group</span>
                  <span className="text-mars-300 font-bold text-sm block">{currentUser.bloodGroup}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-space-900 border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block uppercase">Registered City</span>
                  <span className="text-white font-medium truncate block">{currentUser.city}</span>
                </div>
              </div>
            </div>

            {/* STEP B: Mandatory Selfie Capture & Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-orbitron font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>2. Visual Donor Selfie</span>
                  <span className="text-rose-400 text-[10px] font-mono font-normal">*Mandatory Profile Picture</span>
                </label>

                {!previewImage && (
                  <div className="inline-flex rounded-lg bg-space-900 p-0.5 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('camera'); startCamera(); }}
                      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'camera' ? 'bg-mars-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Webcam</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { stopCameraStream(); setActiveTab('upload'); }}
                      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'upload' ? 'bg-mars-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Viewport Card */}
              <div className="rounded-2xl border border-white/10 bg-space-900/60 p-4">
                {previewImage ? (
                  /* PREVIEW STATE */
                  <div className="flex flex-col sm:flex-row items-center gap-5 justify-center py-2">
                    <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-mars-500 shadow-xl shadow-mars-600/20 shrink-0 bg-space-950">
                      <img
                        src={previewImage}
                        alt="Donor selfie preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"></div>
                    </div>

                    <div className="text-center sm:text-left space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Selfie Captured &amp; Validated</span>
                      </div>
                      <p className="text-xs text-slate-300 max-w-xs">
                        This photograph will be used as your official donor profile picture across RED MISSION.
                      </p>
                      <button
                        type="button"
                        onClick={handleRetake}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-mars-400 hover:text-mars-300 underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retake or choose a different photo</span>
                      </button>
                    </div>
                  </div>
                ) : activeTab === 'camera' ? (
                  /* WEBCAM CAPTURE */
                  <div className="text-center py-2 space-y-3">
                    {cameraError ? (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                        <p>{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('upload'); }}
                          className="px-4 py-1.5 rounded-full bg-space-850 hover:bg-space-800 text-white font-mono text-xs border border-white/10 cursor-pointer"
                        >
                          Switch to File Upload
                        </button>
                      </div>
                    ) : streamActive ? (
                      <div className="space-y-3">
                        <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-2 border-mars-500 shadow-2xl bg-black">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover transform -scale-x-100"
                          />
                          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/30 pointer-events-none"></div>
                        </div>

                        <p className="text-[11px] font-mono text-slate-400">
                          Align your face inside the circle, ensure good lighting, and take snapshot.
                        </p>

                        <button
                          type="button"
                          onClick={captureSnapshot}
                          className="px-5 py-2 rounded-full bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold text-xs hover:brightness-110 shadow-lg cursor-pointer inline-flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Take Snapshot</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-space-850 border border-white/10 text-mars-400 flex items-center justify-center mx-auto">
                          <Video className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-300">
                          Click below to start your webcam stream for live selfie capture.
                        </p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2 rounded-full bg-space-850 hover:bg-space-800 border border-mars-500/40 text-mars-300 hover:text-white font-mono text-xs cursor-pointer inline-flex items-center gap-2"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Open Webcam</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* FILE UPLOAD */
                  <div
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className="border-2 border-dashed border-white/15 hover:border-mars-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-space-950/40 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="user"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-mars-400 mx-auto mb-2 transition-colors" />
                    <p className="text-xs text-white font-medium">
                      Click to choose or drag &amp; drop your selfie photo
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      JPEG, PNG, or WebP • Max file size: 3 MB
                    </p>
                  </div>
                )}
              </div>

              {/* Hidden Canvas for Frame Extraction */}
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>

            {/* STEP C: Clinical & Emergency Preferences */}
            <div className="space-y-3">
              <label className="text-xs font-orbitron font-semibold text-slate-300 uppercase tracking-wider block">
                3. Clinical &amp; Emergency Availability
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Pincode */}
                <div className="space-y-1">
                  <span className="text-slate-400 font-mono text-[11px] block">Postal Area PIN Code:</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 411038"
                    className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-mars-500 text-xs"
                  />
                </div>

                {/* Last Donation Date */}
                <div className="space-y-1">
                  <span className="text-slate-400 font-mono text-[11px] block">Last Blood Donation (Optional):</span>
                  <input
                    type="date"
                    value={lastDonationDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setLastDonationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-space-900 border border-white/10 text-white font-mono focus:outline-none focus:border-mars-500 text-xs"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 font-mono text-xs">
                {/* Emergency Dispatch Toggle */}
                <label className="p-3 rounded-xl bg-space-900/80 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-space-850 transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Available for Urgent Hospital Dispatch</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Allows nearby hospitals to send emergency requests for your blood group.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAvailableForEmergency}
                    onChange={(e) => setIsAvailableForEmergency(e.target.checked)}
                    className="w-4 h-4 rounded text-mars-600 focus:ring-0 cursor-pointer accent-mars-600"
                  />
                </label>

                {/* Directory Photo Visibility */}
                <label className="p-3 rounded-xl bg-space-900/80 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-space-850 transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      {isPhotoPublic ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                      <span>Public Directory Photo Visibility</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Default: Private (only you and verified hospital administrators can view). Check to allow community members to view your photo in the voluntary donor directory.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPhotoPublic}
                    onChange={(e) => setIsPhotoPublic(e.target.checked)}
                    className="w-4 h-4 rounded text-mars-600 focus:ring-0 cursor-pointer accent-mars-600"
                  />
                </label>

                {/* Voluntary Donor Directory Listing Consent */}
                <label className="p-3 rounded-xl bg-space-900/80 border border-white/10 flex items-center justify-between cursor-pointer hover:bg-space-850 transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-mars-400" />
                      <span>Voluntary Donor Directory Listing</span>
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Default: Unlisted. Check to allow your voluntary profile (anonymized reference, first name, blood group, city) to appear in the public donor registry for local emergency assistance.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={consentDirectoryListing}
                    onChange={(e) => setConsentDirectoryListing(e.target.checked)}
                    className="w-4 h-4 rounded text-mars-600 focus:ring-0 cursor-pointer accent-mars-600"
                  />
                </label>
              </div>
            </div>

            {/* STEP D: Mandatory Consent */}
            <div className="p-3.5 rounded-2xl bg-space-900 border border-mars-500/30 space-y-2 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-mars-600 focus:ring-0 cursor-pointer accent-mars-600 shrink-0"
                />
                <span className="text-slate-300 text-[11px] leading-relaxed">
                  <strong className="text-white block font-medium">Photo Usage &amp; Privacy Consent (Mandatory):</strong>
                  I confirm this selfie is my genuine likeness to assist visual donor identification during donation camps and emergency responses. I understand this photo will be used as my profile picture, is <span className="text-mars-400 underline">not a formal biometric ID</span>, and can be updated or deleted at any time from my profile settings.
                </span>
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-space-850 hover:bg-space-800 text-slate-400 hover:text-white font-mono text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !previewImage || !consentGiven}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-mars-600 to-mars-flame text-white font-semibold text-xs hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mars-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Donor Profile...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Complete Donor Registration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
