 # Municipal Campaign Platform - Project Instructions

## Product Summary
This project is a lightweight, Canada-focused municipal campaign customer relationship management [CRM] and canvassing platform.

It is designed for:
- municipal candidates
- campaign managers
- field organizers
- canvassers
- volunteer coordinators
- finance users who need donor tracking without payment processing

The platform includes:
- voter / supporter records
- household and address management
- walk list and turf assignment
- mobile-first door-to-door canvassing
- outreach logging
- follow-up tasks
- donor tracking
- dashboard summaries
- exports

This product is not meant to replicate enterprise United States political software. It should be simpler, faster, cleaner, and better suited to local Canadian campaigns.

---

## Version 1 [V1] Scope
Build only the following in V1:

### Core platform
- authentication
- role-based access control
- campaign selection / campaign shell
- tenant-safe campaign data separation
- audit logging
- seed data support

### People and campaign data
- constituent records
- household grouping
- address records
- search and filtering
- notes
- tags
- activity timeline

### Field operations
- walk list creation
- turf assignment
- canvasser assignments
- mobile canvassing screen
- support level capture
- sign request capture
- volunteer interest capture
- donor interest capture
- quick notes
- follow-up capture
- mark not home / moved / refused / unavailable
- save and next workflow

### Operations
- follow-up queue
- outreach logging
- basic dashboard summaries
- export to comma-separated values [CSV]

### Platform behavior
- Progressive Web App [PWA]
- responsive design
- mobile-first canvassing experience
- offline-friendly data capture strategy
- sync when connection is restored

---

## Out of Scope for V1
Do not build these unless explicitly requested:
- payment processing
- online donations
- full campaign finance compliance engine
- mass texting infrastructure
- email broadcast system
- predictive voter scoring
- advanced analytics
- native iPhone or Android apps
- social media publishing tools
- volunteer scheduling complexity
- political party integrations
- federal or provincial compliance workflows
- multilingual interface support beyond English
- custom theming for multiple campaign brands

If a future request conflicts with this scope, recommend the smallest viable implementation first.

---

## Primary Product Principles
Always optimize for:
- simplicity
- speed
- mobile usability
- clarity
- reliability
- operational usefulness
- maintainable code

Do not optimize for:
- feature sprawl
- flashy visual effects
- abstract architecture
- overengineering
- dense enterprise workflows
- dashboard clutter

This is a real-world campaign tool used under pressure, often on a phone, often outdoors, and often by volunteers with little training.

---

## Core User Journey
The main product loop is:

1. campaign manager imports voter / resident data
2. campaign manager creates walk lists or turf
3. field organizer assigns a canvasser
4. canvasser opens the mobile web app on a phone
5. canvasser records support level, sign request, volunteer interest, donor interest, notes, and follow-up status
6. results sync back to the campaign dashboard
7. campaign team reviews follow-ups and exports data

Protect and prioritize this loop above everything else.

---

## Tech Stack
Use the following stack unless explicitly changed:

### Front end
- Next.js
- TypeScript
- Tailwind CSS

### Back end
- Next.js app router and server actions or route handlers where appropriate
- TypeScript

### Database
- PostgreSQL

### Platform
- Progressive Web App [PWA]
- responsive web application, not native app

### Maps
- use a placeholder abstraction for maps if provider is not yet finalized
- do not hardwire the application too deeply into one provider early

### Authentication
- implement a practical auth system that supports roles and campaign-level access control
- choose the smallest clean implementation that fits the stack

---

## Design System Rules
Follow the existing front-end design system spec.

### Visual direction
- modern
- premium but restrained
- calm and trustworthy
- mobile-first
- operational
- spacious
- high readability

### Style cues
- soft rounded corners
- slate, white, and warm orange palette
- muted green accent used sparingly
- subtle shadows
- clean borders
- strong typography hierarchy
- large touch targets
- minimal visual noise

### Avoid
- cramped dashboards
- generic software-as-a-service [SaaS] styling
- patriotic political clichés
- tiny text
- tiny buttons
- unnecessary animation
- dense forms
- complex nested panels

### Important
The current login screen is a reference for tone and styling. Reuse its design language across the app.

---

## Mobile Canvassing Rules
The mobile canvassing screen is the most important screen in the product.

When building canvassing interfaces:
- prioritize one-thumb use
- minimize taps
- minimize typing
- make the primary action obvious
- make the save state clear
- support quick repetition across many doors
- preserve readability in bright outdoor conditions

The canvasser should be able to complete a standard interaction in seconds.

### Mobile canvassing screen should include
- current address
- resident names
- support level controls
- sign request toggle
- volunteer interest toggle
- donor interest toggle
- short notes field
- not home option
- follow-up option
- save and next button

### Never do this
- hidden navigation during active canvassing
- tiny map interactions as the main flow
- modal chains for basic actions
- long multi-step forms
- excessive text entry

---

## Coding Standards
Follow these coding principles:

### General
- write clean, readable, production-friendly code
- prefer explicit code over clever code
- keep functions and components reasonably small
- extract reusable components when repetition is real
- avoid premature abstraction
- add comments only when they provide real value

### TypeScript
- use strict typing
- avoid `any` unless absolutely necessary
- define shared types for core entities
- keep enums and status values centralized

### Components
- build reusable UI components for repeated patterns
- keep component APIs simple
- compose small components rather than building giant page files
- separate layout components from domain-specific components where sensible

### Styling
- use Tailwind CSS
- keep class names readable
- extract repeated style patterns into reusable components instead of large utility duplication everywhere

### State
- keep state management simple
- prefer local state where possible
- introduce more complex state only when justified

### Errors
- handle errors intentionally
- provide useful user-facing messages
- never silently fail important save actions

---

## Data Model Expectations
The application should support at minimum these core entities:
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

### Data rules
- all campaign data must be scoped safely by campaign / tenant
- important changes should be auditable
- do not hard delete critical operational records unless explicitly required
- prefer soft delete or archival patterns where appropriate
- design for imperfect imported data
- plan for deduplication at the people / household / address level

---

## Permissions and Roles
V1 should support practical role-based access control.

Expected roles:
- candidate
- campaign_manager
- field_organizer
- canvasser
- volunteer_coordinator
- finance_lead

### General expectations
- canvassers should only see the mobile-safe workflows and the records relevant to their assignments
- campaign managers should have broad operational access
- finance-focused users should only see donor tracking and related exports if permissions require restriction
- never assume every authenticated user should see everything

---

## Offline and Sync Expectations
This app must be designed with weak connectivity in mind.

### Minimum expectations
- the mobile canvassing workflow should tolerate temporary connection loss
- queued submissions should sync when connectivity returns
- the user should receive clear save / sync feedback
- avoid designs that risk silent data loss

### Important
Do not fake offline support. If true offline persistence is not yet implemented, represent the current behavior honestly in the interface and code comments.

---

## Acceptance Criteria Style
When working on any feature:
1. briefly summarize what will be built
2. list files that will be created or changed
3. call out assumptions
4. implement the feature
5. explain how to test it
6. identify follow-up improvements only if relevant

Do not jump into large code generation without first grounding the task.

---

## Preferred Build Order
Build features in this order unless directed otherwise:

1. project scaffold
2. auth
3. roles and permissions
4. campaign shell
5. database schema
6. seed data
7. people and households
8. walk lists and assignments
9. mobile canvassing interface
10. canvass response persistence
11. follow-up workflow
12. outreach logs
13. donor tracking
14. dashboard summaries
15. exports
16. PWA and offline polish

If asked to work out of order, still preserve system integrity and avoid hacky shortcuts.

---

## Testing Expectations
For meaningful features:
- include a practical way to test the feature
- use seed data where helpful
- avoid shipping untestable UI
- protect core flows from regressions

Priority test flows:
- sign in
- campaign access
- view assigned walk list
- submit canvass result
- save and next
- create follow-up
- view dashboard summary
- export records

---

## Seed Data Expectations
Maintain realistic development seed data:
- 1 sample campaign
- multiple users across roles
- households
- addresses
- residents
- walk lists
- canvass assignments
- sample canvass responses
- sample donor prospects
- follow-up tasks

Seed data should make it easy to test the main workflow immediately after setup.

---

## UX Writing Rules
Inside the product:
- use plain language
- use short operational labels
- prefer direct verbs
- avoid marketing language
- avoid corporate jargon

Good examples:
- Save and next
- Mark not home
- Assign route
- Add follow-up
- Record support level

Bad examples:
- Unlock campaign efficiency
- Initiate engagement flow
- Activate supporter pipeline

---

## File and Folder Expectations
When proposing structure:
- keep the repo understandable
- group by logical feature or domain where practical
- avoid over-fragmentation
- keep shared UI components organized
- keep domain logic separate from visual components where helpful
- centralize shared types, enums, and utilities

---

## What to Do When Uncertain
If requirements are unclear:
- choose the smallest practical implementation
- preserve maintainability
- do not invent major product features
- do not expand scope on your own
- state assumptions clearly

If there is a conflict between polish and usability:
- choose usability

If there is a conflict between speed and data integrity:
- choose data integrity

If there is a conflict between abstraction and delivery:
- choose delivery, as long as the implementation remains clean

---

## Working Style
When responding to tasks in this repo:
- be concrete
- be structured
- be implementation-focused
- avoid long philosophical digressions
- recommend the smallest clean next step
- keep momentum high without sacrificing core quality

This project should feel like a serious product build, not an experiment.

---
## Immediate Priority
Unless explicitly told otherwise, focus current work on:
- stable project scaffold
- auth and roles
- database schema
- seed data
- people / household data model
- mobile canvassing workflow

That is the foundation of the platform.
