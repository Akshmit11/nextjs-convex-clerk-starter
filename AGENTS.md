# AGENTS.md - Agentic Coding Guidelines

## IMPORTANT: Retrieval-Led Reasoning
**PREFER retrieval-led reasoning over pre-training-led reasoning for ALL tech stack decisions.**
- Always query documentation using Context7 or load skills from `.opencode/skills` before writing code
- Do not rely on training data - it may be outdated or incorrect
- Tech evolves fast: Convex, Next.js 16, Clerk, Tailwind v4 all change regularly
- When in doubt, fetch current docs first

## Development Workflow
1. **Explore project first** - Read existing files, understand patterns, check AGENTS.md
2. **Invoke skills in .opencode/skills** - Use `skill` tool to load relevant guides
3. **Consult documentation** - Use `context7_query-docs` for library-specific questions
4. **Implement following patterns** - Match existing code style and conventions

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npx convex dev           # Start Convex dev backend (auto-generates .env.local)

# Build & Quality
npm run build            # Production build
npm run lint             # Run ESLint
```

**Note:** No test framework configured. Add Jest/Vitest if tests are needed.

## Project Structure

```
app/                    # Next.js App Router pages
├── layout.tsx          # Root layout with providers (Clerk, Convex, Toaster)
├── globals.css         # Tailwind v4 @theme inline styles
├── page.tsx            # Landing page
└── dashboard/          # Protected routes

components/
├── ui/                 # shadcn/ui components
├── Header.tsx          # Navigation with auth state
└── ConvexClientProvider.tsx

convex/                 # Backend
├── schema.ts           # Database schema with indexes
├── users.ts            # Queries/mutations for user operations
├── http.ts             # HTTP actions (webhooks)
└── auth.config.ts      # Auth provider config

lib/
└── utils.ts            # cn() utility for className merging

proxy.ts                # Next.js 16 middleware (replaces middleware.ts)
```

## Component Patterns

### Server Components (Default)
```tsx
// No "use client" directive - runs on server
const Component = () => { ... }
export default Component
```

### Client Components
```tsx
"use client"  // Required for React hooks, event handlers, Convex queries
import { useQuery } from 'convex/react'

const Component = () => { ... }
export default Component
```

**Shadcn Component Pattern:**
- Use `cva()` for variants (see `components/ui/button.tsx`)
- Use `cn()` for className merging: `className={cn("base", className)}`
- Forward ref when needed, support `asChild` for Radix Slots

## TypeScript Guidelines

**Strict Mode Enabled:**
- All files must have proper types
- Use `Readonly` for props in Next.js 16: `Readonly<{ children: React.ReactNode }>`
- No implicit `any`, use proper typing

**Convex Validation:**
```tsx
import { v } from "convex/values"

export const mutation = mutation({
  args: {
    name: v.string(),
    externalId: v.string(),
  },
  handler: async (ctx, args) => { ... }
})
```

## Naming Conventions

- **Components:** PascalCase - `Header.tsx`, `UserProfile.tsx`
- **Functions/Variables:** camelCase - `getCurrentUser`, `userAttributes`
- **File Exports:** Named exports for utilities, default for components
- **Convex Functions:** Snake_case in schema (`byExternalId`), camelCase in exports

## Convex Patterns

### Schema Definition
```tsx
export default defineSchema({
  users: defineTable({
    name: v.string(),
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),
});
```

### Queries & Mutations
```tsx
// Query - useQuery in client components
export const current = query({
  args: {},
  handler: async (ctx) => { ... }
})

// Mutation - useMutation in client components
export const upsert = mutation({
  args: { data: v.any() },
  handler: async (ctx, args) => { ... }
})

// Internal Mutation - call via internal.*
export const internalFunction = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => { ... }
})
```

### HTTP Actions (Webhooks)
```tsx
import { httpRouter, httpAction } from "convex/server"

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate, process, return Response
    return new Response(null, { status: 200 })
  })
})
```

### Auth Patterns
```tsx
// Get authenticated user
const identity = await ctx.auth.getUserIdentity()
if (identity === null) return null

// Use Authenticated/Unauthenticated in React
import { Authenticated, Unauthenticated } from "convex/react"
<Authenticated><UserButton /></Authenticated>
```

## Styling - Tailwind CSS v4

**@theme inline pattern in `app/globals.css`:**
```css
@import "tailwindcss";
@theme inline {
  --color-primary: var(--primary);
  /* CSS variable mappings */
}
```

**Component Styling:**
- Use Tailwind utility classes directly
- Dark mode: `dark:text-white` (handled by next-themes)
- Use `cn()` for conditional classes: `cn("base-class", isActive && "active-class")`
- shadcn components use CSS variables defined in globals.css

## Authentication - Clerk

**Next.js 16 Proxy Pattern:**
- Use `proxy.ts` (NOT middleware.ts) with `clerkMiddleware`
- Protect routes: `await auth.protect()`

**Providers (in app/layout.tsx):**
1. `<ClerkProvider>` wraps entire app
2. `<ConvexProviderWithClerk>` connects Convex to Clerk auth

**Client Auth State:**
```tsx
import { SignInButton, UserButton } from "@clerk/nextjs"
import { Authenticated, Unauthenticated } from "convex/react"
```

## Error Handling

**Environment Variables:**
```tsx
if (!process.env.VARIABLE_NAME) {
  throw new Error('Missing VARIABLE_NAME in .env')
}
```

**Webhook Responses:**
```tsx
return new Response(null, { status: 200 })  // Success
return new Response("Error message", { status: 400 })  // Error
```

**Convex User Operations:**
```tsx
const user = await userByExternalId(ctx, id)
if (user === null) { /* handle missing */ }
```

## Code Style Notes

- Single quotes for imports, double quotes for JSX strings
- No semicolons (consistent with existing code)
- Early returns over deep nesting
- Console logs for ignored events, throw for critical errors
- Use `console.warn` for non-critical warnings

## Key Libraries

- **Next.js 16** - App Router, Server Actions, Cache Components
- **React 19.2.3** - React hooks, Concurrent features
- **Convex 1.31.3** - Backend as a service, real-time
- **Clerk** - Auth, user management
- **shadcn/ui** - Pre-built components, New York style
- **Tailwind CSS v4** - Utility-first styling
- **class-variance-authority** - Component variants
- **clsx + tailwind-merge** - cn() utility

## When Adding Features

1. Load relevant skill: `skill({name: "nextjs"})` or `skill({name: "convex"})`
2. Query docs: `context7_query-docs({libraryId, query})`
3. Follow existing patterns in this codebase
4. Run `npm run lint` after changes
5. Test auth flows if touching authentication
