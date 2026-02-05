
# Floating Doc Aga Panel for Government Dashboard

## Overview
Transform the government dashboard's Doc Aga AI from a full-screen overlay to a floating panel that allows you to continue viewing and interacting with the dashboard while chatting with Doc Aga.

## Current vs. Proposed Behavior

| Aspect | Current | After Change |
|--------|---------|--------------|
| On Click | Full-screen takeover (`fixed inset-0`) | Floating panel in corner |
| Dashboard Access | Hidden completely | Visible and interactive |
| Mobile | Full-screen | Full-screen (stays same for usability) |
| Desktop | Full-screen | Floating panel (450x650px) |
| Backdrop | Solid background | Semi-transparent, click-through |

## Visual Design

```text
+--------------------------------------------------+
|  Government Dashboard                      [User] |
+--------------------------------------------------+
|                                                   |
|  +-------------+  +-------------+  +-------------+|
|  |  Card 1     |  |  Card 2     |  |  Card 3     ||
|  +-------------+  +-------------+  +-------------+|
|                                                   |
|  +----------------------------------------------+ |
|  |  Charts and Analytics                        | |
|  |                                              | |
|  +----------------------------------------------+ |
|                                                   |
|                         +-----------------------+ |
|                         | Doc Aga Panel         | |
|                         | +-------------------+ | |
|                         | | Chat messages     | | |
|                         | |                   | | |
|                         | +-------------------+ | |
|                         | [Voice] [Input...][>]| | |
|                         +-----------------------+ |
+--------------------------------------------------+
```

## Implementation Steps

### Step 1: Update GovernmentFab.tsx

Replace the full-screen container with a floating panel pattern:

**Before:**
```typescript
{showDocAga && (
  <div className="fixed inset-0 z-50 bg-background">
    <DocAgaConsultation ... />
  </div>
)}
```

**After:**
```typescript
{showDocAga && (
  <>
    {/* Semi-transparent backdrop - click to minimize (desktop only) */}
    <div
      className="hidden sm:block fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
      onClick={() => setShowDocAga(false)}
    />
    
    {/* Floating Panel */}
    <Card
      className="fixed z-50 flex flex-col shadow-2xl 
        inset-0 rounded-none 
        sm:inset-auto sm:bottom-24 sm:right-4 sm:w-[420px] sm:h-[550px] sm:rounded-lg 
        lg:w-[450px] lg:h-[600px]"
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between border-b p-3 bg-primary text-primary-foreground rounded-t-none sm:rounded-t-lg">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          <span className="font-semibold">Doc Aga - Analyst</span>
        </div>
        <Button onClick={() => setShowDocAga(false)} variant="ghost" size="icon">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* DocAga content area */}
      <div className="flex-1 overflow-hidden">
        <DocAga />  {/* Reuse existing DocAga component */}
      </div>
    </Card>
  </>
)}
```

### Step 2: Switch from DocAgaConsultation to DocAga

The `DocAga` component (used by `UnifiedActionsFab`) is more feature-rich and already supports:
- Government context detection via `useGovernmentAccess` hook
- Voice, text, and image input modes
- Quick actions
- TTS audio controls

This is a better fit than `DocAgaConsultation` which was designed for a simpler flow.

### Step 3: Add Minimize/Collapse Option (Optional Enhancement)

Add a minimized state where only a small icon/badge shows, allowing quick access without the full panel.

## Benefits

1. **Multi-tasking**: View dashboard charts while asking Doc Aga questions about them
2. **Context-aware**: Ask "What does this chart show?" while looking at it
3. **Familiar pattern**: Matches the floating chat pattern already used in farm dashboard
4. **Mobile-friendly**: Full-screen on mobile preserves usability on small screens

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/government/GovernmentFab.tsx` | Replace full-screen with floating panel, switch to DocAga component |

### Component Reuse

- Reuse `DocAga` component which already has government context detection
- DocAga automatically switches to "Analyst Assistant" persona when `location.pathname.startsWith('/government')`

### Positioning Coordination

Following the established mobile FAB positioning pattern:
- Panel positioned at `bottom-24 right-4` on mobile (above bottom nav)
- Panel positioned at `bottom-6 right-6` on desktop (standard corner)

### Z-Index Stack

- Backdrop: `z-40` (allows panel to float above)
- Floating Panel: `z-50` (above backdrop, below modals)
