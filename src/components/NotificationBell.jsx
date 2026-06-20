import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, FileText, CheckCheck, Clock, Package, ClipboardList, AlertTriangle, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

function formatNotifDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

const TYPE_CONFIG = {
  new_request:        { icon: Package,       color: 'text-blue-600',   bg: 'bg-blue-100' },
  approval_required:  { icon: ClipboardList, color: 'text-amber-600',  bg: 'bg-amber-100' },
  approval_completed: { icon: CheckCheck,    color: 'text-emerald-600', bg: 'bg-emerald-100' },
  sent_to_customer:   { icon: FileText,      color: 'text-purple-600', bg: 'bg-purple-100' },
  customer_approved:  { icon: ThumbsUp,      color: 'text-emerald-600', bg: 'bg-emerald-100' },
  customer_denied:    { icon: ThumbsDown,    color: 'text-red-600',    bg: 'bg-red-100' },
  overdue:            { icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-100' },
  status_update:      { icon: FileText,      color: 'text-slate-600',  bg: 'bg-slate-100' },
  quote_returned:     { icon: FileText,      color: 'text-slate-600',  bg: 'bg-slate-100' },
};

export default function NotificationBell({ userEmail, userRole: rawUserRole }) {
  const { user } = useAuth();
  const userRole = rawUserRole === 'service_manager' ? 'service_advisor' : rawUserRole;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userEmail, userRole],
    queryFn: async () => {
      const byEmail = await entities.Notification.filter(
        { recipient_email: userEmail },
        '-created_at',
        30
      );
      const byRole = userRole ? await entities.Notification.filter(
        { recipient_role: userRole },
        '-created_at',
        30
      ) : [];
      const merged = [...byEmail, ...byRole];
      const unique = merged.filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
      return unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
    },
    enabled: !!userEmail,
    refetchInterval: 15000
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['partsRequests'],
    queryFn: () => entities.PartsRequest.list('-created_at', 100),
    refetchInterval: 15000,
    enabled: !!userEmail
  });

  const actionRequiredCount = requests.filter(req =>
    req.action_required === true &&
    req.action_required_role === userRole &&
    !req.is_archived
  ).length;

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalBadgeCount = unreadCount + actionRequiredCount;

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {totalBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-slate-900">Notifications</h4>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600 hover:text-blue-700 h-7 px-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><CheckCheck className="h-3 w-3 mr-1" />Mark all read</>
              }
            </Button>
          )}
        </div>

        {/* Action Required Banner */}
        {actionRequiredCount > 0 && (
          <div className="bg-red-50 border-b border-red-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-xs font-medium text-red-700">
                {actionRequiredCount} request{actionRequiredCount !== 1 ? 's' : ''} require your immediate action
              </p>
            </div>
          </div>
        )}

        {/* Notification List */}
        <ScrollArea className="h-[340px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.status_update;
                const Icon = cfg.icon;
                return (
                  <Link
                    key={notification.id}
                    to={notification.request_id ? createPageUrl(`RequestDetail?id=${notification.request_id}`) : "#"}
                    onClick={() => handleNotificationClick(notification)}
                    className={`block p-3 hover:bg-slate-50 transition-colors ${!notification.is_read ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${!notification.is_read ? cfg.bg : 'bg-slate-100'}`}>
                        <Icon className={`h-4 w-4 ${!notification.is_read ? cfg.color : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!notification.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatNotifDate(notification.created_at)}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}