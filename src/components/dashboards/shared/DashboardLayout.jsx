import React, { useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';

export default function DashboardLayout({
  activeTab,
  onTabChange,
  activeTabTitle,
  activeTabSubtitle,
  currentUser,
  donorProfile,
  badgeCounts,
  onBackToWebsite,
  onLogout,
  portalType = 'user',
  navItems,
  currentAdmin,
  headerCategory,
  switchAction,
  children
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex relative selection:bg-mars-500 selection:text-white">
      {/* Background Starfield Grid Pattern */}
      <div className="fixed inset-0 bg-grid-pattern opacity-25 pointer-events-none z-0"></div>

      {/* Persistent Left Sidebar */}
      <DashboardSidebar 
        activeTab={activeTab}
        onTabChange={onTabChange}
        currentUser={currentUser}
        donorProfile={donorProfile}
        badgeCounts={badgeCounts}
        onBackToWebsite={onBackToWebsite}
        onLogout={onLogout}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        portalType={portalType}
        navItems={navItems}
        currentAdmin={currentAdmin}
        switchAction={switchAction}
      />

      {/* Main Content Area (offset by sidebar width on lg screens) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 relative z-10">
        <DashboardHeader 
          activeTabTitle={activeTabTitle}
          activeTabSubtitle={activeTabSubtitle}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onBackToWebsite={onBackToWebsite}
          currentUser={currentUser}
          currentAdmin={currentAdmin}
          portalType={portalType}
          headerCategory={headerCategory}
          switchAction={switchAction}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
