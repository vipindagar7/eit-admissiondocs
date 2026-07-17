import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useIdleLock } from '../hooks/useIdleLock.js';
import IdleLockOverlay from './IdleLockOverlay.jsx';
import { Button } from './ui/button.jsx';
import { Badge } from './ui/badge.jsx';
import { cn } from '../lib/utils.js';

const NAV_ITEMS = [
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/sessions', label: 'Sessions', adminOnly: true },
  { to: '/admin/document-types', label: 'Documents', adminOnly: true },
  { to: '/admin/form-questions', label: 'Questions', adminOnly: true },
  { to: '/admin/staff', label: 'Staff', adminOnly: true },
  { to: '/admin/settings', label: 'Settings', adminOnly: true },
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [idleMinutes, setIdleMinutes] = useState(5);
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    api
      .get('/admin/settings')
      .then((res) => setIdleMinutes(Number(res.settings.idleLockMinutes) || 5))
      .catch(() => {});
    api
      .get('/admin/me')
      .then((res) => setStaff(res.staff))
      .catch(() => {});
  }, []);

  const { locked, unlock } = useIdleLock(idleMinutes);
  const isAdmin = staff?.role === 'ADMIN';

  async function handleLogout() {
    await api.post('/admin/logout');
    navigate('/admin/login');
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-gray-50">
      {locked && <IdleLockOverlay onUnlock={unlock} />}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2 text-base font-semibold text-brand-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white">E</span>
              EIT Document Portal
            </span>
            <nav className="flex items-center gap-1">
              {visibleNav.map((item) => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {staff && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{staff.email}</span>
                <Badge variant={isAdmin ? 'default' : 'gray'}>{staff.role}</Badge>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-600">
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet context={{ staff, isAdmin }} />
      </main>
    </div>
  );
}
