 # Roles and Permissions

## Expected roles
- candidate
- campaign_manager
- field_organizer
- canvasser
- volunteer_coordinator
- finance_lead

## Access rules
- Canvassers should only see mobile-safe workflows and records relevant to their assignments
- Campaign managers should have broad operational access
- Finance users should only see donor tracking and related exports
- Never assume every authenticated user should see everything

## Role expectations by role

### candidate
- Read access to dashboard and summaries
- No direct data entry

### campaign_manager
- Full operational access within their campaign
- Can create walk lists, assign canvassers, manage users
- Can export data

### field_organizer
- Can create and manage walk lists
- Can assign canvassers
- Can view canvass results

### canvasser
- Can only see their assigned walk lists
- Can record canvass responses
- Cannot access other canvassers' data or admin screens

### volunteer_coordinator
- Can view and manage volunteer interest flags
- Can manage follow-up tasks for volunteers

### finance_lead
- Can view donor interest records
- Can export donor prospect lists
- Cannot see canvassing or field data unless also assigned another role
