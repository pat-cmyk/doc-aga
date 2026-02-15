

# Add Edit and Disable/Delete Action Buttons to User Management Table

## Problem
The admin user management table only shows a "View" (eye) button and a role dropdown. Edit and Disable actions require opening the detail panel first, making them hard to discover.

## Solution
Add **Edit** and **Disable/Enable** action buttons directly in the table's Actions column, alongside the existing View and role dropdown.

## Changes

### File: `src/components/admin/UserManagement.tsx`

1. **Import** `EditUserDialog` and add state for inline edit/disable actions
2. **Add two buttons** to the Actions cell for each user row:
   - **Edit button** (pencil icon): Opens the `EditUserDialog` directly from the table
   - **Disable/Enable button** (ban/check icon): Toggles the user's disabled state with a confirmation prompt
3. **Add an `AlertDialog`** for the disable/enable confirmation (with reason input), mirroring the one already in `UserDetailPanel`
4. **Add a disable/enable mutation** (reusing the same `admin_disable_user` / `admin_enable_user` RPCs already used in `UserDetailPanel`)

### Updated Actions Column Layout

```text
[ Eye ] [ Edit ] [ Disable/Enable ] [ Add Role dropdown ]
```

### No new dependencies or database changes required
All RPCs (`admin_disable_user`, `admin_enable_user`) and dialogs (`EditUserDialog`) already exist. This change simply surfaces them in the table view.

