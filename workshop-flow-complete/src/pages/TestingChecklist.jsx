import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { entities } from '@/api/entities';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, CheckCircle2, Circle, AlertTriangle, Users, Database, 
  Play, Trash2, Loader2, ExternalLink, Shield, Wrench, Package, 
  ClipboardList, Headphones, UserCog
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

const TEST_ROLES = [
  { role: 'technician', label: 'Technician', icon: Wrench, email: 'test.technician@test.local' },
  { role: 'parts_interpreter', label: 'Parts Interpreter', icon: Package, email: 'test.parts@test.local' },
  { role: 'workshop_controller', label: 'Workshop Controller', icon: ClipboardList, email: 'test.workshop@test.local' },
  { role: 'service_advisor', label: 'Service Advisor', icon: Headphones, email: 'test.advisor@test.local' },
  { role: 'admin', label: 'Service Manager (Admin)', icon: Shield, email: 'test.manager@test.local' },
];

const QA_CHECKLIST = [
  {
    id: 'tech_create',
    role: 'technician',
    step: 1,
    title: 'Technician creates request',
    description: 'Create a new parts request with job card number and parts list',
    validations: [
      'Can access Dashboard',
      'Can see "New Request" button',
      'Can fill form and submit',
      'Request shows as "Draft" or "Sent to Parts"',
    ]
  },
  {
    id: 'parts_quote',
    role: 'parts_interpreter',
    step: 2,
    title: 'Parts Interpreter uploads quote',
    description: 'View request and upload PDF quote with total amount',
    validations: [
      'Can see requests with "Sent to Parts" status',
      'Can open request details',
      'Can upload PDF and enter quote total',
      'Status changes to "Quoted"',
    ]
  },
  {
    id: 'tech_forward',
    role: 'technician',
    step: 3,
    title: 'Technician forwards to Workshop',
    description: 'Review quote and forward for workshop approval',
    validations: [
      'Can see own request with quote attached',
      'Can view PDF quote',
      'Can forward to Workshop Controller',
      'Status changes to "Awaiting Workshop Approval"',
    ]
  },
  {
    id: 'workshop_approve',
    role: 'workshop_controller',
    step: 4,
    title: 'Workshop Controller approves',
    description: 'Review and approve the quoted request',
    validations: [
      'Can see requests awaiting approval',
      'Can view quote details',
      'Can approve request',
      'Status changes to "Approved"',
    ]
  },
  {
    id: 'advisor_send',
    role: 'service_advisor',
    step: 5,
    title: 'Service Advisor sends to customer',
    description: 'Send approved quote to customer for final approval',
    validations: [
      'Can see approved requests',
      'Can mark as "Sent to Customer"',
      'Status changes to "Sent to Customer"',
    ]
  },
  {
    id: 'advisor_record',
    role: 'service_advisor',
    step: 6,
    title: 'Advisor records customer approval',
    description: 'Record how customer approved (phone/email/SMS/in-person)',
    validations: [
      'Can select approval method',
      'Can record customer approval',
      'Status changes to "Customer Approved"',
      'Audit log shows complete history',
    ]
  },
];

export default function TestingChecklist() {
  const { user } = useAuth();
  const [checkedItems, setCheckedItems] = useState({});
  const [isCreatingTestData, setIsCreatingTestData] = useState(false);
  const [isDeletingTestData, setIsDeletingTestData] = useState(false);
  const queryClient = useQueryClient();

  

  const { data: testRequests = [] } = useQuery({
    queryKey: ['testRequests'],
    queryFn: async () => {
      const requests = await entities.PartsRequest.filter(
        { job_card_number: { $regex: '^TEST-' } },
        '-created_at',
        50
      );
      return requests;
    }
  });

  const isAdmin = user?.role === 'admin' || user?.staff_role === 'admin';

  const handleCheck = (itemId, validationIdx) => {
    const key = `${itemId}-${validationIdx}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isStepComplete = (stepId, validations) => {
    return validations.every((_, idx) => checkedItems[`${stepId}-${idx}`]);
  };

  const createTestData = async () => {
    setIsCreatingTestData(true);
    try {
      await entities.PartsRequest.bulkCreate([
        {
          job_card_number: 'TEST-001',
          status: 'sent_to_parts',
          parts: [{ part_type: 'brake_pads', quantity: 2 }],
          notes: '[TEST DATA] Sample request for testing Parts Interpreter flow',
          technician_email: 'test.technician@test.local',
          technician_name: 'Test Technician'
        },
        {
          job_card_number: 'TEST-002',
          status: 'quoted',
          parts: [{ part_type: 'oil_filter', quantity: 1 }, { part_type: 'air_filter', quantity: 1 }],
          notes: '[TEST DATA] Sample quoted request',
          quote_total: 450.00,
          technician_email: 'test.technician@test.local',
          technician_name: 'Test Technician'
        },
        {
          job_card_number: 'TEST-003',
          status: 'awaiting_workshop_approval',
          parts: [{ part_type: 'tyres', quantity: 4, tyre_size: '225/45R17' }],
          notes: '[TEST DATA] Awaiting workshop approval',
          quote_total: 1200.00,
          technician_email: 'test.technician@test.local',
          technician_name: 'Test Technician'
        },
        {
          job_card_number: 'TEST-004',
          status: 'sent_to_advisor',
          parts: [{ part_type: 'battery', quantity: 1 }],
          notes: '[TEST DATA] Ready for service advisor',
          quote_total: 320.00,
          technician_email: 'test.technician@test.local',
          technician_name: 'Test Technician'
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['testRequests'] });
      toast.success('Test data created successfully');
    } catch (error) {
      toast.error('Failed to create test data');
    } finally {
      setIsCreatingTestData(false);
    }
  };

  const deleteTestData = async () => {
    setIsDeletingTestData(true);
    try {
      for (const request of testRequests) {
        await entities.PartsRequest.delete(request.id);
      }
      queryClient.invalidateQueries({ queryKey: ['testRequests'] });
      queryClient.invalidateQueries({ queryKey: ['partsRequests'] });
      toast.success('Test data deleted');
    } catch (error) {
      toast.error('Failed to delete test data');
    } finally {
      setIsDeletingTestData(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Access Required</h2>
            <p className="text-slate-500">Only administrators can access the testing checklist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSteps = QA_CHECKLIST.filter(step => isStepComplete(step.id, step.validations)).length;
  const progressPercent = Math.round((completedSteps / QA_CHECKLIST.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Testing Checklist</h1>
            <p className="text-slate-500">QA validation for the parts ordering workflow</p>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Testing Progress</span>
              <span className="text-sm text-slate-500">{completedSteps} of {QA_CHECKLIST.length} steps</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Setup Section */}
        <div className="grid gap-6 mb-8">
          {/* Test Users Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Test Users Setup
              </CardTitle>
              <CardDescription>
                Create test accounts via Admin Users page, then assign these roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TEST_ROLES.map(({ role, label, icon: Icon, email }) => (
                  <div key={role} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{label}</p>
                      <p className="text-xs text-slate-500">{email}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link to={createPageUrl("AdminUsers")}>
                  <Button variant="outline" className="gap-2">
                    <UserCog className="h-4 w-4" />
                    Go to User Management
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Act As User Instructions */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                How to "Act as User"
              </CardTitle>
              <CardDescription>
                Test different roles by temporarily changing your staff_role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-900">
                  <p className="font-medium mb-2">To impersonate a role:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <strong>User Management</strong></li>
                    <li>Find your own account in the list</li>
                    <li>Change your <strong>Staff Role</strong> to the role you want to test</li>
                    <li>Refresh the page to see the new permissions</li>
                    <li>When done, switch back to <strong>Administrator</strong></li>
                  </ol>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Test Data */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Test Data Management
              </CardTitle>
              <CardDescription>
                Create sample requests prefixed with "TEST-" for safe testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg mb-4">
                <div>
                  <p className="font-medium text-slate-900">Test Requests</p>
                  <p className="text-sm text-slate-500">
                    {testRequests.length} test record(s) in database
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={createTestData} 
                    disabled={isCreatingTestData}
                    className="gap-2"
                  >
                    {isCreatingTestData ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Create Test Data
                  </Button>
                  {testRequests.length > 0 && (
                    <Button 
                      onClick={deleteTestData} 
                      disabled={isDeletingTestData}
                      variant="destructive"
                      className="gap-2"
                    >
                      {isDeletingTestData ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete All
                    </Button>
                  )}
                </div>
              </div>
              
              {testRequests.length > 0 && (
                <div className="space-y-2">
                  {testRequests.map(req => (
                    <Link 
                      key={req.id} 
                      to={createPageUrl(`RequestDetail?id=${req.id}`)}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <span className="font-medium text-slate-900">{req.job_card_number}</span>
                        <Badge variant="outline" className="ml-2">{req.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview URL */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Preview/Staging URL Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-slate-900 rounded-lg">
                <code className="text-emerald-400 text-sm">
                  localhost:5173
                </code>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Replace "your-app-name" with your actual app URL. The preview environment shares the same database.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* QA Checklist */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">Workflow QA Checklist</h2>
        <div className="space-y-4">
          {QA_CHECKLIST.map((step) => {
            const isComplete = isStepComplete(step.id, step.validations);
            const RoleIcon = TEST_ROLES.find(r => r.role === step.role)?.icon || Circle;
            
            return (
              <Card key={step.id} className={`border-0 shadow-sm ${isComplete ? 'ring-2 ring-emerald-500' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isComplete ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-slate-600">
                          {step.step}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{step.title}</CardTitle>
                        <Badge variant="outline" className="gap-1">
                          <RoleIcon className="h-3 w-3" />
                          {TEST_ROLES.find(r => r.role === step.role)?.label}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">{step.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="ml-10 space-y-2">
                    {step.validations.map((validation, idx) => (
                      <label 
                        key={idx}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checkedItems[`${step.id}-${idx}`] || false}
                          onCheckedChange={() => handleCheck(step.id, idx)}
                        />
                        <span className={`text-sm ${checkedItems[`${step.id}-${idx}`] ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                          {validation}
                        </span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Completion */}
        {completedSteps === QA_CHECKLIST.length && (
          <Card className="mt-6 border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-emerald-900">All Tests Passed!</h3>
              <p className="text-emerald-700">The workflow has been fully validated.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
