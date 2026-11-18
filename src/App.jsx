import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TelemetryBar from './components/TelemetryBar';
import MissionPillars from './components/MissionPillars';
import HabitatExplorer from './components/HabitatExplorer';
import FlightManifest from './components/FlightManifest';
import MissionTimeline from './components/MissionTimeline';
import MissionLogs from './components/MissionLogs';
import DonationProof from './components/DonationProof';
import AdminDashboard from './components/AdminDashboard';
import RedMissionAIChat from './components/ai/RedMissionAIChat';
import InstitutionalAssociations from './components/InstitutionalAssociations';
import RotaractMembersDirectory from './components/RotaractMembersDirectory';
import Footer from './components/Footer';
import BloodDropModal from './components/BloodDropModal';
import CertificateModal from './components/CertificateModal';
import CertificateVerificationModal from './components/CertificateVerificationModal';

// Phase 1 Authentication & Role System Modals
import RoleSelectionModal from './components/auth/RoleSelectionModal';
import UserAuthModal from './components/auth/UserAuthModal';
import AdminAuthModal from './components/auth/AdminAuthModal';
import MandatoryProfileCompletionModal from './components/auth/MandatoryProfileCompletionModal';
import AdminManagementPanel from './components/admin/AdminManagementPanel';
import DonorRegistrationModal from './components/donor/DonorRegistrationModal';
import UserDashboard from './components/dashboards/user/UserDashboard';
import ModularAdminDashboard from './components/dashboards/admin/AdminDashboard';
import SuperAdminDashboard from './components/dashboards/superadmin/SuperAdminDashboard';
import LiveDateTime from './components/shared/LiveDateTime';

import { userApi, adminApi, requestApi, getUserToken, getAdminToken } from './services/api';
import { INITIAL_BLOOD_REQUESTS, INITIAL_VERIFIED_SUBMISSIONS } from './data/missionData';

export default function App() {
  // Navigation view state
  const [currentView, setCurrentView] = useState('public'); // 'public' | 'user-dashboard' | 'admin-dashboard' | 'superadmin-dashboard'

  // Authentication states
  const [currentUser, setCurrentUser] = useState(null);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [isRestoringAdmin, setIsRestoringAdmin] = useState(Boolean(getAdminToken()));
  const [intendedAction, setIntendedAction] = useState(null);

  // Modal display states
  const [isRoleSelectOpen, setIsRoleSelectOpen] = useState(false);
  const [isUserAuthOpen, setIsUserAuthOpen] = useState(false);
  const [userAuthMode, setUserAuthMode] = useState('login'); // 'login' | 'register'
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isBloodDropOpen, setIsBloodDropOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');

  // Platform operational state
  const [bloodRequests, setBloodRequests] = useState(INITIAL_BLOOD_REQUESTS);
  const [verifiedSubmissions, setVerifiedSubmissions] = useState(INITIAL_VERIFIED_SUBMISSIONS);

  // Load live blood requests from backend
  const loadBloodRequests = async () => {
    try {
      const res = await requestApi.getAll({ status: 'all' });
      if (res.success && res.requests && res.requests.length > 0) {
        setBloodRequests(res.requests);
      }
    } catch (err) {
      console.error('Failed to load blood requests', err);
    }
  };

  // Check active sessions and load data on initial mount
  useEffect(() => {
    async function restoreSessions() {
      // 1. Check user session if stored token exists
      if (getUserToken()) {
        try {
          const userRes = await userApi.getProfile();
          if (userRes.success && userRes.user) {
            const u = userRes.user;
            const dobVal = u.dateOfBirth || u.date_of_birth || null;
            const genderVal = u.gender || null;
            setCurrentUser({
              id: u.id,
              fullName: u.fullName || u.full_name,
              email: u.email,
              mobileNumber: u.mobileNumber || u.mobile_number,
              bloodGroup: u.bloodGroup || u.blood_group,
              city: u.city,
              age: u.age,
              dateOfBirth: dobVal,
              gender: genderVal,
              requiresProfileCompletion: Boolean(userRes.requiresProfileCompletion || !dobVal || !genderVal),
              isDonor: Boolean(userRes.isDonor),
              needsDonorCompletion: Boolean(userRes.needsDonorCompletion),
              needsDonorPhotoCompletion: Boolean(userRes.needsDonorPhotoCompletion),
              donorProfile: userRes.donorProfile || null
            });
          }
        } catch (err) {
          console.error('Failed to load user profile', err);
        }
      }

      // 2. Check admin session if stored token exists
      if (getAdminToken()) {
        try {
          const adminRes = await adminApi.getProfile();
          if (adminRes.success && adminRes.admin) {
            setCurrentAdmin(adminRes.admin);
            const role = adminRes.admin.roleId || adminRes.admin.role_id;
            if (window.location.hash === '#superadmin-dashboard') {
              if (role === 'SUPER_ADMIN') {
                setCurrentView('superadmin-dashboard');
              } else {
                setCurrentView('admin-dashboard');
                window.location.hash = '#admin-dashboard';
              }
            } else if (window.location.hash === '#admin-dashboard') {
              setCurrentView('admin-dashboard');
            }
          } else {
            setCurrentAdmin(null);
            if (window.location.hash === '#superadmin-dashboard' || window.location.hash === '#admin-dashboard') {
              setIsAdminAuthOpen(true);
              window.location.hash = '';
            }
          }
        } catch (err) {
          console.error('Failed to restore admin session', err);
          setCurrentAdmin(null);
          if (window.location.hash === '#superadmin-dashboard' || window.location.hash === '#admin-dashboard') {
            setIsAdminAuthOpen(true);
            window.location.hash = '';
          }
        } finally {
          setIsRestoringAdmin(false);
        }
      } else {
        setIsRestoringAdmin(false);
      }
    }
    restoreSessions();
    loadBloodRequests();
  }, []);

  // Hash listener for voice assistant, dashboards, or registration
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#blood-drop') {
        setIsBloodDropOpen(true);
      } else if (window.location.hash === '#user-register') {
        setUserAuthMode('register');
        setIsUserAuthOpen(true);
      } else if (window.location.hash === '#user-dashboard') {
        if (getUserToken() || currentUser) {
          setCurrentView('user-dashboard');
        } else {
          setIntendedAction({ destination: 'user-dashboard' });
          setUserAuthMode('login');
          setIsUserAuthOpen(true);
          window.location.hash = '';
        }
      } else if (window.location.hash === '#superadmin-dashboard') {
        if (isRestoringAdmin) {
          // Waiting for admin profile to restore; do not redirect or alter hash
          return;
        }
        if (getAdminToken()) {
          const role = currentAdmin?.roleId || currentAdmin?.role_id;
          if (role === 'SUPER_ADMIN') {
            setCurrentView('superadmin-dashboard');
          } else if (currentAdmin) {
            setCurrentView('admin-dashboard');
            window.location.hash = '#admin-dashboard';
          }
        } else {
          setIsAdminAuthOpen(true);
          window.location.hash = '';
        }
      } else if (window.location.hash === '#admin-dashboard') {
        if (isRestoringAdmin) {
          return;
        }
        if (getAdminToken()) {
          setCurrentView('admin-dashboard');
        } else {
          setIsAdminAuthOpen(true);
          window.location.hash = '';
        }
      } else if (window.location.hash === '#admin-login') {
        setIsAdminAuthOpen(true);
      } else if (window.location.hash === '#rotaract-directory') {
        setCurrentView('rotaract-directory');
      } else if (window.location.hash.startsWith('#verify-certificate-')) {
        const rawToken = window.location.hash.replace(/^#verify-certificate-/, '').trim();
        if (rawToken) {
          setVerifyToken(rawToken);
          setIsVerifyModalOpen(true);
        }
      } else {
        setCurrentView((prev) => (prev === 'rotaract-directory' ? 'public' : prev));
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentUser, currentAdmin, isRestoringAdmin]);

  // Login Navigation Role Selector
  const handleOpenRoleSelection = () => {
    setIsRoleSelectOpen(true);
  };

  const handleSelectRole = (role) => {
    setIsRoleSelectOpen(false);
    if (role === 'user') {
      setUserAuthMode('login');
      setIsUserAuthOpen(true);
    } else if (role === 'admin') {
      setIsAdminAuthOpen(true);
    }
  };

  const handleUserAuthSuccess = (user, authRes = null) => {
    const userDob = authRes?.user?.dateOfBirth || user?.dateOfBirth || user?.date_of_birth || null;
    const userGender = authRes?.user?.gender || user?.gender || null;
    const reqCompletion = Boolean(authRes?.requiresProfileCompletion ?? (!userDob || !userGender));

    const updatedUser = {
      ...user,
      fullName: user?.fullName || user?.full_name || authRes?.user?.fullName,
      mobileNumber: user?.mobileNumber || user?.mobile_number || authRes?.user?.mobileNumber,
      email: user?.email || authRes?.user?.email,
      dateOfBirth: userDob,
      gender: userGender,
      requiresProfileCompletion: reqCompletion,
      isDonor: authRes ? Boolean(authRes.isDonor) : user?.isDonor,
      needsDonorCompletion: authRes ? Boolean(authRes.needsDonorCompletion) : user?.needsDonorCompletion,
      needsDonorPhotoCompletion: authRes ? Boolean(authRes.needsDonorPhotoCompletion) : user?.needsDonorPhotoCompletion,
      donorProfile: authRes?.donorProfile || user?.donorProfile || null
    };
    setCurrentUser(updatedUser);
    setIsUserAuthOpen(false);
    window.dispatchEvent(new CustomEvent('donor-registered', { detail: authRes?.donorProfile || null }));

    if (intendedAction) {
      const { action, destination } = intendedAction;
      setIntendedAction(null);
      if (typeof action === 'function') {
        action(updatedUser);
      } else if (destination === 'user-dashboard') {
        setCurrentView('user-dashboard');
        window.location.hash = '#user-dashboard';
      } else if (destination === 'donor-registration') {
        setIsDonorModalOpen(true);
      }
    } else if (window.location.hash === '#user-dashboard') {
      setCurrentView('user-dashboard');
    }
  };

  const handleMandatoryProfileComplete = (completedUser) => {
    setCurrentUser(prev => ({
      ...prev,
      ...completedUser,
      dateOfBirth: completedUser?.dateOfBirth || completedUser?.date_of_birth || prev?.dateOfBirth,
      gender: completedUser?.gender || prev?.gender,
      age: completedUser?.age !== undefined ? completedUser.age : prev?.age,
      requiresProfileCompletion: false
    }));
  };

  const handleAdminAuthSuccess = (admin) => {
    setCurrentAdmin(admin);
    setIsAdminAuthOpen(false);
    const role = admin?.roleId || admin?.role_id;
    if (role === 'SUPER_ADMIN') {
      if (window.location.hash === '#admin-dashboard') {
        setCurrentView('admin-dashboard');
      } else {
        setCurrentView('superadmin-dashboard');
        window.location.hash = '#superadmin-dashboard';
      }
    } else if (role === 'ADMIN' || role === 'MODERATOR') {
      setCurrentView('admin-dashboard');
      window.location.hash = '#admin-dashboard';
    }
  };

  const handleUserLogout = async () => {
    await userApi.logout();
    setCurrentUser(null);
    setCurrentView('public');
    if (window.location.hash === '#user-dashboard') {
      window.location.hash = '';
    }
  };

  const handleAdminLogout = async () => {
    await adminApi.logout();
    setCurrentAdmin(null);
    if (currentView === 'admin-dashboard' || currentView === 'superadmin-dashboard') {
      setCurrentView('public');
      if (window.location.hash === '#admin-dashboard' || window.location.hash === '#superadmin-dashboard') {
        window.location.hash = '';
      }
    }
  };

  const handleOpenUserDashboard = () => {
    if (!currentUser && !getUserToken()) {
      setIntendedAction({ destination: 'user-dashboard' });
      setUserAuthMode('login');
      setIsUserAuthOpen(true);
    } else {
      setCurrentView('user-dashboard');
      window.location.hash = '#user-dashboard';
    }
  };

  const handleOpenDonorRegistration = () => {
    if (!currentUser) {
      setIntendedAction({ destination: 'donor-registration' });
      setUserAuthMode('login');
      setIsUserAuthOpen(true);
    } else {
      setIsDonorModalOpen(true);
    }
  };

  const handleDonorRegistrationSuccess = (newDonor) => {
    setIsDonorModalOpen(false);
    // Broadcast custom event so UserAccountMenu and HabitatExplorer reactively update
    window.dispatchEvent(new CustomEvent('donor-registered', { detail: newDonor }));
  };

  const handleNewBloodRequest = (newReq) => {
    setBloodRequests(prev => [newReq, ...prev]);
  };

  const handleUpdateRequestStatus = (reqId, newStatus) => {
    setBloodRequests(prev =>
      prev.map(r => (r.id === reqId ? { ...r, status: newStatus } : r))
    );
  };

  const handleNewSubmission = (newSub) => {
    setVerifiedSubmissions(prev => [newSub, ...prev]);
  };

  const handleViewCertificate = (subOrCert) => {
    setSelectedCertificate(subOrCert);
    setIsCertModalOpen(true);
  };

  const isAdminLoggedIn = Boolean(currentAdmin);

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 relative selection:bg-mars-500 selection:text-white">
      {/* Background Ambient Starfield Grid */}
      <div className="fixed inset-0 bg-grid-pattern opacity-25 pointer-events-none z-0"></div>

      {/* View Switch: Super Admin vs User Dashboard vs Admin Dashboard vs Public Website */}
      {isRestoringAdmin && (window.location.hash === '#superadmin-dashboard' || window.location.hash === '#admin-dashboard') ? (
        <div className="min-h-screen flex items-center justify-center bg-space-950 px-4">
          <div className="flex flex-col items-center gap-4">
            <LiveDateTime variant="pill" accent="amber" />
            <div className="w-10 h-10 border-4 border-mars-500/30 border-t-mars-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-mono tracking-wider text-center">VERIFYING ADMINISTRATIVE ACCESS...</p>
          </div>
        </div>
      ) : currentView === 'superadmin-dashboard' && currentAdmin && (currentAdmin.roleId === 'SUPER_ADMIN' || currentAdmin.role_id === 'SUPER_ADMIN') ? (
        <SuperAdminDashboard
          currentAdmin={currentAdmin}
          onBackToWebsite={() => {
            setCurrentView('public');
            if (window.location.hash === '#superadmin-dashboard') {
              window.history.pushState(null, '', window.location.pathname + window.location.search);
            }
          }}
          onLogout={handleAdminLogout}
          onViewCertificate={handleViewCertificate}
          onOpenAdminDashboard={() => {
            setCurrentView('admin-dashboard');
            window.location.hash = '#admin-dashboard';
          }}
          onOpenRotaractDirectory={() => {
            setCurrentView('rotaract-directory');
            window.location.hash = '#rotaract-directory';
          }}
          onRefreshPublicRequests={loadBloodRequests}
        />
      ) : currentView === 'user-dashboard' && currentUser ? (
        <UserDashboard
          currentUser={currentUser}
          onBackToWebsite={() => {
            setCurrentView('public');
            if (window.location.hash === '#user-dashboard') {
              window.history.pushState(null, '', window.location.pathname + window.location.search);
            }
          }}
          onLogout={handleUserLogout}
          onViewCertificate={handleViewCertificate}
          onOpenDonorRegistration={handleOpenDonorRegistration}
          onRaiseRequest={() => {
            setCurrentView('public');
            window.location.hash = '#requests';
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-raise-request-modal'));
            }, 150);
          }}
        />
      ) : currentView === 'admin-dashboard' && currentAdmin ? (
        <ModularAdminDashboard
          currentAdmin={currentAdmin}
          onBackToWebsite={() => {
            setCurrentView('public');
            if (window.location.hash === '#admin-dashboard') {
              window.history.pushState(null, '', window.location.pathname + window.location.search);
            }
          }}
          onLogout={handleAdminLogout}
          onViewCertificate={handleViewCertificate}
          onSwitchToSuperAdminDashboard={() => {
            setCurrentView('superadmin-dashboard');
            window.location.hash = '#superadmin-dashboard';
          }}
          onOpenRotaractDirectory={() => {
            setCurrentView('rotaract-directory');
            window.location.hash = '#rotaract-directory';
          }}
          onRefreshPublicRequests={loadBloodRequests}
        />
      ) : currentView === 'rotaract-directory' ? (
        <RotaractMembersDirectory
          onBackToWebsite={() => {
            setCurrentView('public');
            if (window.location.hash === '#rotaract-directory') {
              window.history.pushState(null, '', window.location.pathname + window.location.search);
            }
          }}
          isAdminAuthenticated={Boolean(currentAdmin && ['SUPER_ADMIN', 'ADMIN'].includes(currentAdmin.roleId || currentAdmin.role_id))}
          onOpenAdminDirectory={() => {
            const role = currentAdmin?.roleId || currentAdmin?.role_id;
            if (role === 'SUPER_ADMIN') {
              setCurrentView('superadmin-dashboard');
              window.location.hash = '#superadmin-dashboard';
            } else {
              setCurrentView('admin-dashboard');
              window.location.hash = '#admin-dashboard';
            }
          }}
        />
      ) : (
        /* Main Platform Structure */
        <div className="relative z-10">
          <Navbar 
            onOpenRoleSelection={handleOpenRoleSelection}
            onOpenBloodDrop={() => setIsBloodDropOpen(true)}
            currentUser={currentUser}
            currentAdmin={currentAdmin}
            onUserLogout={handleUserLogout}
            onAdminLogout={handleAdminLogout}
            onOpenDonorRegistration={handleOpenDonorRegistration}
            onViewCertificate={handleViewCertificate}
            onOpenUserDashboard={handleOpenUserDashboard}
            onOpenAdminDashboard={() => {
              setCurrentView('admin-dashboard');
              window.location.hash = '#admin-dashboard';
            }}
            onOpenSuperAdminDashboard={() => {
              setCurrentView('superadmin-dashboard');
              window.location.hash = '#superadmin-dashboard';
            }}
            hideClock={isRoleSelectOpen || isUserAuthOpen || isAdminAuthOpen}
          />
          
          <main>
            {/* Public Homepage Components */}
            <Hero
              onOpenUserAuth={(mode = 'login') => {
                setUserAuthMode(mode);
                setIsUserAuthOpen(true);
              }}
            />
            <TelemetryBar />
            <MissionPillars />
            <MissionLogs 
              bloodRequests={bloodRequests} 
              onAddRequest={handleNewBloodRequest}
              currentUser={currentUser}
              onOpenAuthModal={(mode, intended) => {
                if (intended) {
                  if (intended.type === 'RAISE_REQUEST') {
                    setIntendedAction({
                      action: () => {
                        window.location.hash = '#requests';
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('open-raise-request-modal'));
                        }, 120);
                      }
                    });
                  } else if (intended.type === 'PLEDGE') {
                    setIntendedAction({
                      action: () => {
                        window.location.hash = `#request-${intended.request.id}`;
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('open-pledge-modal', { detail: intended.request }));
                        }, 120);
                      }
                    });
                  }
                }
                setUserAuthMode(mode || 'login');
                setIsUserAuthOpen(true);
              }}
              onRefreshData={loadBloodRequests}
            />
            <MissionTimeline />

            {/* Admin Management Panel (Available for Authenticated Admins) */}
            {currentAdmin && (
              <AdminManagementPanel 
                currentAdmin={currentAdmin}
                onLogout={handleAdminLogout}
              />
            )}
          </main>

          <InstitutionalAssociations
            onOpenRotaractDirectory={() => {
              setCurrentView('rotaract-directory');
              window.location.hash = '#rotaract-directory';
            }}
          />

          <Footer
            onOpenUserAuth={(mode = 'login') => {
              setUserAuthMode(mode);
              setIsUserAuthOpen(true);
            }}
            onOpenAdminAuth={() => setIsAdminAuthOpen(true)}
          />
        </div>
      )}

      {/* Phase 1 Modals: Role Selection, User Auth, Admin Auth */}
      <RoleSelectionModal
        isOpen={isRoleSelectOpen}
        onClose={() => setIsRoleSelectOpen(false)}
        onSelectRole={handleSelectRole}
      />

      <UserAuthModal
        isOpen={isUserAuthOpen}
        onClose={() => setIsUserAuthOpen(false)}
        initialMode={userAuthMode}
        onAuthSuccess={handleUserAuthSuccess}
      />

      {/* Mandatory Profile Completion for Legacy Accounts */}
      <MandatoryProfileCompletionModal
        isOpen={Boolean(currentUser && (currentUser.requiresProfileCompletion || !currentUser.dateOfBirth || !currentUser.gender))}
        currentUser={currentUser}
        onComplete={handleMandatoryProfileComplete}
        onLogout={handleUserLogout}
      />

      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onAuthSuccess={handleAdminAuthSuccess}
      />

      {/* Floating RED MISSION AI Assistant Mascot & Chat Panel */}
      {(currentView === 'public' || currentView === 'user-dashboard' || currentView === 'rotaract-directory') && (
        <RedMissionAIChat currentUser={currentUser} />
      )}

      {/* Operational Overlays */}
      <BloodDropModal 
        isOpen={isBloodDropOpen} 
        onClose={() => setIsBloodDropOpen(false)} 
        onNavigateSection={(href) => {
          if (href === '#user-dashboard') {
            if (currentUser) {
              setCurrentView('user-dashboard');
              window.location.hash = '#user-dashboard';
            } else {
              setUserAuthMode('login');
              setIsUserAuthOpen(true);
            }
            return;
          }
          if (currentView !== 'public') {
            setCurrentView('public');
            setTimeout(() => {
              window.location.hash = href;
              document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          } else {
            window.location.hash = href;
            document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      <CertificateModal 
        isOpen={isCertModalOpen} 
        onClose={() => setIsCertModalOpen(false)} 
        certificateData={selectedCertificate}
        tokenType={currentView === 'admin-dashboard' || currentView === 'superadmin-dashboard' ? 'admin' : 'user'}
      />

      {/* Stage 2.3: Authenticated Donor Registration & Live Selfie Modal */}
      <DonorRegistrationModal
        isOpen={isDonorModalOpen}
        onClose={() => setIsDonorModalOpen(false)}
        currentUser={currentUser}
        onRegistrationSuccess={handleDonorRegistrationSuccess}
      />

      {/* Stage 2.5: Public QR Certificate Verification Modal */}
      <CertificateVerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setVerifyToken('');
          if (window.location.hash.startsWith('#verify-certificate-')) {
            window.history.pushState(null, '', window.location.pathname + window.location.search);
          }
        }}
        verifyToken={verifyToken}
      />
    </div>
  );
}
