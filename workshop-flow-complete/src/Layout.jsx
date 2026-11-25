import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wrench, User, LogOut, Settings, ChevronDown, Package, ClipboardList, Headphones, Shield, Archive, Search, MessageSquare, Building2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import NotificationBell from "./components/NotificationBell";
import ActionRequiredBanner from "./components/ActionRequiredBanner";

const ROLE_ICONS = {
  super_admin: Shield, technician: Wrench, parts_interpreter: Package,
  workshop_controller: ClipboardList, service_advisor: Headphones,
  service_manager: Headphones, admin: Shield
};
const ROLE_LABELS = {
  super_admin: 'Super Admin', technician: 'Technician', parts_interpreter: 'Parts Interpreter',
  workshop_controller: 'Workshop Controller', service_advisor: 'Service Advisor',
  service_manager: 'Service Manager', admin: 'Administrator'
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const staffRole = user?.staff_role || 'technician';
  const isSuperAdmin = staffRole === 'super_admin';
  const RoleIcon = ROLE_ICONS[staffRole] || Wrench;

  return (
    <div className="min-h-screen bg-slate-50">
      <ActionRequiredBanner />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-xl"><Wrench className="h-5 w-5 text-white" /></div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-slate-900 text-lg leading-tight">My Workshop</h1>
                <p className="text-xs text-slate-500 -mt-0.5">Flow</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {user && <NotificationBell userEmail={user.email} userRole={staffRole} />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <RoleIcon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-slate-900 leading-tight">{user?.full_name || 'User'}</p>
                      <p className="text-xs text-slate-500">{ROLE_LABELS[staffRole]}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.full_name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {isSuperAdmin && (<>
                    <DropdownMenuItem asChild>
                      <Link to="/SuperAdminDashboard" className="cursor-pointer"><Shield className="h-4 w-4 mr-2 text-purple-600" />Super Admin Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>)}
                  {(staffRole === 'admin' || staffRole === 'service_manager') && (<>
                    <DropdownMenuItem asChild><Link to="/BusinessSettings" className="cursor-pointer"><Building2 className="h-4 w-4 mr-2" />Business Settings</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={createPageUrl("FollowUpReport")} className="cursor-pointer"><MessageSquare className="h-4 w-4 mr-2" />Follow-Up Report</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={createPageUrl("CleanupOrders")} className="cursor-pointer"><Archive className="h-4 w-4 mr-2" />Cleanup Orders</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>)}
                  {(staffRole === 'admin' || staffRole === 'super_admin') && (<>
                    <DropdownMenuItem asChild><Link to={createPageUrl("AdminStats")} className="cursor-pointer"><Shield className="h-4 w-4 mr-2" />Statistics Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>)}
                  {(staffRole === 'admin' || staffRole === 'super_admin') && (<>
                    <DropdownMenuItem asChild><Link to={createPageUrl("AdminUsers")} className="cursor-pointer"><Settings className="h-4 w-4 mr-2" />User Management</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={createPageUrl("TestingChecklist")} className="cursor-pointer"><ClipboardList className="h-4 w-4 mr-2" />Testing Checklist</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>)}
                  <DropdownMenuItem asChild><Link to={createPageUrl("SearchHistory")} className="cursor-pointer"><Search className="h-4 w-4 mr-2" />Job History Search</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer"><LogOut className="h-4 w-4 mr-2" />Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
