import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { InvitationAcceptPage } from '@/pages/InvitationAcceptPage';
import { InvitationDeclinePage } from '@/pages/InvitationDeclinePage';
import { InvitationsPage } from '@/pages/InvitationsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupPage } from '@/pages/GroupPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { EventsPage } from '@/pages/EventsPage';
import { AuditPage } from '@/pages/AuditPage';
import { GroupSettingsPage } from '@/pages/GroupSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite/accept" element={<InvitationAcceptPage />} />
        <Route path="/invite/decline" element={<InvitationDeclinePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/invitations" element={<InvitationsPage />} />
            <Route path="/groups/:groupId" element={<GroupPage />} />
            <Route path="/groups/:groupId/expenses" element={<ExpensesPage />} />
            <Route path="/groups/:groupId/events" element={<EventsPage />} />
            <Route path="/groups/:groupId/audit" element={<AuditPage />} />
            <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
