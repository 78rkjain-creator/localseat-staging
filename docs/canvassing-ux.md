 # Mobile Canvassing UX Rules

## The most important screen in the product
The mobile canvassing screen defines the quality of the product.
A canvasser should be able to complete a standard door interaction in seconds.

## Design constraints
- Optimize for one-thumb use
- Minimize taps
- Minimize typing
- Make the primary action obvious
- Make the save state clear
- Support quick repetition across many doors
- Preserve readability in bright outdoor conditions

## Required elements on the canvassing screen
- Current address
- Resident names
- Support level controls
- Sign request toggle
- Volunteer interest toggle
- Donor interest toggle
- Short notes field
- Not home option
- Follow-up option
- Save and next button

## Interaction rules
- Support level should be a large segmented control or button group, not a dropdown
- Toggles should be large and clearly labeled
- Notes field should be short and optional
- Not home should be one tap
- Save and next should be the dominant action at the bottom of the screen
- Progress through the walk list should be visible

## Never do this
- Hidden navigation during active canvassing
- Tiny map interactions as the main flow
- Modal chains for basic actions
- Long multi-step forms
- Excessive text entry
- Small touch targets

## Offline behavior
- The canvassing flow must tolerate temporary connection loss
- Queued submissions must sync when connectivity returns
- The user must receive clear save and sync feedback
- Never risk silent data loss
- Do not fake offline support — represent current behavior honestly in the UI
