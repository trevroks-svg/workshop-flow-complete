import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle, AlertTriangle, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Uploads the daily job schedule CSV (DMS Report_CSV_Exports) to the server.
 * The schedule lets SMS drafts fill in the customer name and vehicle by
 * matching on Job Card. Import it each morning — it is replaced, not merged.
 */
export default function JobScheduleUploader() {
  const [status, setStatus] = useState(null); // { rows, inDates, importedAt }
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const csvText = await file.text();
      const apiResponse = await apiFetch('/api/job-schedule/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });
      const apiData = await apiResponse.json().catch(() => ({}));
      if (!apiResponse.ok || !apiData.success) {
        throw new Error(apiData.error || `Schedule import failed (${apiResponse.status})`);
      }
      setStatus({ rows: apiData.rowCount, inDates: apiData.inDates, importedAt: apiData.importedAt });
      if (apiData.errors?.length) {
        toast.warning(`Schedule imported with ${apiData.errors.length} skipped row(s).`);
      } else {
        toast.success(`Job schedule imported — ${apiData.rowCount} jobs`);
      }
    } catch (err) {
      setError(err.message || 'Schedule import failed');
      toast.error(`Schedule import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 h-8 px-3 text-sm font-medium border border-slate-200 bg-white rounded-md cursor-pointer hover:bg-slate-50">
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" disabled={uploading} />
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Importing…' : 'Upload daily job schedule (CSV)'}
        </label>
        <p className="text-xs text-slate-500">
          From the DMS daily export. Customer names and vehicles are matched by Job Card for SMS drafts.
        </p>
        {status && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            {status.rows} jobs
            {status.inDates?.length > 0 && (
              <span className="flex items-center gap-1 text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {status.inDates.join(', ')}
              </span>
            )}
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1.5 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            {error}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
