 # Data Model

## Core entities
- campaigns
- users
- roles
- memberships
- people
- households
- addresses
- tags
- notes
- tasks
- canvass lists
- canvass assignments
- canvass responses
- outreach logs
- donor records
- audit logs

## Data rules
- All campaign data must be scoped safely by campaign / tenant
- Important changes should be auditable
- Do not hard delete critical operational records unless explicitly required
- Prefer soft delete or archival patterns where appropriate
- Design for imperfect imported data
- Plan for deduplication at the people / household / address level
