import React, { useState, useEffect } from 'react';
import DashboardLayout from '../shared/DashboardLayout';
import UserOverviewTab from './UserOverviewTab';
import UserRequestsTab from './UserRequestsTab';
import UserPledgesTab from './UserPledgesTab';
import UserDonationHistoryTab from './UserDonationHistoryTab';
import UserProofsTab from './UserProofsTab';
import UserCertificatesTab from './UserCertificatesTab';
import UserDonorProfileTab from './UserDonorProfileTab';
import UserSecurityTab from './UserSecurityTab';
import ProofUploadModal from './ProofUploadModal';
import { pledgeApi, donorApi, certificateApi, requestApi } from '../../../services/api';
import { downloadCertificatePdf } from '../../../utils/certificatePdfGenerator';

export default function UserDashboard({
  currentUser,
  onBackToWebsite,
  onLogout,
  onViewCertificate,
  onOpenDonorRegistration,
  onRaiseRequest
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [pledges, setPledges] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [donorProfile, setDonorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Proof upload modal state
  const [selectedProofPledge, setSelectedProofPledge] = useState(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [downloadingCertPledgeId, setDownloadingCertPledgeId] = useState(null);

  // Load pledges, requests, and donor profile
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [pledgeRes, donorRes, requestRes] = await Promise.all([
        pledgeApi.getMyPledges().catch(() => ({ success: false })),
        donorApi.getProfile().catch(() => ({ success: false })),
        requestApi.getMyRequests().catch(() => ({ success: false }))
      ]);

      if (pledgeRes.success && pledgeRes.pledges) {
        setPledges(pledgeRes.pledges);
      }

      if (donorRes.success && (donorRes.isDonor || donorRes.donor)) {
        setDonorProfile(donorRes.donor);
      } else {
        setDonorProfile(null);
      }

      if (requestRes.success && requestRes.requests) {
        setUserRequests(requestRes.requests);
      }
    } catch (err) {
      console.error('Failed to load user dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  // Listen to donor / proof / pledge events to auto-refresh
  useEffect(() => {
    const handleDonorEvent = () => {
      loadDashboardData();
    };
    window.addEventListener('donor-registered', handleDonorEvent);
    window.addEventListener('proof-reviewed', handleDonorEvent);
    window.addEventListener('pledge-updated', handleDonorEvent);
    return () => {
      window.removeEventListener('donor-registered', handleDonorEvent);
      window.removeEventListener('proof-reviewed', handleDonorEvent);
      window.removeEventListener('pledge-updated', handleDonorEvent);
    };
  }, []);

  // Compute live badge counts
  const activePledgesCount = pledges.filter(p => p.rawStatus !== 'CANCELLED' && p.displayStatus !== 'Approved' && p.rawStatus !== 'APPROVED').length;
  const completedDonationsCount = pledges.filter(p => p.displayStatus === 'Approved' || p.rawStatus === 'APPROVED' || p.certificate).length;
  const pendingProofsCount = pledges.filter(p => p.displayStatus === 'Under Admin Review').length;
  const certificatesCount = pledges.filter(p => p.certificate != null).length;

  const badgeCounts = {
    myRequests: userRequests.length,
    activePledges: activePledgesCount,
    completedDonations: completedDonationsCount,
    pendingProofs: pendingProofsCount,
    certificates: certificatesCount
  };

  // Inspect certificate via API and open modal
  const handleInspectCertificate = async (pledge) => {
    try {
      const res = await certificateApi.getCertificate(pledge.id);
      if (res.success && res.certificate) {
        if (onViewCertificate) {
          onViewCertificate(res.certificate);
        }
      } else {
        alert(res.error || 'Certificate not available yet.');
      }
    } catch (err) {
      alert('Failed to load certificate from secure network.');
    }
  };

  // Download genuine PDF certificate directly from User Dashboard
  const handleDownloadCertificatePdf = async (pledge) => {
    if (!pledge?.id || downloadingCertPledgeId === pledge.id) return;
    setDownloadingCertPledgeId(pledge.id);
    try {
      const res = await certificateApi.getCertificate(pledge.id);
      if (res.success && res.certificate) {
        await downloadCertificatePdf(res.certificate);
      } else {
        alert(res.error || 'Certificate PDF is only available for approved donations.');
      }
    } catch (err) {
      alert(err?.message || 'Failed to generate certificate PDF.');
    } finally {
      setDownloadingCertPledgeId(null);
    }
  };

  // Trigger proof upload
  const handleOpenProofModal = (pledge) => {
    setSelectedProofPledge(pledge);
    setIsProofModalOpen(true);
  };

  // Tab metadata titles
  const tabTitles = {
    overview: {
      title: 'Dashboard Overview',
      subtitle: 'Real-time overview of your voluntary blood donation activities'
    },
    requests: {
      title: 'My Blood Requests',
      subtitle: 'Track status and voluntary donor matches for your blood requests'
    },
    pledges: {
      title: 'My Blood Pledges',
      subtitle: 'Emergency units reserved for critical clinical requests'
    },
    history: {
      title: 'Donation History',
      subtitle: 'Verified records of your completed blood donations'
    },
    proofs: {
      title: 'Donation Proof Submissions',
      subtitle: 'Clinical verification status of hospital receipts and slips'
    },
    certificates: {
      title: 'Lifesaver Certificates',
      subtitle: 'Official NBTC accredited citations and verification links'
    },
    profile: {
      title: 'Donor Profile & Settings',
      subtitle: 'Manage your clinical identity, availability, and donor photo'
    },
    security: {
      title: 'Security & Active Sessions',
      subtitle: 'Multi-device sessions and access audit trail'
    }
  };

  const currentTabMeta = tabTitles[activeTab] || tabTitles.overview;

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      activeTabTitle={currentTabMeta.title}
      activeTabSubtitle={currentTabMeta.subtitle}
      currentUser={currentUser}
      donorProfile={donorProfile}
      badgeCounts={badgeCounts}
      onBackToWebsite={onBackToWebsite}
      onLogout={onLogout}
    >
      {activeTab === 'overview' && (
        <UserOverviewTab
          currentUser={currentUser}
          donorProfile={donorProfile}
          pledges={pledges}
          requests={userRequests}
          loading={loading}
          onNavigateTab={setActiveTab}
          onOpenProofModal={handleOpenProofModal}
          onViewCertificate={handleInspectCertificate}
          onOpenDonorRegistration={onOpenDonorRegistration}
          onRaiseRequest={onRaiseRequest}
        />
      )}

      {activeTab === 'requests' && (
        <UserRequestsTab
          requests={userRequests}
          loading={loading}
          onRefresh={loadDashboardData}
          onRaiseRequest={onRaiseRequest}
        />
      )}

      {activeTab === 'pledges' && (
        <UserPledgesTab
          pledges={pledges}
          loading={loading}
          onRefresh={loadDashboardData}
          onOpenProofModal={handleOpenProofModal}
          onViewCertificate={handleInspectCertificate}
        />
      )}

      {activeTab === 'history' && (
        <UserDonationHistoryTab
          pledges={pledges}
          loading={loading}
          onViewCertificate={handleInspectCertificate}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'proofs' && (
        <UserProofsTab
          pledges={pledges}
          loading={loading}
          onOpenProofModal={handleOpenProofModal}
          onViewCertificate={handleInspectCertificate}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'certificates' && (
        <UserCertificatesTab
          pledges={pledges}
          loading={loading}
          onViewCertificate={handleInspectCertificate}
          onDownloadCertificate={handleDownloadCertificatePdf}
          downloadingCertPledgeId={downloadingCertPledgeId}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'profile' && (
        <UserDonorProfileTab
          currentUser={currentUser}
          donorProfile={donorProfile}
          loading={loading}
          onProfileUpdated={loadDashboardData}
          onOpenDonorRegistration={onOpenDonorRegistration}
        />
      )}

      {activeTab === 'security' && (
        <UserSecurityTab
          currentUser={currentUser}
        />
      )}

      {/* Proof Upload Modal */}
      <ProofUploadModal
        isOpen={isProofModalOpen}
        onClose={() => {
          setIsProofModalOpen(false);
          setSelectedProofPledge(null);
        }}
        pledge={selectedProofPledge}
        onUploadSuccess={loadDashboardData}
      />
    </DashboardLayout>
  );
}
