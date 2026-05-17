import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { InvitePage } from '@/pages/InvitePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GroupPage } from '@/pages/GroupPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { EventsPage } from '@/pages/EventsPage';
import { AuditPage } from '@/pages/AuditPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite" element={<InvitePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/groups/:groupId" element={<GroupPage />} />
            <Route path="/groups/:groupId/expenses" element={<ExpensesPage />} />
            <Route path="/groups/:groupId/events" element={<EventsPage />} />
            <Route path="/groups/:groupId/audit" element={<AuditPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
