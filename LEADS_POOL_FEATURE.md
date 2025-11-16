# Leads Pool Feature Documentation

## Overview
The Leads Pool is a new feature that allows employees to claim leads from a shared pool, even if those leads are already assigned to other employees. This creates a more dynamic and competitive lead distribution system.

## Features Implemented

### 1. API Endpoints

#### GET `/api/leads/pool`
Retrieves leads available in the pool with filtering options.

**Query Parameters:**
- `filter`: Filter type
  - `all` - All active leads
  - `unassigned` - Only unassigned leads
  - `available` - Leads that can be claimed (NEW or CONTACTED status)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-id",
      "leadNumber": "LEAD123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "status": "NEW",
      "priority": "HIGH",
      "assignedTo": "Jane Smith",
      "assignedToId": "employee-id",
      "canBeTaken": true,
      ...
    }
  ]
}
```

#### POST `/api/leads/pool`
Claims a lead from the pool and assigns it to the requesting employee.

**Request Body:**
```json
{
  "leadId": "lead-id",
  "employeeId": "employee-id",
  "force": false
}
```

**Features:**
- Validates lead availability (only NEW or CONTACTED leads can be claimed)
- Prevents employees from claiming their own leads
- Creates lead history entry for audit trail
- Sends notifications to both new and previous assignees
- Updates lead assignment timestamp

**Response:**
```json
{
  "success": true,
  "message": "Lead claimed successfully",
  "data": {
    "id": "lead-id",
    "name": "John Doe",
    "assignedTo": "New Employee",
    "previousAssignee": "Previous Employee"
  }
}
```

#### DELETE `/api/leads/pool`
Returns a lead back to the pool (unclaims it).

**Query Parameters:**
- `leadId`: ID of the lead to return
- `employeeId`: ID of the employee returning the lead

**Features:**
- Only allows employees to return their own leads
- Sets lead to unassigned status
- Creates history entry
- Sends notification to employee

### 2. UI Component: LeadsPool

A comprehensive React component located at `/src/components/LeadsPool.tsx`

**Key Features:**

#### Visual Elements
- **Stats Cards**: Shows total available, unassigned, and high-priority leads
- **Filter System**:
  - Search by name, email, phone, or lead number
  - Filter by type (all, unassigned, available)
  - Filter by priority (all, urgent, high, medium, low)
- **Lead Cards**: Beautiful card-based layout showing:
  - Lead information (name, contact details, loan amount)
  - Priority and status badges
  - Current assignee (if any)
  - Creation date
  - Claim button

#### Functionality
- **Real-time Updates**: Automatic refresh on claim
- **Claim Confirmation**: Dialog to confirm before claiming
- **Visual Feedback**: Loading states, success/error toasts
- **Warning System**: Alerts when claiming from another employee
- **Responsive Design**: Works on all screen sizes

#### Color Coding
- **Priority Colors**:
  - URGENT: Red
  - HIGH: Orange
  - MEDIUM: Blue
  - LOW: Green
- **Status Colors**:
  - NEW: Blue
  - CONTACTED: Purple
  - QUALIFIED: Green

### 3. Dashboard Integration

The Leads Pool is integrated into the main dashboard with:

1. **New Tab**: "Leads Pool" tab in the main navigation
2. **Sidebar Button**: Dedicated navigation button with Users icon
3. **Page Title**: "Leads Pool" header when active
4. **Permission-Based Access**: Only visible if user has `canViewLeads` permission

### 4. Notification System

When leads are claimed, notifications are sent to:

**New Assignee:**
- Title: "Lead Claimed Successfully"
- Message: "You have successfully claimed [Lead Name] from the leads pool"
- Type: SUCCESS

**Previous Assignee (if applicable):**
- Title: "Lead Claimed by Another Employee"
- Message: "[Lead Name] has been claimed from the pool by [New Employee]"
- Type: WARNING

### 5. Lead History Tracking

All pool actions are tracked in the lead history:

**Actions Tracked:**
- `CLAIMED_FROM_POOL`: When claimed from another employee
- `CLAIMED_UNASSIGNED`: When claimed from unassigned pool
- `RETURNED_TO_POOL`: When returned to pool

Each entry includes:
- Old and new assignee information
- Timestamp
- Descriptive notes

## Business Rules

1. **Claimable Leads**: Only leads with status `NEW` or `CONTACTED` can be claimed
2. **Self-Assignment Prevention**: Employees cannot claim leads already assigned to them
3. **Status Protection**: Leads in advanced stages (QUALIFIED, APPLICATION, etc.) are protected
4. **Audit Trail**: All claims and returns are logged in lead history
5. **Notification**: All parties involved are notified of changes

## Usage Examples

### For Employees

1. **Viewing Available Leads:**
   - Navigate to "Leads Pool" tab
   - See all available leads with their details
   - Use filters to find specific leads

2. **Claiming a Lead:**
   - Click "Claim Lead" button on desired lead
   - Review lead details in confirmation dialog
   - Click "Confirm Claim" to assign lead to yourself
   - Receive success notification

3. **Returning a Lead:**
   - (Future enhancement - currently requires API call)

### For Managers

1. **Monitor Pool Activity:**
   - View all leads in the pool
   - See which leads are unassigned
   - Track high-priority leads

2. **Analytics:**
   - See claim statistics in stats cards
   - Monitor lead distribution

## API Integration Examples

### Fetch Available Leads
```javascript
const response = await fetch('/api/leads/pool?filter=available', {
  headers: {
    'x-user-id': userId,
    'x-company-id': companyId
  }
})
const result = await response.json()
```

### Claim a Lead
```javascript
const response = await fetch('/api/leads/pool', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'x-company-id': companyId
  },
  body: JSON.stringify({
    leadId: 'lead-123',
    employeeId: 'emp-456'
  })
})
```

### Return a Lead
```javascript
const response = await fetch(
  `/api/leads/pool?leadId=${leadId}&employeeId=${employeeId}`,
  {
    method: 'DELETE',
    headers: {
      'x-user-id': userId,
      'x-company-id': companyId
    }
  }
)
```

## Future Enhancements

Potential improvements for the Leads Pool feature:

1. **Return to Pool UI**: Add button in UI to return leads to pool
2. **Claim Limits**: Set maximum leads per employee
3. **Time-Based Rules**: Auto-release unclaimed leads after X hours
4. **Claim History**: Show employee's claim history
5. **Pool Analytics**: Dashboard showing claim rates, popular leads, etc.
6. **競争 Leaderboard**: Show top performers by claims and conversions
7. **Advanced Filters**: Filter by date range, loan amount, credit score
8. **Batch Claim**: Allow claiming multiple leads at once
9. **Reserve System**: Allow "reserving" a lead for review before claiming
10. **Priority Queue**: Auto-assign high-priority leads based on performance

## Benefits

1. **Increased Efficiency**: Employees can quickly grab leads they're ready to work on
2. **Fair Distribution**: Prevents lead hoarding by allowing reassignment
3. **Employee Empowerment**: Gives employees control over their workload
4. **Competition**: Creates healthy competition among sales team
5. **Lead Velocity**: Ensures leads don't sit idle with inactive employees
6. **Transparency**: Everyone can see available leads
7. **Audit Trail**: Complete history of all lead movements
8. **Flexibility**: Supports dynamic team structures

## Technical Implementation

**Files Created:**
1. `/src/app/api/leads/pool/route.ts` - API endpoints
2. `/src/components/LeadsPool.tsx` - UI component

**Files Modified:**
1. `/src/app/page.tsx` - Dashboard integration

**Dependencies:**
- Existing UI components (Card, Button, Badge, etc.)
- Database models (Lead, Employee, LeadHistory, Notification)
- Authentication system
- Permissions system

## Testing Checklist

- [ ] Claim unassigned lead
- [ ] Claim lead from another employee
- [ ] Prevent claiming own lead
- [ ] Prevent claiming non-available status leads
- [ ] Notifications sent correctly
- [ ] Lead history created
- [ ] Filters work correctly
- [ ] Search functionality works
- [ ] Stats cards update correctly
- [ ] Responsive design on mobile
- [ ] Permission-based access control
- [ ] Error handling and user feedback

---

**Generated**: 2025-11-17
**Version**: 1.0
