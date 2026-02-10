

# Make Inbox Pilot Responsive for Mobile Browsers

## Overview
The app currently uses fixed-width layouts (264px sidebar, 480px email queue, etc.) that don't work on small screens. This plan adds responsive behavior so the app is fully usable on mobile browsers.

## Approach
On mobile (below 768px), the sidebar becomes a slide-out Sheet triggered by a hamburger menu button. Panels that sit side-by-side on desktop stack or swap on mobile.

---

## Changes by File

### 1. `src/components/dashboard/DashboardSidebar.tsx`
- Accept an optional `open` and `onOpenChange` prop for mobile sheet control
- On desktop (md+): render the sidebar as-is (fixed `w-64` aside)
- On mobile: wrap the sidebar content in a `Sheet` component (slides in from the left)
- Extract the sidebar inner content into a shared fragment to avoid duplication

### 2. `src/components/dashboard/MobileHeader.tsx` (new file)
- A thin top bar visible only on mobile (`md:hidden`)
- Contains: hamburger menu button (opens sidebar sheet), app logo, and a page title
- Reused across Dashboard, History, Chat, Compose, and Settings pages

### 3. `src/pages/Dashboard.tsx`
- Add mobile sidebar sheet state (`sidebarOpen`)
- On mobile: show only EmailQueue OR EmailDetail (not both). When an email is selected, show EmailDetail full-width with a back button. When none selected, show EmailQueue full-width
- Pass sidebar open/close state to DashboardSidebar
- Add MobileHeader

### 4. `src/components/dashboard/EmailQueue.tsx`
- Change `w-[480px]` to `w-full md:w-[480px]`
- Make header buttons wrap on small screens (use `flex-wrap`)

### 5. `src/components/dashboard/EmailDetail.tsx`
- On mobile: render full-width instead of as a side panel
- Add a back/close button at the top for mobile navigation

### 6. `src/pages/History.tsx`
- Add mobile sidebar sheet state
- Add MobileHeader
- Make the table horizontally scrollable on mobile (`overflow-x-auto`)
- The detail panels (`w-96`, `w-[480px]`) become full-screen overlays or sheets on mobile

### 7. `src/pages/Settings.tsx`
- Add mobile sidebar sheet state
- Add MobileHeader
- Content already scrolls well; just needs the sidebar to be accessible

### 8. `src/pages/Chat.tsx`
- Add mobile sidebar sheet state
- Add MobileHeader
- Reduce chat bubble max-width on mobile

### 9. `src/pages/Compose.tsx`
- Add mobile sidebar sheet state
- Add MobileHeader
- Content already scrolls; just needs sidebar access

### 10. `src/components/landing/Navbar.tsx`
- Already simple enough; no changes needed

---

## Technical Details

### Mobile Sidebar Pattern
```text
+------------------+
| [=] Inbox Pilot  |  <-- MobileHeader (md:hidden)
+------------------+
|                  |
|  Page Content    |
|  (full width)    |
|                  |
+------------------+

Tapping [=] opens a Sheet from the left with full sidebar nav.
```

### Dashboard Mobile View Pattern
```text
State A: No email selected     State B: Email selected
+------------------+           +------------------+
| [=] Action Queue |           | [<] Email Detail |
+------------------+           +------------------+
| Email 1          |           |                  |
| Email 2          |           | Full email detail|
| Email 3          |           | with actions     |
| ...              |           |                  |
+------------------+           +------------------+
```

### Key Responsive Breakpoint
- `md` (768px) -- matches the existing `useIsMobile` hook
- Below md: single-column layout, sheet sidebar
- md and above: current desktop layout unchanged

### Dependencies
- No new packages needed. Uses existing `Sheet` component from `src/components/ui/sheet.tsx` and the `useIsMobile` hook from `src/hooks/use-mobile.tsx`

