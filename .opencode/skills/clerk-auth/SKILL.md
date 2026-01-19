---
name: clerk-auth
description: Authentication with Clerk, specifically tailored for Next.js App Router and Convex integration. Covers middleware, components, hooks, and database syncing via webhooks.
---

# Clerk Authentication Skill

Use this skill for implementing or managing authentication.

## Critical Integration: Clerk + Convex

### 1. Convex Auth Config
File: `convex/auth.config.ts`
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN, // e.g. https://your-clerk-domain.clerk.accounts.dev
      applicationID: "convex",
    },
  ],
};
```

### 2. Client Provider (Next.js)
File: `components/ConvexClientProvider.tsx`
```typescript
"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

## Next.js Middleware
## Next.js 16 Auth Proxy (`proxy.ts`)
**Important:** Next.js 16 requires using `proxy.ts` instead of `middleware.ts` for authentication.

File: `proxy.ts` (in root)
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)", 
  "/sign-up(.*)",
  "/api/webhooks(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/(.(?!_next|[^?]*.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*$)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

## Webhooks (User Sync)
**Crucial**: Sync Clerk users to Convex `users` table to maintain relationships.

1.  **Convex Http Action**: `convex/http.ts` - Handle `POST /clerk-users-webhook`.
2.  **Verify Signature**: Use `svix` package to verify `svix-id`, `svix-timestamp`, `svix-signature`.
3.  **Internal Mutations**: Call `internal.users.create`, `internal.users.update`, `internal.users.delete` based on event type (`user.created`, `user.updated`, `user.deleted`).

## Components & Hooks
-   **Protect Routes**: 
    -   Client: `<Protect fallback={<RedirectToSignIn />}>{children}</Protect>`
    -   Server: `auth().protect()`
-   **User Data**: 
    -   Client: `const { user } = useUser();`
    -   Server: `const user = await currentUser();`
-   **Auth State**: 
    -   `const { isLoaded, isSignedIn, userId } = useAuth();`
    -   **Important**: When using `ConvexProviderWithClerk`, `useQuery` automatically sends the auth token. In backend, use `ctx.auth.getUserIdentity()`.

## Common Tasks

### Get Current User in Convex Query/Mutation
```typescript
export const getMyData = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");
    
    // identity.subject is the Clerk userId
    const user = await ctx.runQuery(internal.users.getByAuthId, { authId: identity.subject });
    return user;
  },
});
```

### Sign Out
```typescript
const { signOut } = useAuth();
// <button onClick={() => signOut(() => router.push("/"))}>Sign out</button>
```
