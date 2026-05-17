# XBC Expenses — Frontend Architecture

> React 19 + TypeScript + Vite 8 SPA. Talks to a Spring Boot 4 backend at `http://localhost:8080`.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Directory Structure](#directory-structure)
3. [Entry Points](#entry-points)
4. [Routing (`App.tsx`)](#routing)
5. [Type System (`types/`)](#type-system)
6. [State Management (`store/`)](#state-management)
7. [API Layer (`api/`)](#api-layer)
8. [Custom Hooks (`hooks/`)](#custom-hooks)
9. [Layout & Shell (`components/AppLayout.tsx`)](#layout--shell)
10. [UI Primitives (`components/ui/`)](#ui-primitives)
11. [Feature Components (`components/`)](#feature-components)
12. [Pages (`pages/`)](#pages)
13. [Data Flow Diagram](#data-flow-diagram)
14. [Key Patterns](#key-patterns)

---

## Tech Stack

| Layer | Library | Purpose |
|---|---|---|
| Framework | React 19 | UI rendering |
| Language | TypeScript 5 | Type safety |
| Build | Vite 8 + `@tailwindcss/vite` | Dev server, HMR, bundling |
| Styling | Tailwind CSS v4 (via Vite plugin) | Utility classes, CSS vars theme |
| Components | shadcn/ui (Nova style, Base UI) | Accessible UI primitives |
| Server state | TanStack React Query v5 | Fetching, caching, mutations |
| Client state | Zustand v5 | Auth session, notifications |
| Forms | react-hook-form v7 + zod v4 | Form state + schema validation |
| HTTP | Axios | REST calls to Spring Boot |
| WebSocket | @stomp/stompjs v7 + sockjs-client v1.6 | Real-time notifications |
| Charts | recharts v3 | Bar chart, donut chart |
| Dates | date-fns v4 | Formatting, relative time |
| Icons | lucide-react | SVG icon set |
| Toasts | sonner | Toast notifications |

---

## Directory Structure

```
frontend/src/
├── App.tsx                        # Root router
├── main.tsx                       # React + QueryClient bootstrap
├── index.css                      # Tailwind + CSS variable theme
├── App.css                        # Legacy template CSS (unused)
│
├── types/
│   └── index.ts                   # All shared TypeScript interfaces
│
├── lib/
│   └── utils.ts                   # cn() utility (clsx + twMerge)
│
├── store/
│   ├── authStore.ts               # Zustand: JWT + user session
│   └── notificationStore.ts       # Zustand: in-memory notification list
│
├── api/
│   ├── axios.ts                   # Axios instance + auth interceptor
│   ├── auth.ts                    # login(), register()
│   ├── groups.ts                  # Group CRUD + members + invitations
│   ├── expenses.ts                # Expense CRUD + filters + summary
│   ├── events.ts                  # Event CRUD
│   ├── categories.ts              # Category + subcategory CRUD
│   ├── audit.ts                   # Audit log queries
│   ├── notifications.ts           # Notification fetch + mark-read
│   └── files.ts                   # File upload/download + delete
│
├── hooks/
│   ├── useAuth.ts                 # Auth state + derived flags
│   ├── useWebSocket.ts            # STOMP/SockJS connection lifecycle
│   └── usePageTitle.ts            # document.title manager
│
├── components/
│   ├── ProtectedRoute.tsx         # Auth guard (redirects to /login)
│   ├── AppLayout.tsx              # Sidebar + header + outlet shell
│   ├── GroupCard.tsx              # Dashboard group summary card
│   │
│   ├── ui/                        # shadcn/ui primitives
│   │   ├── alert-dialog.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── popover.tsx
│   │   ├── separator.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   └── tabs.tsx
│   │
│   ├── expenses/
│   │   ├── ExpenseSheet.tsx       # Create/edit expense (side sheet)
│   │   ├── ExpenseDetailModal.tsx # View expense detail (dialog)
│   │   └── SummaryChart.tsx       # Bar/donut charts for expenses
│   │
│   └── categories/
│       └── CategoriesTab.tsx      # Category + subcategory manager
│
└── pages/
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── InvitePage.tsx
    ├── DashboardPage.tsx
    ├── GroupPage.tsx
    ├── ExpensesPage.tsx
    ├── EventsPage.tsx
    ├── AuditPage.tsx
    └── GroupSettingsPage.tsx
```

---

## Entry Points

### `src/main.tsx`
Bootstrap file. Creates the `QueryClient` and wraps the app with:
- `QueryClientProvider` (React Query)
- `<Toaster />` from sonner (global toast outlet)
- `<App />` (router root)

### `src/index.css`
Defines the CSS custom property theme (`--background`, `--foreground`, `--primary`, …) used by Tailwind CSS v4 and shadcn/ui. Also contains the `@tailwind base/components/utilities` directives via the Vite plugin.

---

## Routing

### `src/App.tsx`

All routes are defined here using React Router DOM v7.

```
/login                          → LoginPage        (public)
/register                       → RegisterPage     (public)
/invite?token=xxx               → InvitePage       (public)

/dashboard                      → DashboardPage    (protected)
/groups/:groupId                → GroupPage        (protected)
/groups/:groupId/expenses       → ExpensesPage     (protected)
/groups/:groupId/events         → EventsPage       (protected)
/groups/:groupId/audit          → AuditPage        (protected)
/groups/:groupId/settings       → GroupSettingsPage (protected)
* (catch-all)                   → redirect to /dashboard
```

All protected routes are wrapped in `<ProtectedRoute>` → `<AppLayout>`. The `AppLayout` renders the sidebar/header shell and `<Outlet />` where child pages appear.

---

## Type System

### `src/types/index.ts`

Single source of truth for all domain types. Key interfaces:

| Type | Description |
|---|---|
| `AuthUser` | `{ id, username, email, role }` — decoded JWT payload |
| `Role` | `'ADMIN' \| 'MANAGER' \| 'MEMBER'` |
| `Permission` | `'VIEW' \| 'EDIT'` — group member access level |
| `GroupMember` | Member row with `userId, email, permission, joinedAt` |
| `Group` | Full group object with `ownerId`, `members[]`, timestamps |
| `Expense` | Expense record with `amount`, `currency`, `categoryId`, `attachments[]` |
| `Category` | Category with `color`, `icon`, and `subcategories[]` |
| `Event` | Expense event/trip with `status`, `expenseTotal` |
| `Invitation` | Invite record with `status`, `acceptUrl`, `expiresAt` |
| `Notification` | WebSocket push notification with `type`, `read`, `referenceId` |
| `AuditLog` | Immutable change record with `action`, `entityType`, `performedBy` |
| `ApiResponse<T>` | Backend envelope `{ success, message, data: T }` |
| `PagedResponse<T>` | Paginated envelope with `content[]`, `totalElements`, `totalPages` |

---

## State Management

### `src/store/authStore.ts`
**Zustand** store, persisted to `localStorage`.

| Field | Type | Purpose |
|---|---|---|
| `user` | `AuthUser \| null` | Decoded JWT payload |
| `token` | `string \| null` | Raw JWT string |
| `setAuth(user, token)` | action | Called on login success |
| `clearAuth()` | action | Called on logout or 401 |

Consumed by `useAuth()` hook and the Axios interceptor.

### `src/store/notificationStore.ts`
**Zustand** store, **not** persisted (in-memory per session).

| Field | Type | Purpose |
|---|---|---|
| `notifications` | `NotificationItem[]` | All loaded notifications, newest first |
| `setNotifications(list)` | action | Bulk-load on app mount |
| `prependNotification(n)` | action | Add incoming WebSocket notification |
| `markRead(id)` | action | Toggle single item read |
| `markAllRead()` | action | Mark everything read |
| `selectUnreadCount` | selector | Derived count for the bell badge |

---

## API Layer

All files in `src/api/` export plain async functions. They import the shared Axios instance from `axios.ts` and unwrap the `data.data` field from the backend envelope.

### `src/api/axios.ts`
Creates an Axios instance pointed at `http://localhost:8080`. Attaches a **request interceptor** that reads the JWT from `authStore` and sets `Authorization: Bearer <token>`. On 401 responses, calls `clearAuth()` and redirects to `/login`.

---

### `src/api/auth.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `login(email, password)` | POST | `/api/auth/login` | `{ token }` |
| `register(username, email, password)` | POST | `/api/auth/register` | `{ token }` |

---

### `src/api/groups.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getMyGroups()` | GET | `/api/groups/my` | `GroupDto[]` |
| `getGroup(id)` | GET | `/api/groups/:id` | `GroupDto` |
| `createGroup({ name, description })` | POST | `/api/groups` | `GroupDto` |
| `updateGroup(id, { name, description })` | PUT | `/api/groups/:id` | `GroupDto` |
| `deleteGroup(id)` | DELETE | `/api/groups/:id` | `void` |
| `updateMemberPermission(groupId, userId, permission)` | PUT | `/api/groups/:id/members/:uid/permission` | `GroupDto` |
| `removeMember(groupId, userId)` | DELETE | `/api/groups/:id/members/:uid` | `GroupDto` |
| `sendInvitation(groupId, { email, permission })` | POST | `/api/groups/:id/invitations` | `InvitationResult` |
| `getGroupInvitations(groupId)` | GET | `/api/groups/:id/invitations` | `InvitationResult[]` |
| `cancelInvitation(groupId, invitationId)` | DELETE | `/api/groups/:id/invitations/:iid` | `void` |
| `getExpenseSummary(groupId)` | GET | `/api/groups/:id/expenses/summary` | `ExpenseSummary` |

---

### `src/api/expenses.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getExpense(groupId, expenseId)` | GET | `/api/groups/:id/expenses/:eid` | `ExpenseDto` |
| `getExpenses(groupId, filters, page, size, sortBy, sortDir)` | GET | `/api/groups/:id/expenses` | `PagedExpenses` |
| `getExpenseSummary(groupId, filters?)` | GET | `/api/groups/:id/expenses/summary` | `ExpenseSummaryDto` |
| `createExpense(groupId, payload)` | POST | `/api/groups/:id/expenses` | `ExpenseDto` |
| `updateExpense(groupId, expenseId, payload)` | PUT | `/api/groups/:id/expenses/:eid` | `ExpenseDto` |
| `deleteExpense(groupId, expenseId)` | DELETE | `/api/groups/:id/expenses/:eid` | `void` |

**Key types:**
- `ExpenseFilters` — `dateFrom, dateTo, categoryId, subcategoryId, minAmount, maxAmount`
- `ExpenseDto.attachments` — `string[]` of fileIds (preferred multi-file)
- `ExpenseDto.fileId` — legacy single-file field (backward compat)

---

### `src/api/events.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getEvents(groupId)` | GET | `/api/groups/:id/events` | `EventDto[]` |
| `createEvent(groupId, payload)` | POST | `/api/groups/:id/events` | `EventDto` |
| `updateEvent(groupId, eventId, payload)` | PUT | `/api/groups/:id/events/:eid` | `EventDto` |
| `deleteEvent(groupId, eventId)` | DELETE | `/api/groups/:id/events/:eid` | `void` |

`EventStatus`: `'UPCOMING' | 'ACTIVE' | 'CLOSED'`

---

### `src/api/categories.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getCategories(groupId)` | GET | `/api/groups/:id/categories` | `CategoryDto[]` |
| `createCategory(groupId, payload)` | POST | `/api/groups/:id/categories` | `CategoryDto` |
| `updateCategory(groupId, catId, payload)` | PUT | `/api/groups/:id/categories/:cid` | `CategoryDto` |
| `deleteCategory(groupId, catId)` | DELETE | `/api/groups/:id/categories/:cid` | `void` |
| `addSubcategory(groupId, catId, payload)` | POST | `/api/groups/:id/categories/:cid/subcategories` | `CategoryDto` |
| `updateSubcategory(groupId, catId, subId, payload)` | PUT | `…/subcategories/:sid` | `CategoryDto` |
| `deleteSubcategory(groupId, catId, subId)` | DELETE | `…/subcategories/:sid` | `CategoryDto` |

---

### `src/api/audit.ts`
| Function | Method | Endpoint | Returns |
|---|---|---|---|
| `getAuditLogs(groupId, filters, page, size)` | GET | `/api/groups/:id/audit-logs` | `PagedAuditLogs` |

`AuditFilters`: `entityType?, entityId?, action?, userId?, dateFrom?, dateTo?`

`AuditAction`: `'CREATED' | 'UPDATED' | 'DELETED' | 'JOINED' | 'LEFT' | 'PERMISSION_CHANGED'`

`AuditEntityType`: `'EXPENSE' | 'CATEGORY' | 'EVENT' | 'GROUP' | 'MEMBER'`

---

### `src/api/notifications.ts`
| Function | Description |
|---|---|
| `fetchNotifications()` | Load all notifications for current user |
| `markNotificationRead(id)` | Mark single notification as read |
| `markAllNotificationsRead()` | Bulk mark all as read |

---

### `src/api/files.ts`
| Function | Description |
|---|---|
| `uploadFile(file, groupId)` | POST multipart to `/api/files/upload`, returns `UploadedFile` |
| `uploadFileWithProgress(file, groupId, onProgress)` | Same but streams `onUploadProgress` percent (0–100) |
| `deleteFile(fileId)` | DELETE `/api/files/:fileId` |

`UploadedFile`: `{ fileId, filename, contentType, size }`

To **download** a file for display, call `api.get('/api/files/:fileId', { responseType: 'blob' })` and use `URL.createObjectURL(blob)`. Always call `URL.revokeObjectURL(url)` on cleanup.

---

## Custom Hooks

### `src/hooks/useAuth.ts`
Wraps `authStore`. Returns:

| Field | Type |
|---|---|
| `user` | `AuthUser \| null` |
| `token` | `string \| null` |
| `isAuthenticated` | `boolean` |
| `isAdmin` | `boolean` — `role === 'ADMIN'` |
| `isManager` | `boolean` — `ADMIN \| MANAGER` |
| `setAuth(user, token)` | action |
| `clearAuth()` | action |

---

### `src/hooks/useWebSocket.ts`
Manages the STOMP/SockJS connection lifecycle:
- Connects when `token` appears in `authStore`
- Disconnects when `token` is cleared (logout)
- Subscribes to `/user/queue/notifications`
- On message: calls `prependNotification(payload)` + `toast(payload.message)`
- Reconnects every 5 seconds on drop

Connect headers: `Authorization: Bearer <token>`

---

### `src/hooks/usePageTitle.ts`
```ts
usePageTitle(title: string)
```
Sets `document.title = "${title} — XBC Expenses"` on mount, restores previous title on unmount. Used by every page.

---

## Layout & Shell

### `src/components/AppLayout.tsx`
Renders the full authenticated shell. **Not** re-mounted between route changes — `<Outlet />` swaps child pages.

**Sub-components inside the file:**

| Component | Purpose |
|---|---|
| `GroupNavItem` | Collapsible group row in sidebar with color dot + sub-links |
| `Breadcrumb` | Parses `pathname` regex to produce breadcrumb trail |
| `NotificationList` | Shared list used by both desktop popover and mobile popover |
| `NotificationPopover` | Desktop header bell → `<Popover>` with unread count badge |
| `MobileNotifTab` | Bottom-bar bell button → same popover variant |
| `UserMenu` | Avatar → `<Popover>` with Profile and Sign out buttons |

**Sidebar features:**
- Width: 240 px expanded / 64 px collapsed (icon-only). Collapse state persisted in `localStorage['sidebar-collapsed']`
- Groups loaded via `useQuery(['my-groups'], getMyGroups)`
- Active group detected from URL: `/groups/:groupId` regex
- Active group auto-expands its sub-link list on navigation
- `SUB_PAGES` constant drives all per-group sub-links:
  - `/expenses` → Expenses
  - `/events` → Events
  - `` (end match) → Members
  - `/audit` → Audit Log
  - `/settings` → Settings

**Header:**
- Left: `<Breadcrumb>` (derived from `pathname`)
- Right: `<NotificationPopover>` + `<UserMenu>`

**Mobile bottom bar (< 768 px):**
- Home → `/dashboard`
- Groups → `/dashboard`
- Alerts → `<MobileNotifTab>`
- Profile → logout

**Notification icons** (`N_ICON` / `N_ICON_STYLE` / `N_ACCENT` maps):

| `type` | Icon | Color |
|---|---|---|
| `EXPENSE_ADDED` | PlusCircle | Emerald |
| `EXPENSE_UPDATED` | Pencil | Blue |
| `MEMBER_JOINED` | UserCheck | Violet |
| `INVITE_RECEIVED` | Mail | Amber |
| `PERMISSION_CHANGED` | Shield | Rose |

---

### `src/components/ProtectedRoute.tsx`
Reads `isAuthenticated` from `useAuth()`. If false, renders `<Navigate to="/login" replace />`. Otherwise renders `<Outlet />`.

---

### `src/components/GroupCard.tsx`
Simple presentational card shown on the Dashboard. Displays group name, member count, and total expense amount. Clicking navigates to `/groups/:groupId`.

---

## UI Primitives

All components in `src/components/ui/` are shadcn/ui components built on **`@base-ui/react`** v1.4.1 instead of Radix UI. The key difference: use `render={<Component />}` instead of `asChild`.

| File | Component | Key Props / Notes |
|---|---|---|
| `button.tsx` | `<Button>` | `variant`: default, outline, ghost, destructive, link. `size`: default, sm, lg, icon, icon-sm, xs |
| `input.tsx` | `<Input>` | Wraps `@base-ui/react/input`. Single-line text field. Use `aria-invalid` for error state |
| `label.tsx` | `<Label>` | Plain `<label>` with muted styling |
| `avatar.tsx` | `<Avatar>` + `<AvatarFallback>` | `size="sm"` for 32 px variant |
| `badge.tsx` | `<Badge>` | `variant`: default, secondary, destructive, outline, success. Success = emerald |
| `card.tsx` | `<Card>`, `<CardHeader>`, `<CardContent>`, `<CardFooter>` | Bordered container |
| `skeleton.tsx` | `<Skeleton>` | Animated pulse placeholder |
| `separator.tsx` | `<Separator>` | `<hr>` styled divider |
| `tabs.tsx` | `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` | `variant="line"` for underline style; default is pill |
| `dialog.tsx` | `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>` | `showCloseButton` prop on Content; override width with `className="sm:max-w-[680px]"` |
| `alert-dialog.tsx` | `<AlertDialog>`, `<AlertDialogContent>`, `<AlertDialogCancel>`, `<AlertDialogAction>` | `AlertDialogCancel` uses `render={<Button />}`. `size="sm"` for compact variant |
| `sheet.tsx` | `<Sheet>`, `<SheetContent>`, `<SheetHeader>`, `<SheetTitle>` | `side="right"`. Width controlled by className on `SheetContent` |
| `popover.tsx` | `<Popover>`, `<PopoverTrigger>`, `<PopoverContent>` | Trigger uses `render={<button />}` pattern |
| `calendar.tsx` | `<Calendar>` | Date picker from `react-day-picker`. Used inside `<Controller>` in forms |

---

## Feature Components

### `src/components/expenses/ExpenseSheet.tsx`
Side sheet (`side="right"`, `sm:max-w-[480px]`) for **creating and editing** expenses.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `groupId` | `string` | Group context |
| `open` | `boolean` | Controls sheet visibility |
| `onOpenChange` | `(v: boolean) => void` | |
| `editingExpense` | `ExpenseDto \| null` | Pre-fills form when editing |
| `categories?` | `CategoryDto[]` | Passed as `initialData` to internal query |
| `onSuccess` | `() => void` | Called after create/update |

**Form fields** (react-hook-form + zod):
- `title` (2–200 chars)
- `amount` (positive number, 2 decimal places)
- `currency` (USD / EUR / TND / GBP / MAD — shown with symbol prefix)
- `categoryId` → triggers subcategory reset
- `subcategoryId` (optional)
- `eventId` (optional — only shows ACTIVE / UPCOMING events)
- `date` (`<Calendar>` via `<Controller>`)
- `description` (max 500 chars, char counter)

**Multi-file upload:**
- `react-dropzone`: accepts `image/*` + `application/pdf`, max 5 files, max 10 MB each
- Per-file progress via `uploadFileWithProgress()` with functional state update
- Image files: `URL.createObjectURL(blob)` thumbnail preview, revoked on cleanup
- PDF files: `FileText` icon
- Remove uploaded file → calls `deleteFile(fileId)` + revokes object URL
- Submit blocked while any file is still uploading (`anyUploading` flag)

**Server-side error mapping:**
On HTTP 400, maps `body.errors` object fields to react-hook-form `setError(field, { message })` per field.

**`fileEntriesRef` pattern:**
A `useRef` mirrors the `fileEntries` state so `handleDrop` (wrapped in `useCallback([groupId])`) can read the current count without stale closure.

---

### `src/components/expenses/ExpenseDetailModal.tsx`
Dialog (`sm:max-w-[680px]`, `max-h-[90vh]`, scrollable body) for **viewing** expense detail.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `expenseId` | `string \| null` | Which expense to load |
| `groupId` | `string` | Group context |
| `open` | `boolean` | |
| `onOpenChange` | `(v: boolean) => void` | |
| `canEdit` | `boolean` | Shows Edit / Delete buttons |
| `initialExpense?` | `ExpenseDto` | Avoids loading flash if already known |
| `onEditClick?` | `(expense: ExpenseDto) => void` | Parent opens ExpenseSheet |

**Internal queries** (all use cached data where available):
- `['expense', groupId, expenseId]` — the expense itself
- `['categories', groupId]` — for category color + name
- `['events', groupId]` — for event name
- `['group', groupId]` — for "added by" member email
- `['audit', groupId, 'EXPENSE', expenseId]` — activity timeline

**Attachment display:**
Fetches each fileId from `/api/files/:fileId` as `responseType: 'blob'`, creates object URLs in a `useEffect`. Images show as clickable thumbnails → opens Lightbox. PDFs show `FileText` icon → opens in new tab. All object URLs revoked on close or unmount.

**Lightbox:**
Full-screen fixed overlay at `z-[100]`. Prev/next buttons, keyboard nav (`Escape` / `ArrowLeft` / `ArrowRight`), image counter badge.

**Audit trail:**
Badges per action — `CREATED` → success (green), `UPDATED` → outline (amber-ish), `DELETED` → destructive (red).

**404 handling:**
`axios.isAxiosError(error) && error.response?.status === 404` → shows "This expense no longer exists" empty state instead of trying to render.

---

### `src/components/expenses/SummaryChart.tsx`
Recharts visualizations for the Dashboard:
- **Bar chart** (`BarChart` + `ResponsiveContainer`): monthly spending for last 6 months
- **Donut chart** (`PieChart` + `Pie` + `Cell` + `Legend`): spending by category

---

### `src/components/categories/CategoriesTab.tsx`
Manages categories and subcategories inline within a tab panel.

**Features:**
- Accordion rows: click chevron to expand and see subcategories
- Inline name rename (click pencil → `<InlineEdit>` → blur/Enter saves, Escape cancels)
- Color picker (`<input type="color">`) — triggers `updateCategory` on change
- Icon field (Lucide icon name as text, e.g. `"home"`) — rendered dynamically via `LucideIcons[key]`
- Subcategory chips with inline rename and delete
- "Add subcategory" inline form at the bottom of each expanded row
- "Add category" form at the bottom of the list (color picker + name + icon)
- Inline delete confirm (Yes/No buttons inline, no separate dialog)

**Optimistic updates:**
Uses `useQueryClient().setQueryData` to instantly reflect changes before server confirmation. Rolls back via `onError` if the mutation fails.

---

## Pages

### `src/pages/LoginPage.tsx`
Public route. Email + password form. On success, calls `setAuth(user, token)` and navigates to `/dashboard`.

### `src/pages/RegisterPage.tsx`
Public route. Username + email + password form. Same flow as login on success.

### `src/pages/InvitePage.tsx`
Public route at `/invite?token=xxx`. Reads `?token` from the URL, calls `acceptInvitation(token)`, shows success message, auto-redirects to `/dashboard` after a delay.

---

### `src/pages/DashboardPage.tsx`
Home page. Uses `useQueries` for maximum parallelism — fetches for every group simultaneously:
- `getExpenseSummary(groupId)` — totals and category breakdown
- `getExpenses(groupId, ...)` — recent expenses
- `getCategories(groupId)` — for category names and colors
- `getAuditLogs(groupId, ...)` — recent activity
- `getGroupInvitations(groupId).catch(() => [])` — pending invites (graceful 404 fallback)

**Metric cards** (aggregated across all groups):
- Total balance (sum of all group expense totals)
- This month spending
- Total expenses count
- Active groups count

**Left column:**
- Bar chart (monthly spending — last 6 months, `last6Months()` helper)
- Recent expenses table

**Right column:**
- Donut chart (by category, with `categoryColorMap` from fetched data)
- Groups list
- Activity feed (formatted from audit logs)

**Empty state:** When user has no groups — shows `FolderOpen` icon + "Create your first group" button.

---

### `src/pages/GroupPage.tsx`
Route: `/groups/:groupId`. Shows the group's Members and Categories tabs. Contains an `InviteDialog` (separate from GroupSettingsPage — dialog-based invite form). Members list uses `MemberRow` component with inline permission select and remove button.

> **Note:** Most group management has moved to `GroupSettingsPage`. This page focuses on quick member overview and categories.

---

### `src/pages/ExpensesPage.tsx`
Route: `/groups/:groupId/expenses`. Full expense list with:
- Filter panel (date range, category, amount range)
- Sortable columns (date, amount, title)
- Server-side pagination
- "Add Expense" → opens `<ExpenseSheet>`
- Row click → opens `<ExpenseDetailModal>`
- Edit action in detail modal → closes modal, opens sheet in edit mode

---

### `src/pages/EventsPage.tsx`
Route: `/groups/:groupId/events`. Lists events (trips, projects) that group expenses. CRUD with status lifecycle (`UPCOMING → ACTIVE → CLOSED`).

---

### `src/pages/AuditPage.tsx`
Route: `/groups/:groupId/audit`. Full audit log table using `@tanstack/react-table` with:
- Filters: `entityType`, `action`, `userId`, `dateFrom`, `dateTo`
- Colored `action` column badges
- Server-side pagination

---

### `src/pages/GroupSettingsPage.tsx`
Route: `/groups/:groupId/settings`. Four-tab settings page.

**Overview tab:**
- Inline-edit group name (click text → input, saves on blur / Enter, cancels on Escape)
- Inline-edit description (same pattern, `<textarea>`)
- Stats grid: Created date, Members count, Expenses count, Categories count
- **Danger zone** (owner only): "Delete group" button → `<AlertDialog>` with type-to-confirm pattern (must type the exact group name to enable the confirm button)

**Members tab:**
- All members in a bordered list
- Owner row: `Crown` icon, "Owner" badge, no action controls
- Current user row: highlighted with `bg-primary/[0.03]` + left border + "(you)" chip
- Other members (when viewer is owner): permission `<select>` calling `updateMemberPermission` + `UserMinus` remove button → `<AlertDialog>` confirm

**Categories tab:**
Delegates entirely to `<CategoriesTab groupId={groupId} canEdit={canEdit} />`.

**Invitations tab:**
- Inline invite form (email + permission select + Send Invite)
- On success: green info box with copyable invite link (`navigator.clipboard.writeText`)
- Invitations table: all invitations with permission badge + status badge (PENDING=amber, ACCEPTED=green, EXPIRED=grey)
- Cancel button (PENDING only) → `<AlertDialog>` confirm → `cancelInvitation()`
- Empty state with `Mail` icon

---

## Data Flow Diagram

```
User Action
    │
    ▼
Page / Component
    │  react-hook-form (forms)
    │  useMutation (write)
    │  useQuery / useQueries (read)
    ▼
api/*.ts functions
    │  axios instance (JWT header auto-attached)
    ▼
Spring Boot Backend  ←──────────────── WebSocket (STOMP/SockJS)
    │                                       │
    │  JSON response                        │  Push notification
    ▼                                       ▼
React Query cache ←──────────── notificationStore (Zustand)
    │                                       │
    ▼                                       ▼
Component re-renders                  Notification bell + toast
```

---

## Key Patterns

### 1. Query key conventions
```
['my-groups']                         — all groups for current user
['group', groupId]                    — single group
['expenses', groupId]                 — paginated expense list
['expenses-count', groupId]           — expense total count (size=1 query)
['expense', groupId, expenseId]       — single expense
['expense-summary', groupId]          — totals and category breakdown
['categories', groupId]               — all categories for group
['events', groupId]                   — all events for group
['invitations', groupId]              — all invitations for group
['audit', groupId, entityType, id]    — audit logs filtered by entity
```

### 2. Optimistic updates (CategoriesTab pattern)
```ts
// 1. Cancel in-flight queries
await queryClient.cancelQueries({ queryKey: key });
// 2. Snapshot for rollback
const previous = queryClient.getQueryData<T[]>(key);
// 3. Apply optimistic change
queryClient.setQueryData<T[]>(key, (old = []) => updater(old));
// 4. onError: rollback
queryClient.setQueryData(key, previous);
// 5. onSettled: re-fetch from server
queryClient.invalidateQueries({ queryKey: key });
```

### 3. File blob lifecycle (ExpenseDetailModal)
```ts
// Fetch
const res = await api.get(`/api/files/${fid}`, { responseType: 'blob' });
const url = URL.createObjectURL(res.data);
// Cleanup (on close or unmount)
blobsRevokeRef.current.forEach(URL.revokeObjectURL);
```

### 4. `fileEntriesRef` (stable callback with mutable state)
`handleDrop` is wrapped in `useCallback([groupId])` for stability. Since it needs the current file count, a `useRef` mirrors the state array so the callback reads the ref (always current) instead of closing over stale state.

### 5. Inline edit save-on-blur pattern
```ts
// click display text → enter edit mode
onClick={() => setNameEdit(group.name)}
// Input:
onBlur={commitName}
onKeyDown={(e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitName(); }
  if (e.key === 'Escape') setNameEdit(null);
}}
```

### 6. `prevCategoryRef` (avoid subcategory reset on mount)
When `categoryId` changes in `ExpenseSheet`, subcategory is reset — but only on an actual change, not on initial render. A `prevRef` tracks the previous value to distinguish the two cases.

### 7. Type-to-confirm delete
```tsx
<Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
<Button disabled={confirmText !== group.name || mutation.isPending}>Delete</Button>
```

### 8. Parallel group data fetching (Dashboard)
```ts
const results = useQueries({
  queries: groups.map((g) => ({
    queryKey: ['expenses', g.id],
    queryFn: () => getExpenses(g.id, {}, 0, 5, 'date', 'desc'),
  })),
});
```

### 9. 404 detection
```ts
import axios from 'axios';
const is404 = axios.isAxiosError(error) && error.response?.status === 404;
```

### 10. Permission guard pattern
```ts
const isOwner  = group.ownerId === user?.id;
const canEdit  = isOwner || group.members.some(
  (m) => m.userId === user?.id && m.permission === 'EDIT'
);
```
