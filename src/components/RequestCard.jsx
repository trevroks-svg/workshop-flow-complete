import React from 'react';
import PrivateStorageLink from './PrivateStorageLink';
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Package, Clock, User, ChevronRight, Download } from "lucide-react";
import { createPageUrl } from "@/utils";
import StatusBadge from "./StatusBadge";
import ExpiryBadge from "./ExpiryBadge";
import { PART_TYPES } from "./PartsSelector";
import { formatDateTime } from "@/lib/dateUtils";

const isRecommendation = (request) =>
  request.approval_action === 'recommendation' ||
  request.status === 'advisor_action_required' ||
  request.status === 'recommendation_added';

export default function RequestCard({ request, showPdfLink = false }) {
  const getPartLabel = (partType) => {
    const found = PART_TYPES.find(p => p.value === partType);
    return found ? found.label : partType;
  };

  const partsPreview = request.parts?.slice(0, 3).map(p => getPartLabel(p.part_type)).join(", ");
  const moreCount = (request.parts?.length || 0) - 3;

  return (
    <Link to={createPageUrl(`RequestDetail?id=${request.id}`)}>
      <Card className={`p-4 hover:shadow-md transition-all duration-200 cursor-pointer group ${isRecommendation(request) ? 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-300' : 'bg-orange-50/40 border-orange-100 hover:border-orange-300'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-lg shrink-0 ${isRecommendation(request) ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                <Package className={`h-4 w-4 ${isRecommendation(request) ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">Job #{request.job_card_number}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isRecommendation(request) ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {isRecommendation(request) ? 'New Recommendation' : 'Upsell'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(request.created_date)}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 truncate mb-2">
              {partsPreview}
              {moreCount > 0 && <span className="text-slate-400"> +{moreCount} more</span>}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={request.status} />
              <ExpiryBadge createdDate={request.created_date} />
              {request.technician_name && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <User className="h-3 w-3" />
                  {request.technician_name}
                </div>
              )}
            </div>

            {showPdfLink && request.quote_pdf_url && (
              <div className="mt-2">
                <PrivateStorageLink
                  objectPath={request.quote_pdf_url}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 font-medium bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Download className="h-3 w-3" />
                  View Quote PDF
                </PrivateStorageLink>
              </div>
            )}
          </div>
          
          <ChevronRight className={`h-5 w-5 text-slate-300 transition-colors flex-shrink-0 mt-2 ${isRecommendation(request) ? 'group-hover:text-emerald-400' : 'group-hover:text-orange-400'}`} />
        </div>
      </Card>
    </Link>
  );
}
