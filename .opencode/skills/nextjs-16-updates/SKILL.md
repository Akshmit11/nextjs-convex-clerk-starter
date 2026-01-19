---
name: nextjs-16-updates
description: Strict guide for Next.js 15 and 16 breaking changes. Focuses on Async Request APIs (awaiting params, cookies), Caching defaults, and React 19 integration. Use this when upgrading projects or writing strictly modern Next.js code.
---

# Next.js 16 / 15 Breaking Changes & Best Practices

Use this skill to ensure compliance with Next.js 15+ breaking changes.

## 1. Async Request APIs (CRITICAL)

Dynamic APIs that rely on runtime values are now **asynchronous**. You **MUST** await them.

### `params` and `searchParams` in Layouts/Pages

**❌ Legacy (Sync) - Will Error/Warn:**
```typescript
// app/blog/[slug]/page.tsx
export default function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>; 
}
```

**✅ Modern (Async):**
```typescript
// app/blog/[slug]/page.tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // Await before using!
  return <h1>{slug}</h1>;
}
```

### `cookies()` and `headers()`

**❌ Legacy (Sync):**
```typescript
import { cookies } from 'next/headers';

export default function Page() {
  const cookieStore = cookies(); // Sync call deprecated
  const token = cookieStore.get('token');
}
```

**✅ Modern (Async):**
```typescript
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies(); // Await strictly required
  const token = cookieStore.get('token');
}
```

## 2. Caching Defaults (GET Requests)

By default, `fetch` requests, GET Route Handlers, and Client Router Cache are **NOT cached** by default.

**❌ Legacy Assumption:**
"This fetch is static by default." (No longer true)

**✅ Modern Explicit Caching:**
If you want static behavior (SSG), you must opt-in:

```typescript
// Force cache (SSG behavior)
const data = await fetch('https://api.example.com', { cache: 'force-cache' });

// Or ISR
const data = await fetch('https://api.example.com', { next: { revalidate: 3600 } });
```

## 3. React 19 Integration

### Use `useActionState` instead of `useFormState`
`useFormState` is deprecated in favor of `useActionState`.

**✅ Modern Form:**
```typescript
"use client";
import { useActionState } from 'react';
import { updateProfile } from './actions';

export function ProfileForm() {
  const [state, action, isPending] = useActionState(updateProfile, null);
  
  return (
    <form action={action}>
      <input name="email" />
      <button disabled={isPending}>Save</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

## 4. Server Actions Security

Ensure strict validation and auth checks, as Server Actions are public endpoints.

```typescript
"use server";
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

const schema = z.object({ id: z.string() });

export async function deleteItem(formData: FormData) {
  // 1. Authenticate
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 2. Validate
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input" };

  // 3. Mutate
  await db.delete(parsed.data.id);
}
```
