import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerDecisionDialog({ 
  open, 
  onOpenChange, 
  request, 
  decision, 
  user 
}) {
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const recordDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!method) {
        throw new Error("Decision method is required");
      }

      const newStatus = decision === 'approved' ? 'customer_approved' : 'customer_denied';
      const now = new Date().toISOString();

      // Update request with decision details
      await entities.PartsRequest.update(request.id, {
        status: newStatus,
        customer_decision: decision,
        customer_decision_method: method,
        customer_decision_notes: notes,
        customer_decision_recorded_by: user.email,
        customer_decision_recorded_at: now,
        audit_log: [
          ...(request.audit_log || []),
          {
            previous_status: request.status,
            new_status: newStatus,
            changed_by_email: user.email,
            changed_by_name: user.full_name,
            changed_at: now,
            notes: `Customer decision: ${decision}. Method: ${method}. ${notes ? `Notes: ${notes}` : ''}`
          }
        ]
      });

      // Create notification for workshop controller
      await entities.Notification.create({
        business_id: request.business_id,
        recipient_email: request.workshop_controller_email,
        recipient_role: 'workshop_controller',
        type: decision === 'approved' ? 'customer_approved' : 'customer_decision_recorded',
        title: `Customer ${decision === 'approved' ? 'Approved' : 'Denied'} Quote`,
        message: `Customer has ${decision} the quote for job card ${request.job_card_number}. Method: ${method}`,
        request_id: request.id,
        job_card_number: request.job_card_number
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partsRequest', request.id] });
      queryClient.invalidateQueries({ queryKey: ['partsRequests'] });
      toast.success(`Customer decision recorded: ${decision}`);
      onOpenChange(false);
      setMethod("");
      setNotes("");
    },
    onError: (error) => {
      toast.error(`Failed to record decision: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!method) {
      toast.error("Please select a decision method");
      return;
    }
    recordDecisionMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Record Customer {decision === 'approved' ? 'Approval' : 'Denial'}
          </DialogTitle>
          <DialogDescription>
            Record how the customer's decision was communicated for job card {request?.job_card_number}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="method">Decision Method *</Label>
              <Select value={method} onValueChange={setMethod} required>
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about the decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={recordDecisionMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!method || recordDecisionMutation.isPending}
              className={decision === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {recordDecisionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Record {decision === 'approved' ? 'Approval' : 'Denial'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
