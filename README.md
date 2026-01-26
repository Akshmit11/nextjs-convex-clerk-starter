# Next.js Project

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

---

### 2. Run Development Server
First, run the development server:

```bash
npm run dev
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

You can start editing the page by modifying:

```bash
app/page.tsx
```

The page auto-updates as you edit the file.

---

## Fonts

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

---

## Convex Setup

### 1. Initialize Convex

```bash
npx convex dev
```

* Create a new Convex project or select an existing one.
* This will automatically generate a `.env.local` file.

---

## Clerk Authentication Setup

### 1. Create Clerk Project

* Go to [Clerk Dashboard](https://dashboard.clerk.com)
* Create a new project
* Follow Clerk’s official setup instructions
* Add the provided environment variables to `.env.local`

---

### 2. Next.js 16 Note

> **Important**
> Next.js 16 requires using `proxy.ts` instead of `middleware.ts` for authentication handling.

---

## JWT Configuration (Clerk + Convex)

Follow the official documentation:
[https://docs.convex.dev/auth/clerk](https://docs.convex.dev/auth/clerk)

### Steps:

1. Generate a JWT token in Clerk
2. Copy the **Issuer URL**
3. Add it to Convex:

**Convex Dashboard → Settings → Environment Variables**

```bash
CLERK_JWT_ISSUER_DOMAIN=your_issuer_domain
```

---

## Webhook Setup

Follow documentation:
[https://docs.convex.dev/auth/database-auth#set-up-webhooks](https://docs.convex.dev/auth/database-auth#set-up-webhooks)

### Steps:

1. Create a webhook in Clerk
2. Copy the webhook secret
3. Add it to Convex:

**Convex Dashboard → Settings → Environment Variables**

```bash
CLERK_WEBHOOK_SECRET=your_webhook_secret
```

---

### 3. Context7 Setup

* Go to [Context7 Dashboard](https://context7.com/dashboard)
* Create api key
* Add the key in opencode.json

## Learn More

* [Next.js Documentation](https://nextjs.org/docs)
* [Learn Next.js](https://nextjs.org/learn)
* [Next.js GitHub](https://github.com/vercel/next.js)

