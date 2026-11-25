import { Badge } from "@/components/ui/badge";

const statusConfig = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  sent_to_parts: { label: "Sent to Parts", className: "bg-blue-100 text-blue-700 border-blue-200" },
  quoted: { label: "Quoted", className: "bg-purple-100 text-purple-700 border-purple-200" },
  awaiting_workshop_approval: { label: "Awaiting Approval", className: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  sent_to_advisor: { label: "Sent to Advisor", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  advisor_action_required: { label: "Advisor Action Required", className: "bg-blue-100 text-blue-700 border-blue-200" },
  recommendation_added: { label: "Recommendation Added", className: "bg-teal-100 text-teal-700 border-teal-200" },
  sent_to_customer: { label: "Sent to Customer", className: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  customer_approved: { label: "Customer Approved", className: "bg-green-100 text-green-700 border-green-200" },
  customer_denied: { label: "Customer Denied", className: "bg-red-100 text-red-700 border-red-200" },
  returned_to_workshop_controller: { label: "Returned to Workshop", className: "bg-orange-100 text-orange-700 border-orange-200" }
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  
  return (
    <Badge variant="outline" className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}