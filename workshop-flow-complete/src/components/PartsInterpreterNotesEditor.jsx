import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Edit, Loader2 } from "lucide-react";

export default function PartsInterpreterNotesEditor({ request, user, onUpdate }) {
  const [isEditing, setIsEditing] = useState(!request.parts_interpreter_notes);
  const [notes, setNotes] = useState(request.parts_interpreter_notes || '');
  const queryClient = useQueryClient();

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      await entities.PartsRequest.update(request.id, {
        parts_interpreter_notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsRequest', request.id]);
      toast.success("Notes saved successfully");
      setIsEditing(false);
      if (onUpdate) onUpdate();
    },
    onError: () => {
      toast.error("Failed to save notes");
    }
  });

  if (!isEditing && request.parts_interpreter_notes) {
    return (
      <div>
        <p className="text-purple-800 whitespace-pre-wrap mb-3">{request.parts_interpreter_notes}</p>
        <Button
          onClick={() => setIsEditing(true)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Edit className="h-3 w-3" />
          Edit Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Add notes about this quote (e.g., special pricing, availability, substitutions, etc.)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="bg-white"
      />
      <div className="flex gap-2">
        <Button
          onClick={() => saveNotesMutation.mutate()}
          disabled={saveNotesMutation.isPending || !notes.trim()}
          size="sm"
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {saveNotesMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Save Notes
        </Button>
        {request.parts_interpreter_notes && (
          <Button
            onClick={() => {
              setNotes(request.parts_interpreter_notes);
              setIsEditing(false);
            }}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}