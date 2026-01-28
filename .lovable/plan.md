

# Invitation Sign-Up Flow Improvements - Implementation Plan

## Problem Summary

The current invitation flow has significant friction points that cause users to get lost after authentication, requiring them to re-scan QR codes or manually navigate:

1. **Auth.tsx ignores redirect parameter** - After login/signup, users are sent to role-based routes instead of back to the invitation page
2. **InviteAccept.tsx doesn't set farm context** - After accepting, users go to generic `/dashboard` without the correct farm pre-selected
3. **No role-based navigation** - Farmhands should go to `/farmhand`, owners should go to `/` (main dashboard)
4. **No auto-accept for logged-in users** - Even when email matches, users must manually click accept
5. **No email pre-check** - Users might sign up with wrong email, then get `email_mismatch` error after wasting time

---

## Solution Architecture

### Flow After Implementation

**New User (minimum friction):**
1. Scan QR code → lands on `/invite/accept/{token}`
2. Sees invitation details + invited email prominently displayed
3. Clicks "Sign In to Accept" → `/auth?redirect=/invite/accept/{token}&email=invited@example.com`
4. Signs up with email pre-filled (or different email with clear warning)
5. After auth, auto-redirected back to invitation page
6. Auto-accepts → Farm context set → navigated to `/farmhand` or `/`

**Existing Logged-In User (zero friction):**
1. Scan QR code → lands on `/invite/accept/{token}`
2. Email matches → Auto-accepts immediately with brief loading state
3. Farm context set → navigated directly to appropriate dashboard

---

## Implementation Details

### File 1: `src/pages/Auth.tsx`

**Changes Required:**

1. **Add useSearchParams import** (line 2)
   ```typescript
   import { useNavigate, Link, useSearchParams } from "react-router-dom";
   ```

2. **Add state for redirect URL and pre-filled email** (after line 32)
   ```typescript
   const [searchParams] = useSearchParams();
   const pendingRedirect = searchParams.get('redirect');
   const prefillEmail = searchParams.get('email');
   
   // Pre-fill email from invitation flow
   useEffect(() => {
     if (prefillEmail && !email) {
       setEmail(decodeURIComponent(prefillEmail));
     }
   }, [prefillEmail]);
   ```

3. **Update checkAuth to honor redirect** (lines 34-57)
   - After detecting authenticated user, check if `pendingRedirect` exists
   - If redirect starts with `/invite/accept/`, navigate there instead of role-based routing
   - Add: `if (pendingRedirect?.startsWith('/invite/accept/')) { navigate(pendingRedirect); return; }`

4. **Update handleSignIn to honor redirect** (lines 178-186)
   - Before role-based navigation, check for `pendingRedirect`
   - If exists and starts with `/invite/accept/`, navigate there instead

5. **Update handleSignUp success** (lines 97-120)
   - Update VoiceTrainingOnboarding's `onSkip` callback to use `pendingRedirect` if available
   - Navigate to invitation page instead of `/` when redirect exists

6. **Update Google OAuth to preserve redirect** (lines 125-130)
   ```typescript
   options: {
     redirectTo: pendingRedirect?.startsWith('/invite/accept/')
       ? `${window.location.origin}${pendingRedirect}`
       : `${window.location.origin}/`
   }
   ```

7. **Show email context when from invitation** (in signup form UI)
   - Add a notice above email field when `prefillEmail` exists:
   ```typescript
   {prefillEmail && (
     <div className="bg-muted p-3 rounded-md text-sm text-center">
       <p>You're signing up to accept a farm invitation sent to:</p>
       <p className="font-semibold">{decodeURIComponent(prefillEmail)}</p>
     </div>
   )}
   ```

---

### File 2: `src/pages/InviteAccept.tsx`

**Changes Required:**

1. **Add useFarm import** (line 4)
   ```typescript
   import { useFarm } from "@/contexts/FarmContext";
   ```

2. **Add useFarm hook** (after line 21)
   ```typescript
   const { setFarmId, setFarmDetails } = useFarm();
   ```

3. **Add auto-accept state** (after line 26)
   ```typescript
   const [autoAccepting, setAutoAccepting] = useState(false);
   ```

4. **Add auto-accept logic** (new useEffect after line 31)
   ```typescript
   // Auto-accept for logged-in users with matching email
   useEffect(() => {
     if (loading || !invitation || !user || autoAccepting || accepting) return;
     
     const userEmail = user.email?.toLowerCase();
     const invitedEmail = invitation.invited_email?.toLowerCase();
     
     if (userEmail === invitedEmail) {
       setAutoAccepting(true);
       // Brief delay for UX feedback
       const timer = setTimeout(() => {
         acceptInvitation();
       }, 800);
       return () => clearTimeout(timer);
     }
   }, [loading, invitation, user, autoAccepting, accepting]);
   ```

5. **Update acceptInvitation redirect to include email** (lines 68-71)
   ```typescript
   if (!user) {
     const returnUrl = encodeURIComponent(window.location.pathname);
     const inviteEmail = encodeURIComponent(invitation?.invited_email || '');
     navigate(`/auth?redirect=${returnUrl}&email=${inviteEmail}`);
     return;
   }
   ```

6. **Update success handler to set farm context** (lines 103-111)
   ```typescript
   if (result?.success) {
     // Set farm context immediately (SSOT pattern)
     setFarmId(result.farm_id);
     setFarmDetails({ 
       name: result.farm_name || 'My Farm',
       canManage: invitation?.role_in_farm === 'farmer_owner'
     });
     
     toast({
       title: "Welcome!",
       description: `You've joined ${result.farm_name}!`,
     });
     
     // Role-based navigation - no delay needed
     if (invitation?.role_in_farm === 'farmhand') {
       navigate("/farmhand");
     } else {
       navigate("/");
     }
   }
   ```

7. **Add email mismatch warning UI** (new section before accept button)
   ```typescript
   {user && invitation && user.email?.toLowerCase() !== invitation.invited_email?.toLowerCase() && (
     <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg text-sm">
       <p className="text-destructive font-medium">Email Mismatch</p>
       <p className="text-muted-foreground mt-1">
         This invitation was sent to <strong>{invitation.invited_email}</strong>,
         but you're signed in as <strong>{user.email}</strong>.
       </p>
       <p className="text-muted-foreground mt-1">
         Please sign in with the correct email or contact the farm owner.
       </p>
     </div>
   )}
   ```

8. **Update loading state for auto-accept** (lines 123-129)
   ```typescript
   if (loading || autoAccepting) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="text-center">
           <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
           {autoAccepting && <p className="text-muted-foreground">Joining farm...</p>}
         </div>
       </div>
     );
   }
   ```

9. **Update button state for email mismatch** (lines 172-188)
   - Disable accept button when email mismatch detected
   - Add alternative "Sign Out & Use Different Account" option

---

## Data Flow Diagram

```text
User scans QR code
       |
       v
/invite/accept/:token
       |
   +---+---+
   |       |
   v       v
Logged In   Not Logged In
   |            |
   v            v
Check email  "Sign In to Accept"
match?           |
   |             v
+--+--+    /auth?redirect=...&email=...
|     |          |
v     v          v
Match No Match  Auth Flow
   |     |       (email pre-filled)
   v     |          |
Auto-    |          v
Accept   |     On success
   |     |          |
   |     v          v
   |   Warning    Redirect back
   |   shown      to invitation
   |     |            |
   +--+--+            v
      |          Auto-accept
      v          (if email matches)
      |               |
      +-------+-------+
              |
              v
    setFarmId() + setFarmDetails()
    (SSOT - FarmContext)
              |
              v
    Role-based navigation
              |
    +---------+---------+
    |                   |
    v                   v
farmhand           farmer_owner
    |                   |
    v                   v
/farmhand            / (Dashboard)
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Add useSearchParams, handle redirect param, pre-fill email, show invitation context, preserve redirect in OAuth |
| `src/pages/InviteAccept.tsx` | Import useFarm, set farm context on success, role-based navigation, auto-accept logic, email mismatch warning |

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Steps for new user | 6+ clicks | 3-4 clicks |
| Steps for logged-in user with matching email | 3 clicks | 0 clicks (auto) |
| QR re-scans needed | Sometimes | Never |
| Farm context preserved | No | Yes |
| Email pre-filled for new users | No | Yes |
| Email mismatch caught early | No (post-signup error) | Yes (warning shown) |
| Role-appropriate destination | No (generic /dashboard) | Yes (/farmhand or /) |

---

## Edge Cases Handled

1. **OAuth flow** - Google sign-in preserves redirect URL, returns user to invitation
2. **Email mismatch** - Clear warning shown before attempting accept, with option to switch accounts
3. **Expired invitation** - Error state shown, user directed to home
4. **Already accepted** - Handled by RPC, error shown
5. **Multiple tabs** - localStorage farm context syncs across tabs via FarmContext
6. **Voice training onboarding** - Skip redirects to invitation instead of home when pending redirect exists

