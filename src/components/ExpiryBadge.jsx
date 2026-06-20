import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";

export default function ExpiryBadge({ createdDate }) {
  const created = new Date(createdDate);
  const expiresAt = new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days
  const now = new Date();
  const isExpired = now > expiresAt;
  
  if (isExpired) {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Expired
      </Badge>
    );
  }
  
  const timeLeft = expiresAt - now;
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);
  
  let label;
  if (daysLeft > 1) {
    label = `Expires in ${daysLeft} days`;
  } else if (daysLeft === 1) {
    label = `Expires in 1 day`;
  } else if (hoursLeft > 1) {
    label = `Expires in ${hoursLeft} hours`;
  } else {
    label = `Expires soon`;
  }
  
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}