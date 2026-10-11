import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';

// Admin Components
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminEmployees } from './components/admin/AdminEmployees';
import { AdminAddEmployee } from './components/admin/AdminAddEmployee';
import { AdminManagers } from './components/admin/AdminManagers';
import { AdminAddManager } from './components/admin/AdminAddManager';
import { AdminAttendance } from './components/admin/AdminAttendance';
import { AdminApprovalAudit } from './components/admin/AdminApprovalAudit';
import { AdminSettings } from './components/admin/AdminSettings';

// Manager Components
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerEmployees } from './components/manager/ManagerEmployees';
import { ManagerLeaveApproval } from './components/manager/ManagerLeaveApproval';

// Employee Components
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';
import { EmployeeMarkAttendance } from './components/employee/EmployeeMarkAttendance';
import { EmployeeAttendanceHistory } from './components/employee/EmployeeAttendanceHistory';
import { EmployeeSmartHours } from './components/employee/EmployeeSmartHours';
import { EmployeeApplyLeave } from './components/employee/EmployeeApplyLeave';
import { EmployeeLeaveStatus } from './components/employee/EmployeeLeaveStatus';

// Common Components
import { ReportsView } from './components/common/ReportsView';
import { UserProfileView } from './components/common/UserProfileView';

function AppContent() {
  const { currentUser, currentRole } = useApp();
  const [activeTab, setActiveTab] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Set default tab when role changes
  useEffect(() => {
    if (currentRole === 'admin') {
      setActiveTab('admin-dashboard');
    } else if (currentRole === 'manager') {
      setActiveTab('manager-dashboard');
    } else if (currentRole === 'employee') {
      setActiveTab('emp-dashboard');
    }
  }, [currentRole]);

  if (!currentUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    // ADMIN VIEWS
    if (currentRole === 'admin') {
      switch (activeTab) {
        case 'admin-dashboard':
          return <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />;
        case 'admin-employees':
          return (
            <AdminEmployees
              onNavigateAddEmployee={() => setActiveTab('admin-add-employee')}
            />
          );
        case 'admin-add-employee':
          return (
            <AdminAddEmployee
              onCancel={() => setActiveTab('admin-employees')}
              onSuccess={() => setActiveTab('admin-employees')}
            />
          );
        case 'admin-managers':
          return (
            <AdminManagers
              onNavigateAddManager={() => setActiveTab('admin-add-manager')}
            />
          );
        case 'admin-add-manager':
          return (
            <AdminAddManager
              onCancel={() => setActiveTab('admin-managers')}
              onSuccess={() => setActiveTab('admin-managers')}
            />
          );
        case 'admin-attendance-today':
          return <AdminAttendance initialMode="today" />;
        case 'admin-attendance-history':
          return <AdminAttendance initialMode="history" />;
        case 'admin-leaves':
          return <ManagerLeaveApproval />;
        case 'admin-approval-audit':
          return <AdminApprovalAudit />;
        case 'admin-reports':
          return <ReportsView />;
        case 'admin-settings':
          return <AdminSettings />;
        default:
          return <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      }
    }

    // MANAGER VIEWS
    if (currentRole === 'manager') {
      switch (activeTab) {
        case 'manager-dashboard':
          return <ManagerDashboard onNavigate={(tab) => setActiveTab(tab)} />;
        case 'manager-my-employees':
          return <ManagerEmployees />;
        case 'manager-attendance':
          return <AdminAttendance initialMode="today" />;
        case 'manager-leave-approval':
          return <ManagerLeaveApproval />;
        case 'manager-reports':
          return <ReportsView />;
        case 'manager-notifications':
          return <ManagerDashboard onNavigate={(tab) => setActiveTab(tab)} />;
        case 'manager-profile':
          return <UserProfileView />;
        default:
          return <ManagerDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      }
    }

    // EMPLOYEE VIEWS
    if (currentRole === 'employee') {
      switch (activeTab) {
        case 'emp-dashboard':
          return <EmployeeDashboard onNavigate={(tab) => setActiveTab(tab)} />;
        case 'emp-mark-attendance':
          return <EmployeeMarkAttendance />;
        case 'emp-attendance-history':
          return <EmployeeAttendanceHistory />;
        case 'emp-smart-hours':
          return <EmployeeSmartHours />;
        case 'emp-apply-leave':
          return (
            <EmployeeApplyLeave
              onNavigateStatus={() => setActiveTab('emp-leave-status')}
            />
          );
        case 'emp-leave-status':
          return (
            <EmployeeLeaveStatus
              onApplyNew={() => setActiveTab('emp-apply-leave')}
            />
          );
        case 'emp-reports':
          return <ReportsView />;
        case 'emp-profile':
          return <UserProfileView />;
        default:
          return <EmployeeDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      }
    }

    return <div>Select a view from the sidebar.</div>;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
      <Header
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        activeTab={activeTab.replace(/-/g, ' ').toUpperCase()}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
