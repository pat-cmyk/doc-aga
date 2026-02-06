
# Fix Tooltip Popout for Priority Legend Badges

## Problem

The tooltips on priority legend badges show a "?" cursor but no definition popout appears. This is caused by a React ref forwarding issue with the Badge component.

## Root Cause

When `TooltipTrigger` uses `asChild`, it needs to pass a `ref` to the Badge component for positioning. The current Badge component doesn't support ref forwarding.

## Solution

Update `src/components/ui/badge.tsx` to use `React.forwardRef()`:

**Current Code (lines 25-27):**
```typescript
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

**Updated Code:**
```typescript
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
```

## Expected Result

After this fix, hovering over "Critical", "High", "Medium", "Low" badges will display an opaque tooltip popout with the full definition text.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/badge.tsx` | Add ref forwarding with `React.forwardRef` |
