import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Copy, CheckCircle2, XCircle, Clock, RefreshCw, Loader2, Wrench, FileText, PhoneCall, AlertTriangle, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dateUtils";
import { analyseRepairs } from "@/lib/analyseRepairs";

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PART_TYPE_LABELS = {
  air_filter: "Air Filter", pollen_filter: "Pollen Filter", battery: "Battery",
  wiper_blades: "Wiper Blades", front_pads: "Front Brake Pads", rear_pads: "Rear Brake Pads",
  front_rotors: "Front Rotors", rear_rotors: "Rear Rotors", tyres: "Tyres", tyre: "Tyre", other: "Other"
};

function getPartsDescription(parts = []) {
  return parts
    .map(p => {
      if (p.part_type === 'tyre' || p.part_type === 'tyres') return `${p.quantity || 1}x Tyre (${p.tyre_size || 'unknown size'})`;
      if (p.part_type === 'other') return `${p.quantity || 1}x ${p.other_description || 'Other'}`;
      return `${p.quantity || 1}x ${PART_TYPE_LABELS[p.part_type] || p.part_type?.replace(/_/g, ' ') || 'Part'}`;
    })
    .join(', ');
}

function SMSRow({ request, user, labourRate, onFollowUpDone }) {
  const [sms, setSms] = useState('');
  const [groups, setGroups] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingFollowUp, setConfirmingFollowUp] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [analysisWarning, setAnalysisWarning] = useState(null);

  const loading = analysing || generating;
  const customerName = request.customer_name || 'the customer';
  const jobCard = request.job_card_number;
  const vehicle = request.vehicle_type || 'your vehicle';
  const decisionDate = formatDate(request.customer_decision_recorded_at);
  const type = request.status === 'customer_denied' ? 'declined' : 'unactioned';
  const situation = type === 'declined'
    ? `The customer previously declined this work on ${decisionDate}. We are following up to see if they've reconsidered.`
    : 'The customer has not yet responded to our recommendation. We are following up.';

  const partsText = getPartsDescription(request.parts);

  const updateLabour = (i, val) => {
    setGroups(prev => prev.map((g, idx) =>
      idx === i ? { ...g, labour_hours: val === '' ? null : parseFloat(val), labour_overridden: true } : g
    ));
  };

  // Step 1: Analyse repairs using shared analyseRepairs utility
  const runAnalysis = async () => {
    setAnalysing(true);
    setAnalysisWarning(null);
    const { groups: initialised, pdfReadable, notesUsed } = await analyseRepairs(request, partsText);

    if (!pdfReadable && !notesUsed) {
      setAnalysisWarning("PDF could not be read and no Parts Interpreter notes found. Parts prices are shown as TBC.");
    } else if (!pdfReadable && notesUsed) {
      setAnalysisWarning("PDF was blank — prices extracted from Parts Interpreter notes.");
    }

    setGroups(initialised);
    setAnalysing(false);
    return initialised;
  };

  // Step 2: Generate SMS from groups with proper parts + labour cost calculation
  const generateSms = async (groupsToUse) => {
    setGenerating(true);
    const gst = 1.1;

    const repairLines = groupsToUse.map(g => {
      const partsExGst = g.parts_cost_ex_gst;
      const labourHours = g.labour_hours;
      const labourExGst = labourHours != null ? labourHours * labourRate : null;
      const labourIncGst = labourExGst != null ? labourExGst * gst : null;
      const partsIncGst = partsExGst != null ? partsExGst * gst : null;
      const totalIncGst = (partsExGst != null && labourExGst != null)
        ? ((partsExGst + labourExGst) * gst).toFixed(2)
        : null;

      return `Repair: ${g.repair_name}
  Parts: ${g.parts.join(', ')}
  Parts cost (ex GST): ${partsExGst != null ? `$${partsExGst.toFixed(2)}` : 'TBC'}
  Parts cost (inc GST): ${partsIncGst != null ? `$${partsIncGst.toFixed(2)}` : 'TBC'}
  Labour: ${labourHours != null ? `${labourHours}h @ $${labourRate}/h ex GST = $${labourIncGst?.toFixed(2)} inc GST` : 'not specified'}
  Total (inc GST): ${totalIncGst ? `$${totalIncGst}` : 'TBC'}`;
    }).join('\n\n');

    const knownGroups = groupsToUse.filter(g => g.parts_cost_ex_gst != null && g.labour_hours != null);
    const grandTotalIncGst = knownGroups.length === groupsToUse.length
      ? (groupsToUse.reduce((sum, g) => sum + (g.parts_cost_ex_gst + g.labour_hours * labourRate), 0) * gst).toFixed(2)
      : null;
    const anyPriceKnown = groupsToUse.some(g => g.parts_cost_ex_gst != null || g.labour_hours != null);

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    });
    const apiData = await apiResponse.json();
    const smsResult = { content: apiData.content?.[0]?.text || '' };

    setSms(smsResult);
    setGenerating(false);
  };

  const analyse = async () => {
    const g = await runAnalysis();
    await generateSms(g);
  };

  const copy = () => {
    navigator.clipboard.writeText(sms);
    setCopied(true);
    toast.success('SMS copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmFollowUp = async () => {
    setSavingFollowUp(true);
    await entities.PartsRequest.update(request.id, {
      follow_up_completed: true,
      follow_up_completed_at: new Date().toISOString(),
      follow_up_completed_by: user?.email,
      follow_up_completed_by_name: user?.full_name,
      follow_up_notes: followUpNotes.trim() || undefined,
    });
    toast.success('Follow-up confirmed');
    setSavingFollowUp(false);
    onFollowUpDone();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-slate-900">{jobCard}</span>
              {request.status === 'customer_denied' ? (
                <Badge className="bg-red-100 text-red-700 border-0">Declined</Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-0">No Response</Badge>
              )}
              {request.quote_pdf_url && (
                <a href={request.quote_pdf_url} target="_blank" rel="noopener noreferrer">
                  <Badge className="bg-blue-100 text-blue-700 border-0 gap-1 cursor-pointer hover:bg-blue-200">
                    <FileText className="h-3 w-3" /> PDF Quote
                  </Badge>
                </a>
              )}
            </div>
            <div className="text-sm text-slate-600 space-y-0.5">
              {request.customer_name && <p><span className="text-slate-400">Customer:</span> {request.customer_name}</p>}
              {request.vehicle_type && <p><span className="text-slate-400">Vehicle:</span> {request.vehicle_type}</p>}
              <p><span className="text-slate-400">Parts:</span> {partsText || '—'}</p>
              {type === 'declined' && request.customer_decision_recorded_at && (
                <p><span className="text-slate-400">Declined on:</span> {decisionDate}</p>
              )}
              {request.customer_decision_notes && (
                <p><span className="text-slate-400">Note:</span> {request.customer_decision_notes}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap shrink-0">
            {!groups && (
              <Button
                size="sm"
                onClick={analyse}
                disabled={loading}
                className="gap-2 bg-slate-900 hover:bg-slate-800"
              >
                {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {analysing ? 'Analysing...' : generating ? 'Generating...' : 'Generate SMS'}
              </Button>
            )}
            {groups && (
              <Button
                size="sm"
                variant="outline"
                onClick={runAnalysis}
                disabled={loading}
                className="gap-2"
              >
                {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-analyse
              </Button>
            )}
          </div>
        </div>

        {/* Analysis warning banner */}
        {analysisWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>{analysisWarning}</span>
          </div>
        )}

        {/* Repair groups with editable labour */}
        {groups && groups.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {groups.length} repair job{groups.length !== 1 ? 's' : ''} identified — adjust labour if needed
            </div>
            <div className="divide-y divide-slate-100">
              {groups.map((g, i) => {
                const partsExGst = g.parts_cost_ex_gst;
                const labourHours = g.labour_hours;
                const labourExGst = labourHours != null ? labourHours * labourRate : null;
                const partsIncGst = partsExGst != null ? partsExGst * 1.1 : null;
                const labourIncGst = labourExGst != null ? labourExGst * 1.1 : null;
                const totalIncGst = (partsExGst != null && labourExGst != null)
                  ? ((partsExGst + labourExGst) * 1.1) : null;

                return (
                  <div key={i} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-700 font-medium text-sm">{g.repair_name}</span>
                      </div>
                      {totalIncGst != null
                        ? <span className="text-slate-700 font-semibold text-sm">${totalIncGst.toFixed(2)} inc GST</span>
                        : <span className="text-slate-400 text-xs">price TBC</span>
                      }
                    </div>
                    <p className="text-xs text-slate-400 ml-5">{(g.parts || []).join(' · ')}</p>
                    <div className="flex items-center gap-2 ml-5 flex-wrap">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">Labour hrs</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.25"
                        value={g.labour_hours ?? ''}
                        onChange={e => updateLabour(i, e.target.value)}
                        className="w-20 h-7 text-sm"
                        placeholder="hrs"
                      />
                      {!g.labour_overridden && g.estimated_labour_hours != null && (
                        <span className="text-xs text-slate-400">AI: {g.estimated_labour_hours}h</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {partsIncGst != null && `Parts: $${partsIncGst.toFixed(2)}`}
                        {partsIncGst != null && labourIncGst != null && ' · '}
                        {labourIncGst != null && `Labour: $${labourIncGst.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate SMS button shown after groups are ready */}
        {groups && (
          <Button
            size="sm"
            onClick={() => generateSms(groups)}
            disabled={loading}
            className="gap-2 bg-slate-900 hover:bg-slate-800"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {generating ? 'Generating SMS...' : sms ? 'Regenerate SMS' : 'Generate SMS'}
          </Button>
        )}

        {/* Single SMS output */}
        {sms && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Generated SMS</p>
            <textarea
              className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
              rows={5}
              value={sms}
              onChange={e => setSms(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 flex-1">
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy SMS'}
              </Button>
            </div>
            <p className="text-xs text-slate-400">{sms.length} characters</p>
          </div>
        )}

        {/* Follow-up confirmation */}
        {!request.follow_up_completed && (
          confirmingFollowUp ? (
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-emerald-800">Confirm follow-up was completed</p>
              <textarea
                className="w-full text-sm border border-emerald-200 rounded-lg p-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                rows={2}
                placeholder="Optional: add a note (e.g. 'Left voicemail', 'Spoke to customer')"
                value={followUpNotes}
                onChange={e => setFollowUpNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmFollowUp} disabled={savingFollowUp} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white flex-1">
                  {savingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Yes, follow-up done
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingFollowUp(false)} className="text-slate-500">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingFollowUp(true)}
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 w-full"
            >
              <PhoneCall className="h-4 w-4" />
              Mark Follow-Up as Completed
            </Button>
          )
        )}

        {/* Already followed up banner */}
        {request.follow_up_completed && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Followed up by <strong>{request.follow_up_completed_by_name || request.follow_up_completed_by}</strong> on {formatDateTime(request.follow_up_completed_at)}
              {request.follow_up_notes && <> — "{request.follow_up_notes}"</>}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FollowUpReport() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('both'); // 'declined', 'unactioned', 'both'
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const queryClient = useQueryClient();

  

  const businessId = user?.business_id || null;
  const { data: business } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => entities.Business.filter({ id: businessId }).then(r => r[0] || null),
    enabled: !!businessId
  });
  const labourRate = business?.default_labour_rate || 110;

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ['followUpRequests'],
    queryFn: () => entities.PartsRequest.list('-updated_at', 500),
    enabled: !!user
  });

  const handleFollowUpDone = () => {
    queryClient.invalidateQueries({ queryKey: ['followUpRequests'] });
  };

  if (!user || (user.staff_role !== 'admin' && user.role !== 'admin' && user.staff_role !== 'service_manager')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-600">Administrator or Service Manager access required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Declined: customer explicitly said no
  const declined = allRequests.filter(r =>
    !r.is_archived && r.status === 'customer_denied'
  );

  // Unactioned: sent to customer but never got a response (still sitting at sent_to_customer)
  const unactioned = allRequests.filter(r =>
    !r.is_archived && r.status === 'sent_to_customer'
  );

  const baseFiltered =
    filter === 'declined' ? declined :
    filter === 'unactioned' ? unactioned :
    [...declined, ...unactioned].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  // Build month options from baseFiltered records
  const monthOptions = Array.from(
    new Set(baseFiltered.map(r => {
      const d = new Date(r.updated_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))
  ).sort((a, b) => b.localeCompare(a));

  const allFiltered = selectedMonth === 'all'
    ? baseFiltered
    : baseFiltered.filter(r => {
        const d = new Date(r.updated_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedMonth;
      });

  const completedCount = allFiltered.filter(r => r.follow_up_completed).length;
  const displayList = showCompleted ? allFiltered : allFiltered.filter(r => !r.follow_up_completed);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Follow-Up Report</h1>
          <p className="text-slate-500 mt-1">Declined & unactioned work — generate SMS reminders for each customer</p>
        </div>

        {/* Filter + Summary */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filter === 'both' ? 'default' : 'outline'}
              onClick={() => setFilter('both')}
              className="gap-1.5"
            >
              All ({declined.length + unactioned.length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'declined' ? 'default' : 'outline'}
              onClick={() => setFilter('declined')}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              Declined ({declined.length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'unactioned' ? 'default' : 'outline'}
              onClick={() => setFilter('unactioned')}
              className="gap-1.5"
            >
              <Clock className="h-4 w-4" />
              No Response ({unactioned.length})
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {monthOptions.map(m => {
                  const [year, month] = m.split('-');
                  const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
                  return <SelectItem key={m} value={m}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          {completedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCompleted(v => !v)}
              className="gap-1.5 text-slate-500"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {showCompleted ? `Hide` : `Show`} completed ({completedCount})
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : displayList.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">All clear!</h3>
              <p className="text-slate-500">No declined or unactioned work to follow up on.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayList.map(request => (
              <SMSRow key={request.id} request={request} user={user} labourRate={labourRate} onFollowUpDone={handleFollowUpDone} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
