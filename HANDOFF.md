# LocalSeat.io — Handoff Notes

## Remaining Work

### Active Remaining Work

| Item | Effort |
|---|---|
| Marketing site at localseat.io | Medium |
| Operations guide document | Small |
| Text messaging (Telnyx + Stripe + approval + CRTC) | Large |
| Admin platform settings page | Medium |
| Stripe payment integration on choose-plan page | Large |
| Map-based turf cutting (Leaflet + OpenStreetMap) | Large |
| Demo instance isolation — Option 3 (unique DB per visitor) | Large |

### Defined — Ready to Build When Scheduled

| Item | Effort |
|---|---|
| Official voter list reconciliation engine (4 prompts) — address normalization, fuzzy name matching, phone preservation, field-level merge control, manual review screen, unmatched record handling, audit trail, data quality scoring, import source labeling | Large |

### V2+ Backlog — Out of Scope for V1

Payment processing, online donations, mass texting, email broadcasts, predictive voter scoring, advanced analytics, native iOS/Android apps, social media publishing tools, party integrations (federal/provincial), multilingual interface, campaign branding/custom theming, federal/provincial compliance workflows.

### Known Limitations

- Canvassing page shell doesn't load offline (requires server render)
- Rate limiter resets on server restart (needs Redis for production scale)
- Offline queue is per-device only
- Demo site shares one database — multiple simultaneous users see each other's changes (deferred to Option 3)
