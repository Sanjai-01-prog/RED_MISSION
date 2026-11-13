import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import DashboardLayout from '../shared/DashboardLayout';
import AdminOverviewTab from './AdminOverviewTab';
import AdminProofReviewTab from './AdminProofReviewTab';
import AdminRequestsTab from './AdminRequestsTab';
import ProofPhotoModal from './ProofPhotoModal';
import MonthlyReportsTab from '../../admin/MonthlyReportsTab';
import RotaractDirectoryAdminTab from '../../admin/RotaractDirectoryAdminTab';
import { proofApi, requestApi } from '../../../services/api';

export default function AdminDashboard({
  currentAdmin,
  onBackToWebsite,
  onLogout,
  onViewCertificate,
  onSwitchToSuperAdminDashboard,
  onOpenRotaractDirectory,
  onRefreshPublicRequests
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'proofs' | 'requests'
  const [openCreateRequestModal, setOpenCreateRequestModal] = useState(false);
  
  // Live Telemetry States
  const [proofs, setProofs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [proofFilter, setProofFilter] = useState('PENDING');

  // Photo viewer modal state
  const [selectedProofPhoto, setSelectedProofPhoto] = useState(null);

  // Fetch all donation proofs
  const fetchProofs = useCallback(async () => {
    setLoadingProofs(true);
    try {
      // Fetch all proofs to compute overview stats and filter locally/server-side
      const res = await proofApi.getAdminProofs('all');
      if (res.success && res.proofs) {
        setProofs(res.proofs);
      }
    } catch (err) {
      console.error('Failed to load admin proofs:', err);
    } finally {
      setLoadingProofs(false);
    }
  }, []);

  // Fetch emergency blood requests
  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await requestApi.getAll({ status: 'all' });
      if (res.success && res.requests) {
        setRequests(res.requests);
      }
    } catch (err) {
      console.error('Failed to load blood requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Initial load & reactive refresh
  useEffect(() => {
    fetchProofs();
    fetchRequests();
    const handleRefresh = () => {
      fetchProofs();
      fetchRequests();
    };
    window.addEventListener('proof-reviewed', handleRefresh);
    window.addEventListener('pledge-updated', handleRefresh);
    return () => {
      window.removeEventListener('proof-reviewed', handleRefresh);
      window.removeEventListener('pledge-updated', handleRefresh);
    };
  }, [fetchProofs, fetchRequests]);

  // Compute live statistics from database records
  const pendingProofsCount = proofs.filter(p => (p.status || p.proofStatus || '').toUpperCase() === 'PENDING').length;
  const approvedProofsCount = proofs.filter(p => (p.status || p.proofStatus || '').toUpperCase() === 'APPROVED').length;
  const rejectedProofsCount = proofs.filter(p => (p.status || p.proofStatus || '').toUpperCase() === 'REJECTED').length;

  const isExpiredRequest = (r) => {
    if (r.is_expired) return true;
    const rawStatus = (r.status || '').toUpperCase();
    if (rawStatus === 'CANCELLED' || rawStatus === 'FULFILLED') return false;
    const fulfilled = Number(r.units_fulfilled || 0);
    const requested = Number(r.units_requested || 0);
    if (requested > 0 && fulfilled >= requested) return false;
    if (!r.required_by) return false;
    const deadlineMs = new Date(r.required_by).getTime();
    return !isNaN(deadlineMs) && deadlineMs < Date.now();
  };

  const isFulfilledRequest = (r) => {
    return (r.status || '').toUpperCase() === 'FULFILLED' || (Number(r.units_requested || 0) > 0 && Number(r.units_fulfilled || 0) >= Number(r.units_requested || 0));
  };

  // Truthful active requests: Approved, OPEN, not expired, not fulfilled
  const activeRequestsCount = requests.filter(r => 
    !isExpiredRequest(r) && 
    !isFulfilledRequest(r) && 
    (r.status || 'OPEN').toUpperCase() === 'OPEN' && 
    (r.approval_status || (r.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase() === 'APPROVED'
  ).length;

  const pendingRequestsCount = requests.filter(r => 
    !isExpiredRequest(r) && 
    !isFulfilledRequest(r) && 
    (r.status || '').toUpperCase() !== 'CANCELLED' && 
    (r.approval_status || '').toUpperCase() === 'PENDING'
  ).length;

  const expiredRequestsCount = requests.filter(r => isExpiredRequest(r)).length;
  const fulfilledRequestsCount = requests.filter(r => isFulfilledRequest(r)).length;

  const stats = {
    pendingProofs: pendingProofsCount,
    approvedProofs: approvedProofsCount,
    rejectedProofs: rejectedProofsCount,
    activeRequests: activeRequestsCount,
    pendingRequests: pendingRequestsCount,
    expiredRequests: expiredRequestsCount,
    fulfilledRequests: fulfilledRequestsCount,
    totalDonors: null // Explicitly unavailable, never fake
  };

  const badgeCounts = {
    pendingProofs: pendingProofsCount,
    activeRequests: activeRequestsCount,
    pendingRequests: pendingRequestsCount
  };

  // Tab titles
  const getTabInfo = () => {
    switch (activeTab) {
      case 'proofs':
        return {
          title: 'Donation Proof Review',
          subtitle: 'Verify clinical donation receipts and issue certified lifesaver credentials'
        };
      case 'requests':
        return {
          title: 'Emergency Blood Requests',
          subtitle: 'Manage regional blood shortage calls and monitor patient fulfillment'
        };
      case 'reports':
        return {
          title: 'Official Monthly Donation Reports',
          subtitle: 'Generate and download evidence-based monthly activity reports for Rotaract District Portal submission'
        };
      case 'rotaract':
        return {
          title: 'Rotaract KPRIET Members Directory',
          subtitle: 'Manage verified public college club member profiles, photographs, designations, and display order'
        };
      case 'overview':
      default:
        return {
          title: 'Mission Command Overview',
          subtitle: 'Real-time telemetry and operational clinical metrics'
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      activeTabTitle={tabInfo.title}
      activeTabSubtitle={tabInfo.subtitle}
      badgeCounts={badgeCounts}
      onBackToWebsite={onBackToWebsite}
      onLogout={onLogout}
      portalType="admin"
      currentAdmin={currentAdmin}
      switchAction={(currentAdmin?.roleId === 'SUPER_ADMIN' || currentAdmin?.role_id === 'SUPER_ADMIN') && onSwitchToSuperAdminDashboard ? {
        label: 'Return to Super Admin',
        shortLabel: 'Super Admin',
        icon: ShieldCheck,
        onClick: onSwitchToSuperAdminDashboard,
        className: 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
      } : undefined}
    >
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <AdminOverviewTab
          stats={stats}
          recentProofs={proofs.filter(p => (p.status || p.proofStatus || '').toUpperCase() === 'PENDING')}
          recentRequests={requests}
          onNavigateTab={setActiveTab}
          onOpenProofPhoto={(proof) => setSelectedProofPhoto(proof)}
          onReviewPendingProofs={() => {
            setActiveTab('proofs');
            setProofFilter('PENDING');
          }}
          onOpenCreateRequest={() => {
            setActiveTab('requests');
            setOpenCreateRequestModal(true);
          }}
          onRefreshData={() => {
            fetchProofs();
            fetchRequests();
          }}
          currentAdmin={currentAdmin}
          loading={loadingProofs || loadingRequests}
        />
      )}

      {/* Proof Review Tab */}
      {activeTab === 'proofs' && (
        <AdminProofReviewTab
          proofs={proofs}
          loading={loadingProofs}
          onRefreshProofs={fetchProofs}
          onOpenProofPhoto={(proof) => setSelectedProofPhoto(proof)}
          onViewCertificate={onViewCertificate}
          currentAdmin={currentAdmin}
          activeFilter={proofFilter}
          onFilterChange={setProofFilter}
        />
      )}

      {/* Emergency Requests Tab */}
      {activeTab === 'requests' && (
        <AdminRequestsTab
          requests={requests}
          loading={loadingRequests}
          onRefreshRequests={() => {
            fetchRequests();
            if (onRefreshPublicRequests) onRefreshPublicRequests();
          }}
          onRequestCreated={(newReq) => {
            setRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq?.id)]);
            fetchRequests();
            if (onRefreshPublicRequests) onRefreshPublicRequests();
          }}
          currentAdmin={currentAdmin}
          initialOpenCreate={openCreateRequestModal}
          onConsumeInitialOpenCreate={() => setOpenCreateRequestModal(false)}
        />
      )}

      {/* Monthly Reports Tab */}
      {activeTab === 'reports' && (
        <MonthlyReportsTab
          currentAdmin={currentAdmin}
        />
      )}

      {/* Rotaract College Members Directory Tab */}
      {activeTab === 'rotaract' && (
        <RotaractDirectoryAdminTab
          currentAdmin={currentAdmin}
          onOpenPublicDirectory={onOpenRotaractDirectory}
        />
      )}

      {/* Proof Photo High-Res Viewer Modal */}
      <ProofPhotoModal
        isOpen={Boolean(selectedProofPhoto)}
        onClose={() => setSelectedProofPhoto(null)}
        proof={selectedProofPhoto}
      />
    </DashboardLayout>
  );
}
