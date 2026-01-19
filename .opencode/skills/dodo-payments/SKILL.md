---
name: dodo-payments
description: This skill should be used when integrating Dodo Payments into a project using Convex. It covers installation, configuration, checkout flows, customer portal access, and webhook handling within the Convex backend.
---

# Dodo Payments Skill

This skill provides guidance for integrating Dodo Payments with a Convex backend, using the `@dodopayments/convex` package. It covers setting up checkout flows, managing customer portals, and handling webhooks securely.

## When to Use This Skill

Use this skill when:
- Adding payment processing to a Convex application
- Implementing checkout flows for one-time purchases or subscriptions
- enabling users to manage their subscriptions via a Customer Portal
- Handling payment webhooks (success, failure, subscription updates) in Convex
- Mapping authenticated users to Dodo Payments customers

## Skill Resources

The documentation in `docs/dodopayments.md` (specifically the "Convex Component" section) provides the source of truth.

### Core Concepts
- **Convex Component**: The integration is done via a Convex component defined in `convex.config.ts`.
- **Identity Mapping**: You must provide an `identify` function to map the current authenticated user (from `ctx.auth`) to a Dodo Payments customer ID stored in your database.
- **Session-Based Checkout**: The recommended flow is to create a checkout session on the server (Convex action) and redirect the client to the returned URL.

## Installation & Configuration

1.  **Install Package**:
    ```bash
    npm install @dodopayments/convex
    ```

2.  **Configure Convex**:
    Add to `convex/convex.config.ts`:
    ```typescript
    import { defineApp } from "convex/server";
    import dodopayments from "@dodopayments/convex/convex.config";

    const app = defineApp();
    app.use(dodopayments);
    export default app;
    ```
    Run `npx convex dev` to generate types.

3.  **Environment Variables**:
    Set these in Convex Dashboard:
    - `DODO_PAYMENTS_API_KEY`
    - `DODO_PAYMENTS_ENVIRONMENT` ("test_mode" or "live_mode")
    - `DODO_PAYMENTS_WEBHOOK_SECRET`

## Implementation Steps

### 1. Identify Function & Client Setup
Create `convex/dodo.ts` to initialize the client and map users.

```typescript
import { DodoPayments, DodoPaymentsClientConfig } from "@dodopayments/convex";
import { components } from "./_generated/api";
import { internal } from "./_generated/api";

export const dodo = new DodoPayments(components.dodopayments, {
  identify: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Fetch user from your database to get dodoCustomerId
    // This assumes you have an internal query to look up users by auth ID
    const user = await ctx.runQuery(internal.users.getByAuthId, {
      authId: identity.subject,
    });

    if (!user) return null;

    return {
      dodoCustomerId: user.dodoCustomerId,
    };
  },
  apiKey: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode",
} as DodoPaymentsClientConfig);

export const { checkout, customerPortal } = dodo.api();
```

### 2. Checkout Action
Create a Convex action (e.g., in `convex/payments.ts`) to generate checkout sessions.

```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import { checkout } from "./dodo";

export const createCheckout = action({
  args: {
    productId: v.string(),
    quantity: v.number(),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await checkout(ctx, {
      payload: {
        product_cart: [{
          product_id: args.productId,
          quantity: args.quantity
        }],
        return_url: args.returnUrl,
        billing_currency: "USD",
      },
    });
    return session;
  },
});
```

### 3. Customer Portal
Create an action to get the portal URL.

```typescript
import { action } from "./_generated/server";
import { customerPortal } from "./dodo";

export const getPortalUrl = action({
  args: {},
  handler: async (ctx) => {
    return await customerPortal(ctx, { send_email: false });
  },
});
```

### 4. Webhook Handling
Configure the HTTP router in `convex/http.ts`.

```typescript
import { createDodoWebhookHandler } from "@dodopayments/convex";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/dodopayments-webhook",
  method: "POST",
  handler: createDodoWebhookHandler({
    onPaymentSucceeded: async (ctx, payload) => {
      // Handle payment success (e.g., update DB)
       await ctx.runMutation(internal.webhooks.handlePaymentSuccess, {
         paymentId: payload.data.payment_id,
         // ... extract other fields
       });
    },
    // Add other handlers: onSubscriptionActive, onSubscriptionCancelled, etc.
  }),
});

export default http;
```

## Key Guidelines

- **Always use `action`**: Dodo Payments operations involve external API calls, so they must be Convex Actions, not Mutations or Queries (though webhooks can call mutations).
- **Secure IDs**: Never trust client-side user IDs. Always use `ctx.auth` in the `identify` callback.
- **Webhooks**: Remember to register the webhook URL in the Dodo Payments dashboard matching your Convex deployment URL (ending in `/dodopayments-webhook`).
- **Frontend**: In React components, use `useAction(api.payments.createCheckout)` and redirect `window.location.href` to the returned `checkout_url`.
