import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { AlertCircle, X } from "lucide-react";
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function ActionRequiredBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);

  

  const { data: requests = [] } = useQuery({
    queryKey: ['partsRequests'],
    queryFn: () => entities.PartsRequest.list('-created_at', 100),
    refetchInterval: 10000,
    enabled: !!user
  });

  if (!user || dismissed) return null;

  const staffRole = user.staff_role || 'technician';

  // Count action-required items for this role
  const actionRequiredCount = requests.filter(req => 
    req.action_required === true && 
    req.action_required_role === staffRole &&
    !req.is_archived
  ).length;

  if (actionRequiredCount === 0) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                You have {actionRequiredCount} request{actionRequiredCount !== 1 ? 's' : ''} requiring immediate action
              </p>
            </div>
            <Link to={createPageUrl("Dashboard") + "?filter=actions_required"}>
              <Button variant="secondary" size="sm">
                View Now
              </Button>
            </Link>
          </div>
          <button 
            onClick={() => setDismissed(true)}
            className="ml-4 p-1 hover:bg-red-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}