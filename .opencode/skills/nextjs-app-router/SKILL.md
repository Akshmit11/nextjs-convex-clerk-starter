---
name: nextjs-app-router
description: Best practices for Next.js App Router (v15/v16+). Covers Server Components, Async APIs (params/cookies), Server Actions, and Caching.
---

# Next.js App Router Skill

Use this skill when building features or refactoring code in the `app/` directory.

## Core Concepts

### 1. Server vs Client Components
-   **Server Components (Default)**: Use for data fetching, accessing backend resources, and keeping sensitive keys on the server.
    -   Cannot use: hooks (`useState`, `useEffect`), event listeners.
    -   **Async APIs**: In v15+, `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous and must be awaited.
-   **Client Components**: Add `"use client"` at the top. Use for interactivity, state, and browser APIs.
    -   **Tip**: Pass Server Components as `children` to Client Components to avoid de-optimization.

### 2. Data Fetching
-   **Fetch in Server Components**:
    -   **Caching**: By default, `fetch` requests are **NOT cached** in v15+. Use `next: { revalidate: 3600 }` to opt-in to caching.
    ```typescript
    async function Page() {
      const data = await getData(); // Direct DB call or fetch
      return <Display data={data} />;
    }
    ```
-   **Convex Integration**:
    -   Use `fetchQuery` or `preloadQuery` in Server Components.
    -   Use `useQuery` in Client Components.

### 3. Async Request APIs (Important for v15+)
Dynamic data interfaces are now asynchronous.

**❌ Legacy (Sync):**
```typescript
export default function Page({ params }: { params: { slug: string } }) {
  return <div>{params.slug}</div>;
}
```

**✅ Modern (Async):**
```typescript
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div>{slug}</div>;
}
```

### 4. Server Actions
Use for form submissions and mutations.
```typescript
// app/actions.ts
"use server";

export async function submitForm(formData: FormData) {
  const value = formData.get("key");
  await mutateData(value);
  revalidatePath("/path");
}
```

### 5. Routing & Files
-   `layout.tsx`: Shared UI (nav, footer). Preserves state on navigation.
-   `page.tsx`: Unique UI for a route.
-   `loading.tsx`: Suspense boundary during load.
-   `error.tsx`: Error boundary (must be Client Component).
-   `not-found.tsx`: Custom 404 UI.
-   `route.ts`: API endpoints (GET, POST, etc.).

## Best Practices

### Metadata
Export `metadata` object or `generateMetadata` function from `page.tsx` or `layout.tsx`.
```typescript
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Page",
  description: "Description",
};
```

### Navigation
-   Use `<Link href="...">` for internal nav.
-   Use `useRouter()` (from `next/navigation`) for programmatic changes (Client Components only).
-   Use `redirect()` (from `next/navigation`) in Server Components.

### Image Component
Always use `<Image />` for assets.
```typescript
import Image from "next/image";
```

### Fonts
Use `next/font/google`.
```typescript
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
// Apply to body via className={inter.className}
```
