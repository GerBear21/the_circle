/**
 * Data-Driven Approval Engine
 * 
 * This is the core engine that processes approval workflows.
 * Workflows are stored as data in the database, not as code.
 * 
 * Key concepts:
 * - WorkflowDefinition: The template/blueprint stored in DB
 * - WorkflowInstance: A running instance (the request + its steps)
 * - ApprovalEngine: The processor that executes the workflow logic
 */

import { supabaseAdmin } from './supabaseAdmin';
import { generateAndStoreArchive } from '@/pages/api/archives/generate-pdf';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  order: number;
  type: 'approval' | 'notification' | 'integration' | 'condition';
  
  // Approver configuration
  approverType: 'specific_user' | 'role' | 'department_head' | 'manager' | 'dynamic_field';
  approverValue?: string; // user_id, role_name, or field_name depending on approverType
  
  // Conditions for when this step should execute
  conditions?: StepCondition[];
  
  // Step-specific settings
  settings?: {
    requireComment?: boolean;
    allowDelegation?: boolean;
    autoApprove?: {
      enabled: boolean;
      condition: string;
      value: string;
    };
    escalation?: {
      enabled: boolean;
      hours: number;
      escalateTo?: string;
    };
    notifications?: {
      onAssignment: boolean;
      onApproval: boolean;
      onRejection: boolean;
    };
  };
  
  // For parallel approvals
  isParallel?: boolean;
  parallelGroup?: string;
  
  // Integration config (for notification/integration steps)
  integration?: {
    provider: 'email' | 'teams' | 'slack' | 'webhook';
    action: string;
    config: Record<string, any>;
  };
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'in';
  value: string | number;
  value2?: string | number; // For 'between' operator
}

export interface WorkflowDefinition {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  category?: string;
  form_schema: FormField[];
  steps: WorkflowStepDefinition[];
  settings: WorkflowSettings;
  is_active: boolean;
  version: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file' | 'currency';
  required: boolean;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface WorkflowSettings {
  allowParallelApprovals: boolean;
  requireAllParallel: boolean;
  allowSkipSteps: boolean;
  allowReassignment: boolean;
  expirationDays: number;
  onExpiration: 'escalate' | 'auto_approve' | 'auto_reject' | 'notify';
  notifyRequesterOnEachStep: boolean;
  allowWithdraw: boolean;
  requireAttachments: boolean;
}

export interface WorkflowInstance {
  requestId: string;
  workflowDefinitionId: string;
  organizationId: string;
  creatorId: string;
  formData: Record<string, any>;
  currentStepIndex: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'expired';
}

export interface StepInstance {
  id: string;
  requestId: string;
  stepIndex: number;
  stepDefinition: WorkflowStepDefinition;
  approverId: string | null;
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';
  dueAt?: string;
}

// ============================================================================
// Approval Engine Class
// ============================================================================

export class ApprovalEngine {
  
  /**
   * Get a workflow definition by ID
   */
  static async getWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
    const { data, error } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowId)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('Failed to fetch workflow definition:', error);
      return null;
    }
    
    return data as WorkflowDefinition;
  }
  
  /**
   * Get all active workflow definitions for an organization
   */
  static async getWorkflowDefinitions(organizationId: string): Promise<WorkflowDefinition[]> {
    const { data, error } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Failed to fetch workflow definitions:', error);
      return [];
    }
    
    return (data || []) as WorkflowDefinition[];
  }
  
  /**
   * Create a new request from a workflow definition
   * This is the main entry point for starting a workflow
   */
  static async createRequest(
    workflowDefinitionId: string,
    organizationId: string,
    creatorId: string,
    title: string,
    description: string | null,
    formData: Record<string, any>,
    status: 'draft' | 'pending' = 'draft'
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    
    // 1. Fetch the workflow definition
    const workflow = await this.getWorkflowDefinition(workflowDefinitionId);
    if (!workflow) {
      return { success: false, error: 'Workflow definition not found' };
    }
    
    // 2. Create the request record
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .insert({
        organization_id: organizationId,
        workflow_definition_id: workflowDefinitionId,
        creator_id: creatorId,
        title,
        description,
        status,
        metadata: {
          ...formData,
          workflow_name: workflow.name,
          workflow_category: workflow.category,
          total_steps: workflow.steps.filter(s => s.type === 'approval').length,
        },
      })
      .select()
      .single();
    
    if (requestError || !request) {
      console.error('Failed to create request:', requestError);
      return { success: false, error: 'Failed to create request' };
    }
    
    // 3. If submitting (not draft), create the workflow steps
    if (status === 'pending') {
      const stepsResult = await this.initializeWorkflowSteps(
        request.id,
        workflow,
        formData,
        organizationId,
        creatorId
      );
      
      if (!stepsResult.success) {
        // Rollback: delete the request
        await supabaseAdmin.from('requests').delete().eq('id', request.id);
        return { success: false, error: stepsResult.error };
      }
    }
    
    return { success: true, requestId: request.id };
  }
  
  /**
   * Initialize workflow steps for a request
   */
  static async initializeWorkflowSteps(
    requestId: string,
    workflow: WorkflowDefinition,
    formData: Record<string, any>,
    organizationId: string,
    creatorId: string
  ): Promise<{ success: boolean; error?: string }> {
    
    const approvalSteps = workflow.steps.filter(s => s.type === 'approval');
    const stepsToCreate: any[] = [];
    
    // Check if parallel approvals mode is enabled
    const useParallelApprovals = formData?.useParallelApprovals === true;
    
    for (let i = 0; i < approvalSteps.length; i++) {
      const stepDef = approvalSteps[i];
      
      // Check if step conditions are met
      if (stepDef.conditions && stepDef.conditions.length > 0) {
        const shouldInclude = this.evaluateConditions(stepDef.conditions, formData);
        if (!shouldInclude) {
          continue; // Skip this step
        }
      }
      
      // Resolve the approver
      const approverId = await this.resolveApprover(
        stepDef,
        formData,
        organizationId,
        creatorId
      );
      
      if (!approverId && stepDef.type === 'approval') {
        return { 
          success: false, 
          error: `Could not resolve approver for step: ${stepDef.name}` 
        };
      }
      
      // Calculate due date if escalation is configured
      let dueAt: string | null = null;
      if (stepDef.settings?.escalation?.enabled && stepDef.settings.escalation.hours) {
        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + stepDef.settings.escalation.hours);
        dueAt = dueDate.toISOString();
      }
      
      stepsToCreate.push({
        request_id: requestId,
        step_index: stepsToCreate.length + 1,
        step_type: stepDef.type,
        approver_user_id: approverId,
        approver_role: stepDef.approverType === 'role' ? stepDef.approverValue : null,
        // PARALLEL: All steps are pending; SEQUENTIAL: Only first step is pending
        status: useParallelApprovals ? 'pending' : (stepsToCreate.length === 0 ? 'pending' : 'waiting'),
        due_at: dueAt,
        step_definition: stepDef, // Store the step config snapshot
      });
    }
    
    if (stepsToCreate.length === 0) {
      return { success: false, error: 'No approval steps could be created' };
    }
    
    // Insert all steps
    const { error: stepsError } = await supabaseAdmin
      .from('request_steps')
      .insert(stepsToCreate);
    
    if (stepsError) {
      console.error('Failed to create request steps:', stepsError);
      return { success: false, error: 'Failed to create approval steps' };
    }
    
    if (useParallelApprovals) {
      // PARALLEL: Notify ALL approvers immediately
      for (const step of stepsToCreate) {
        await this.notifyApprover(
          requestId,
          step.approver_user_id,
          organizationId,
          creatorId,
          `New approval request requires your attention (Parallel approval - ${stepsToCreate.length} approvers)`
        );
      }
    } else {
      // SEQUENTIAL: Notify only the first approver
      await this.notifyApprover(
        requestId,
        stepsToCreate[0].approver_user_id,
        organizationId,
        creatorId,
        'New approval request requires your attention'
      );
    }
    
    return { success: true };
  }
  
  /**
   * Resolve the approver for a step based on approverType
   */
  static async resolveApprover(
    stepDef: WorkflowStepDefinition,
    formData: Record<string, any>,
    organizationId: string,
    creatorId: string
  ): Promise<string | null> {
    
    switch (stepDef.approverType) {
      case 'specific_user':
        return stepDef.approverValue || null;
      
      case 'role':
        // Find a user with this role in the organization
        const { data: roleUser } = await supabaseAdmin
          .from('app_users')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('role', stepDef.approverValue)
          .limit(1)
          .single();
        return roleUser?.id || null;
      
      case 'department_head':
        // Get the creator's department, then find the department head
        const { data: creator } = await supabaseAdmin
          .from('app_users')
          .select('department_id')
          .eq('id', creatorId)
          .single();
        
        if (creator?.department_id) {
          const { data: deptHead } = await supabaseAdmin
            .from('app_users')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('department_id', creator.department_id)
            .eq('is_department_head', true)
            .limit(1)
            .single();
          return deptHead?.id || null;
        }
        return null;
      
      case 'manager':
        // Get the creator's manager
        const { data: creatorWithManager } = await supabaseAdmin
          .from('app_users')
          .select('manager_id')
          .eq('id', creatorId)
          .single();
        return creatorWithManager?.manager_id || null;
      
      case 'dynamic_field':
        // The approver is specified in a form field
        const fieldName = stepDef.approverValue;
        if (fieldName && formData[fieldName]) {
          return formData[fieldName];
        }
        return null;
      
      default:
        return null;
    }
  }
  
  /**
   * Evaluate conditions against form data
   */
  static evaluateConditions(
    conditions: StepCondition[],
    formData: Record<string, any>
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }
    
    return conditions.every(condition => {
      const fieldValue = formData[condition.field];
      const targetValue = condition.value;
      const targetValue2 = condition.value2;
      
      switch (condition.operator) {
        case 'equals':
          return String(fieldValue) === String(targetValue);
        case 'not_equals':
          return String(fieldValue) !== String(targetValue);
        case 'greater_than':
          return Number(fieldValue) > Number(targetValue);
        case 'less_than':
          return Number(fieldValue) < Number(targetValue);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
        case 'between':
          const num = Number(fieldValue);
          return num >= Number(targetValue) && num <= Number(targetValue2 || targetValue);
        case 'in':
          const values = String(targetValue).split(',').map(v => v.trim());
          return values.includes(String(fieldValue));
        default:
          return true;
      }
    });
  }
  
  /**
   * Process an approval action (approve/reject)
   */
  static async processApprovalAction(
    requestId: string,
    stepId: string,
    userId: string,
    action: 'approve' | 'reject',
    comment?: string,
    signatureUrl?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    
    if (!supabaseAdmin) {
      console.error('supabaseAdmin is not initialized');
      return { success: false, error: 'Database connection not available' };
    }
    
    // 1. Verify the step belongs to this user and is actionable
    console.log('Looking up step:', { stepId, requestId, userId });
    
    // First, try to find the step by ID only to debug
    const { data: stepById, error: stepByIdError } = await supabaseAdmin
      .from('request_steps')
      .select('id, request_id, approver_user_id, status')
      .eq('id', stepId)
      .single();
    
    if (stepByIdError) {
      console.error('Step lookup by ID only failed:', JSON.stringify(stepByIdError, null, 2));
    } else {
      console.log('Step found by ID:', stepById);
      if (stepById.request_id !== requestId) {
        console.error('Request ID mismatch! Step belongs to:', stepById.request_id, 'but got:', requestId);
      }
    }
    
    const { data: step, error: stepError } = await supabaseAdmin
      .from('request_steps')
      .select('*')
      .eq('id', stepId)
      .eq('request_id', requestId)
      .single();
    
    if (stepError) {
      console.error('Step lookup error:', JSON.stringify(stepError, null, 2));
      // PGRST116 means no rows found
      if (stepError.code === 'PGRST116') {
        return { success: false, error: 'Approval step not found - step may not exist or does not belong to this request' };
      }
      return { success: false, error: `Database error: ${stepError.message}` };
    }
    
    if (!step) {
      console.error('Step not found - no data returned');
      return { success: false, error: 'Approval step not found' };
    }
    
    console.log('Found step:', { id: step.id, status: step.status, approver: step.approver_user_id });
    
    if (step.approver_user_id !== userId) {
      return { success: false, error: 'You are not authorized to act on this approval' };
    }
    
    if (step.status !== 'pending' && step.status !== 'waiting') {
      return { success: false, error: 'This approval step is no longer pending' };
    }
    
    // Check if previous steps are completed (for waiting status)
    if (step.status === 'waiting') {
      const { data: previousSteps } = await supabaseAdmin
        .from('request_steps')
        .select('status')
        .eq('request_id', requestId)
        .lt('step_index', step.step_index);
      
      const allPreviousApproved = !previousSteps || previousSteps.every(s => s.status === 'approved');
      if (!allPreviousApproved) {
        return { success: false, error: 'Previous approval steps must be completed first' };
      }
    }
    
    // Check if comment is required
    const stepDef = step.step_definition as WorkflowStepDefinition | null;
    if (action === 'reject' && !comment?.trim()) {
      return { success: false, error: 'Comment is required for rejection' };
    }
    if (stepDef?.settings?.requireComment && !comment?.trim()) {
      return { success: false, error: 'Comment is required for this step' };
    }
    
    const decision = action === 'approve' ? 'approved' : 'rejected';
    
    // 2. Record the approval decision
    const { error: approvalError } = await supabaseAdmin
      .from('approvals')
      .insert({
        request_id: requestId,
        step_id: stepId,
        approver_id: userId,
        decision,
        comment: comment || null,
        signature_url: signatureUrl || null,
      });
    
    if (approvalError) {
      console.error('Failed to create approval record:', approvalError);
      return { success: false, error: 'Failed to record approval decision' };
    }
    
    // 3. Update step status
    await supabaseAdmin
      .from('request_steps')
      .update({ status: decision })
      .eq('id', stepId);
    
    // 4. Handle next steps based on action
    if (action === 'approve') {
      return await this.handleApproval(requestId, step, userId);
    } else {
      return await this.handleRejection(requestId, step, userId);
    }
  }
  
  /**
   * Handle approval - activate next step or complete workflow
   */
  private static async handleApproval(
    requestId: string,
    currentStep: any,
    approverId: string
  ): Promise<{ success: boolean; message?: string }> {
    
    // Get request details for notification and to check parallel mode
    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('title, organization_id, creator_id, metadata')
      .eq('id', requestId)
      .single();
    
    // Get approver name for notification message
    const { data: approver } = await supabaseAdmin
      .from('app_users')
      .select('display_name')
      .eq('id', approverId)
      .single();
    
    const approverName = approver?.display_name || 'an approver';
    const isParallelApproval = request?.metadata?.useParallelApprovals === true;
    
    if (isParallelApproval) {
      // PARALLEL APPROVAL MODE: Check if all steps are now approved
      const { data: allSteps } = await supabaseAdmin
        .from('request_steps')
        .select('id, status')
        .eq('request_id', requestId);
      
      const pendingSteps = allSteps?.filter(s => s.status === 'pending') || [];
      const approvedSteps = allSteps?.filter(s => s.status === 'approved') || [];
      const totalSteps = allSteps?.length || 0;
      
      // Notify the requestor about this approval
      if (request) {
        await this.notifyRequester(
          requestId,
          request.creator_id,
          request.organization_id,
          `Your request "${request.title}" was approved by ${approverName} (${approvedSteps.length} of ${totalSteps} approvals received).`
        );
      }
      
      if (pendingSteps.length === 0) {
        // All approvers have approved - complete the workflow
        await supabaseAdmin
          .from('requests')
          .update({ status: 'approved' })
          .eq('id', requestId);
        
        if (request) {
          await this.notifyRequester(
            requestId,
            request.creator_id,
            request.organization_id,
            `Your request "${request.title}" has been fully approved! All ${totalSteps} approvers have approved.`
          );
          
          // Auto-generate and store PDF archive
          try {
            await generateAndStoreArchive(requestId, request.organization_id, approverId);
            console.log(`Archive generated for request ${requestId}`);
          } catch (archiveError) {
            console.error('Failed to generate archive:', archiveError);
          }
        }
        
        return { success: true, message: 'Request fully approved (parallel)' };
      }
      
      return { success: true, message: `Approved (${approvedSteps.length}/${totalSteps} approvals)` };
    }
    
    // SEQUENTIAL APPROVAL MODE (original logic)
    // Get the next step
    const { data: nextStep } = await supabaseAdmin
      .from('request_steps')
      .select('id, approver_user_id, status')
      .eq('request_id', requestId)
      .eq('step_index', currentStep.step_index + 1)
      .single();
    
    if (nextStep && nextStep.status === 'waiting') {
      // Activate the next step - SEQUENTIAL APPROVAL
      await supabaseAdmin
        .from('request_steps')
        .update({ status: 'pending' })
        .eq('id', nextStep.id);
      
      // Update current_step in request metadata
      const { data: currentRequest } = await supabaseAdmin
        .from('requests')
        .select('metadata')
        .eq('id', requestId)
        .single();
      
      if (currentRequest) {
        await supabaseAdmin
          .from('requests')
          .update({
            metadata: {
              ...currentRequest.metadata,
              current_step: currentStep.step_index + 1,
            }
          })
          .eq('id', requestId);
      }
      
      if (request && nextStep.approver_user_id) {
        // Get total steps for the notification message
        const { count: totalSteps } = await supabaseAdmin
          .from('request_steps')
          .select('id', { count: 'exact', head: true })
          .eq('request_id', requestId);
        
        const nextStepNumber = currentStep.step_index + 1;
        const stepsInfo = totalSteps ? ` (Step ${nextStepNumber} of ${totalSteps})` : '';
        
        // SEQUENTIAL NOTIFICATION: Notify the next approver only when their turn comes
        await this.notifyApprover(
          requestId,
          nextStep.approver_user_id,
          request.organization_id,
          approverId,
          `Request "${request.title}" is ready for your approval${stepsInfo}`
        );
        
        // Notify the requestor about this step approval
        await this.notifyRequester(
          requestId,
          request.creator_id,
          request.organization_id,
          `Your request "${request.title}" was approved by ${approverName} (Step ${currentStep.step_index}). Awaiting next approval.`
        );
      }
      
      return { success: true, message: 'Approved - next approver notified' };
    }
    
    // Check if all steps are completed
    const { data: incompleteSteps } = await supabaseAdmin
      .from('request_steps')
      .select('id')
      .eq('request_id', requestId)
      .in('status', ['pending', 'waiting']);
    
    if (!incompleteSteps || incompleteSteps.length === 0) {
      // All steps approved - complete the workflow
      await supabaseAdmin
        .from('requests')
        .update({ status: 'approved' })
        .eq('id', requestId);
      
      // Notify the requester (request already fetched above)
      if (request) {
        await this.notifyRequester(
          requestId,
          request.creator_id,
          request.organization_id,
          `Your request "${request.title}" has been fully approved by ${approverName}!`
        );
        
        // Auto-generate and store PDF archive
        try {
          await generateAndStoreArchive(requestId, request.organization_id, approverId);
          console.log(`Archive generated for request ${requestId}`);
        } catch (archiveError) {
          console.error('Failed to generate archive:', archiveError);
        }
      }
      
      return { success: true, message: 'Request fully approved' };
    }
    
    return { success: true, message: 'Approved' };
  }
  
  /**
   * Handle rejection - reject the entire request
   */
  private static async handleRejection(
    requestId: string,
    currentStep: any,
    rejecterId: string
  ): Promise<{ success: boolean; message?: string }> {
    
    // Update request status to rejected
    await supabaseAdmin
      .from('requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    // Notify the requester
    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('creator_id, organization_id, title')
      .eq('id', requestId)
      .single();
    
    if (request) {
      const { data: rejecter } = await supabaseAdmin
        .from('app_users')
        .select('display_name')
        .eq('id', rejecterId)
        .single();
      
      await this.notifyRequester(
        requestId,
        request.creator_id,
        request.organization_id,
        `Your request "${request.title}" was rejected by ${rejecter?.display_name || 'an approver'}`
      );
    }
    
    return { success: true, message: 'Request rejected' };
  }
  
  /**
   * Submit a draft request (start the workflow)
   */
  static async submitRequest(
    requestId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    
    // Get the request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('*, workflow_definition_id')
      .eq('id', requestId)
      .eq('creator_id', userId)
      .single();
    
    if (requestError || !request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.status !== 'draft') {
      return { success: false, error: 'Only draft requests can be submitted' };
    }
    
    if (!request.workflow_definition_id) {
      return { success: false, error: 'Request has no workflow definition' };
    }
    
    // Get the workflow definition
    const workflow = await this.getWorkflowDefinition(request.workflow_definition_id);
    if (!workflow) {
      return { success: false, error: 'Workflow definition not found' };
    }
    
    // Initialize workflow steps
    const stepsResult = await this.initializeWorkflowSteps(
      requestId,
      workflow,
      request.metadata || {},
      request.organization_id,
      userId
    );
    
    if (!stepsResult.success) {
      return { success: false, error: stepsResult.error };
    }
    
    // Update request status to pending
    await supabaseAdmin
      .from('requests')
      .update({ status: 'pending' })
      .eq('id', requestId);
    
    return { success: true };
  }
  
  /**
   * Withdraw a request
   */
  static async withdrawRequest(
    requestId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    
    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('creator_id, status, workflow_definition_id')
      .eq('id', requestId)
      .single();
    
    if (!request) {
      return { success: false, error: 'Request not found' };
    }
    
    if (request.creator_id !== userId) {
      return { success: false, error: 'Only the requester can withdraw' };
    }
    
    if (request.status !== 'pending' && request.status !== 'draft') {
      return { success: false, error: 'Cannot withdraw a completed request' };
    }
    
    // Check workflow settings
    if (request.workflow_definition_id) {
      const workflow = await this.getWorkflowDefinition(request.workflow_definition_id);
      if (workflow && !workflow.settings.allowWithdraw) {
        return { success: false, error: 'This workflow does not allow withdrawal' };
      }
    }
    
    await supabaseAdmin
      .from('requests')
      .update({ status: 'withdrawn' })
      .eq('id', requestId);
    
    return { success: true };
  }
  
  /**
   * Notify an approver about a pending request
   */
  private static async notifyApprover(
    requestId: string,
    approverId: string,
    organizationId: string,
    senderId: string,
    message: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          organization_id: organizationId,
          recipient_id: approverId,
          sender_id: senderId,
          type: 'task',
          title: 'Approval Required',
          message,
          metadata: {
            request_id: requestId,
            action_label: 'Review Request',
            action_url: `/requests/${requestId}`,
          },
          is_read: false,
        });
    } catch (error) {
      console.error('Failed to notify approver:', error);
    }
  }
  
  /**
   * Notify the requester about their request status
   */
  private static async notifyRequester(
    requestId: string,
    requesterId: string,
    organizationId: string,
    message: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          organization_id: organizationId,
          recipient_id: requesterId,
          type: 'info',
          title: 'Request Update',
          message,
          metadata: {
            request_id: requestId,
            action_label: 'View Request',
            action_url: `/requests/${requestId}`,
          },
          is_read: false,
        });
    } catch (error) {
      console.error('Failed to notify requester:', error);
    }
  }
}

export default ApprovalEngine;
