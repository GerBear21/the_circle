-- Seed example workflow definitions
-- These are templates that can be used to create different types of approval requests
-- The key insight: workflows are DATA, not code!

-- Note: Replace 'YOUR_ORG_ID' and 'YOUR_USER_ID' with actual UUIDs when running

-- 1. CAPEX Approval Workflow
-- For capital expenditure requests with amount-based routing
INSERT INTO workflow_definitions (
    organization_id,
    created_by,
    name,
    description,
    category,
    form_schema,
    steps,
    settings
) VALUES (
    'YOUR_ORG_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'CAPEX Approval',
    'Capital expenditure approval workflow with amount-based routing',
    'capex',
    '[
        {"id": "project_name", "name": "project_name", "label": "Project Name", "type": "text", "required": true},
        {"id": "amount", "name": "amount", "label": "Amount", "type": "currency", "required": true},
        {"id": "justification", "name": "justification", "label": "Business Justification", "type": "textarea", "required": true},
        {"id": "expected_roi", "name": "expected_roi", "label": "Expected ROI (%)", "type": "number", "required": false},
        {"id": "vendor", "name": "vendor", "label": "Preferred Vendor", "type": "text", "required": false}
    ]'::jsonb,
    '[
        {
            "id": "step_1",
            "name": "Manager Approval",
            "order": 1,
            "type": "approval",
            "approverType": "manager",
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_2",
            "name": "Department Head Approval",
            "order": 2,
            "type": "approval",
            "approverType": "department_head",
            "conditions": [{"field": "amount", "operator": "greater_than", "value": 5000}],
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_3",
            "name": "Finance Director Approval",
            "order": 3,
            "type": "approval",
            "approverType": "role",
            "approverValue": "finance_director",
            "conditions": [{"field": "amount", "operator": "greater_than", "value": 25000}],
            "settings": {
                "requireComment": true,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_4",
            "name": "CEO Approval",
            "order": 4,
            "type": "approval",
            "approverType": "role",
            "approverValue": "ceo",
            "conditions": [{"field": "amount", "operator": "greater_than", "value": 100000}],
            "settings": {
                "requireComment": true,
                "escalation": {"enabled": true, "hours": 72},
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        }
    ]'::jsonb,
    '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 30,
        "onExpiration": "escalate",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": false
    }'::jsonb
);

-- 2. Travel Authorization Workflow
INSERT INTO workflow_definitions (
    organization_id,
    created_by,
    name,
    description,
    category,
    form_schema,
    steps,
    settings
) VALUES (
    'YOUR_ORG_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Travel Authorization',
    'Travel request approval for business trips',
    'travel',
    '[
        {"id": "destination", "name": "destination", "label": "Destination", "type": "text", "required": true},
        {"id": "travel_dates", "name": "travel_dates", "label": "Travel Dates", "type": "text", "required": true},
        {"id": "purpose", "name": "purpose", "label": "Purpose of Travel", "type": "textarea", "required": true},
        {"id": "estimated_cost", "name": "estimated_cost", "label": "Estimated Cost", "type": "currency", "required": true},
        {"id": "travel_type", "name": "travel_type", "label": "Travel Type", "type": "select", "required": true, "options": [
            {"label": "Local", "value": "local"},
            {"label": "Domestic", "value": "domestic"},
            {"label": "International", "value": "international"}
        ]}
    ]'::jsonb,
    '[
        {
            "id": "step_1",
            "name": "Manager Approval",
            "order": 1,
            "type": "approval",
            "approverType": "manager",
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_2",
            "name": "HR Approval",
            "order": 2,
            "type": "approval",
            "approverType": "role",
            "approverValue": "hr_manager",
            "conditions": [{"field": "travel_type", "operator": "equals", "value": "international"}],
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_3",
            "name": "Finance Approval",
            "order": 3,
            "type": "approval",
            "approverType": "role",
            "approverValue": "finance_manager",
            "conditions": [{"field": "estimated_cost", "operator": "greater_than", "value": 5000}],
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        }
    ]'::jsonb,
    '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 14,
        "onExpiration": "notify",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": false
    }'::jsonb
);

-- 3. Leave Request Workflow
INSERT INTO workflow_definitions (
    organization_id,
    created_by,
    name,
    description,
    category,
    form_schema,
    steps,
    settings
) VALUES (
    'YOUR_ORG_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Leave Request',
    'Employee leave/vacation request approval',
    'leave',
    '[
        {"id": "leave_type", "name": "leave_type", "label": "Leave Type", "type": "select", "required": true, "options": [
            {"label": "Annual Leave", "value": "annual"},
            {"label": "Sick Leave", "value": "sick"},
            {"label": "Personal Leave", "value": "personal"},
            {"label": "Maternity/Paternity", "value": "parental"},
            {"label": "Unpaid Leave", "value": "unpaid"}
        ]},
        {"id": "start_date", "name": "start_date", "label": "Start Date", "type": "date", "required": true},
        {"id": "end_date", "name": "end_date", "label": "End Date", "type": "date", "required": true},
        {"id": "days_requested", "name": "days_requested", "label": "Number of Days", "type": "number", "required": true},
        {"id": "reason", "name": "reason", "label": "Reason", "type": "textarea", "required": false}
    ]'::jsonb,
    '[
        {
            "id": "step_1",
            "name": "Manager Approval",
            "order": 1,
            "type": "approval",
            "approverType": "manager",
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_2",
            "name": "HR Acknowledgment",
            "order": 2,
            "type": "approval",
            "approverType": "role",
            "approverValue": "hr_manager",
            "conditions": [{"field": "days_requested", "operator": "greater_than", "value": 5}],
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        }
    ]'::jsonb,
    '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 7,
        "onExpiration": "notify",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": false
    }'::jsonb
);

-- 4. Procurement Request Workflow
INSERT INTO workflow_definitions (
    organization_id,
    created_by,
    name,
    description,
    category,
    form_schema,
    steps,
    settings
) VALUES (
    'YOUR_ORG_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Procurement Request',
    'Purchase requisition approval workflow',
    'procurement',
    '[
        {"id": "item_description", "name": "item_description", "label": "Item Description", "type": "textarea", "required": true},
        {"id": "quantity", "name": "quantity", "label": "Quantity", "type": "number", "required": true},
        {"id": "unit_price", "name": "unit_price", "label": "Unit Price", "type": "currency", "required": true},
        {"id": "total_amount", "name": "total_amount", "label": "Total Amount", "type": "currency", "required": true},
        {"id": "urgency", "name": "urgency", "label": "Urgency", "type": "select", "required": true, "options": [
            {"label": "Low", "value": "low"},
            {"label": "Medium", "value": "medium"},
            {"label": "High", "value": "high"},
            {"label": "Critical", "value": "critical"}
        ]},
        {"id": "vendor_name", "name": "vendor_name", "label": "Preferred Vendor", "type": "text", "required": false},
        {"id": "budget_code", "name": "budget_code", "label": "Budget Code", "type": "text", "required": true}
    ]'::jsonb,
    '[
        {
            "id": "step_1",
            "name": "Manager Approval",
            "order": 1,
            "type": "approval",
            "approverType": "manager",
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_2",
            "name": "Budget Holder Approval",
            "order": 2,
            "type": "approval",
            "approverType": "role",
            "approverValue": "budget_holder",
            "conditions": [{"field": "total_amount", "operator": "greater_than", "value": 1000}],
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_3",
            "name": "Procurement Team Review",
            "order": 3,
            "type": "approval",
            "approverType": "role",
            "approverValue": "procurement_officer",
            "settings": {
                "requireComment": true,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_4",
            "name": "Finance Approval",
            "order": 4,
            "type": "approval",
            "approverType": "role",
            "approverValue": "finance_manager",
            "conditions": [{"field": "total_amount", "operator": "greater_than", "value": 10000}],
            "settings": {
                "requireComment": true,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        }
    ]'::jsonb,
    '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 14,
        "onExpiration": "escalate",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": true
    }'::jsonb
);

-- 5. Hotel Booking Request (Complimentary)
INSERT INTO workflow_definitions (
    organization_id,
    created_by,
    name,
    description,
    category,
    form_schema,
    steps,
    settings
) VALUES (
    'YOUR_ORG_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Complimentary Hotel Booking',
    'Request for complimentary hotel room booking',
    'hospitality',
    '[
        {"id": "guest_name", "name": "guest_name", "label": "Guest Name", "type": "text", "required": true},
        {"id": "guest_company", "name": "guest_company", "label": "Guest Company/Organization", "type": "text", "required": false},
        {"id": "relationship", "name": "relationship", "label": "Relationship to Company", "type": "select", "required": true, "options": [
            {"label": "VIP Client", "value": "vip_client"},
            {"label": "Partner", "value": "partner"},
            {"label": "Government Official", "value": "government"},
            {"label": "Media", "value": "media"},
            {"label": "Other", "value": "other"}
        ]},
        {"id": "check_in", "name": "check_in", "label": "Check-in Date", "type": "date", "required": true},
        {"id": "check_out", "name": "check_out", "label": "Check-out Date", "type": "date", "required": true},
        {"id": "room_type", "name": "room_type", "label": "Room Type", "type": "select", "required": true, "options": [
            {"label": "Standard", "value": "standard"},
            {"label": "Deluxe", "value": "deluxe"},
            {"label": "Suite", "value": "suite"},
            {"label": "Executive Suite", "value": "executive"}
        ]},
        {"id": "justification", "name": "justification", "label": "Business Justification", "type": "textarea", "required": true}
    ]'::jsonb,
    '[
        {
            "id": "step_1",
            "name": "Department Head Approval",
            "order": 1,
            "type": "approval",
            "approverType": "department_head",
            "settings": {
                "requireComment": false,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        },
        {
            "id": "step_2",
            "name": "GM Approval",
            "order": 2,
            "type": "approval",
            "approverType": "role",
            "approverValue": "general_manager",
            "conditions": [{"field": "room_type", "operator": "in", "value": "suite,executive"}],
            "settings": {
                "requireComment": true,
                "notifications": {"onAssignment": true, "onApproval": true, "onRejection": true}
            }
        }
    ]'::jsonb,
    '{
        "allowParallelApprovals": false,
        "requireAllParallel": true,
        "allowSkipSteps": false,
        "allowReassignment": true,
        "expirationDays": 3,
        "onExpiration": "notify",
        "notifyRequesterOnEachStep": true,
        "allowWithdraw": true,
        "requireAttachments": false
    }'::jsonb
);
