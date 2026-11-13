import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Award, 
  FileText, 
  ShieldCheck, 
  Shield, 
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  Droplets,
  Heart
} from 'lucide-react';
import DashboardLayout from '../shared/DashboardLayout';
import SuperAdminOverviewTab from './SuperAdminOverviewTab';
import SuperAdminDonorsTab from './SuperAdminDonorsTab';
import SuperAdminTeamTab from './SuperAdminTeamTab';
import SuperAdminCertificatesTab from './SuperAdminCertificatesTab';
import SuperAdminAuditLogsTab from './SuperAdminAuditLogsTab';
import SuperAdminGovernanceTab from './SuperAdminGovernanceTab';
import AdminRequestsTab from '../admin/AdminRequestsTab';
import MonthlyReportsTab from '../../admin/MonthlyReportsTab';
import RotaractDirectoryAdminTab from '../../admin/RotaractDirectoryAdminTab';
import { adminApi, certificateApi, requestApi } from '../../../services/api';

export default function SuperAdminDashboard({
  currentAdmin,
  onBackToWebsite,
  onLogout,
  onViewCertificate,
  onOpenAdminDashboard,
  onOpenRotaractDirectory,
  onRefreshPublicRequests
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'donors' | 'requests' | 'team' | 'certificates' | 'audit' | 'governance' | 'reports' | 'rotaract'
  const [openCreateRequestModal, setOpenCreateRequestModal] = useState(false);
  
  // Platform telemetry & aggregate data
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  
  // Team data
  const [teamList, setTeamList] = useState([]);
  const [invitationsList, setInvitationsList] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Certificates list
  const [certificates, setCertificates] = useState([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  // Emergency blood requests list
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Security role verification
  const isSuperAdmin = currentAdmin?.roleId === 'SUPER_ADMIN' || currentAdmin?.role_id === 'SUPER_ADMIN';

  // Fetch aggregate platform stats
  const fetchStats = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingStats(true);
    setStatsError('');
    try {
      const res = await adminApi.getStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        setStatsError(res.error || 'Failed to retrieve administrative statistics.');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      setStatsError('Network error while retrieving administrative stats.');
    } finally {
      setLoadingStats(false);
    }
  }, [isSuperAdmin]);

  // Fetch team governance data
  const fetchTeam = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingTeam(true);
    try {
      const res = await adminApi.getTeam();
      if (res.success) {
        setTeamList(res.team || []);
        setInvitationsList(res.invitations || []);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoadingTeam(false);
    }
  }, [isSuperAdmin]);

  // Fetch certificates
  const fetchCertificates = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingCertificates(true);
    try {
      const res = await certificateApi.getAllAdmin();
      if (res.success && res.certificates) {
        setCertificates(res.certificates);
      }
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoadingCertificates(false);
    }
  }, [isSuperAdmin]);

  // Fetch emergency blood requests
  const fetchRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
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
  }, [isSuperAdmin]);

  // Initial data loading
  useEffect(() => {
    if (isSuperAdmin) {
      fetchStats();
      fetchTeam();
      fetchCertificates();
      fetchRequests();

      const handleReactiveRefresh = () => {
        fetchStats();
        fetchRequests();
      };
      window.addEventListener('pledge-updated', handleReactiveRefresh);
      window.addEventListener('proof-reviewed', handleReactiveRefresh);
      return () => {
        window.removeEventListener('pledge-updated', handleReactiveRefresh);
        window.removeEventListener('proof-reviewed', handleReactiveRefresh);
      };
    }
  }, [isSuperAdmin, fetchStats, fetchTeam, fetchCertificates, fetchRequests]);

  // Guard: If not Super Admin, show strict security denial
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-space-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full card-glass rounded-3xl p-8 border border-rose-500/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-orbitron font-extrabold text-xl text-white">
            Access Restricted: Super Admin Only
          </h2>
          <p className="text-xs text-slate-300 font-mono">
            This dashboard contains platform governance, audit oversight, and administrative credentials management. Your current account role does not have authorization.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={onBackToWebsite}
              className="w-full py-2.5 rounded-xl bg-space-850 hover:bg-space-800 border border-white/10 text-xs font-mono text-white transition-colors cursor-pointer"
            >
              Return to Website
            </button>
            <button
              onClick={onLogout}
              className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-mono text-rose-300 transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const openRequestsCount = requests.filter(r => 
    !isExpiredRequest(r) && 
    !isFulfilledRequest(r) && 
    (r.status || 'OPEN').toUpperCase() === 'OPEN' && 
    (r.approval_status || (r.approved_by_admin_id ? 'APPROVED' : 'PENDING')).toUpperCase() === 'APPROVED'
  ).length;

  // Navigation Items
  const navItems = [
    {
      id: 'overview',
      label: 'Platform Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'donors',
      label: 'Donor Directory',
      icon: Droplets,
      badge: stats?.totalDonors > 0 ? stats.totalDonors : null,
      badgeColor: 'bg-mars-500/20 text-mars-300 border-mars-500/40'
    },
    {
      id: 'requests',
      label: 'Blood Requests',
      icon: Heart,
      badge: (openRequestsCount || stats?.activeRequests) > 0 ? (openRequestsCount || stats?.activeRequests) : null,
      badgeColor: 'bg-mars-500/20 text-mars-300 border-mars-500/40'
    },
    {
      id: 'team',
      label: 'Team Governance',
      icon: Users,
      badge: invitationsList.length > 0 ? `${invitationsList.length} Invites` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      id: 'certificates',
      label: 'Certificate Oversight',
      icon: Award,
      badge: (stats?.issuedCertificates || certificates.length) > 0 ? (stats?.issuedCertificates || certificates.length) : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    },
    {
      id: 'audit',
      label: 'Security Audit Logs',
      icon: FileText,
      badge: null
    },
    {
      id: 'governance',
      label: 'System & Governance',
      icon: Shield,
      badge: null
    },
    {
      id: 'reports',
      label: 'Monthly Reports',
      icon: FileSpreadsheet,
      badge: null
    },
    {
      id: 'rotaract',
      label: 'Rotaract Directory',
      icon: Building2,
      badge: null
    }
  ];

  // Tab Header Metadata
  const getTabInfo = () => {
    switch (activeTab) {
      case 'donors':
        return {
          title: 'Blood Group Donor Directory',
          subtitle: 'Inspect all registered donors across all 8 blood groups, registered photographs, pledge timelines, and 3-month availability'
        };
      case 'requests':
        return {
          title: 'Emergency Blood Requests',
          subtitle: 'Create, publish, and manage live emergency blood requests visible on the public Blood Requests section'
        };
      case 'reports':
        return {
          title: 'Official Monthly Donation Reports',
          subtitle: 'Generate, preview, and download evidence-based monthly activity reports for Rotaract District Portal submission'
        };
      case 'rotaract':
        return {
          title: 'Rotaract KPRIET Members Directory',
          subtitle: 'Manage verified public college club member profiles, photographs, designations, and display order'
        };
      case 'team':
        return {
          title: 'Administrative Team Governance',
          subtitle: 'Provision and govern hospital administrators, verification officers, and dispatch invitation links'
        };
      case 'certificates':
        return {
          title: 'Clinical Certificate Oversight',
          subtitle: 'Audit issued clinical donation certificates, public QR tokens, and verification status'
        };
      case 'audit':
        return {
          title: 'Security Audit Infrastructure',
          subtitle: 'Read-only immutable activity log tracking logins, verifications, account creations, and security events'
        };
      case 'governance':
        return {
          title: 'System & Security Governance',
          subtitle: 'Platform telemetry, active administrative sessions, security policies, and credentials management'
        };
      case 'overview':
      default:
        return {
          title: 'Platform Governance & Command',
          subtitle: 'Comprehensive real-time telemetry across donors, emergency requests, verification queues, and audit events'
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
      onBackToWebsite={onBackToWebsite}
      onLogout={onLogout}
      portalType="superadmin"
      navItems={navItems}
      currentAdmin={currentAdmin}
      headerCategory="Super Admin Command //"
      switchAction={onOpenAdminDashboard ? {
        label: 'Switch to Admin Ops',
        shortLabel: 'Admin Ops',
        icon: LayoutDashboard,
        onClick: onOpenAdminDashboard,
        className: 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30'
      } : undefined}
    >
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <SuperAdminOverviewTab
          stats={stats}
          loading={loadingStats}
          error={statsError}
          onRefresh={() => {
            fetchStats();
            fetchTeam();
            fetchCertificates();
            fetchRequests();
          }}
          onNavigateTab={setActiveTab}
          onOpenCreateRequest={() => {
            setActiveTab('requests');
            setOpenCreateRequestModal(true);
          }}
          onSwitchToAdminOps={onOpenAdminDashboard}
          currentAdmin={currentAdmin}
        />
      )}

      {/* Super Admin Donor Directory Tab */}
      {activeTab === 'donors' && <SuperAdminDonorsTab />}

      {/* Emergency Blood Requests Management Tab (Shared with Admin) */}
      {activeTab === 'requests' && (
        <AdminRequestsTab
          requests={requests}
          loading={loadingRequests}
          onRefreshRequests={() => {
            fetchRequests();
            fetchStats();
            if (onRefreshPublicRequests) onRefreshPublicRequests();
          }}
          onRequestCreated={(newReq) => {
            setRequests(prev => [newReq, ...prev.filter(r => r.id !== newReq?.id)]);
            fetchRequests();
            fetchStats();
            if (onRefreshPublicRequests) onRefreshPublicRequests();
          }}
          currentAdmin={currentAdmin}
          initialOpenCreate={openCreateRequestModal}
          onConsumeInitialOpenCreate={() => setOpenCreateRequestModal(false)}
        />
      )}

      {/* Team Governance Tab */}
      {activeTab === 'team' && (
        <SuperAdminTeamTab
          teamList={teamList}
          invitationsList={invitationsList}
          loading={loadingTeam}
          onRefreshTeam={fetchTeam}
          currentAdmin={currentAdmin}
        />
      )}

      {/* Certificate Oversight Tab */}
      {activeTab === 'certificates' && (
        <SuperAdminCertificatesTab
          certificates={certificates}
          loading={loadingCertificates}
          onRefreshCertificates={fetchCertificates}
          onViewCertificate={onViewCertificate}
          currentAdmin={currentAdmin}
        />
      )}

      {/* Security Audit Logs Tab */}
      {activeTab === 'audit' && (
        <SuperAdminAuditLogsTab
          currentAdmin={currentAdmin}
        />
      )}

      {/* Security & Governance Tab */}
      {activeTab === 'governance' && (
        <SuperAdminGovernanceTab
          currentAdmin={currentAdmin}
          onLogout={onLogout}
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
    </DashboardLayout>
  );
}
