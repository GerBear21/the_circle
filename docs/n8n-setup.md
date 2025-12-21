# n8n Integration Guide

## Overview
We are using n8n as the backbone for automation and business logic in **The Circle**. 
This allows us to visually manage workflows for:
- Form Approvals
- Notifications
- Data Processing
- External Integrations (Teams, Slack, Outlook, etc.)

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│   The Circle    │      │   Workflow       │      │    n8n      │
│   Frontend      │─────▶│   Executor       │─────▶│   Webhook   │
│                 │      │   (API)          │      │             │
└─────────────────┘      └──────────────────┘      └─────────────┘
                                  │                       │
                                  │                       │
                                  ▼                       ▼
                         ┌──────────────────┐     ┌─────────────┐
                         │   Supabase       │     │  Callback   │
                         │   (Workflows DB) │◀────│  Webhook    │
                         └──────────────────┘     └─────────────┘
```

## Getting Started

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# n8n Configuration
N8N_BASE_URL=http://localhost:5678

# Optional: Shared secret for webhook verification
N8N_WEBHOOK_SECRET=your-secret-key-here
```

### 2. Run n8n Locally

**Option A: Using npm (Recommended for Development)**

The simplest way to run n8n is via npx - no installation required:

```bash
# Run n8n directly (will download if not installed)
npx n8n

# Or install globally
npm install -g n8n
n8n start
```

n8n will be available at: http://localhost:5678

**Option B: Using Docker (For Production-like Environment)**

We have added a `docker-compose.yml` file to the project root:

```bash
docker-compose up -d
```

### 3. Database Setup (Optional)

To enable workflow execution logging, create this table in Supabase:

```sql
CREATE TABLE workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  request_id UUID REFERENCES requests(id),
  action TEXT NOT NULL,
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_workflow_executions_request ON workflow_executions(request_id);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
```

## Usage

### Triggering n8n from The Circle

#### Method 1: Using the React Hook

```typescript
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';

function MyComponent() {
  const { startWorkflow, isLoading, error, results } = useWorkflowExecution({
    onSuccess: (results) => console.log('Workflow started:', results),
    onError: (error) => console.error('Workflow failed:', error),
  });

  const handleSubmit = async () => {
    await startWorkflow({
      workflowId: 'your-workflow-uuid',
      requestId: 'your-request-uuid',
      requestData: {
        amount: 1500,
        category: 'Travel',
        // ... any form data
      },
    });
  };
}
```

#### Method 2: Direct API Call

```typescript
const response = await fetch('/api/workflows/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'start',
    workflowId: 'your-workflow-uuid',
    requestId: 'your-request-uuid',
    requestData: { /* form data */ },
  }),
});
```

#### Method 3: Direct n8n Trigger (Low-Level)

```typescript
import { triggerN8nWorkflow } from '@/lib/n8n';

const result = await triggerN8nWorkflow('my-workflow-slug', 'POST', {
  formId: 123,
  userId: currentUser.id,
  data: formData
});

if (result.success) {
  console.log('n8n response:', result.data);
} else {
  console.error('n8n error:', result.error);
}
```

### Receiving Callbacks from n8n

n8n can send data back to The Circle using the callback webhook:

**Endpoint:** `POST /api/webhooks/n8n`

**Payload Format:**
```json
{
  "event": "workflow_complete",
  "requestId": "uuid-of-the-request",
  "workflowSlug": "my-workflow",
  "data": {
    "result": "approved",
    "processedBy": "automation"
  },
  "secret": "your-webhook-secret"
}
```

**Event Types:**
- `workflow_complete` - Workflow finished successfully
- `step_complete` - Individual step completed
- `error` - Workflow encountered an error
- `custom` - Custom events for any purpose

## Creating n8n Workflows

### Basic Webhook Workflow

1. In n8n, create a new workflow
2. Add a **Webhook** node as the trigger
3. Set the HTTP Method to POST
4. Copy the webhook URL (e.g., `http://localhost:5678/webhook/my-workflow`)
5. Use the slug `my-workflow` in your integration configuration

### Example: Approval Notification Workflow

```
[Webhook Trigger] → [Send Email] → [Update Database] → [Send Slack Message]
```

### Connecting to Supabase

1. In n8n, go to Credentials
2. Add new **Supabase** credentials
3. Enter your Supabase URL and Service Role Key
4. Use the Supabase node to read/write data

### Sending Callbacks to The Circle

Add an **HTTP Request** node at the end of your workflow:

- **Method:** POST
- **URL:** `http://your-app-url/api/webhooks/n8n`
- **Body (JSON):**
```json
{
  "event": "workflow_complete",
  "requestId": "{{ $json.requestId }}",
  "workflowSlug": "my-workflow",
  "data": {
    "status": "processed",
    "timestamp": "{{ $now }}"
  },
  "secret": "your-webhook-secret"
}
```

## Integration Types

The workflow builder supports these integration types:

| Provider | Actions | Configuration |
|----------|---------|---------------|
| **n8n** | Trigger Workflow | Workflow ID / Webhook Slug |
| **Teams** | Send Channel Message, Send DM | Teams Incoming Webhook URL |
| **Slack** | Send Channel Message, Send DM | Slack Incoming Webhook URL |
| **Outlook** | Send Email, Create Event | Email Address (requires Graph API) |
| **Webhook** | POST Request | Target URL |

## Project Structure

```
the_circle/
├── docker-compose.yml          # n8n Docker configuration
├── lib/
│   ├── n8n.ts                  # n8n webhook helper functions
│   └── workflowExecutor.ts     # Workflow execution engine
├── hooks/
│   └── useWorkflowExecution.ts # React hook for workflows
├── pages/api/
│   ├── workflows/
│   │   ├── index.ts            # Create/save workflows
│   │   └── execute.ts          # Execute workflows
│   └── webhooks/
│       └── n8n.ts              # Callback handler for n8n
├── n8n/
│   └── local_files/            # Shared files with n8n container
└── docs/
    └── n8n-setup.md            # This documentation
```

## Troubleshooting

### n8n not reachable
- Ensure Docker is running: `docker ps`
- Check n8n logs: `docker-compose logs n8n`
- Verify N8N_BASE_URL in .env.local

### Webhooks not triggering
- Check the webhook URL in n8n settings
- Ensure the workflow is active (toggle in n8n)
- Check browser/server console for errors

### Callback not received
- Verify the callback URL is accessible
- Check N8N_WEBHOOK_SECRET matches both sides
- Look at n8n execution logs

## Security Considerations

1. **Webhook Secrets**: Always use N8N_WEBHOOK_SECRET in production
2. **Network**: In production, n8n should be on a private network
3. **Authentication**: n8n can be configured with basic auth
4. **Rate Limiting**: Consider adding rate limiting to webhook endpoints
