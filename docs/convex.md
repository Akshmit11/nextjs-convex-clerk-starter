# Convex Overview

Convex is the open source, reactive database where queries are TypeScript code running right in the database. Just like React components react to state changes, Convex queries react to database changes.

Convex provides a database, a place to write your server functions, and client libraries. It makes it easy to build and scale dynamic live-updating apps.

The following diagram shows the standard three-tier app architecture that Convex enables. We'll start at the bottom and work our way up to the top of this diagram.

![Convex in your app](/assets/images/basic-diagram-8ad312f058c3cf7e15c3396e46eedb48.png)

## Database[​](#database "Direct link to Database")

The [database](/database.md) is at the core of Convex. The Convex database is automatically provisioned when you create your project. There is no connection setup or cluster management.

info

In Convex, your database queries are just [TypeScript code](/database/reading-data/.md) written in your [server functions](/functions.md). There is no SQL to write. There are no ORMs needed.

The Convex database is reactive. Whenever any data on which a query depends changes, the query is rerun, and client subscriptions are updated.

Convex is a "document-relational" database. "Document" means you put JSON-like nested objects into your database. "Relational" means you have tables with relations, like `tasks` assigned to a `user` using IDs to reference documents in other tables.

The Convex cloud offering runs on top of Amazon RDS using MySQL as its persistence layer. The Open Source version uses SQLite, Postgres and MySQL. The database is ACID-compliant and uses [serializable isolation and optimistic concurrency control](/database/advanced/occ.md). All that to say, Convex provides the strictest possible transactional guarantees, and you never see inconsistent data.

## Server functions[​](#server-functions "Direct link to Server functions")

When you create a new Convex project, you automatically get a `convex/` folder where you write your [server functions](/functions.md). This is where all your backend application logic and database query code live.

Example TypeScript server functions that read (query) and write (mutation) to the database.

convex/tasks.ts

```
// A Convex query function
export const getAllOpenTasks = query({
  args: {},
  handler: async (ctx, args) => {
    // Query the database to get all items that are not completed
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_completed", (q) => q.eq("completed", false))
      .collect();
    return tasks;
  },
});

// A Convex mutation function
export const setTaskCompleted = mutation({
  args: { taskId: v.id("tasks"), completed: v.boolean() },
  handler: async (ctx, { taskId, completed }) => {
    // Update the database using TypeScript
    await ctx.db.patch("tasks", taskId, { completed });
  },
});
```

You read and write to your database through query or mutation functions. [Query functions](/functions/query-functions.md) are pure functions that can only read from the database. [Mutation functions](/functions/mutation-functions.md) are transactions that can read or write from the database. These two database functions are [not allowed to take any non-deterministic](/functions/runtimes.md#restrictions-on-queries-and-mutations) actions like network requests to ensure transactional guarantees.

info

The entire Convex mutation function is a transaction. There are no `begin` or `end` transaction statements to write. Convex automatically retries the function on conflicts, and you don't have to manage anything.

Convex also provides standard general-purpose serverless functions called actions. [Action functions](/functions/actions.md) can make network requests. They have to call query or mutation functions to read and write to the database. You use actions to call LLMs or send emails.

You can also durably schedule Convex functions via the [scheduler](/scheduling/scheduled-functions.md) or [cron jobs](/scheduling/cron-jobs.md). Scheduling lets you build workflows like emailing a new user a day later if they haven't performed an onboarding task.

You call your Convex functions via [client libraries](/client/react.md) or directly via [HTTP](/http-api/.md#functions-api).

## Client libraries[​](#client-libraries "Direct link to Client libraries")

Convex client libraries keep your frontend synced with the results of your server functions.

```
// In your React component
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function TaskList() {
  const data = useQuery(api.tasks.getAllOpenTasks);
  return data ?? "Loading...";
}
```

Like the `useState` hook that updates your React component when local state changes, the Convex `useQuery` hook automatically updates your component whenever the result of your query changes. There's no manual subscription management or state synchronization needed.

When calling query functions, the client library subscribes to the results of the function. Convex tracks the dependencies of your query functions, including what data was read from the database. Whenever relevant data in the database changes, the Convex automatically reruns the query and sends the result to the client.

The client library also queues up mutations in memory to send to the server. As mutations execute and cause query results to update, the client library keeps your app state consistent. It updates all subscriptions to the same logical moment in time in the database.

Convex provides client libraries for nearly all popular web and native app frameworks. Client libraries connect to your Convex deployment via WebSockets. You can then call your public Convex functions [through the library](/client/react.md#fetching-data). You can also use Convex with [HTTP directly](/http-api/.md#functions-api), you just won't get the automatic subscriptions.

## Putting it all together[​](#putting-it-all-together "Direct link to Putting it all together")

Let's return to the `getAllOpenTasks` Convex query function from earlier that gets all tasks that are not marked as `completed`:

convex/tasks.ts

```
export const getAllOpenTasks = query({
  args: {},
  handler: async (ctx, args) => {
    // Query the database to get all items that are not completed
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_completed", (q) => q.eq("completed", false))
      .collect();
    return tasks;
  },
});
```

Let's follow along what happens when you subscribe to this query:

![Convex data flow](/assets/images/convex-query-subscription-945e7990515e438ab4385f9b4803bbd4.png)

The web app uses the `useQuery` hook to subscribe to this query, and the following happens to get an initial value:

* The Convex client sends a message to the Convex server to subscribe to the query
* The Convex server runs the function, which reads data from the database
* The Convex server sends a message to the client with the function's result

In this case the initial result looks like this (1):

```
[
  { _id: "e4g", title: "Grocery shopping", complete: false },
  { _id: "u9v", title: "Plant new flowers", complete: false },
];
```

Then you use a mutation to mark an item as completed (2). Convex then reruns the query (3) to get an updated result. And pushes the result to the web app via the WebSocket connection (4):

```
[
  { _id: "e4g", title: "Grocery shopping", complete: false },
];
```

## Beyond reactivity[​](#beyond-reactivity "Direct link to Beyond reactivity")

Beyond reactivity, Convex's architecture is crucial for a deeper reason. Convex does not let your app have inconsistent state at any layer of the stack.

To illustrate this, let's imagine you're building a shopping cart for an e-commerce store.

![Convex in your app](/assets/images/convex-swaghaus-dcc9919685db6a7f34378afc500f68cd.png)

On the product listing page, you have two numbers, one showing the number of items remaining in stock and another showing the number of items in your shopping cart. Each number is a result of a different query function.

Every time you press the "Add to Cart" button, a mutation is called to remove one item from the stock and add it to the shopping cart.

The mutation to change the cart runs in a transaction, so your database is always in a consistent state. The reactive database knows that the queries showing the number of items in stock and the number of items in the shopping cart both need to be updated. The queries are invalidated and rerun. The results are pushed to the web app via the WebSocket connection.

The client library makes sure that both queries update at the same time in the web app since they reflect a singular moment in time in your database. You never have a moment where those numbers don't add up. Your app always shows consistent data.

You can see this example in action in the [Swaghaus sample app](https://swaghaus.biz/).

## For human and AI generated code[​](#for-human-and-ai-generated-code "Direct link to For human and AI generated code")

Convex is designed around a small set of composable abstractions with strong guarantees that result in code that is not only faster to write, it’s easier to read and maintain, whether written by a team member or an LLM. Key features make sure you get bug-free AI generated code:

1. **Queries are Just TypeScript** Your database queries are pure TypeScript functions with end-to-end type safety and IDE support. This means AI can generate database code using the large training set of TypeScript code without switching to SQL.
2. **Less Code for the Same Work** Since so much infrastructure and boiler plate is automatically managed by Convex there is less code to write, and thus less code to get wrong.
3. **Automatic Reactivity** The reactive system automatically tracks data dependencies and updates your UI. AI doesn't need to manually manage subscriptions, WebSocket connections, or complex state synchronization—Convex handles all of this automatically.
4. **Transactional Guarantees** Queries are read-only and mutations run in transactions. These constraints make it nearly impossible for AI to write code that could corrupt your data or leave your app in an inconsistent state.

Together, these features mean AI can focus on your business logic while Convex's guarantees prevent common failure modes.

## Learn more[​](#learn-more "Direct link to Learn more")

If you are intrigued about the details of how Convex pulls this all off, you can read Convex co-founder Sujay's excellent [How Convex Works](https://stack.convex.dev/how-convex-works) blog post.

Now that you have a good sense of how Convex fits in your app. Let's walk through the overall workflow of setting up and launching a Convex app.

# Best Practices

This is a list of best practices and common anti-patterns around using Convex. We recommend going through this list before broadly releasing your app to production. You may choose to try using all of these best practices from the start, or you may wait until you've gotten major parts of your app working before going through and adopting the best practices here.

## Await all Promises[​](#await-all-promises "Direct link to Await all Promises")

### Why?[​](#why "Direct link to Why?")

Convex functions use async / await. If you don't await all your promises (e.g. `await ctx.scheduler.runAfter`, `await ctx.db.patch`), you may run into unexpected behavior (e.g. failing to schedule a function) or miss handling errors.

### How?[​](#how "Direct link to How?")

We recommend the [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/) eslint rule with TypeScript.

## Avoid `.filter` on database queries[​](#avoid-filter-on-database-queries "Direct link to avoid-filter-on-database-queries")

### Why?[​](#why-1 "Direct link to Why?")

Filtering in code instead of using the `.filter` syntax has the same performance, and is generally easier code to write. Conditions in `.withIndex` or `.withSearchIndex` are more efficient than `.filter` or filtering in code, so almost all uses of `.filter` should either be replaced with a `.withIndex` or `.withSearchIndex` condition, or written as TypeScript code.

Read through the [indexes documentation](/database/reading-data/indexes/indexes-and-query-perf.md) for an overview of how to define indexes and how they work.

### Examples[​](#examples "Direct link to Examples")

convex/messages.ts

TS

```
// ❌
const tomsMessages = ctx.db
  .query("messages")
  .filter((q) => q.eq(q.field("author"), "Tom"))
  .collect();

// ✅
// Option 1: Use an index
const tomsMessages = await ctx.db
  .query("messages")
  .withIndex("by_author", (q) => q.eq("author", "Tom"))
  .collect();

// Option 2: Filter in code
const allMessages = await ctx.db.query("messages").collect();
const tomsMessages = allMessages.filter((m) => m.author === "Tom");
```

### How?[​](#how-1 "Direct link to How?")

Search for `.filter` in your Convex codebase — a regex like `\.filter\(\(?q` will probably find all the ones on database queries.

Decide whether they should be replaced with a `.withIndex` condition — per [this section](/understanding/best-practices/.md#only-use-collect-with-a-small-number-of-results), if you are filtering over a large (1000+) or potentially unbounded number of documents, you should use an index. If not using a `.withIndex` / `.withSearchIndex` condition, consider replacing them with a filter in code for more readability and flexibility.

See [this article](https://stack.convex.dev/complex-filters-in-convex) for more strategies for filtering.

### Exceptions[​](#exceptions "Direct link to Exceptions")

Using `.filter` on a paginated query (`.paginate`) has advantages over filtering in code. The paginated query will return the number of documents requested, including the `.filter` condition, so filtering in code afterwards can result in a smaller page or even an empty page. Using `.withIndex` on a paginated query will still be more efficient than a `.filter`.

## Only use `.collect` with a small number of results[​](#only-use-collect-with-a-small-number-of-results "Direct link to only-use-collect-with-a-small-number-of-results")

### Why?[​](#why-2 "Direct link to Why?")

All results returned from `.collect` count towards database bandwidth (even ones filtered out by `.filter`). It also means that if any document in the result changes, the query will re-run or the mutation will hit a conflict.

If there's a chance the number of results is large (say 1000+ documents), you should use an index to filter the results further before calling `.collect`, or find some other way to avoid loading all the documents such as using pagination, denormalizing data, or changing the product feature.

### Example[​](#example "Direct link to Example")

**Using an index:**

convex/movies.ts

TS

```
// ❌ -- potentially unbounded
const allMovies = await ctx.db.query("movies").collect();
const moviesByDirector = allMovies.filter(
  (m) => m.director === "Steven Spielberg",
);

// ✅ -- small number of results, so `collect` is fine
const moviesByDirector = await ctx.db
  .query("movies")
  .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
  .collect();
```

**Using pagination:**

convex/movies.ts

TS

```
// ❌ -- potentially unbounded
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .collect();

// ✅ -- using pagination, showing recently watched movies first
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .order("desc")
  .paginate(paginationOptions);
```

**Using a limit or denormalizing:**

convex/movies.ts

TS

```
// ❌ -- potentially unbounded
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .collect();
const numberOfWatchedMovies = watchedMovies.length;

// ✅ -- Show "99+" instead of needing to load all documents
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .take(100);
const numberOfWatchedMovies =
  watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();

// ✅ -- Denormalize the number of watched movies in a separate table
const watchedMoviesCount = await ctx.db
  .query("watchedMoviesCount")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .unique();
```

### How?[​](#how-2 "Direct link to How?")

Search for `.collect` in your Convex codebase (a regex like `\.collect\(` will probably find these). And think through whether the number of results is small. This function health page in the dashboard can also help surface these.

The [aggregate component](https://www.npmjs.com/package/@convex-dev/aggregate) or [database triggers](https://stack.convex.dev/triggers) can be helpful patterns for denormalizing data.

### Exceptions[​](#exceptions-1 "Direct link to Exceptions")

If you're doing something that requires loading a large number of documents (e.g. performing a migration, making a summary), you may want to use an action to load them in batches via separate queries / mutations.

## Check for redundant indexes[​](#check-for-redundant-indexes "Direct link to Check for redundant indexes")

### Why?[​](#why-3 "Direct link to Why?")

Indexes like `by_foo` and `by_foo_and_bar` are usually redundant (you only need `by_foo_and_bar`). Reducing the number of indexes saves on database storage and reduces the overhead of writing to the table.

convex/teams.ts

TS

```
// ❌
const allTeamMembers = await ctx.db
  .query("teamMembers")
  .withIndex("by_team", (q) => q.eq("team", teamId))
  .collect();
const currentUserId = /* get current user id from `ctx.auth` */
const currentTeamMember = await ctx.db
  .query("teamMembers")
  .withIndex("by_team_and_user", (q) =>
    q.eq("team", teamId).eq("user", currentUserId),
  )
  .unique();

// ✅
// Just don't include a condition on `user` when querying for results on `team`
const allTeamMembers = await ctx.db
  .query("teamMembers")
  .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
  .collect();
const currentUserId = /* get current user id from `ctx.auth` */
const currentTeamMember = await ctx.db
  .query("teamMembers")
  .withIndex("by_team_and_user", (q) =>
    q.eq("team", teamId).eq("user", currentUserId),
  )
  .unique();
```

### How?[​](#how-3 "Direct link to How?")

Look through your indexes, either in your `schema.ts` file or in the dashboard, and look for any indexes where one is a prefix of another.

### Exceptions[​](#exceptions-2 "Direct link to Exceptions")

`.index("by_foo", ["foo"])` is really an index on the properties `foo` and `_creationTime`, while `.index("by_foo_and_bar", ["foo", "bar"])` is an index on the properties `foo`, `bar`, and `_creationTime`. If you have queries that need to be sorted by `foo` and then `_creationTime`, then you need both indexes.

For example, `.index("by_channel", ["channel"])` on a table of messages can be used to query for the most recent messages in a channel, but `.index("by_channel_and_author", ["channel", "author"])` could not be used for this since it would first sort the messages by `author`.

## Use argument validators for all public functions[​](#use-argument-validators-for-all-public-functions "Direct link to Use argument validators for all public functions")

### Why?[​](#why-4 "Direct link to Why?")

Public functions can be called by anyone, including potentially malicious attackers trying to break your app. [Argument validators](/functions/validation.md) (as well as return value validators) help ensure you're getting the traffic you expect.

### Example[​](#example-1 "Direct link to Example")

convex/messages.ts

TS

```
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage = mutation({
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
```

### How?[​](#how-4 "Direct link to How?")

Search for `query`, `mutation`, and `action` in your Convex codebase, and ensure that all of them have argument validators (and optionally return value validators). If you have `httpAction`s, you may want to use something like `zod` to validate that the HTTP request is the shape you expect.

## Use some form of access control for all public functions[​](#use-some-form-of-access-control-for-all-public-functions "Direct link to Use some form of access control for all public functions")

### Why?[​](#why-5 "Direct link to Why?")

Public functions can be called by anyone, including potentially malicious attackers trying to break your app. If portions of your app should only be accessible when the user is signed in, make sure all these Convex functions check that `ctx.auth.getUserIdentity()` is set.

You may also have specific checks, like only loading messages that were sent to or from the current user, which you'll want to apply in every relevant public function.

Favoring more granular functions like `setTeamOwner` over `updateTeam` allows more granular checks for which users can do what.

Access control checks should either use `ctx.auth.getUserIdentity()` or a function argument that is unguessable (e.g. a UUID, or a Convex ID, provided that this ID is never exposed to any client but the one user). In particular, don't use a function argument which could be spoofed (e.g. email) for access control checks.

### Example[​](#example-2 "Direct link to Example")

convex/teams.ts

TS

```
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch("teams", id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch("teams", id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch("teams", id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch("teams", id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch("teams", id, { name: name });
  },
});
```

### How?[​](#how-5 "Direct link to How?")

Search for `query`, `mutation`, `action`, and `httpAction` in your Convex codebase, and ensure that all of them have some form of access control. [Custom functions](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#custom-functions) like [`authenticatedQuery`](https://stack.convex.dev/custom-functions#modifying-the-ctx-argument-to-a-server-function-for-user-auth) can be helpful.

Some apps use Row Level Security (RLS) to check access to each document automatically whenever it's loaded, as described in [this article](https://stack.convex.dev/row-level-security). Alternatively, you can check access in each Convex function instead of checking access for each document.

Helper functions for common checks and common operations can also be useful -- e.g. `isTeamMember`, `isTeamAdmin`, `loadTeam` (which throws if the current user does not have access to the team).

## Only schedule and `ctx.run*` internal functions[​](#only-schedule-and-ctxrun-internal-functions "Direct link to only-schedule-and-ctxrun-internal-functions")

### Why?[​](#why-6 "Direct link to Why?")

Public functions can be called by anyone, including potentially malicious attackers trying to break your app, and should be carefully audited to ensure they can't be used maliciously. Functions that are only called within Convex can be marked as internal, and relax these checks since Convex will ensure that internal functions can only be called within Convex.

### How?[​](#how-6 "Direct link to How?")

Search for `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` in your Convex codebase. Also search for `ctx.scheduler` and check the `crons.ts` file. Ensure all of these use `internal.foo.bar` functions instead of `api.foo.bar` functions.

If you have code you want to share between a public Convex function and an internal Convex function, create a helper function that can be called from both. The public function will likely have additional access control checks.

Alternatively, make sure that `api` from `_generated/api.ts` is never used in your Convex functions directory.

### Examples[​](#examples-1 "Direct link to Examples")

convex/teams.ts

TS

```
// ❌ -- using `api`
export const sendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
import { MutationCtx } from './_generated/server';
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
```

## Use helper functions to write shared code[​](#use-helper-functions-to-write-shared-code "Direct link to Use helper functions to write shared code")

### Why?[​](#why-7 "Direct link to Why?")

Most logic should be written as plain TypeScript functions, with the `query`, `mutation`, and `action` wrapper functions being a thin wrapper around one or more helper function.

Concretely, most of your code should live in a directory like `convex/model`, and your public API, which is defined with `query`, `mutation`, and `action`, should have very short functions that mostly just call into `convex/model`.

Organizing your code this way makes several of the refactors mentioned in this list easier to do.

See the [TypeScript page](/understanding/best-practices/typescript.md) for useful types.

### Example[​](#example-3 "Direct link to Example")

**❌** This example overuses `ctx.runQuery` and `ctx.runMutation`, which is discussed more in the [Avoid sequential `ctx.runMutation` / `ctx.runQuery` from actions](/understanding/best-practices/.md#avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions) section.

convex/users.ts

TS

```
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */
    const userSettings = /* load other documents related to the user */
    return { user, settings: userSettings };
  },
});
```

convex/conversations.ts

TS

```
export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get("conversations", conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */
    return messages;
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    const summary = /* call some external service to summarize the conversation */
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
```

**✅** Most of the code here is now in the `convex/model` directory. The API for this application is in `convex/conversations.ts`, which contains very little code itself.

convex/model/users.ts

TS

```
import { QueryCtx } from '../_generated/server';

export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */
  const userSettings = /* load other documents related to the user */
  return { user, settings: userSettings };
}
```

convex/model/conversations.ts

TS

```
import { QueryCtx, MutationCtx } from '../_generated/server';
import * as Users from './users';

export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get("conversations", conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */
  return messages;
}

export async function addSummary(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch("conversations", conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  const summary = /* call some external service to summarize the conversation */
  return summary;
}
```

convex/conversations.ts

TS

```
import * as Conversations from './model/conversations';

export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
```

## Use `runAction` only when using a different runtime[​](#use-runaction-only-when-using-a-different-runtime "Direct link to use-runaction-only-when-using-a-different-runtime")

### Why?[​](#why-8 "Direct link to Why?")

Calling `runAction` has more overhead than calling a plain TypeScript function. It counts as an extra function call with its own memory and CPU usage, while the parent action is doing nothing except waiting for the result. Therefore, `runAction` should almost always be replaced with calling a plain TypeScript function. However, if you want to call code that requires Node.js from a function in the Convex runtime (e.g. using a library that requires Node.js), then you can use `runAction` to call the Node.js code.

### Example[​](#example-4 "Direct link to Example")

convex/scrape.ts

TS

```
// ❌ -- using `runAction`
export const scrapeWebsite = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
```

convex/model/scrape.ts

TS

```
import { ActionCtx } from '../_generated/server';

// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
```

convex/scrape.ts

TS

```
import * as Scrape from './model/scrape';

export const scrapeWebsite = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
```

### How?[​](#how-7 "Direct link to How?")

Search for `runAction` in your Convex codebase, and see if the function it calls uses the same runtime as the parent function. If so, replace the `runAction` with a plain TypeScript function. You may want to structure your functions so the Node.js functions are in a separate directory so it's easier to spot these.

## Avoid sequential `ctx.runMutation` / `ctx.runQuery` calls from actions[​](#avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions "Direct link to avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions")

### Why?[​](#why-9 "Direct link to Why?")

Each `ctx.runMutation` or `ctx.runQuery` runs in its own transaction, which means if they're called separately, they may not be consistent with each other. If instead we call a single `ctx.runQuery` or `ctx.runMutation`, we're guaranteed that the results we get are consistent.

### How?[​](#how-8 "Direct link to How?")

Audit your calls to `ctx.runQuery` and `ctx.runMutation` in actions. If you see multiple in a row with no other code between them, replace them with a single `ctx.runQuery` or `ctx.runMutation` that handles both things. Refactoring your code to use helper functions will make this easier.

### Example: Queries[​](#example-queries "Direct link to Example: Queries")

convex/teams.ts

TS

```
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
```

convex/teams.ts

TS

```
import * as Teams from './model/teams';
import * as Users from './model/users';

export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
```

### Example: Loops[​](#example-loops "Direct link to Example: Loops")

convex/teams.ts

TS

```
import * as Users from './model/users';

export const importTeams = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
```

convex/teams.ts

TS

```
import * as Users from './model/users';

export const importTeams = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
```

### Exceptions[​](#exceptions-3 "Direct link to Exceptions")

If you're intentionally trying to process more data than fits in a single transaction, like running a migration or aggregating data, then it makes sense to have multiple sequential `ctx.runMutation` / `ctx.runQuery` calls.

Multiple `ctx.runQuery` / `ctx.runMutation` calls are often necessary because the action does a side effect in between them. For example, reading some data, feeding it to an external service, and then writing the result back to the database.

## Use `ctx.runQuery` and `ctx.runMutation` sparingly in queries and mutations[​](#use-ctxrunquery-and-ctxrunmutation-sparingly-in-queries-and-mutations "Direct link to use-ctxrunquery-and-ctxrunmutation-sparingly-in-queries-and-mutations")

### Why?[​](#why-10 "Direct link to Why?")

While these queries and mutations run in the same transaction, and will give consistent results, they have extra overhead compared to plain TypeScript functions. Wanting a TypeScript helper function is much more common than needing `ctx.runQuery` or `ctx.runMutation`.

### How?[​](#how-9 "Direct link to How?")

Audit your calls to `ctx.runQuery` and `ctx.runMutation` in queries and mutations. Unless one of the exceptions below applies, replace them with a plain TypeScript function.

### Exceptions[​](#exceptions-4 "Direct link to Exceptions")

* If you're using components, these require `ctx.runQuery` or `ctx.runMutation`.
* If you want partial rollback on an error, you will want `ctx.runMutation` instead of a plain TypeScript function.

convex/messages.ts

TS

```
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
```

# TypeScript

Convex provides end-to-end type support when Convex functions are written in [TypeScript](https://www.typescriptlang.org/).

You can gradually add TypeScript to a Convex project: the following steps provide progressively better type support. For the best support you'll want to complete them all.

**Example:** [TypeScript and Schema](https://github.com/get-convex/convex-demos/tree/main/typescript)

## Writing Convex functions in TypeScript[​](#writing-convex-functions-in-typescript "Direct link to Writing Convex functions in TypeScript")

The first step to improving type support in a Convex project is to writing your Convex functions in TypeScript by using the `.ts` extension.

If you are using [argument validation](/functions/validation.md), Convex will infer the types of your functions arguments automatically:

convex/sendMessage.ts

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  // Convex knows that the argument type is `{body: string, author: string}`.
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author });
  },
});
```

Otherwise you can annotate the arguments type manually:

convex/sendMessage.ts

```
import { internalMutation } from "./_generated/server";

export default internalMutation({
  // To convert this function from JavaScript to
  // TypeScript you annotate the type of the arguments object.
  handler: async (ctx, args: { body: string; author: string }) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author });
  },
});
```

This can be useful for [internal functions](/functions/internal-functions.md) accepting complicated types.

If TypeScript is installed in your project `npx convex dev` and `npx convex deploy` will typecheck Convex functions before sending code to the Convex backend.

Convex functions are typechecked with the `tsconfig.json` in the Convex folder: you can modify some parts of this file to change typechecking settings, or delete this file to disable this typecheck.

You'll find most database methods have a return type of `Promise<any>` until you add a schema.

## Adding a schema[​](#adding-a-schema "Direct link to Adding a schema")

Once you [define a schema](/database/schemas.md) the type signature of database methods will be known. You'll also be able to use types imported from `convex/_generated/dataModel` in both Convex functions and clients written in TypeScript (React, React Native, Node.js etc.).

The types of documents in tables can be described using the [`Doc`](/generated-api/data-model.md#doc) type from the generated data model and references to documents can be described with parametrized [Document IDs](/database/document-ids.md).

convex/messages.ts

```
import { query } from "./_generated/server";

export const list = query({
  args: {},
  // The inferred return type of `handler` is now `Promise<Doc<"messages">[]>`
  handler: (ctx) => {
    return ctx.db.query("messages").collect();
  },
});
```

## Type annotating server-side helpers[​](#type-annotating-server-side-helpers "Direct link to Type annotating server-side helpers")

When you want to reuse logic across Convex functions you'll want to define helper TypeScript functions, and these might need some of the provided context, to access the database, authentication and any other Convex feature.

Convex generates types corresponding to documents and IDs in your database, `Doc` and `Id`, as well as `QueryCtx`, `MutationCtx` and `ActionCtx` types based on your schema and declared Convex functions:

convex/helpers.ts

```
// Types based on your schema
import { Doc, Id } from "./_generated/dataModel";
// Types based on your schema and declared functions
import {
  QueryCtx,
  MutationCtx,
  ActionCtx,
  DatabaseReader,
  DatabaseWriter,
} from "./_generated/server";
// Types that don't depend on schema or function
import {
  Auth,
  StorageReader,
  StorageWriter,
  StorageActionWriter,
} from "convex/server";

// Note that a `MutationCtx` also satisfies the `QueryCtx` interface
export function myReadHelper(ctx: QueryCtx, id: Id<"channels">) {
  /* ... */
}

export function myActionHelper(ctx: ActionCtx, doc: Doc<"messages">) {
  /* ... */
}
```

### Inferring types from validators[​](#inferring-types-from-validators "Direct link to Inferring types from validators")

Validators can be reused between [argument validation](/functions/validation.md) and [schema validation](/database/schemas.md). You can use the provided [`Infer`](/api/modules/values.md#infer) type to get a TypeScript type corresponding to a validator:

convex/helpers.ts

```
import { Infer, v } from "convex/values";

export const courseValidator = v.union(
  v.literal("appetizer"),
  v.literal("main"),
  v.literal("dessert"),
);

// The corresponding type can be used in server or client-side helpers:
export type Course = Infer<typeof courseValidator>;
// is inferred as `'appetizer' | 'main' | 'dessert'`
```

### Document types without system fields[​](#document-types-without-system-fields "Direct link to Document types without system fields")

All documents in Convex include the built-in `_id` and `_creationTime` fields, and so does the generated `Doc` type. When creating or updating a document you might want use the type without the system fields. Convex provides [`WithoutSystemFields`](/api/modules/server.md#withoutsystemfields) for this purpose:

convex/helpers.ts

```
import { MutationCtx } from "./_generated/server";
import { WithoutSystemFields } from "convex/server";
import { Doc } from "./_generated/dataModel";

export async function insertMessageHelper(
  ctx: MutationCtx,
  values: WithoutSystemFields<Doc<"messages">>,
) {
  // ...
  await ctx.db.insert("messages", values);
  // ...
}
```

## Writing frontend code in TypeScript[​](#writing-frontend-code-in-typescript "Direct link to Writing frontend code in TypeScript")

All Convex JavaScript clients, including React hooks like [`useQuery`](/api/modules/react.md#usequery) and [`useMutation`](/api/modules/react.md#usemutation) provide end to end type safety by ensuring that arguments and return values match the corresponding Convex functions declarations. For React, install and configure TypeScript so you can write your React components in `.tsx` files instead of `.jsx` files.

Follow our [React](/quickstart/react.md) or [Next.js](/quickstart/nextjs.md) quickstart to get started with Convex and TypeScript.

### Type annotating client-side code[​](#type-annotating-client-side-code "Direct link to Type annotating client-side code")

When you want to pass the result of calling a function around your client codebase, you can use the generated types `Doc` and `Id`, just like on the backend:

src/App.tsx

```
import { Doc, Id } from "../convex/_generated/dataModel";

function Channel(props: { channelId: Id<"channels"> }) {
  // ...
}

function MessagesView(props: { message: Doc<"messages"> }) {
  // ...
}
```

You can also declare custom types inside your backend codebase which include `Doc`s and `Id`s, and import them in your client-side code.

You can also use `WithoutSystemFields` and any types inferred from validators via `Infer`.

#### Using inferred function return types[​](#using-inferred-function-return-types "Direct link to Using inferred function return types")

Sometimes you might want to annotate a type on the client based on whatever your backend function returns. Beside manually declaring the type (on the backend or on the frontend), you can use the generic `FunctionReturnType` and `UsePaginatedQueryReturnType` types with a function reference:

src/Components.tsx

```
import { FunctionReturnType } from "convex/server";
import { UsePaginatedQueryReturnType } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyHelperComponent(props: {
  data: FunctionReturnType<typeof api.myFunctions.getSomething>;
}) {
  // ...
}

export function MyPaginationHelperComponent(props: {
  paginatedData: UsePaginatedQueryReturnType<
    typeof api.myFunctions.getSomethingPaginated
  >;
}) {
  // ...
}
```

## Turning `string`s into valid document IDs[​](#turning-strings-into-valid-document-ids "Direct link to turning-strings-into-valid-document-ids")

See [Serializing IDs](/database/document-ids.md#serializing-ids).

## Required TypeScript version[​](#required-typescript-version "Direct link to Required TypeScript version")

Convex requires TypeScript version [5.0.3](https://www.npmjs.com/package/typescript/v/5.0.3) or newer.

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)

# Dev workflow

Let's walk through everything that needs to happen from creating a new project to launching your app in production.

This doc assumes you are building an app with Convex and React and you already have a basic React app already up and running. You can follow one of our [quickstarts](/quickstarts) to set this up.

## Installing and running Convex[​](#installing-and-running-convex "Direct link to Installing and running Convex")

You install Convex adding the npm dependency to your app:

```
npm i convex
```

Then you create your Convex project and start the backend dev loop:

```
npx convex dev
```

The first time you run the `npx convex dev` command you'll be asked whether you want start developing locally without an account or create an account.

### Developing without an account[​](#developing-without-an-account "Direct link to Developing without an account")

`npx convex dev` will prompt you for the name of your project, and then start running the open-source Convex backend locally on your machine (this is also called a "deployment").

The data for your project will be saved in the `~/.convex` directory.

1. The name of your project will get saved to your `.env.local` file so future runs of `npx convex dev` will know to use this project.
2. A `convex/` folder will be created (if it doesn't exist), where you'll write your Convex backend functions.

You can run `npx convex login` in the future to create an account and link any existing projects.

### Developing with an account[​](#developing-with-an-account "Direct link to Developing with an account")

`npx convex dev` will prompt you through creating an account if one doesn't exist, and will add your credentials to `~/.convex/config.json` on your machine. You can run `npx convex logout` to log you machine out of the account in the future.

Next, `npx convex dev` will create a new project and provision a new personal development deployment for this project:

1. Deployment details will automatically be added to your `.env.local` file so future runs of `npx convex dev` will know which dev deployment to connect to.
2. A `convex/` folder will be created (if it doesn't exist), where you'll write your Convex backend functions.

![Convex directory in your app](/assets/images/convex-directory-1ede9882007bf42d249b0561f2892c54.png)

## Running the dev loop[​](#running-the-dev-loop "Direct link to Running the dev loop")

Keep the `npx convex dev` command running while you're working on your Convex app. This continuously pushes backend code you write in the `convex/` folder to your deployment. It also keeps the necessary TypeScript types up-to-date as you write your backend code.

When you're developing with a locally running deployment, `npx convex dev` is also responsible for running your deployment.

You can then add new server functions to your Convex backend:

convex/tasks.ts

```
import { query } from "./_generated/server";
import { v } from "convex/values";

// Return the last 100 tasks in a given task list.
export const getTaskList = query({
  args: { taskListId: v.id("taskLists") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("taskListId", (q) => q.eq("taskListId", args.taskListId))
      .order("desc")
      .take(100);
    return tasks;
  },
});
```

When you write and save this code in your editor, several things happen:

1. The `npx convex dev` command typechecks your code and updates the `convex/_generated` directory.
2. The contents of your `convex/` directory get uploaded to your dev deployment.
3. Your Convex dev deployment analyzes your code and finds all Convex functions. In this example, it determines that `tasks.getTaskList` is a new public query function.
4. If there are any changes to the [schema](/database/schemas.md), the deployment will automatically enforce them.
5. The `npx convex dev` command updates generated TypeScript code in the `convex/_generated` directory to provide end to end type safety for your functions.

tip

Check in everything in your `convex/_generated/` directory. This it ensures that your code immediately type checks and runs without having to first run `npx convex dev`. It's particularly useful when non-backend developers are writing frontend code and want to ensure their code type checks against currently deployed backend code.

Once this is done you can use your new server function in your frontend:

src/App.tsx

```
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function App() {
  const data = useQuery(api.tasks.getTaskList);
  return data ?? "Loading...";
}
```

If you have other configuration like [crons](/scheduling/cron-jobs.md) or [auth](/auth.md) in your `convex/` folder, Convex ensures that they are applied and enforced on your backend.

## Convex dashboard[​](#convex-dashboard "Direct link to Convex dashboard")

The [Convex dashboard](/dashboard/deployments/.md) will be a trusty helper throughout your dev, debug and deploy workflow in Convex.

`npx convex dashboard` will open a link to the dashboard for your deployment.

### Logs[​](#logs "Direct link to Logs")

Since Convex functions are TypeScript functions you can always use the standard `console.log` and `console.time` functions to debug your apps.

Logs from your functions show up [in your dashboard](/dashboard/deployments/logs.md).

![Logs Dashboard Page](/assets/images/logs-ed208103a42edfb005e9089a8edad58e.png)

### Health, Data, Functions and more[​](#health-data-functions-and-more "Direct link to Health, Data, Functions and more")

* [Health](/dashboard/deployments/health.md) - provides invaluable information on how your app is performing in production, with deep insights on how your Convex queries are doing.
* [Data](/dashboard/deployments/data.md) - gives you a complete data browser to spot check your data.
* [Functions](/dashboard/deployments/functions.md) - gives you stats and run functions to debug them.

There is a lot more to to the dashboard. Be sure to click around or [check out the docs](/dashboard.md).

## Deploying your app[​](#deploying-your-app "Direct link to Deploying your app")

So far you've been working on your app against your personal dev deployment.

All Convex projects have one production deployment running in the cloud. It has separate data and has a separate push process from personal dev deployments, which allows you and your teammates to work on new features using personal dev deployments without disrupting your app running in production.

If you have not created a Convex account yet, you will need to do so with `npx convex login`. This will automatically link any projects you've started with your new account, and enable using your production deployment.

To push your code to your production deployment for your project you run the deploy command:

```
npx convex deploy
```

info

If you're running this command for the first time, it will automatically provision the prod deployment for your project.

### Setting up your deployment pipeline[​](#setting-up-your-deployment-pipeline "Direct link to Setting up your deployment pipeline")

It's rare to run `npx convex deploy` directly. Most production applications run an automated workflow that runs tests and deploys your backend and frontend together.

You can see detailed deployment and frontend configuration instructions in the [Hosting and Deployment](/production/hosting/.md) doc. For most React meta-frameworks Convex [automatically sets the correct environment variable](/production/hosting/vercel.md#how-it-works) to connect to the production deployment.

## Up next[​](#up-next "Direct link to Up next")

You now know the basics of how Convex works and fits in your app. Go head and explore the docs further to learn more about the specific features you want to use.

Whenever you're ready be sure the read the [Best Practices](/understanding/best-practices/.md), and then the [Zen of Convex](/understanding/zen.md) once you are ready to "think in Convex."


# The Zen of Convex

Convex is an opinionated framework, with every element designed to pull developers into [the pit of success](https://blog.codinghorror.com/falling-into-the-pit-of-success/).

The Zen of Convex is a set of guidelines & best practices developers have discovered that keep their projects falling into this wonderful pit.

## Performance<!-- -->

### Double down on the [sync engine](/tutorial/.md#how-convex-works)

There's a reason why a deterministic, reactive database is the beating heart of Convex: the more you center your apps around its properties, the better your projects will fare over time. Your projects will be easier to understand and refactor. Your app's performance will stay screaming fast. You won't have any consistency or state management problems.

Use a query for nearly every app read

Queries are the reactive, automatically cacheable, consistent and resilient way to propagate data to your application and its jobs. With very few exceptions, every read operation in your app should happen via a query function.

Keep sync engine functions light & fast

In general, your mutations and queries should be working with less than a few hundred records and should aim to finish in less than 100ms. It's nearly impossible to maintain a snappy, responsive app if your synchronous transactions involve a lot more work than this.

Use actions sparingly and incrementally

Actions are wonderful for batch jobs and/or integrating with outside services. They're very powerful, but they're slower, more expensive, and Convex provides a lot fewer guarantees about their behavior. So never use an action if a query or mutation will get the job done.

### <!-- -->Don't over-complicate client-side state management

Convex builds in a ton of its own caching and consistency controls into the app's client library. Rather than reinvent the wheel, let your client-side code take advantage of these built-in performance boosts.

Let Convex handle caching & consistency

You might be tempted to quickly build your own local cache or state aggregation layer in Convex to sit between your components and your Convex functions. With Convex, most of the time, you won't end up needing this. More often than not, you can bind your components to Convex functions in pretty simple ways and things will Just Work and be plenty fast.

Be thoughtful about the return values of mutations

Mutation return values can be useful to trigger state changes in your app, but it's rarely a good idea to use them to set in-app state to update the UI. Let queries and the sync engine do that.

## Architecture<!-- -->

### <!-- -->Create server-side frameworks using "just code"

Convex's built-in primitives are pretty low level! They're just functions. What about authentication frameworks? What about object-relational mappings? Do you need to wait until Convex ships some in-built feature to get those? Nope. In general, you should solve composition and encapsulation problems in your server-side Convex code using the same methods you use for the rest of your TypeScript code bases. After all, this is why Convex is "just code!" [Stack](https://stack.convex.dev) always has [great](https://stack.convex.dev/functional-relationships-helpers) [examples](https://stack.convex.dev/wrappers-as-middleware-authentication) of ways to tackle [these needs](https://stack.convex.dev/row-level-security).

### <!-- -->Don't misuse actions

Actions are powerful, but it's important to be intentional in how they fit into your app's data flow.

Don't invoke actions directly from your app

In general, it's an anti-pattern to call actions from the browser. Usually, actions are running on some dependent record that should be living in a Convex table. So it's best trigger actions by invoking a mutation that both *writes* that dependent record and *schedules* the subsequent action to run in the background.

Don't think 'background jobs', think 'workflow'

When actions are involved, it's useful to write chains of effects and mutations, such as:

action code → mutation → more action code → mutation.

Then apps or other jobs can follow along with queries.

Record progress one step at a time

While actions *could* work with thousands of records and call dozens of APIs, it's normally best to do smaller batches of work and/or to perform individual transformations with outside services. Then record your progress with a mutation, of course. Using this pattern makes it easy to debug issues, resume partial jobs, and report incremental progress in your app's UI.

## Development workflow<!-- -->

### <!-- -->Keep the dashboard by your side

Working on your Convex project without using the dashboard is like driving a car with your eyes closed. The dashboard lets you view logs, give mutations/queries/actions a test run, make sure your configuration and codebase are as you expect, inspect your tables, generate schemas, etc. It's an invaluable part of your rapid development cycle.

### <!-- -->Don't go it alone

Between these [docs](https://docs.convex.dev), [Stack](https://stack.convex.dev), and [our community](https://convex.dev/community), someone has *probably* encountered the design or architectural issue you're facing. So why try to figure things out the hard way, when you can take advantage of a whole community's experience?

Leverage Convex developer search

With so many great resources from the Convex team & community, it can be hard to know where to look first. If you want a quick way to search across all of these, [we have a portal for that](https://search.convex.dev)!

Join the Convex community

Whether you're stuck on a tricky use case, you have a question or feature request for the Convex team, or you're excited to share the amazing app(s) you've built and help others learn, the Convex community is there for you! Join the party on [Discord](https://convex.dev/community).

# Node.js Quickstart

Learn how to query data from Convex in a Node.js project.

For instructions for subscriptions instead of point-in-time queries and more project configurations (TypeScript, bundlers, CJS vs ESM) see [Node.js notes](/client/javascript/node.md).

1. Create a new npm project

   Create a new directory for your Node.js project.

   ```
   mkdir my-project && cd my-project && npm init -y && npm pkg set type="module"
   ```

2. Install the Convex client and server library

   Install the `convex` package which provides a convenient interface for working with Convex from JavaScript.

   Also install the `dotenv` library for loading `.env` files.

   ```
   npm install convex dotenv
   ```

3. Set up a Convex dev deployment

   Next, run `npx convex dev`. This will prompt you to log in with GitHub, create a project, and save your production and deployment URLs.

   It will also create a `convex/` folder for you to write your backend API functions in. The `dev` command will then continue running to sync your functions with your dev deployment in the cloud.

   ```
   npx convex dev
   ```

4. Create sample data for your database

   In a new terminal window, create a `sampleData.jsonl` file with some sample data.

   sampleData.jsonl

   ```
   {"text": "Buy groceries", "isCompleted": true}
   {"text": "Go for a swim", "isCompleted": true}
   {"text": "Integrate Convex", "isCompleted": false}
   ```

5. Add the sample data to your database

   Now that your project is ready, add a `tasks` table with the sample data into your Convex database with the `import` command.

   ```
   npx convex import --table tasks sampleData.jsonl
   ```

6. Expose a database query

   Add a new file `tasks.js` in the `convex/` folder with a query function that loads the data.

   Exporting a query function from this file declares an API function named after the file and the export name, `api.tasks.get`.

   convex/tasks.js

   ```
   import { query } from "./_generated/server";

   export const get = query({
     args: {},
     handler: async (ctx) => {
       return await ctx.db.query("tasks").collect();
     },
   });
   ```

7. Connect the script to your backend

   In a new file `script.js`, create a `ConvexHttpClient` using the URL of your development environment.

   script.js

   ```
   import { ConvexHttpClient } from "convex/browser";
   import { api } from "./convex/_generated/api.js";
   import * as dotenv from "dotenv";
   dotenv.config({ path: ".env.local" });

   const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

   client.query(api.tasks.get).then(console.log);
   ```

8. Run the script

   Run the script from the same directory and see the list of tasks logged to the terminal.

   ```
   node script.js
   ```

See the complete [Node.js documentation](/client/javascript/node.md).

# React Native Quickstart

Learn how to query data from Convex in a React Native app.

1. Create a React Native app

   Create a React Native app using the `npx create-expo-app` command.

   ```
   npx create-expo-app my-app
   ```

2. Install the Convex client and server library

   To get started, install the `convex` package which provides a convenient interface for working with Convex from a React app.

   Navigate to your app and install `convex`.

   ```
   cd my-app && npm install convex
   ```

3. Set up a Convex dev deployment

   Next, run `npx convex dev`. This will prompt you to log in with GitHub, create a project, and save your production and deployment URLs.

   It will also create a `convex/` folder for you to write your backend API functions in. The `dev` command will then continue running to sync your functions with your dev deployment in the cloud.

   ```
   npx convex dev
   ```

4. Create sample data for your database

   Create a `sampleData.jsonl` file with some sample data.

   sampleData.jsonl

   ```
   {"text": "Buy groceries", "isCompleted": true}
   {"text": "Go for a swim", "isCompleted": true}
   {"text": "Integrate Convex", "isCompleted": false}
   ```

5. Add the sample data to your database

   Now that your project is ready, add a `tasks` table with the sample data into your Convex database with the `import` command.

   ```
   npx convex import --table tasks sampleData.jsonl
   ```

6. Expose a database query

   Add a new file `tasks.ts` in the `convex/` folder with a query function that loads the data.

   Exporting a query function from this file declares an API function named after the file and the export name, `api.tasks.get`.

   convex/tasks.ts

   ```
   import { query } from "./_generated/server";

   export const get = query({
     args: {},
     handler: async (ctx) => {
       return await ctx.db.query("tasks").collect();
     },
   });
   ```

7. Reset the Expo project

   If you haven't done so yet, reset the Expo project to get a fresh `app` directory.

   ```
   npm run reset-project
   ```

8. Connect the app to your backend

   In `_layout.tsx`, create a `ConvexReactClient` and pass it to a `ConvexProvider` wrapping your component tree.

   app/\_layout.tsx

   ```
   import { ConvexProvider, ConvexReactClient } from "convex/react";
   import { Stack } from "expo-router";

   const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
     unsavedChangesWarning: false,
   });

   export default function RootLayout() {
     return (
       <ConvexProvider client={convex}>
         <Stack>
           <Stack.Screen name="index" />
         </Stack>
       </ConvexProvider>
     );
   }
   ```

9. Display the data in your app

   In `index.tsx` use the `useQuery` hook to fetch from your `api.tasks.get` API.

   app/index.tsx

   ```
   import { api } from "@/convex/_generated/api";
   import { useQuery } from "convex/react";
   import { Text, View } from "react-native";

   export default function Index() {
     const tasks = useQuery(api.tasks.get);
     return (
       <View
         style={{
           flex: 1,
           justifyContent: "center",
           alignItems: "center",
         }}
       >
         {tasks?.map(({ _id, text }) => <Text key={_id}>{text}</Text>)}
       </View>
     );
   }
   ```

10. Start the app

    Start the app, scan the provided QR code with your phone, and see the serialized list of tasks in the center of the screen.

    ```
    npm start
    ```

React native uses the same library as React web. See the complete [React documentation](/client/react.md).

# Next.js Quickstart

Convex + Next.js

Convex is an all-in-one backend and database that integrates quickly and easily with Next.js.

Once you've gotten started, see how to set up [hosting](/production/hosting/.md), [server rendering](/client/nextjs/app-router/server-rendering.md), and [auth](https://docs.convex.dev/client/nextjs/).

To get setup quickly with Convex and Next.js run

**`npm create convex@latest`**

**``**

or follow the guide below.

***

Learn how to query data from Convex in a Next.js app using the App Router and

TypeScript

Alternatively see the [Pages Router](/client/nextjs/pages-router/quickstart.md) version of this quickstart.

1. Create a Next.js app

   Create a Next.js app using the `npx create-next-app` command.

   Choose the default option for every prompt (hit Enter).

   ```
   npx create-next-app@latest my-app
   ```

2. Install the Convex client and server library

   To get started, install the `convex` package.

   Navigate to your app and install `convex`.

   ```
   cd my-app && npm install convex
   ```

3. Set up a Convex dev deployment

   Next, run `npx convex dev`. This will prompt you to log in with GitHub, create a project, and save your production and deployment URLs.

   It will also create a `convex/` folder for you to write your backend API functions in. The `dev` command will then continue running to sync your functions with your dev deployment in the cloud.

   ```
   npx convex dev
   ```

4. Create sample data for your database

   In a new terminal window, create a `sampleData.jsonl` file with some sample data.

   sampleData.jsonl

   ```
   {"text": "Buy groceries", "isCompleted": true}
   {"text": "Go for a swim", "isCompleted": true}
   {"text": "Integrate Convex", "isCompleted": false}
   ```

5. Add the sample data to your database

   Use the [`import`](/database/import-export/import.md) command to add a `tasks` table with the sample data into your Convex database.

   ```
   npx convex import --table tasks sampleData.jsonl
   ```

6. Expose a database query

   In the `convex/` folder, add a new file `tasks.ts` with a query function that loads the data.

   Exporting a query function from this file declares an API function named after the file and the export name: `api.tasks.get`.

   convex/tasks.ts

   TS

   ```
   import { query } from "./_generated/server";

   export const get = query({
     args: {},
     handler: async (ctx) => {
       return await ctx.db.query("tasks").collect();
     },
   });
   ```

7. Create a client component for the Convex provider

   For `<ConvexProvider>` to work on the client, `ConvexReactClient` must be passed to it.

   In the `app/` folder, add a new file `ConvexClientProvider.tsx` with the following code. This creates a client component that wraps `<ConvexProvider>` and passes it the `<ConvexReactClient>`.

   app/ConvexClientProvider.tsx

   TS

   ```
   "use client";

   import { ConvexProvider, ConvexReactClient } from "convex/react";
   import { ReactNode } from "react";

   const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

   export function ConvexClientProvider({ children }: { children: ReactNode }) {
     return <ConvexProvider client={convex}>{children}</ConvexProvider>;
   }
   ```

8. Wire up the ConvexClientProvider

   In `app/layout.tsx`, wrap the children of the `body` element with the `<ConvexClientProvider>`.

   app/layout.tsx

   TS

   ```
   import type { Metadata } from "next";
   import { Geist, Geist_Mono } from "next/font/google";
   import "./globals.css";
   import { ConvexClientProvider } from "./ConvexClientProvider";

   const geistSans = Geist({
     variable: "--font-geist-sans",
     subsets: ["latin"],
   });

   const geistMono = Geist_Mono({
     variable: "--font-geist-mono",
     subsets: ["latin"],
   });

   export const metadata: Metadata = {
     title: "Create Next App",
     description: "Generated by create next app",
   };

   export default function RootLayout({
     children,
   }: Readonly<{
     children: React.ReactNode;
   }>) {
     return (
       <html lang="en">
         <body
           className={`${geistSans.variable} ${geistMono.variable} antialiased`}
         >
           <ConvexClientProvider>{children}</ConvexClientProvider>
         </body>
       </html>
     );
   }
   ```

9. Display the data in your app

   In `app/page.tsx`, use the `useQuery()` hook to fetch from your `api.tasks.get` API function.

   app/page.tsx

   TS

   ```
   "use client";

   import Image from "next/image";
   import { useQuery } from "convex/react";
   import { api } from "../convex/_generated/api";

   export default function Home() {
     const tasks = useQuery(api.tasks.get);
     return (
       <main className="flex min-h-screen flex-col items-center justify-between p-24">
         {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
       </main>
     );
   }
   ```

10. Start the app

    Run your Next.js development server, open <http://localhost:3000> in a browser, and see the list of tasks.

    ```
    npm run dev
    ```

See the complete [Next.js documentation](/client/nextjs/app-router/.md).

# React Quickstart

[YouTube video player](https://www.youtube.com/embed/4MgsvjMb59Q)

To get setup quickly with Convex and React run

**`npm create convex@latest`**

**``**

or follow the guide below.

***

Learn how to query data from Convex in a React app using Vite and

TypeScript

1. Create a React app

   Create a React app using the `create vite` command.

   ```
   npm create vite@latest my-app -- --template react-ts
   ```

2. Install the Convex client and server library

   To get started, install the `convex` package which provides a convenient interface for working with Convex from a React app.

   Navigate to your app directory and install `convex`.

   ```
   cd my-app && npm install convex
   ```

3. Set up a Convex dev deployment

   Next, run `npx convex dev`. This will prompt you to log in with GitHub, create a project, and save your production and deployment URLs.

   It will also create a `convex/` folder for you to write your backend API functions in. The `dev` command will then continue running to sync your functions with your dev deployment in the cloud.

   ```
   npx convex dev
   ```

4. Create sample data for your database

   In a new terminal window, create a `sampleData.jsonl` file with some sample data.

   sampleData.jsonl

   ```
   {"text": "Buy groceries", "isCompleted": true}
   {"text": "Go for a swim", "isCompleted": true}
   {"text": "Integrate Convex", "isCompleted": false}
   ```

5. Add the sample data to your database

   Now that your project is ready, add a `tasks` table with the sample data into your Convex database with the `import` command.

   ```
   npx convex import --table tasks sampleData.jsonl
   ```

6. (optional) Define a schema

   Add a new file `schema.ts` in the `convex/` folder with a description of your data.

   This will declare the types of your data for optional typechecking with TypeScript, and it will be also enforced at runtime.

   Alternatively remove the line `'plugin:@typescript-eslint/recommended-requiring-type-checking',` from the `.eslintrc.cjs` file to lower the type checking strictness.

   convex/schema.ts

   ```
   import { defineSchema, defineTable } from "convex/server";
   import { v } from "convex/values";

   export default defineSchema({
     tasks: defineTable({
       text: v.string(),
       isCompleted: v.boolean(),
     }),
   });
   ```

7. Expose a database query

   Add a new file `tasks.ts` in the `convex/` folder with a query function that loads the data.

   Exporting a query function from this file declares an API function named after the file and the export name, `api.tasks.get`.

   convex/tasks.ts

   TS

   ```
   import { query } from "./_generated/server";

   export const get = query({
     args: {},
     handler: async (ctx) => {
       return await ctx.db.query("tasks").collect();
     },
   });
   ```

8. Connect the app to your backend

   In `src/main.tsx`, create a `ConvexReactClient` and pass it to a `ConvexProvider` wrapping your app.

   src/main.tsx

   TS

   ```
   import React from "react";
   import ReactDOM from "react-dom/client";
   import App from "./App";
   import "./index.css";
   import { ConvexProvider, ConvexReactClient } from "convex/react";

   const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

   ReactDOM.createRoot(document.getElementById("root")!).render(
     <React.StrictMode>
       <ConvexProvider client={convex}>
         <App />
       </ConvexProvider>
     </React.StrictMode>,
   );
   ```

9. Display the data in your app

   In `src/App.tsx`, use the `useQuery` hook to fetch from your `api.tasks.get` API function and display the data.

   src/App.tsx

   TS

   ```
   import "./App.css";
   import { useQuery } from "convex/react";
   import { api } from "../convex/_generated/api";

   function App() {
     const tasks = useQuery(api.tasks.get);
     return (
       <div className="App">
         {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
       </div>
     );
   }

   export default App;
   ```

10. Start the app

    Start the app, open <http://localhost:5173/> in a browser, and see the list of tasks.

    ```
    npm run dev
    ```

See the complete [React documentation](/client/react.md).

# Functions

Functions run on the backend and are written in JavaScript (or TypeScript). They are automatically available as APIs accessed through [client libraries](/client/react.md). Everything you do in the Convex backend starts from functions.

There are three types of functions:

* [Queries](/functions/query-functions.md) read data from your Convex database and are automatically cached and subscribable (realtime, reactive).
* [Mutations](/functions/mutation-functions.md) write data to the database and run as a transaction.
* [Actions](/functions/actions.md) can call OpenAI, Stripe, Twilio, or any other service or API you need to make your app work.

You can also build [HTTP actions](/functions/http-actions.md) when you want to call your functions from a webhook or a custom client.

Here's an overview of the three different types of Convex functions and what they can do:

|                            | Queries | Mutations | Actions |
| -------------------------- | ------- | --------- | ------- |
| Database access            | Yes     | Yes       | No      |
| Transactional              | Yes     | Yes       | No      |
| Cached                     | Yes     | No        | No      |
| Real-time Updates          | Yes     | No        | No      |
| External API Calls (fetch) | No      | No        | Yes     |

# Actions

Actions can call third party services to do things such as processing a payment with [Stripe](https://stripe.com). They can be run in Convex's JavaScript environment or in Node.js. They can interact with the database indirectly by calling [queries](/functions/query-functions.md) and [mutations](/functions/mutation-functions.md).

**Example:** [GIPHY Action](https://github.com/get-convex/convex-demos/tree/main/giphy-action)

## Action names[​](#action-names "Direct link to Action names")

Actions follow the same naming rules as queries, see [Query names](/functions/query-functions.md#query-names).

## The `action` constructor[​](#the-action-constructor "Direct link to the-action-constructor")

To declare an action in Convex you use the action constructor function. Pass it an object with a `handler` function, which performs the action:

convex/myFunctions.ts

TS

```
import { action } from "./_generated/server";

export const doSomething = action({
  args: {},
  handler: () => {
    // implementation goes here

    // optionally return a value
    return "success";
  },
});
```

Unlike a query, an action can but does not have to return a value.

### Action arguments and responses[​](#action-arguments-and-responses "Direct link to Action arguments and responses")

Action arguments and responses follow the same rules as [mutations](/functions/mutation-functions.md#mutation-arguments):

convex/myFunctions.ts

TS

```
import { action } from "./_generated/server";
import { v } from "convex/values";

export const doSomething = action({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    // do something with `args.a` and `args.b`

    // optionally return a value
    return "success";
  },
});
```

The first argument to the handler function is reserved for the action context.

### Action context[​](#action-context "Direct link to Action context")

The `action` constructor enables interacting with the database, and other Convex features by passing an [ActionCtx](/api/interfaces/server.GenericActionCtx.md) object to the handler function as the first argument:

convex/myFunctions.ts

TS

```
import { action } from "./_generated/server";
import { v } from "convex/values";

export const doSomething = action({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // do something with `ctx`
  },
});
```

Which part of that action context is used depends on what your action needs to do:

* To read data from the database use the `runQuery` field, and call a query that performs the read:

  convex/myFunctions.ts

  TS

  ```
  import { action, internalQuery } from "./_generated/server";
  import { internal } from "./_generated/api";
  import { v } from "convex/values";

  export const doSomething = action({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      const data = await ctx.runQuery(internal.myFunctions.readData, {
        a: args.a,
      });
      // do something with `data`
    },
  });

  export const readData = internalQuery({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      // read from `ctx.db` here
    },
  });
  ```

  Here `readData` is an [internal query](/functions/internal-functions.md) because we don't want to expose it to the client directly. Actions, mutations and queries can be defined in the same file.

* To write data to the database use the `runMutation` field, and call a mutation that performs the write:

  convex/myFunctions.ts

  TS

  ```
  import { v } from "convex/values";
  import { action } from "./_generated/server";
  import { internal } from "./_generated/api";

  export const doSomething = action({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      const data = await ctx.runMutation(internal.myMutations.writeData, {
        a: args.a,
      });
      // do something else, optionally use `data`
    },
  });
  ```

  Use an [internal mutation](/functions/internal-functions.md) when you want to prevent users from calling the mutation directly.

  As with queries, it's often convenient to define actions and mutations in the same file.

* To generate upload URLs for storing files use the `storage` field. Read on about [File Storage](/file-storage.md).

* To check user authentication use the `auth` field. Auth is propagated automatically when calling queries and mutations from the action. Read on about [Authentication](/auth.md).

* To schedule functions to run in the future, use the `scheduler` field. Read on about [Scheduled Functions](/scheduling/scheduled-functions.md).

* To search a vector index, use the `vectorSearch` field. Read on about [Vector Search](/search/vector-search.md).

### Dealing with circular type inference[​](#dealing-with-circular-type-inference "Direct link to Dealing with circular type inference")

Working around the TypeScript error: some action `implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.`

When the return value of an action depends on the result of calling `ctx.runQuery` or `ctx.runMutation`, TypeScript will complain that it cannot infer the return type of the action. This is a minimal example of the issue:

convex/myFunctions.ts

```
// TypeScript reports an error on `myAction`
export const myAction = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(api.myFunctions.getSomething);
  },
});

export const getSomething = query({
  args: {},
  handler: () => {
    return null;
  },
});
```

To work around this, there are two options:

1. Type the return value of the handler function explicitly:

   <!-- -->

   convex/myFunctions.ts

   ```
   export const myAction = action({
     args: {},
     handler: async (ctx): Promise<null> => {
       const result = await ctx.runQuery(api.myFunctions.getSomething);
       return result;
     },
   });
   ```

2. Type the the result of the `ctx.runQuery` or `ctx.runMutation` call explicitly:

   <!-- -->

   convex/myFunctions.ts

   ```
   export const myAction = action({
     args: {},
     handler: async (ctx) => {
       const result: null = await ctx.runQuery(api.myFunctions.getSomething);
       return result;
     },
   });
   ```

TypeScript will check that the type annotation matches what the called query or mutation returns, so you don't lose any type safety.

In this trivial example the return type of the query was `null`. See the [TypeScript](/understanding/best-practices/typescript.md#type-annotating-server-side-helpers) page for other types which might be helpful when annotating the result.

## Choosing the runtime ("use node")[​](#choosing-the-runtime-use-node "Direct link to Choosing the runtime (\"use node\")")

Actions can run in Convex's custom JavaScript environment or in Node.js.

By default, actions run in Convex's environment. This environment supports `fetch`, so actions that simply want to call a third-party API using `fetch` can be run in this environment:

convex/myFunctions.ts

TS

```
import { action } from "./_generated/server";

export const doSomething = action({
  args: {},
  handler: async () => {
    const data = await fetch("https://api.thirdpartyservice.com");
    // do something with data
  },
});
```

Actions running in Convex's environment are faster compared to Node.js, since they don't require extra time to start up before running your action (cold starts). They can also be defined in the same file as other Convex functions. Like queries and mutations they can import NPM packages, but not all are supported.

Actions needing unsupported NPM packages or Node.js APIs can be configured to run in Node.js by adding the `"use node"` directive at the top of the file. Note that other Convex functions cannot be defined in files with the `"use node";` directive.

convex/myAction.ts

TS

```
"use node";

import { action } from "./_generated/server";
import SomeNpmPackage from "some-npm-package";

export const doSomething = action({
  args: {},
  handler: () => {
    // do something with SomeNpmPackage
  },
});
```

Learn more about the two [Convex Runtimes](/functions/runtimes.md).

## Splitting up action code via helpers[​](#splitting-up-action-code-via-helpers "Direct link to Splitting up action code via helpers")

Just like with [queries](/functions/query-functions.md#splitting-up-query-code-via-helpers) and [mutations](/functions/mutation-functions.md#splitting-up-mutation-code-via-helpers) you can define and call helper

TypeScript

functions to split up the code in your actions or reuse logic across multiple Convex functions.

But note that the [ActionCtx](/api/interfaces/server.GenericActionCtx.md) only has the `auth` field in common with [QueryCtx](/generated-api/server.md#queryctx) and [MutationCtx](/generated-api/server.md#mutationctx).

## Calling actions from clients[​](#calling-actions-from-clients "Direct link to Calling actions from clients")

To call an action from [React](/client/react.md) use the [`useAction`](/api/modules/react.md#useaction) hook along with the generated [`api`](/generated-api/api.md) object.

src/myApp.tsx

TS

```
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const performMyAction = useAction(api.myFunctions.doSomething);
  const handleClick = () => {
    performMyAction({ a: 1 });
  };
  // pass `handleClick` to a button
  // ...
}
```

Unlike [mutations](/functions/mutation-functions.md#calling-mutations-from-clients), actions from a single client are parallelized. Each action will be executed as soon as it reaches the server (even if other actions and mutations from the same client are running). If your app relies on actions running after other actions or mutations, make sure to only trigger the action after the relevant previous function completes.

**Note:** In most cases calling an action directly from a client **is an anti-pattern**. Instead, have the client call a [mutation](/functions/mutation-functions.md) which captures the user intent by writing into the database and then [schedules](/scheduling/scheduled-functions.md) an action:

convex/myFunctions.ts

TS

```
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, mutation } from "./_generated/server";

export const mutationThatSchedulesAction = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const taskId = await ctx.db.insert("tasks", { text });
    await ctx.scheduler.runAfter(0, internal.myFunctions.actionThatCallsAPI, {
      taskId,
      text,
    });
  },
});

export const actionThatCallsAPI = internalAction({
  args: { taskId: v.id("tasks"), text: v.string() },
  handler: (_, args): void => {
    // do something with `taskId` and `text`, like call an API
    // then run another mutation to store the result
  },
});
```

This way the mutation can enforce invariants, such as preventing the user from executing the same action twice.

## Limits[​](#limits "Direct link to Limits")

Actions time out after 10 minutes. [Node.js](/functions/runtimes.md#nodejs-runtime) and [Convex runtime](/functions/runtimes.md#default-convex-runtime) have 512MB and 64MB memory limit respectively. Please [contact us](/production/contact.md) if you have a use case that requires configuring higher limits.

Actions can do up to 1000 concurrent operations, such as executing queries, mutations or performing fetch requests.

For information on other limits, see [here](/production/state/limits.md).

## Error handling[​](#error-handling "Direct link to Error handling")

Unlike queries and mutations, actions may have side-effects and therefore can't be automatically retried by Convex when errors occur. For example, say your action calls Stripe to send a customer invoice. If the HTTP request fails, Convex has no way of knowing if the invoice was already sent. Like in normal backend code, it is the responsibility of the caller to handle errors raised by actions and retry the action call if appropriate.

## Dangling promises[​](#dangling-promises "Direct link to Dangling promises")

Make sure to await all promises created within an action. Async tasks still running when the function returns might or might not complete. In addition, since the Node.js execution environment might be reused between action calls, dangling promises might result in errors in subsequent action invocations.

## Best practices[​](#best-practices "Direct link to Best practices")

### `await ctx.runAction` should only be used for crossing JS runtimes[​](#await-ctxrunaction-should-only-be-used-for-crossing-js-runtimes "Direct link to await-ctxrunaction-should-only-be-used-for-crossing-js-runtimes")

**Why?** `await ctx.runAction` incurs to overhead of another Convex server function. It counts as an extra function call, it allocates its own system resources, and while you're awaiting this call the parent action call is frozen holding all it's resources. If you pile enough of these calls on top of each other, your app may slow down significantly.

**Fix:** The reason this api exists is to let you run code in the [Node.js environment](/functions/runtimes.md). If you want to call an action from another action that's in the same runtime, which is the normal case, the best way to do this is to pull the code you want to call into a TypeScript [helper function](/understanding/best-practices/.md#use-helper-functions-to-write-shared-code) and call the helper instead.

### Avoid `await ctx.runMutation` / `await ctx.runQuery`[​](#avoid-await-ctxrunmutation--await-ctxrunquery "Direct link to avoid-await-ctxrunmutation--await-ctxrunquery")

```
// ❌
const foo = await ctx.runQuery(...)
const bar = await ctx.runQuery(...)

// ✅
const fooAndBar = await ctx.runQuery(...)
```

**Why?** Multiple runQuery / runMutations execute in separate transactions and aren’t guaranteed to be consistent with each other (e.g. foo and bar could read the same document and return two different results), while a single runQuery / runMutation will always be consistent. Additionally, you’re paying for multiple function calls when you don’t have to.

**Fix:** Make a new internal query / mutation that does both things. Refactoring the code for the two functions into helpers will make it easy to create a new internal function that does both things while still keeping around the original functions. Potentially try and refactor your action code to “batch” all the database access.

Caveats: Separate runQuery / runMutation calls are valid when intentionally trying to process more data than fits in a single transaction (e.g. running a migration, doing a live aggregate).

## Related Components[​](#related-components "Direct link to Related Components")

[Convex Component](https://www.convex.dev/components/action-cache)

### [Action Cache](https://www.convex.dev/components/action-cache)

[Cache expensive or frequently run actions. Allows configurable cache duration and forcing updates.](https://www.convex.dev/components/action-cache)

[Convex Component](https://www.convex.dev/components/workpool)

### [Workpool](https://www.convex.dev/components/workpool)

[Workpool give critical tasks priority by organizing async operations into separate, customizable queues. Supports retries and parallelism limits.](https://www.convex.dev/components/workpool)

[Convex Component](https://www.convex.dev/components/workflow)

### [Workflow](https://www.convex.dev/components/workflow)

[Similar to Actions, Workflows can call queries, mutations, and actions. However, they are durable functions that can suspend, survive server crashes, specify retries for action calls, and more.](https://www.convex.dev/components/workflow)

# Debugging

Debugging is the process of figuring out why your code isn't behaving as you expect.

## Debugging during development[​](#debugging-during-development "Direct link to Debugging during development")

During development the built-in `console` API allows you to understand what's going on inside your functions:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const mutateSomething = mutation({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    console.log("Received args", args);
    // ...
  },
});
```

The following methods are available in the [default Convex runtime](/functions/runtimes.md#default-convex-runtime):

* Logging values, with a specified severity level:

  <!-- -->

  * `console.log`
  * `console.info`
  * `console.warn`
  * `console.error`
  * `console.debug`

* Logging with a stack trace:
  <!-- -->
  * [`console.trace`](https://developer.mozilla.org/en-US/docs/Web/API/console/trace_static)

* Measuring execution time:

  <!-- -->

  * [`console.time`](https://developer.mozilla.org/en-US/docs/Web/API/console/time_static)
  * [`console.timeLog`](https://developer.mozilla.org/en-US/docs/Web/API/console/timelog_static)
  * [`console.timeEnd`](https://developer.mozilla.org/en-US/docs/Web/API/console/timeend_static)

The Convex backend also automatically logs all successful function executions and all errors thrown by your functions.

You can view these logs:

1. When using the [`ConvexReactClient`](/client/react.md), in your browser developer tools console pane. The logs are sent from your dev deployment to your client, and the client logs them to the browser. Production deployments [**do not** send logs to the client](/functions/error-handling/.md#differences-in-error-reporting-between-dev-and-prod).
2. In your Convex dashboard on the [Logs page](/dashboard/deployments/logs.md).
3. In your terminal with [`npx convex dev`](/cli.md#tail-deployment-logs) during development or [`npx convex logs`](/cli.md#tail-deployment-logs), which only prints logs.

### Using a debugger[​](#using-a-debugger "Direct link to Using a debugger")

You can exercise your functions from tests, in which case you can add `debugger;` statements and step through your code. See [Testing](/testing/convex-test.md#debugging-tests).

## Debugging in production[​](#debugging-in-production "Direct link to Debugging in production")

When debugging an issue in production your options are:

1. Leverage existing logging
2. Add more logging and deploy a new version of your backend to production

Convex backend currently only preserves a limited number of logs, and logs can be erased at any time when the Convex team performs internal maintenance and upgrades. You should therefore set up [log streaming and error reporting](/production/integrations/.md) integrations to enable your team easy access to historical logs and additional information logged by your client.

## Finding relevant logs by Request ID[​](#finding-relevant-logs-by-request-id "Direct link to Finding relevant logs by Request ID")

To find the appropriate logs for an error you or your users experience, Convex includes a Request ID in all exception messages in both dev and prod in this format: `[Request ID: <request_id>]`.

You can copy and paste a Request ID into your Convex dashboard to view the logs for functions started by that request. See the [Dashboard logs page](/dashboard/deployments/logs.md#filter-logs) for details.

# Error Handling

There are four reasons why your Convex [queries](/functions/query-functions.md) and [mutations](/functions/mutation-functions.md) may hit errors:

1. [Application Errors](#application-errors-expected-failures): The function code hits a logical condition that should stop further processing, and your code throws a `ConvexError`
2. Developer Errors: There is a bug in the function (like calling `db.get("documents", null)` instead of `db.get("documents", id)`).
3. [Read/Write Limit Errors](#readwrite-limit-errors): The function is retrieving or writing too much data.
4. Internal Convex Errors: There is a problem within Convex (like a network blip).

Convex will automatically handle internal Convex errors. If there are problems on our end, we'll automatically retry your queries and mutations until the problem is resolved and your queries and mutations succeed.

On the other hand, you must decide how to handle application, developer and read/write limit errors. When one of these errors happens, the best practices are to:

1. Show the user some appropriate UI.
2. Send the error to an exception reporting service using the [Exception Reporting Integration](/production/integrations/exception-reporting.md).
3. Log the incident using `console.*` and set up reporting with [Log Streaming](/production/integrations/log-streams/.md). This can be done in addition to the above options, and doesn't require an exception to be thrown.

Additionally, you might also want to send client-side errors to a service like [Sentry](https://sentry.io) to capture additional information for debugging and observability.

## Errors in queries[​](#errors-in-queries "Direct link to Errors in queries")

If your query function hits an error, the error will be sent to the client and thrown from your `useQuery` call site. **The best way to handle these errors is with a React [error boundary component](https://reactjs.org/docs/error-boundaries.html).**

Error boundaries allow you to catch errors thrown in their child component tree, render fallback UI, and send information about the error to your exception handling service. Adding error boundaries to your app is a great way to handle errors in Convex query functions as well as other errors in your React components. If you are using Sentry, you can use their [`Sentry.ErrorBoundary`](https://docs.sentry.io/platforms/javascript/guides/react/components/errorboundary/) component.

With error boundaries, you can decide how granular you'd like your fallback UI to be. One simple option is to wrap your entire application in a single error boundary like:

```
<StrictMode>
  <ErrorBoundary>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </ErrorBoundary>
</StrictMode>,
```

Then any error in any of your components will be caught by the boundary and render the same fallback UI.

On the other hand, if you'd like to enable some portions of your app to continue functioning even if other parts hit errors, you can instead wrap different parts of your app in separate error boundaries.

Retrying

Unlike other frameworks, there is no concept of "retrying" if your query function hits an error. Because Convex functions are [deterministic](/functions/query-functions.md#caching--reactivity--consistency), if the query function hits an error, retrying will always produce the same error. There is no point in running the query function with the same arguments again.

## Errors in mutations[​](#errors-in-mutations "Direct link to Errors in mutations")

If a mutation hits an error, this will

1. Cause the promise returned from your mutation call to be rejected.
2. Cause your [optimistic update](/client/react/optimistic-updates.md) to be rolled back.

If you have an exception service like [Sentry](https://sentry.io/) configured, it should report "unhandled promise rejections" like this automatically. That means that with no additional work your mutation errors should be reported.

Note that errors in mutations won't be caught by your error boundaries because the error doesn't happen as part of rendering your components.

If you would like to render UI specifically in response to a mutation failure, you can use `.catch` on your mutation call. For example:

```
sendMessage(newMessageText).catch((error) => {
  // Do something with `error` here
});
```

If you're using an `async` handled function you can also use `try...catch`:

```
try {
  await sendMessage(newMessageText);
} catch (error) {
  // Do something with `error` here
}
```

Reporting caught errors

If you handle your mutation error, it will no longer become an unhandled promise rejection. You may need to report this error to your exception handling service manually.

## Errors in action functions[​](#errors-in-action-functions "Direct link to Errors in action functions")

Unlike queries and mutations, [actions](//docs/functions/actions.mdx) may have side-effects and therefore can't be automatically retried by Convex when errors occur. For example, say your action sends a email. If it fails part-way through, Convex has no way of knowing if the email was already sent and can't safely retry the action. It is responsibility of the caller to handle errors raised by actions and retry if appropriate.

## Differences in error reporting between dev and prod[​](#differences-in-error-reporting-between-dev-and-prod "Direct link to Differences in error reporting between dev and prod")

Using a dev deployment any server error thrown on the client will include the original error message and a server-side stack trace to ease debugging.

Using a production deployment any server error will be redacted to only include the name of the function and a generic `"Server Error"` message, with no stack trace. Server [application errors](/functions/error-handling/application-errors.md) will still include their custom `data`.

Both development and production deployments log full errors with stack traces which can be found on the [Logs](/dashboard/deployments/logs.md) page of a given deployment.

## Application errors, expected failures[​](#application-errors-expected-failures "Direct link to Application errors, expected failures")

If you have expected ways your functions might fail, you can either return different values or throw `ConvexError`s.

See [Application Errors](/functions/error-handling/application-errors.md).

## Read/write limit errors[​](#readwrite-limit-errors "Direct link to Read/write limit errors")

To ensure uptime and guarantee performance, Convex will catch queries and mutations that try to read or write too much data. These limits are enforced at the level of a single query or mutation function execution. The exact limits are listed in [Limits](/production/state/limits.md#transactions).

Documents are "scanned" by the database to figure out which documents should be returned from `db.query`. So for example `db.query("table").take(5).collect()` will only need to scan 5 documents, but `db.query("table").filter(...).first()` might scan up to as many documents as there are in `"table"`, to find the first one that matches the given filter.

The number of calls to `db.get` and `db.query` has a limit to prevent a single query from subscribing to too many index ranges, or a mutation from reading from too many ranges that could cause conflicts.

In general, if you're running into these limits frequently, we recommend [indexing your queries](/database/reading-data/indexes/.md) to reduce the number of documents scanned, allowing you to avoid unnecessary reads. Queries that scan large swaths of your data may look innocent at first, but can easily blow up at any production scale. If your functions are close to hitting these limits they will log a warning.

For information on other limits, see [here](/production/state/limits.md).

## Debugging Errors[​](#debugging-errors "Direct link to Debugging Errors")

See [Debugging](/functions/debugging.md) and specifically [Finding relevant logs by Request ID](/functions/debugging.md#finding-relevant-logs-by-request-id).

## Related Components[​](#related-components "Direct link to Related Components")

[Convex Component](https://www.convex.dev/components/workpool)

### [Workpool](https://www.convex.dev/components/workpool)

[Workpool give critical tasks priority by organizing async operations into separate, customizable queues. Supports retries and parallelism limits.](https://www.convex.dev/components/workpool)

[Convex Component](https://www.convex.dev/components/workflow)

### [Workflow](https://www.convex.dev/components/workflow)

[Simplify programming long running code flows. Workflows execute durably with configurable retries and delays.](https://www.convex.dev/components/workflow)


# Application Errors

If you have expected ways your functions might fail, you can either return different values or throw `ConvexError`s.

## Returning different values[​](#returning-different-values "Direct link to Returning different values")

If you're using TypeScript different return types can enforce that you're handling error scenarios.

For example, a `createUser` mutation could return

```
Id<"users"> | { error: "EMAIL_ADDRESS_IN_USE" };
```

to express that either the mutation succeeded or the email address was already taken.

This ensures that you remember to handle these cases in your UI.

## Throwing application errors[​](#throwing-application-errors "Direct link to Throwing application errors")

You might prefer to throw errors for the following reasons:

* You can use the exception bubbling mechanism to throw from a deeply nested function call, instead of manually propagating error results up the call stack. This will work for `runQuery`, `runMutation` and `runAction` calls in [actions](/functions/actions.md) too.
* In [mutations](/functions/mutation-functions.md), throwing an error will prevent the mutation transaction from committing
* On the client, it might be simpler to handle all kinds of errors, both expected and unexpected, uniformly

Convex provides an error subclass, [`ConvexError`](/api/classes/values.ConvexError.md), which can be used to carry information from the backend to the client:

convex/myFunctions.ts

TS

```
import { ConvexError } from "convex/values";
import { mutation } from "./_generated/server";

export const assignRole = mutation({
  args: {
    // ...
  },
  handler: (ctx, args) => {
    const isTaken = isRoleTaken(/* ... */);
    if (isTaken) {
      throw new ConvexError("Role is already taken");
    }
    // ...
  },
});
```

### Application error `data` payload[​](#application-error-data-payload "Direct link to application-error-data-payload")

You can pass the same [data types](/database/types.md) supported by function arguments, return types and the database, to the `ConvexError` constructor. This data will be stored on the `data` property of the error:

```
// error.data === "My fancy error message"
throw new ConvexError("My fancy error message");

// error.data === {message: "My fancy error message", code: 123, severity: "high"}
throw new ConvexError({
  message: "My fancy error message",
  code: 123,
  severity: "high",
});

// error.data === {code: 123, severity: "high"}
throw new ConvexError({
  code: 123,
  severity: "high",
});
```

Error payloads more complicated than a simple `string` are helpful for more structured error logging, or for handling sets of errors differently on the client.

## Handling application errors on the client[​](#handling-application-errors-on-the-client "Direct link to Handling application errors on the client")

On the client, application errors also use the `ConvexError` class, and the data they carry can be accessed via the `data` property:

src/App.tsx

TS

```
import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const doSomething = useMutation(api.myFunctions.mutateSomething);
  const handleSomething = async () => {
    try {
      await doSomething({ a: 1, b: 2 });
    } catch (error) {
      const errorMessage =
        // Check whether the error is an application error
        error instanceof ConvexError
          ? // Access data and cast it to the type we expect
            (error.data as { message: string }).message
          : // Must be some developer error,
            // and prod deployments will not
            // reveal any more information about it
            // to the client
            "Unexpected error occurred";
      // do something with `errorMessage`
    }
  };
  // ...
}
```


# HTTP Actions

HTTP actions allow you to build an HTTP API right in Convex!

convex/http.ts

TS

```
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response(`Hello from ${request.url}`);
  }),
});
export default http;
```

HTTP actions take in a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and return a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) following the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). HTTP actions can manipulate the request and response directly, and interact with data in Convex indirectly by running [queries](/functions/query-functions.md), [mutations](/functions/mutation-functions.md), and [actions](/functions/actions.md). HTTP actions might be used for receiving webhooks from external applications or defining a public HTTP API.

HTTP actions are exposed at `https://<your deployment name>.convex.site` (e.g. `https://happy-animal-123.convex.site`).

**Example:** [HTTP Actions](https://github.com/get-convex/convex-demos/tree/main/http)

## Defining HTTP actions[​](#defining-http-actions "Direct link to Defining HTTP actions")

HTTP action handlers are defined using the [`httpAction`](/generated-api/server.md#httpaction) constructor, similar to the `action` constructor for normal actions:

convex/myHttpActions.ts

TS

```
import { httpAction } from "./_generated/server";

export const doSomething = httpAction(async () => {
  // implementation will be here
  return new Response();
});
```

The first argument to the `handler` is an [`ActionCtx`](/api/interfaces/server.GenericActionCtx.md) object, which provides [`auth`](/api/interfaces/server.Auth.md), [`storage`](/api/interfaces/server.StorageActionWriter.md), and [`scheduler`](/api/interfaces/server.Scheduler.md), as well as `runQuery`, `runMutation`, `runAction`.

The second argument contains the [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) data. HTTP actions do not support argument validation, as the parsing of arguments from the incoming Request is left entirely to you.

Here's an example:

convex/messages.ts

TS

```
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const postMessage = httpAction(async (ctx, request) => {
  const { author, body } = await request.json();

  await ctx.runMutation(internal.messages.sendOne, {
    body: `Sent via HTTP action: ${body}`,
    author,
  });

  return new Response(null, {
    status: 200,
  });
});
```

To expose the HTTP Action, export an instance of [`HttpRouter`](/api/classes/server.HttpRouter.md) from the `convex/http.ts` file. To create the instance call the `httpRouter` function. On the `HttpRouter` you can expose routes using the `route` method:

convex/http.ts

TS

```
import { httpRouter } from "convex/server";
import { postMessage, getByAuthor, getByAuthorPathSuffix } from "./messages";

const http = httpRouter();

http.route({
  path: "/postMessage",
  method: "POST",
  handler: postMessage,
});

// Define additional routes
http.route({
  path: "/getMessagesByAuthor",
  method: "GET",
  handler: getByAuthor,
});

// Define a route using a path prefix
http.route({
  // Will match /getAuthorMessages/User+123 and /getAuthorMessages/User+234 etc.
  pathPrefix: "/getAuthorMessages/",
  method: "GET",
  handler: getByAuthorPathSuffix,
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
```

You can now call this action via HTTP and interact with data stored in the Convex Database. HTTP actions are exposed on `https://<your deployment name>.convex.site`.

```
export DEPLOYMENT_NAME=... # example: "happy-animal-123"
curl -d '{ "author": "User 123", "body": "Hello world" }' \
    -H 'content-type: application/json' "https://$DEPLOYMENT_NAME.convex.site/postMessage"
```

Like other Convex functions, you can view your HTTP actions in the [Functions view](/dashboard/deployments/functions.md) of [your dashboard](https://dashboard.convex.dev/) and view logs produced by them in the [Logs view](/dashboard/deployments/logs.md).

## Limits[​](#limits "Direct link to Limits")

HTTP actions run in the same environment as queries and mutations so also do not have access to Node.js-specific JavaScript APIs. HTTP actions can call [actions](/functions/actions.md), which can run in Node.js.

Like [actions](/functions/actions.md#error-handling), HTTP actions may have side-effects and will not be automatically retried by Convex when errors occur. It is a responsibility of the caller to handle errors and retry the request if appropriate.

Request and response size is limited to 20MB.

HTTP actions support request and response body types of `.text()`, `.json()`, `.blob()`, and `.arrayBuffer()`.

Note that you don't need to define an HTTP action to call your queries, mutations and actions over HTTP if you control the caller, since you can use use the JavaScript [`ConvexHttpClient`](/api/classes/browser.ConvexHttpClient.md) or the [Python client](/client/python.md) to call these functions directly.

## Debugging[​](#debugging "Direct link to Debugging")

### Step 1: Check that your HTTP actions were deployed.[​](#step-1-check-that-your-http-actions-were-deployed "Direct link to Step 1: Check that your HTTP actions were deployed.")

Check the [functions page](https://dashboard.convex.dev/deployment/functions) in the dashboard and make sure there's an entry called `http`.

If not, double check that you've defined your HTTP actions with the `httpRouter` in a file called `http.js` or `http.ts` (the name of the file must match exactly), and that `npx convex dev` has no errors.

### Step 2: Check that you can access your endpoint using curl[​](#step-2-check-that-you-can-access-your-endpoint-using-curl "Direct link to Step 2: Check that you can access your endpoint using curl")

Get your URL from the dashboard under [Settings](https://dashboard.convex.dev/deployment/settings) > URL and Deploy Key.

Make sure this is the URL that ends in **`.convex.site`**, and not `.convex.cloud`. E.g. `https://happy-animal-123.convex.site`

Run a `curl` command to hit one of your defined endpoints, potentially defining a new endpoint specifically for testing

```
curl -X GET https://<deployment name>.convex.site/myEndpoint
```

Check the [logs page](https://dashboard.convex.dev/deployment/logs) in the dashboard to confirm that there's an entry for your HTTP action.

### Step 3: Check the request being made by your browser[​](#step-3-check-the-request-being-made-by-your-browser "Direct link to Step 3: Check the request being made by your browser")

If you've determined that your HTTP actions have been deployed and are accessible via curl, but there are still issues requesting them from your app, check the exact requests being made by your browser.

Open the *Network* tab in your browser's developer tools, and trigger your HTTP requests.

Check that this URL matches what you tested earlier with curl -- it ends in `.convex.site` and has the right deployment name.

You should be able to see these requests in the dashboard [logs page](https://dashboard.convex.dev/deployment/logs).

If you see "CORS error" or messages in the browser console like `Access to fetch at '...' from origin '...' has been blocked by CORS policy`, you likely need to configure CORS headers and potentially add a handler for the pre-flight `OPTIONS` request. See [this section](/functions/http-actions.md#cors) below.

## Common patterns[​](#common-patterns "Direct link to Common patterns")

### File Storage[​](#file-storage "Direct link to File Storage")

HTTP actions can be used to handle uploading and fetching stored files, see:

* [Uploading files via an HTTP action](/file-storage/upload-files.md#uploading-files-via-an-http-action)
* [Serving files from HTTP actions](/file-storage/serve-files.md#serving-files-from-http-actions)

### CORS[​](#cors "Direct link to CORS")

To make requests to HTTP actions from a website you need to add [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) headers to your HTTP actions.

There are existing resources for exactly which CORS headers are required based on the use case. [This site](https://httptoolkit.com/will-it-cors/) provides an interactive walkthrough for what CORS headers to add. Here's an example of adding CORS headers to a Convex HTTP action:

convex/http.ts

TS

```
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/sendImage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Step 1: Store the file
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    // Step 2: Save the storage ID to the database via a mutation
    const author = new URL(request.url).searchParams.get("author");
    if (author === null) {
      return new Response("Author is required", {
        status: 400,
      });
    }

    await ctx.runMutation(api.messages.sendImage, { storageId, author });

    // Step 3: Return a response with the correct CORS headers
    return new Response(null, {
      status: 200,
      // CORS headers
      headers: new Headers({
        // e.g. https://mywebsite.com, configured on your Convex dashboard
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
        Vary: "origin",
      }),
    });
  }),
});
```

Here's an example of handling a pre-flight `OPTIONS` request:

convex/http.ts

TS

```
// Pre-flight request for /sendImage
http.route({
  path: "/sendImage",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          // e.g. https://mywebsite.com, configured on your Convex dashboard
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});
```

### Authentication[​](#authentication "Direct link to Authentication")

You can leverage Convex's built-in [authentication](/auth.md) integration and access a user identity from [`ctx.auth.getUserIdentity()`](/api/interfaces/server.Auth.md#getuseridentity). To do this call your endpoint with an `Authorization` header including a JWT token:

myPage.ts

TS

```
const jwtToken = "...";

fetch("https://<deployment name>.convex.site/myAction", {
  headers: {
    Authorization: `Bearer ${jwtToken}`,
  },
});
```


# Internal Functions

Internal functions can only be called by other [functions](/functions.md) and cannot be called directly from a [Convex client](/client/react.md).

By default your Convex functions are public and accessible to clients. Public functions may be called by malicious users in ways that cause surprising results. Internal functions help you mitigate this risk. We recommend using internal functions any time you're writing logic that should not be called from a client.

While internal functions help mitigate risk by reducing the public surface area of your application, you can still validate internal invariants using [argument validation](/functions/validation.md) and/or [authentication](/auth/functions-auth.md).

## Use cases for internal functions[​](#use-cases-for-internal-functions "Direct link to Use cases for internal functions")

Leverage internal functions by:

* Calling them from [actions](/functions/actions.md#action-context) via `runQuery` and `runMutation`
* Calling them from [HTTP actions](/functions/http-actions.md) via `runQuery`, `runMutation`, and `runAction`
* [Scheduling](/scheduling/scheduled-functions.md) them from other functions to run in the future
* Scheduling them to run periodically from [cron jobs](/scheduling/cron-jobs.md)
* Running them using the [Dashboard](/dashboard/deployments/functions.md#running-functions)
* Running them from the [CLI](/cli.md#run-convex-functions)

## Defining internal functions[​](#defining-internal-functions "Direct link to Defining internal functions")

An internal function is defined using `internalQuery`, `internalMutation`, or `internalAction`. For example:

convex/plans.ts

TS

```
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const markPlanAsProfessional = internalMutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    await ctx.db.patch("plans", args.planId, { planType: "professional" });
  },
});
```

If you need to pass complicated objects to internal functions you might prefer to not use argument validation. Note though that if you're using `internalQuery` or `internalMutation` it's a better idea to pass around document IDs instead of documents, to ensure the query or mutation is working with the up-to-date state of the database.

Internal function without argument validation

convex/plans.ts

TS

```
import { internalAction } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const markPlanAsProfessional = internalAction({
  handler: async (actionCtx, args) => {
    // perform an action, perhaps calling a third-party API
  },
});
```

## Calling internal functions[​](#calling-internal-functions "Direct link to Calling internal functions")

Internal functions can be called from actions and scheduled from actions and mutation using the [`internal`](/generated-api/api.md#internal) object.

For example, consider this public `upgrade` action that calls the internal `plans.markPlanAsProfessional` mutation we defined above:

convex/changes.ts

TS

```
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const upgrade = action({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    // Call out to payment provider (e.g. Stripe) to charge customer
    const response = await fetch("https://...");
    if (response.ok) {
      // Mark the plan as "professional" in the Convex DB
      await ctx.runMutation(internal.plans.markPlanAsProfessional, {
        planId: args.planId,
      });
    }
  },
});
```

In this example a user should not be able to directly call `internal.plans.markPlanAsProfessional` without going through the `upgrade` action — if they did, then they would get a free upgrade.

You can define public and internal functions in the same file.


# Mutations

Mutations insert, update and remove data from the database, check authentication or perform other business logic, and optionally return a response to the client application.

This is an example mutation, taking in named arguments, writing data to the database and returning a result:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new task with the given text
export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const newTaskId = await ctx.db.insert("tasks", { text: args.text });
    return newTaskId;
  },
});
```

Read on to understand how to build mutations yourself.

## Mutation names[​](#mutation-names "Direct link to Mutation names")

Mutations follow the same naming rules as queries, see [Query names](/functions/query-functions.md#query-names).

Queries and mutations can be defined in the same file when using named exports.

## The `mutation` constructor[​](#the-mutation-constructor "Direct link to the-mutation-constructor")

To declare a mutation in Convex use the `mutation` constructor function. Pass it an object with a `handler` function, which performs the mutation:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";

export const mutateSomething = mutation({
  args: {},
  handler: () => {
    // implementation will be here
  },
});
```

Unlike a query, a mutation can but does not have to return a value.

### Mutation arguments[​](#mutation-arguments "Direct link to Mutation arguments")

Just like queries, mutations accept named arguments, and the argument values are accessible as fields of the second parameter of the `handler` function:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";

export const mutateSomething = mutation({
  handler: (_, args: { a: number; b: number }) => {
    // do something with `args.a` and `args.b`

    // optionally return a value
    return "success";
  },
});
```

Arguments and responses are automatically serialized and deserialized, and you can pass and return most value-like JavaScript data to and from your mutation.

To both declare the types of arguments and to validate them, add an `args` object using `v` validators:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const mutateSomething = mutation({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    // do something with `args.a` and `args.b`
  },
});
```

See [argument validation](/functions/validation.md) for the full list of supported types and validators.

The first parameter to the handler function is reserved for the mutation context.

### Mutation responses[​](#mutation-responses "Direct link to Mutation responses")

Queries can return values of any supported [Convex type](/functions/validation.md) which will be automatically serialized and deserialized.

Mutations can also return `undefined`, which is not a valid Convex value. When a mutation returns `undefined` **it is translated to `null`** on the client.

### Mutation context[​](#mutation-context "Direct link to Mutation context")

The `mutation` constructor enables writing data to the database, and other Convex features by passing a [MutationCtx](/generated-api/server.md#mutationctx) object to the handler function as the first parameter:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const mutateSomething = mutation({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // Do something with `ctx`
  },
});
```

Which part of the mutation context is used depends on what your mutation needs to do:

* To read from and write to the database use the `db` field. Note that we make the handler function an `async` function so we can `await` the promise returned by `db.insert()`:

  convex/myFunctions.ts

  TS

  ```
  import { mutation } from "./_generated/server";
  import { v } from "convex/values";

  export const addItem = mutation({
    args: { text: v.string() },
    handler: async (ctx, args) => {
      await ctx.db.insert("tasks", { text: args.text });
    },
  });
  ```

  Read on about [Writing Data](/database/writing-data.md).

* To generate upload URLs for storing files use the `storage` field. Read on about [File Storage](/file-storage.md).

* To check user authentication use the `auth` field. Read on about [Authentication](/auth.md).

* To schedule functions to run in the future, use the `scheduler` field. Read on about [Scheduled Functions](/scheduling/scheduled-functions.md).

## Splitting up mutation code via helpers[​](#splitting-up-mutation-code-via-helpers "Direct link to Splitting up mutation code via helpers")

When you want to split up the code in your mutation or reuse logic across multiple Convex functions you can define and call helper

TypeScript

functions:

convex/myFunctions.ts

TS

```
import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";

export const addItem = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text });
    await trackChange(ctx, "addItem");
  },
});

async function trackChange(ctx: MutationCtx, type: "addItem" | "removeItem") {
  await ctx.db.insert("changes", { type });
}
```

Mutations can call helpers that take a [QueryCtx](/generated-api/server.md#queryctx) as argument, since the mutation context can do everything query context can.

You can `export` helpers to use them across multiple files. They will not be callable from outside of your Convex functions.

See [Type annotating server side helpers](/understanding/best-practices/typescript.md#type-annotating-server-side-helpers) for more guidance on TypeScript types.

## Using NPM packages[​](#using-npm-packages "Direct link to Using NPM packages")

Mutations can import NPM packages installed in `node_modules`. Not all NPM packages are supported, see [Runtimes](/functions/runtimes.md#default-convex-runtime) for more details.

```
npm install @faker-js/faker
```

convex/myFunctions.ts

TS

```
import { faker } from "@faker-js/faker";
import { mutation } from "./_generated/server";

export const randomName = mutation({
  args: {},
  handler: async (ctx) => {
    faker.seed();
    await ctx.db.insert("tasks", { text: "Greet " + faker.person.fullName() });
  },
});
```

## Calling mutations from clients[​](#calling-mutations-from-clients "Direct link to Calling mutations from clients")

To call a mutation from [React](/client/react.md) use the [`useMutation`](/client/react.md#editing-data) hook along with the generated [`api`](/generated-api/api.md) object.

src/myApp.tsx

TS

```
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const mutateSomething = useMutation(api.myFunctions.mutateSomething);
  const handleClick = () => {
    mutateSomething({ a: 1, b: 2 });
  };
  // pass `handleClick` to a button
  // ...
}
```

See the [React](/client/react.md) client documentation for all the ways queries can be called.

When mutations are called from the [React](/client/react.md) or [Rust](/client/rust.md) clients, they are executed one at a time in a single, ordered queue. You don't have to worry about mutations editing the database in a different order than they were triggered.

## Transactions[​](#transactions "Direct link to Transactions")

Mutations run **transactionally**. This means that:

1. All database reads inside the transaction get a consistent view of the data in the database. You don't have to worry about a concurrent update changing the data in the middle of the execution.
2. All database writes get committed together. If the mutation writes some data to the database, but later throws an error, no data is actually written to the database.

For this to work, similarly to queries, mutations must be deterministic, and cannot call third party APIs. To call third party APIs, use [actions](/functions/actions.md).

## Limits[​](#limits "Direct link to Limits")

Mutations have a limit to the amount of data they can read and write at once to guarantee good performance. Learn more in [Read/write limit errors](/functions/error-handling/.md#readwrite-limit-errors).

For information on other limits, see [Limits](/production/state/limits.md).


# Queries

Queries are the bread and butter of your backend API. They fetch data from the database, check authentication or perform other business logic, and return data back to the client application.

This is an example query, taking in named arguments, reading data from the database and returning a result:

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

// Return the last 100 tasks in a given task list.
export const getTaskList = query({
  args: { taskListId: v.id("taskLists") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskListId"), args.taskListId))
      .order("desc")
      .take(100);
    return tasks;
  },
});
```

Read on to understand how to build queries yourself.

## Query names[​](#query-names "Direct link to Query names")

Queries are defined in

TypeScript

files inside your `convex/` directory.

The path and name of the file, as well as the way the function is exported from the file, determine the name the client will use to call it:

convex/myFunctions.ts

TS

```
// This function will be referred to as `api.myFunctions.myQuery`.
export const myQuery = …;

// This function will be referred to as `api.myFunctions.sum`.
export const sum = …;
```

To structure your API you can nest directories inside the `convex/` directory:

convex/foo/myQueries.ts

TS

```
// This function will be referred to as `api.foo.myQueries.listMessages`.
export const listMessages = …;
```

Default exports receive the name `default`.

convex/myFunctions.ts

TS

```
// This function will be referred to as `api.myFunctions.default`.
export default …;
```

The same rules apply to [mutations](/functions/mutation-functions.md) and [actions](/functions/actions.md), while [HTTP actions](/functions/http-actions.md) use a different routing approach.

Client libraries in languages other than JavaScript and TypeScript use strings instead of API objects:

* `api.myFunctions.myQuery` is `"myFunctions:myQuery"`
* `api.foo.myQueries.myQuery` is `"foo/myQueries:myQuery"`.
* `api.myFunction.default` is `"myFunction:default"` or `"myFunction"`.

## The `query` constructor[​](#the-query-constructor "Direct link to the-query-constructor")

To actually declare a query in Convex you use the `query` constructor function. Pass it an object with a `handler` function, which returns the query result:

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";

export const myConstantString = query({
  args: {},
  handler: () => {
    return "My never changing string";
  },
});
```

### Query arguments[​](#query-arguments "Direct link to Query arguments")

Queries accept named arguments. The argument values are accessible as fields of the second parameter of the handler function:

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";

export const sum = query({
  handler: (_, args: { a: number; b: number }) => {
    return args.a + args.b;
  },
});
```

Arguments and responses are automatically serialized and deserialized, and you can pass and return most value-like JavaScript data to and from your query.

To both declare the types of arguments and to validate them, add an `args` object using `v` validators:

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const sum = query({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    return args.a + args.b;
  },
});
```

See [argument validation](/functions/validation.md) for the full list of supported types and validators.

The first parameter of the handler function contains the query context.

### Query responses[​](#query-responses "Direct link to Query responses")

Queries can return values of any supported [Convex type](/functions/validation.md) which will be automatically serialized and deserialized.

Queries can also return `undefined`, which is not a valid Convex value. When a query returns `undefined` **it is translated to `null`** on the client.

### Query context[​](#query-context "Direct link to Query context")

The `query` constructor enables fetching data, and other Convex features by passing a [QueryCtx](/generated-api/server.md#queryctx) object to the handler function as the first parameter:

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQuery = query({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // Do something with `ctx`
  },
});
```

Which part of the query context is used depends on what your query needs to do:

* To fetch from the database use the `db` field. Note that we make the handler function an `async` function so we can `await` the promise returned by `db.get()`:

  convex/myFunctions.ts

  TS

  ```
  import { query } from "./_generated/server";
  import { v } from "convex/values";

  export const getTask = query({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
      return await ctx.db.get("tasks", args.id);
    },
  });
  ```

  Read more about [Reading Data](/database/reading-data/.md).

* To return URLs to stored files use the `storage` field. Read more about [File Storage](/file-storage.md).

* To check user authentication use the `auth` field. Read more about [Authentication](/auth.md).

## Splitting up query code via helpers[​](#splitting-up-query-code-via-helpers "Direct link to Splitting up query code via helpers")

When you want to split up the code in your query or reuse logic across multiple Convex functions you can define and call helper

TypeScript

functions:

convex/myFunctions.ts

TS

```
import { Id } from "./_generated/dataModel";
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export const getTaskAndAuthor = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.id);
    if (task === null) {
      return null;
    }
    return { task, author: await getUserName(ctx, task.authorId ?? null) };
  },
});

async function getUserName(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (userId === null) {
    return null;
  }
  return (await ctx.db.get("users", userId))?.name;
}
```

You can `export` helpers to use them across multiple files. They will not be callable from outside of your Convex functions.

See [Type annotating server side helpers](/understanding/best-practices/typescript.md#type-annotating-server-side-helpers) for more guidance on TypeScript types.

## Using NPM packages[​](#using-npm-packages "Direct link to Using NPM packages")

Queries can import NPM packages installed in `node_modules`. Not all NPM packages are supported, see [Runtimes](/functions/runtimes.md#default-convex-runtime) for more details.

```
npm install @faker-js/faker
```

convex/myFunctions.ts

TS

```
import { query } from "./_generated/server";
import { faker } from "@faker-js/faker";

export const randomName = query({
  args: {},
  handler: () => {
    faker.seed();
    return faker.person.fullName();
  },
});
```

## Calling queries from clients[​](#calling-queries-from-clients "Direct link to Calling queries from clients")

To call a query from [React](/client/react.md) use the [`useQuery`](/client/react.md#fetching-data) hook along with the generated [`api`](/generated-api/api.md) object.

src/MyApp.tsx

TS

```
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const data = useQuery(api.myFunctions.sum, { a: 1, b: 2 });
  // do something with `data`
}
```

See the [React](/client/react.md) client documentation for all the ways queries can be called.

## Caching & reactivity & consistency[​](#caching--reactivity--consistency "Direct link to Caching & reactivity & consistency")

Queries have three awesome attributes:

1. **Caching**: Convex caches query results automatically. If many clients request the same query, with the same arguments, they will receive a cached response.
2. **Reactivity**: clients can subscribe to queries to receive new results when the underlying data changes.
3. **Consistency**: All database reads inside a single query call are performed at the same logical timestamp. Concurrent writes do not affect the query results.

To have these attributes the handler function must be *deterministic*, which means that given the same arguments (including the query context) it will return the same response.

For this reason queries cannot `fetch` from third party APIs. To call third party APIs, use [actions](/functions/actions.md).

You might wonder whether you can use non-deterministic language functionality like `Math.random()` or `Date.now()`. The short answer is that Convex takes care of implementing these in a way that you don't have to think about the deterministic constraint.

See [Runtimes](/functions/runtimes.md#default-convex-runtime) for more details on the Convex runtime.

## Limits[​](#limits "Direct link to Limits")

Queries have a limit to the amount of data they can read at once to guarantee good performance. Check out these limits in [Read/write limit errors](/functions/error-handling/.md#readwrite-limit-errors).

For information on other limits, see [Limits](/production/state/limits.md).


# OCC and Atomicity

In [Queries](/functions/query-functions.md), we mentioned that determinism was important in the way optimistic concurrency control (OCC) was used within Convex. In this section, we'll dive much deeper into *why*.

## Convex Financial, Inc.[​](#convex-financial-inc "Direct link to Convex Financial, Inc.")

Imagine that you're building a banking app, and therefore your databases stores accounts with balances. You want your users to be able to give each other money, so you write a mutation function that transfers funds from one user's account to another.

One run of that transaction might read Alice's account balance, and then Bob's. You then propose to deduct $5 from Alice's account and increase Bob's balance by the same $5.

Here's our pseudocode:

```
$14 <- READ Alice
$11 <- READ Bob
WRITE Alice $9
WRITE Bob $16
```

This ledger balance transfer is a classic database scenario that requires a guarantee that these write operations will only apply together. It is a really bad thing if only one operation succeeds!

```
$14 <- READ Alice
$11 <- READ Bob
WRITE Alice $9
*crash* // $5 lost from your bank
```

You need a guarantee that this can never happen. You require transaction atomicity, and Convex provides it.

The problem of data correctness is much deeper. Concurrent transactions that read and edit the same records can create *data races*.

In the case of our app it's entirely possible that someone deducts Alice's balance right after we read it. Maybe she bought a Coke Zero at the airport with her debit card for $3.

```
$5 Transfer                           $3 Debit Card Charge
----------------------------------------------------------
$14 <- READ Alice
$11 <- READ Bob
                                        $14 <- READ Alice
                                        WRITE Alice $11
WRITE Alice $9 // Free coke!
WRITE Bob $16
```

Clearly, we need to prevent these types of data races from happening. We need a way to handle these concurrent conflicts. Generally, there are two common approaches.

Most traditional databases choose a *pessimistic locking* strategy. (Pessimism in this case means the strategy assumes conflict will happen ahead of time so seeks to prevent it.) With pessimistic locking, you first need to acquire a lock on Alice's record, and then acquire a lock on Bob's record. Then you can proceed to conduct your transaction, knowing that any other transaction that needed to touch those records will wait until you are done and all your writes are committed.

After decades of experience, the drawbacks of pessimistic locking are well understood and undeniable. The biggest limitation arises from real-life networks and computers being inherently unreliable. If the lock holder goes missing for whatever reason half way through its transaction, everyone else that wants to modify any of those records is waiting indefinitely. Not good!

Optimistic concurrency control is, as the name states, optimistic. It assumes the transaction will succeed and doesn't worry about locking anything ahead of time. Very brash! How can it be so sure?

It does this by treating the transaction as a *declarative proposal* to write records on the basis of any read record versions (the "read set"). At the end of the transaction, the writes all commit if every version in the read set is still the latest version of that record. This means no concurrent conflict occurred.

Now using our version read set, let's see how OCC would have prevented the soda-catastrophe above:

```
$5 Transfer                           $3 Debit Card Charge
----------------------------------------------------------
(v1, $14) <- READ Alice
(v7, $11) <- READ Bob
                                        (v1, $14) <- READ Alice
                                        WRITE Alice $11
                                        IF Alice.v = v1

WRITE Alice = $9, Bob = $16
    IF Alice.v = v1, Bob.v = v7 // Fails! Alice is = v2
```

This is akin to being unable to push your Git repository because you're not at HEAD. We all know in that circumstance, we need to pull, and rebase or merge, etc.

## When OCC loses, determinism wins[​](#when-occ-loses-determinism-wins "Direct link to When OCC loses, determinism wins")

A naive optimistic concurrency control solution would be to solve this the same way that Git does: require the user/application to resolve the conflict and determine if it is safe to retry.

In Convex, however, we don't need to do that. We know the transaction is deterministic. It didn't charge money to Stripe, it didn't write a permanent value out to the filesystem. It had no effect at all other than proposing some atomic changes to Convex tables that were not applied.

The determinism means that we can simply re-run the transaction; you never need to worry about temporary data races. We can run several retries if necessary until we succeed to execute the transaction without any conflicts.

tip

In fact, the Git analogy stays very apt. An OCC conflict means we cannot push because our HEAD is out of date, so we need to rebase our changes and try again. And determinism is what guarantees there is never a "merge conflict", so (unlike with Git) this rebase operation will always eventually succeed without developer intervention.

## Snapshot Isolation vs Serializability[​](#snapshot-isolation-vs-serializability "Direct link to Snapshot Isolation vs Serializability")

It is common for optimistic multi-version concurrency control databases to provide a guarantee of [snapshot isolation](https://en.wikipedia.org/wiki/Snapshot_isolation). This [isolation level](https://en.wikipedia.org/wiki/Isolation_\(database_systems\)) provides the illusion that all transactions execute on an atomic snapshot of the data but it is vulnerable to [anomalies](https://en.wikipedia.org/wiki/Snapshot_isolation#Definition) where certain combinations of concurrent transactions can yield incorrect results. The implementation of optimistic concurrency control in Convex instead provides true [serializability](https://en.wikipedia.org/wiki/Serializability) and will yield correct results regardless of what transactions are issued concurrently.

## No need to think about this[​](#no-need-to-think-about-this "Direct link to No need to think about this")

The beauty of this approach is that you can simply write your mutation functions as if they will *always succeed*, and always be guaranteed to be atomic.

Aside from sheer curiosity about how Convex works, day to day there's no need to worry about conflicts, locking, or atomicity when you make changes to your tables and documents. The "obvious way" to write your mutation functions will just work.


# Schema Philosophy

With Convex there is no need to write any `CREATE TABLE` statements, or think through your stored table structure ahead of time so you can name your field and types. You simply put your objects into Convex and keep building your app!

However, moving fast early can be problematic later. "Was that field a number or a string? I think I changed it when I fixed that one bug?"

Storage systems which are too permissive can sometimes become liabilities as your system matures and you want to be able to reason assuredly about exactly what data is in your system.

The good news is Convex is always typed. It's just implicitly typed! When you submit a document to Convex, tracks all the types of all the fields in your document. You can go to your [dashboard](/dashboard.md) and view the inferred schema of any table to understand what you've ended up with.

"What about that field I changed from a string to a number?" Convex can handle this too. Convex will track those changes, in this case the field is a union like `v.union(v.number(), v.string())`. That way even when you change your mind about your documents fields and types, Convex has your back.

Once you are ready to formalize your schema, you can define it using our [schema builder](/database/schemas.md) to enable schema validation and generate types based on it.


# System Tables

System tables enable read-only access to metadata for built-in Convex features. Currently there are two system tables exposed:

* `"_scheduled_functions"` table contains metadata for [scheduled functions](/scheduling/scheduled-functions.md#retrieving-scheduled-function-status)
* `"_storage"` table contains metadata for [stored files](/file-storage/file-metadata.md)

You can read data from system tables using the `db.system.get` and `db.system.query` methods, which work the same as the standard `db.get` and `db.query` methods. Queries reading from system tables are reactive and realtime just like queries reading from all other tables, and pagination can be used to enumerate all documents even when there are too many to read in a single query.


# Document IDs

**Example:** [Relational Data Modeling](https://github.com/get-convex/convex-demos/tree/main/relational-data-modeling)

Every document in convex has a globally unique string *document ID* that is automatically generated by the system.

```
const userId = await ctx.db.insert("users", { name: "Michael Jordan" });
```

You can use this ID to efficiently read a single document using the `get` method:

```
const retrievedUser = await ctx.db.get("users", userId);
```

You can access the ID of a document in the [`_id` field](/database/types.md#system-fields):

```
const userId = retrievedUser._id;
```

Also, this same ID can be used to update that document in place:

```
await ctx.db.patch("users", userId, { name: "Steph Curry" });
```

Convex generates an [`Id`](/generated-api/data-model.md#id) TypeScript type based on your [schema](/database/schemas.md) that is parameterized over your table names:

```
import { Id } from "./_generated/dataModel";

const userId: Id<"users"> = user._id;
```

IDs are strings at runtime, but the [`Id`](/generated-api/data-model.md#id) type can be used to distinguish IDs from other strings at compile time.

## References and relationships[​](#references-and-relationships "Direct link to References and relationships")

In Convex, you can reference a document simply by embedding its `Id` in another document:

```
await ctx.db.insert("books", {
  title,
  ownerId: user._id,
});
```

You can follow references with `ctx.db.get`:

```
const user = await ctx.db.get("books", book.ownerId);
```

And [query for documents](/database/reading-data/.md) with a reference:

```
const myBooks = await ctx.db
  .query("books")
  .filter((q) => q.eq(q.field("ownerId"), user._id))
  .collect();
```

Using `Id`s as references can allow you to build a complex data model.

## Trading off deeply nested documents vs. relationships[​](#trading-off-deeply-nested-documents-vs-relationships "Direct link to Trading off deeply nested documents vs. relationships")

While it's useful that Convex supports nested objects and arrays, you should keep documents relatively small in size. In practice, we recommend limiting Arrays to no more than 5-10 elements and avoiding deeply nested Objects.

Instead, leverage separate tables, documents, and references to structure your data. This will lead to better maintainability and performance as your project grows.

## Serializing IDs[​](#serializing-ids "Direct link to Serializing IDs")

IDs are strings, which can be easily inserted into URLs or stored outside of Convex.

You can pass an ID string from an external source (like a URL) into a Convex function and get the corresponding object. If you're using TypeScript on the client you can cast a string to the `Id` type:

src/App.tsx

```
import { useQuery } from "convex/react";
import { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";

export function App() {
  const id = localStorage.getItem("myIDStorage");
  const task = useQuery(api.tasks.getTask, { taskId: id as Id<"tasks"> });
  // ...
}
```

Since this ID is coming from an external source, use an argument validator or [`ctx.db.normalizeId`](/api/interfaces/server.GenericDatabaseReader.md#normalizeid) to confirm that the ID belongs to the expected table before returning the object.

convex/tasks.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    // ...
  },
});
```

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)


# Reading Data

[Query](/functions/query-functions.md) and [mutation](/functions/mutation-functions.md) functions can read data from database tables using *document ids* and *document queries*.

## Reading a single document[​](#reading-a-single-document "Direct link to Reading a single document")

Given a single document's id you can read its data with the [`db.get`](/api/interfaces/server.GenericDatabaseReader.md#get) method:

convex/tasks.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    // do something with `task`
  },
});
```

**Note**: You should use the `v.id` validator like in the example above to make sure you are not exposing data from tables other than the ones you intended.

## Querying documents[​](#querying-documents "Direct link to Querying documents")

Document queries always begin by choosing the table to query with the [`db.query`](/api/interfaces/server.GenericDatabaseReader.md#query) method:

convex/tasks.ts

TS

```
import { query } from "./_generated/server";

export const listTasks = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    // do something with `tasks`
  },
});
```

Then you can:

1. filter
2. order
3. and `await` the results

We'll see how this works in the examples below.

## Filtering your query[​](#filtering-your-query "Direct link to Filtering your query")

The best way to filter in Convex is to use indexes. Indexes build a special internal structure in your database to speed up lookups.

There are two steps to using indexes:

1. Define the index in your `convex/schema.ts` file.
2. Query via the `withIndex()` syntax.

### 1. Define the index[​](#1-define-the-index "Direct link to 1. Define the index")

If you aren't familiar with how to create a Convex schema, read the [schema doc](/database/schemas.md).

Let’s assume you’re building a chat app and want to get all messages in a particular channel. You can define a new index called `by_channel` on the `messages` table by using the `.index()` method in your schema.

convex/schema.ts

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define a messages table with an index.
export default defineSchema({
  messages: defineTable({
    channel: v.id("channels"),
    body: v.string(),
    user: v.id("users"),
  }).index("by_channel", ["channel"]),
});
```

### 2. Filter a query with an index[​](#2-filter-a-query-with-an-index "Direct link to 2. Filter a query with an index")

In your query function, you can now filter your `messages` table by using the `by_channel` index.

```
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) => q.eq("channel", channel))
  .collect();
```

In Convex, you must explicitly use the `withIndex()` syntax to ensure your database uses the index. This differs from a more traditional SQL database, where the database implicitly chooses to use an index based on heuristics. The Convex approach leads to fewer surprises in the long run.

You can create an index across multiple fields at once, query a specific range of data, and change the order of your query result. [Read the complete index documentation](/database/reading-data/indexes/.md) to learn more.

Convex also supports a slower filtering mechanism that effectively loops through the table to match the filter. This can be useful if you know your table will be small (low thousands of rows), you're prototyping, or you want to filter an index query further. You can read more about filters [here](/database/reading-data/filters.md).

## Ordering[​](#ordering "Direct link to Ordering")

By default Convex always returns documents ordered by [`_creationTime`](/database/types.md#system-fields).

You can use [`.order("asc" | "desc")`](/api/interfaces/server.Query.md#order) to pick whether the order is ascending or descending. If the order isn't specified, it defaults to ascending.

```
// Get all messages, oldest to newest.
const messages = await ctx.db.query("messages").order("asc").collect();
```

```
// Get all messages, newest to oldest.
const messages = await ctx.db.query("messages").order("desc").collect();
```

If you need to sort on a field other than `_creationTime` and your document query returns a small number of documents (on the order of hundreds rather than thousands of documents), consider sorting in JavaScript:

```
// Get top 10 most liked messages, assuming messages is a fairly small table:
const messages = await ctx.db.query("messages").collect();
const topTenMostLikedMessages = recentMessages
  .sort((a, b) => b.likes - a.likes)
  .slice(0, 10);
```

For document queries that return larger numbers of documents, you'll want to use an [index](/database/reading-data/indexes/.md) to improve the performance. Document queries that use indexes will be [ordered based on the columns in the index](/database/reading-data/indexes/.md#sorting-with-indexes) and can avoid slow table scans.

```
// Get the top 20 most liked messages of all time, using the "by_likes" index.
const messages = await ctx.db
  .query("messages")
  .withIndex("by_likes")
  .order("desc")
  .take(20);
```

See [Limits](/database/reading-data/indexes/.md#limits) for details.

### Ordering of different types of values[​](#ordering-of-different-types-of-values "Direct link to Ordering of different types of values")

A single field can have values of any [Convex type](/database/types.md). When there are values of different types in an indexed field, their ascending order is as follows:

No value set (`undefined`) < Null (`null`) < Int64 (`bigint`) < Float64 (`number`) < Boolean (`boolean`) < String (`string`) < Bytes (`ArrayBuffer`) < Array (`Array`) < Object (`Object`)

The same ordering is used by the filtering comparison operators `q.lt()`, `q.lte()`, `q.gt()` and `q.gte()`.

## Retrieving results[​](#retrieving-results "Direct link to Retrieving results")

Most of our previous examples have ended the document query with the [`.collect()`](/api/interfaces/server.Query.md#collect) method, which returns all the documents that match your filters. Here are the other options for retrieving results.

### Taking `n` results[​](#taking-n-results "Direct link to taking-n-results")

[`.take(n)`](/api/interfaces/server.Query.md#take) selects only the first `n` results that match your query.

```
const users = await ctx.db.query("users").take(5);
```

### Finding the first result[​](#finding-the-first-result "Direct link to Finding the first result")

[`.first()`](/api/interfaces/server.Query.md#first) selects the first document that matches your query and returns `null` if no documents were found.

```
// We expect only one user with that email address.
const userOrNull = await ctx.db
  .query("users")
  .withIndex("by_email", (q) => q.eq("email", "test@example.com"))
  .first();
```

### Using a unique result[​](#using-a-unique-result "Direct link to Using a unique result")

[`.unique()`](/api/interfaces/server.Query.md#unique) selects the single document from your query or returns `null` if no documents were found. If there are multiple results it will throw an exception.

```
// Our counter table only has one document.
const counterOrNull = await ctx.db.query("counter").unique();
```

### Loading a page of results[​](#loading-a-page-of-results "Direct link to Loading a page of results")

[`.paginate(opts)`](/api/interfaces/server.OrderedQuery.md#paginate) loads a page of results and returns a [`Cursor`](/api/modules/server.md#cursor) for loading additional results.

See [Paginated Queries](/database/pagination.md) to learn more.

## More complex queries[​](#more-complex-queries "Direct link to More complex queries")

Convex prefers to have a few, simple ways to walk through and select documents from tables. In Convex, there is no specific query language for complex logic like a join, an aggregation, or a group by.

Instead, you can write the complex logic in JavaScript! Convex guarantees that the results will be consistent.

### Join[​](#join "Direct link to Join")

Table join might look like:

convex/events.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const eventAttendees = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get("events", args.eventId);
    return Promise.all(
      (event?.attendeeIds ?? []).map((userId) => ctx.db.get("users", userId)),
    );
  },
});
```

### Aggregation[​](#aggregation "Direct link to Aggregation")

Here's an example of computing an average:

convex/purchases.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const averagePurchasePrice = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userPurchases = await ctx.db
      .query("purchases")
      .withIndex("by_buyer", (q) => q.eq("buyer", args.email))
      .collect();
    const sum = userPurchases.reduce((a, { value: b }) => a + b, 0);
    return sum / userPurchases.length;
  },
});
```

> If you need more scalable aggregate options (for example to handle frequent updates or large tables), consider using the [Sharded Counter](https://www.convex.dev/components/sharded-counter) or [Aggregate](https://www.convex.dev/components/aggregate) components. These components can help you handle high-throughput counters, sums, or computations without looping through the whole table.

### Group by[​](#group-by "Direct link to Group by")

Here's an example of grouping and counting:

convex/purchases.ts

TS

```
import { query } from "./_generated/server";
import { v } from "convex/values";

export const numPurchasesPerBuyer = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userPurchases = await ctx.db.query("purchases").collect();

    return userPurchases.reduce(
      (counts, { buyer }) => ({
        ...counts,
        [buyer]: counts[buyer] ?? 0 + 1,
      }),
      {} as Record<string, number>,
    );
  },
});
```

## Explore the syntax on the dashboard[​](#explore-the-syntax-on-the-dashboard "Direct link to Explore the syntax on the dashboard")

You can try out the syntax described above directly from the dashboard by [writing a custom test query](/dashboard/deployments/data.md#writing-custom-queries).



# Filtering

The [`filter`](/api/interfaces/server.Query.md#filter) method allows you to restrict the documents that your document query returns. This method takes a filter constructed by [`FilterBuilder`](/api/interfaces/server.FilterBuilder.md) and will only select documents that match.

The examples below demonstrate some of the common uses of `filter`. You can see the full list of available filtering methods [in the reference docs](/api/interfaces/server.FilterBuilder.md).

If you need to filter to documents containing some keywords, use a [search query](/search/text-search.md).

Use indexes instead

Filters effectively loop over your table looking for documents that match. This can be slow or cause your function to hit a [limit](/production/state/limits.md) when your table has thousands of rows. For faster more database efficient queries use [indexes instead](/database/reading-data/indexes/.md).

### Equality conditions[​](#equality-conditions "Direct link to Equality conditions")

This document query finds documents in the `users` table where `doc.name === "Alex"`:

```
// Get all users named "Alex".
const usersNamedAlex = await ctx.db
  .query("users")
  .filter((q) => q.eq(q.field("name"), "Alex"))
  .collect();
```

Here `q` is the [`FilterBuilder`](/api/interfaces/server.FilterBuilder.md) utility object. It contains methods for all of our supported filter operators.

This filter will run on all documents in the table. For each document, `q.field("name")` evaluates to the `name` property. Then `q.eq` checks if this property is equal to `"Alex"`.

If your query references a field that is missing from a given document then that field will be considered to have the value `undefined`.

### Comparisons[​](#comparisons "Direct link to Comparisons")

Filters can also be used to compare fields against values. This document query finds documents where `doc.age >= 18`:

```
// Get all users with an age of 18 or higher.
const adults = await ctx.db
  .query("users")
  .filter((q) => q.gte(q.field("age"), 18))
  .collect();
```

Here the `q.gte` operator checks if the first argument (`doc.age`) is greater than or equal to the second (`18`).

Here's the full list of comparisons:

| Operator      | Equivalent TypeScript |
| ------------- | --------------------- |
| `q.eq(l, r)`  | `l === r`             |
| `q.neq(l, r)` | `l !== r`             |
| `q.lt(l, r)`  | `l < r`               |
| `q.lte(l, r)` | `l <= r`              |
| `q.gt(l, r)`  | `l > r`               |
| `q.gte(l, r)` | `l >= r`              |

### Arithmetic[​](#arithmetic "Direct link to Arithmetic")

You can also include basic arithmetic in your queries. This document query finds documents in the `carpets` table where `doc.height * doc.width > 100`:

```
// Get all carpets that have an area of over 100.
const largeCarpets = await ctx.db
  .query("carpets")
  .filter((q) => q.gt(q.mul(q.field("height"), q.field("width")), 100))
  .collect();
```

Here's the full list of arithmetic operators:

| Operator      | Equivalent TypeScript |
| ------------- | --------------------- |
| `q.add(l, r)` | `l + r`               |
| `q.sub(l, r)` | `l - r`               |
| `q.mul(l, r)` | `l * r`               |
| `q.div(l, r)` | `l / r`               |
| `q.mod(l, r)` | `l % r`               |
| `q.neg(x)`    | `-x`                  |

### Combining operators[​](#combining-operators "Direct link to Combining operators")

You can construct more complex filters using methods like `q.and`, `q.or`, and `q.not`. This document query finds documents where `doc.name === "Alex" && doc.age >= 18`:

```
// Get all users named "Alex" whose age is at least 18.
const adultAlexes = await ctx.db
  .query("users")
  .filter((q) =>
    q.and(q.eq(q.field("name"), "Alex"), q.gte(q.field("age"), 18)),
  )
  .collect();
```

Here is a query that finds all users where `doc.name === "Alex" || doc.name === "Emma"`:

```
// Get all users named "Alex" or "Emma".
const usersNamedAlexOrEmma = await ctx.db
  .query("users")
  .filter((q) =>
    q.or(q.eq(q.field("name"), "Alex"), q.eq(q.field("name"), "Emma")),
  )
  .collect();
```

## Advanced filtering techniques[​](#advanced-filtering-techniques "Direct link to Advanced filtering techniques")

Sometimes the filter syntax is is not expressive enough. For example you may want to collect all posts that have a tag. Your schema for the posts looks like this:

```
export default defineSchema({
  posts: defineTable({
    body: v.string(),
    tags: v.array(v.string()),
  }),
});
```

One way to solve is by applying the filter on the result of the `collect()` call. This is just filtering a JavaScript array:

```
export const postsWithTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => {
    const allPosts = await ctx.db.query("posts").collect();
    return allPosts.filter((post) => post.tags.includes(args.tag));
  },
});
```

But this requires reading the whole table first. If you want to just get the first result that matches, reading the whole table could be very inefficient. Instead you may want to use the JavaScript [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) syntax to loop through the table one document at a time:

```
export const firstPostWithTag = query({
  args: { tag: v.string() },
  handler: (ctx, args) => {
    for await (const post of db.query("posts")) {
      if (post.tags.includes(args.tag)) {
        return post;
      }
    }
  },
});
```

This works because Convex queries are [JavaScript iterables](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).

Even with this optimization you are still just looping over the table to find the first post that matches and may hit your function limits. Using indexes is still the way to go. You can read a [detailed discussion of how to handle tags with indexes](https://stack.convex.dev/complex-filters-in-convex#optimize-with-indexes).

## Querying performance and limits[​](#querying-performance-and-limits "Direct link to Querying performance and limits")

Most of the example document queries above can lead to a *full table scan*. That is, for the document query to return the requested results, it might need to walk over every single document in the table.

Take this simple example:

```
const tasks = await ctx.db.query("tasks").take(5);
```

This document query will not scan more than 5 documents.

On the other hand, this document query:

```
const tasks = await ctx.db
  .query("tasks")
  .filter((q) => q.eq(q.field("isCompleted"), true))
  .first();
```

might need to walk over every single document in the `"tasks"` table just to find the first one with `isCompleted: true`.

If a table has more than a few thousand documents, you should use [indexes](/database/reading-data/indexes/.md) to improve your document query performance. Otherwise, you may run into our enforced limits, detailed in [Read/write limit errors](/functions/error-handling/.md#readwrite-limit-errors).

For information on other limits, see [Limits](/production/state/limits.md).


# Schemas

A schema is a description of

1. the tables in your Convex project
2. the type of documents within your tables

While it is possible to use Convex *without* defining a schema, adding a `schema.ts` file will ensure that the documents in your tables are the correct type. If you're using [TypeScript](/understanding/best-practices/typescript.md), adding a schema will also give you end-to-end type safety throughout your app.

We recommend beginning your project without a schema for rapid prototyping and then adding a schema once you've solidified your plan. To learn more see our [Schema Philosophy](/database/advanced/schema-philosophy.md).

**Example:** [TypeScript and Schemas](https://github.com/get-convex/convex-demos/tree/main/typescript)

## Writing schemas[​](#writing-schemas "Direct link to Writing schemas")

Schemas are defined in a `schema.ts` file in your `convex/` directory and look like:

convex/schema.ts

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    user: v.id("users"),
  }),
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),
});
```

This schema (which is based on our [users and auth example](https://github.com/get-convex/convex-demos/tree/main/users-and-auth)), has 2 tables: messages and users. Each table is defined using the [`defineTable`](/api/modules/server.md#definetable) function. Within each table, the document type is defined using the validator builder, [`v`](/api/modules/values.md#v). In addition to the fields listed, Convex will also automatically add `_id` and `_creationTime` fields. To learn more, see [System Fields](/database/types.md#system-fields).

Generating a Schema

While writing your schema, it can be helpful to consult the [Convex Dashboard](/dashboard/deployments/data.md#generating-a-schema). The "Generate Schema" button in the "Data" view suggests a schema declaration based on the data in your tables.

### Validators[​](#validators "Direct link to Validators")

The validator builder, [`v`](/api/modules/values.md#v) is used to define the type of documents in each table. It has methods for each of [Convex's types](/database/types.md):

convex/schema.ts

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    id: v.id("documents"),
    string: v.string(),
    number: v.number(),
    boolean: v.boolean(),
    nestedObject: v.object({
      property: v.string(),
    }),
  }),
});
```

It additionally allows you to define unions, optional property, string literals, and more. [Argument validation](/functions/validation.md) and schemas both use the same validator builder, `v`.

#### Optional fields[​](#optional-fields "Direct link to Optional fields")

You can describe optional fields by wrapping their type with `v.optional(...)`:

```
defineTable({
  optionalString: v.optional(v.string()),
  optionalNumber: v.optional(v.number()),
});
```

This corresponds to marking fields as optional with `?` in TypeScript.

#### Unions[​](#unions "Direct link to Unions")

You can describe fields that could be one of multiple types using `v.union`:

```
defineTable({
  stringOrNumber: v.union(v.string(), v.number()),
});
```

If your table stores multiple different types of documents, you can use `v.union` at the top level:

```
defineTable(
  v.union(
    v.object({
      kind: v.literal("StringDocument"),
      value: v.string(),
    }),
    v.object({
      kind: v.literal("NumberDocument"),
      value: v.number(),
    }),
  ),
);
```

In this schema, documents either have a `kind` of `"StringDocument"` and a string for their `value`:

```
{
  "kind": "StringDocument",
  "value": "abc"
}
```

or they have a `kind` of `"NumberDocument"` and a number for their `value`:

```
{
  "kind": "NumberDocument",
  "value": 123
}
```

#### Literals[​](#literals "Direct link to Literals")

Fields that are a constant can be expressed with `v.literal`:

```
defineTable({
  oneTwoOrThree: v.union(
    v.literal("one"),
    v.literal("two"),
    v.literal("three"),
  ),
});
```

#### Record objects[​](#record-objects "Direct link to Record objects")

You can describe objects that map arbitrary keys to values with `v.record`:

```
defineTable({
  simpleMapping: v.record(v.string(), v.boolean()),
});
```

You can use other types of string validators for the keys:

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    userIdToValue: v.record(v.id("users"), v.boolean()),
  },
  handler: async ({ db }, { userIdToValue }) => {
    //...
  },
});
```

Notes:

* This type corresponds to the [Record\<K,V>](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type) type in TypeScript
* You cannot use string literals as a `record` key
* Using `v.string()` as a `record` key validator will only allow ASCII characters

#### Any[​](#any "Direct link to Any")

Fields or documents that could take on any value can be represented with `v.any()`:

```
defineTable({
  anyValue: v.any(),
});
```

This corresponds to the `any` type in TypeScript.

### Options[​](#options "Direct link to Options")

These options are passed as part of the [options](/api/interfaces/server.DefineSchemaOptions.md) argument to [`defineSchema`](/api/modules/server.md#defineschema).

#### `schemaValidation: boolean`[​](#schemavalidation-boolean "Direct link to schemavalidation-boolean")

Whether Convex should validate at runtime that your documents match your schema.

By default, Convex will enforce that all new and existing documents match your schema.

You can disable `schemaValidation` by passing in `schemaValidation: false`:

```
defineSchema(
  {
    // Define tables here.
  },
  {
    schemaValidation: false,
  },
);
```

When `schemaValidation` is disabled, Convex will not validate that new or existing documents match your schema. You'll still get schema-specific TypeScript types, but there will be no validation at runtime that your documents match those types.

#### `strictTableNameTypes: boolean`[​](#stricttablenametypes-boolean "Direct link to stricttablenametypes-boolean")

Whether the TypeScript types should allow accessing tables not in the schema.

By default, the TypeScript table name types produced by your schema are strict. That means that they will be a union of strings (ex. `"messages" | "users"`) and only support accessing tables explicitly listed in your schema.

Sometimes it's useful to only define part of your schema. For example, if you are rapidly prototyping, it could be useful to try out a new table before adding it your `schema.ts` file.

You can disable `strictTableNameTypes` by passing in `strictTableNameTypes: false`:

```
defineSchema(
  {
    // Define tables here.
  },
  {
    strictTableNameTypes: false,
  },
);
```

When `strictTableNameTypes` is disabled, the TypeScript types will allow access to tables not listed in the schema and their document type will be `any`.

Regardless of the value of `strictTableNameTypes`, your schema will only validate documents in the tables listed in the schema. You can still create and modify documents in other tables in JavaScript or on the dashboard (they just won't be validated).

## Schema validation[​](#schema-validation "Direct link to Schema validation")

Schemas are pushed automatically in [`npx convex dev`](/cli.md#run-the-convex-dev-server) and [`npx convex deploy`](/cli.md#deploy-convex-functions-to-production).

The first push after a schema is added or modified will validate that all existing documents match the schema. If there are documents that fail validation, the push will fail.

After the schema is pushed, Convex will validate that all future document inserts and updates match the schema.

Schema validation is skipped if [`schemaValidation`](#schemavalidation-boolean) is set to `false`.

Note that schemas only validate documents in the tables listed in the schema. You can still create and modify documents in other tables (they just won't be validated).

### Circular references[​](#circular-references "Direct link to Circular references")

You might want to define a schema with circular ID references like:

convex/schema.ts

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    preferencesId: v.id("preferences"),
  }),
  preferences: defineTable({
    userId: v.id("users"),
  }),
});
```

In this schema, documents in the `users` table contain a reference to documents in `preferences` and vice versa.

Because schema validation enforces your schema on every `db.insert`, `db.replace`, and `db.patch` call, creating circular references like this is not possible.

The easiest way around this is to make one of the references nullable:

convex/schema.ts

```
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    preferencesId: v.id("preferences"),
  }),
  preferences: defineTable({
    userId: v.union(v.id("users"), v.null()),
  }),
});
```

This way you can create a preferences document first, then create a user document, then set the reference on the preferences document:

convex/users.ts

TS

```
import { mutation } from "./_generated/server";

export default mutation({
  handler: async (ctx) => {
    const preferencesId = await ctx.db.insert("preferences", {});
    const userId = await ctx.db.insert("users", { preferencesId });
    await ctx.db.patch("preferences", preferencesId, { userId });
  },
});
```

[Let us know](/production/contact.md) if you need better support for circular references.

## TypeScript types[​](#typescript-types "Direct link to TypeScript types")

Once you've defined a schema, [`npx convex dev`](/cli.md#run-the-convex-dev-server) will produce new versions of [`dataModel.d.ts`](/generated-api/data-model.md) and [`server.d.ts`](/generated-api/server.md) with types based on your schema.

### `Doc<TableName>`[​](#doctablename "Direct link to doctablename")

The [`Doc`](/generated-api/data-model.md#doc) TypeScript type from [`dataModel.d.ts`](/generated-api/data-model.md) provides document types for all of your tables. You can use these both when writing Convex functions and in your React components:

MessageView\.tsx

```
import { Doc } from "../convex/_generated/dataModel";

function MessageView(props: { message: Doc<"messages"> }) {
  ...
}
```

If you need the type for a portion of a document, use the [`Infer` type helper](/functions/validation.md#extracting-typescript-types).

### `query` and `mutation`[​](#query-and-mutation "Direct link to query-and-mutation")

The [`query`](/generated-api/server.md#query) and [`mutation`](/generated-api/server.md#mutation) functions in [`server.js`](/generated-api/server.md) have the same API as before but now provide a `db` with more precise types. Functions like [`db.insert(table, document)`](/api/interfaces/server.GenericDatabaseWriter.md#insert) now understand your schema. Additionally [database queries](/database/reading-data/.md) will now return the correct document type (not `any`).

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)


# Writing Data

[Mutations](/functions/mutation-functions.md) can insert, update, and remove data from database tables.

## Inserting new documents[​](#inserting-new-documents "Direct link to Inserting new documents")

You can create new documents in the database with the [`db.insert`](/api/interfaces/server.GenericDatabaseWriter.md#insert) method:

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", { text: args.text });
    // do something with `taskId`
  },
});
```

The second argument to `db.insert` is a JavaScript object with data for the new document.

The same types of values that can be passed into and returned from [queries](/functions/query-functions.md) and [mutations](/functions/mutation-functions.md) can be written into the database. See [Data Types](/database/types.md) for the full list of supported types.

The `insert` method returns a globally unique ID for the newly inserted document.

## Updating existing documents[​](#updating-existing-documents "Direct link to Updating existing documents")

Given an existing document ID the document can be updated using the following methods:

1. The [`db.patch`](/api/interfaces/server.GenericDatabaseWriter.md#patch) method will patch an existing document, shallow merging it with the given partial document. New fields are added. Existing fields are overwritten. Fields set to `undefined` are removed.

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const { id } = args;
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", status: { done: true }, _id: ... }

    // Add `tag` and overwrite `status`:
    await ctx.db.patch("tasks", id, { tag: "bar", status: { archived: true } });
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", tag: "bar", status: { archived: true }, _id: ... }

    // Unset `tag` by setting it to `undefined`
    await ctx.db.patch("tasks", id, { tag: undefined });
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", status: { archived: true }, _id: ... }
  },
});
```

2. The [`db.replace`](/api/interfaces/server.GenericDatabaseWriter.md#replace) method will replace the existing document entirely, potentially removing existing fields:

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const replaceTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const { id } = args;
    console.log(await ctx.db.get("tasks", id));
    // { text: "foo", _id: ... }

    // Replace the whole document
    await ctx.db.replace("tasks", id, { invalid: true });
    console.log(await ctx.db.get("tasks", id));
    // { invalid: true, _id: ... }
  },
});
```

## Deleting documents[​](#deleting-documents "Direct link to Deleting documents")

Given an existing document ID the document can be removed from the table with the [`db.delete`](/api/interfaces/server.GenericDatabaseWriter.md#delete) method.

convex/tasks.ts

TS

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete("tasks", args.id);
  },
});
```

## Bulk inserts or updates[​](#bulk-inserts-or-updates "Direct link to Bulk inserts or updates")

If you are used to SQL you might be looking for some sort of bulk insert or bulk update statement. In Convex the entire `mutation` function is automatically a single transaction.

You can just insert or update in a loop in the mutation function. Convex queues up all database changes in the function and executes them all in a single transaction when the function ends, leading to a single efficient change to the database.

````
/**
 * Bulk insert multiple products into the database.
 *
 * Equivalent to the SQL:
 * ```sql
 * INSERT INTO products (product_id, product_name, category, price, in_stock)
 * VALUES
 *     ('Laptop Pro', 'Electronics', 1299.99, true),
 *     ('Wireless Mouse', 'Electronics', 24.95, true),
 *     ('Ergonomic Keyboard', 'Electronics', 89.50, true),
 *     ('Ultra HD Monitor', 'Electronics', 349.99, false),
 *     ('Wireless Headphones', 'Audio', 179.99, true);
 * ```
 */
export const bulkInsertProducts = mutation({
  args: {
    products: v.array(
      v.object({
        product_name: v.string(),
        category: v.string(),
        price: v.number(),
        in_stock: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { products } = args;

    // Insert in a loop. This is efficient because Convex queues all the changes
    // to be executed in a single transaction when the mutation ends.
    for (const product of products) {
      const id = await ctx.db.insert("products", {
        product_name: product.product_name,
        category: product.category,
        price: product.price,
        in_stock: product.in_stock,
      });
    }
  },
});
````

## Migrations[​](#migrations "Direct link to Migrations")

Database migrations are done through the migration component. The component is designed to run online migrations to safely evolve your database schema over time. It allows you to resume from failures, and validate changes with dry runs.

[Convex Component](https://www.convex.dev/components/migrations)

### [Migrations](https://www.convex.dev/components/migrations)

[Framework for long running data migrations of live data.](https://www.convex.dev/components/migrations)

## Write performance and limits[​](#write-performance-and-limits "Direct link to Write performance and limits")

To prevent accidental writes of large amounts of records, queries and mutations enforce limits detailed [here](/production/state/limits.md#transactions).


# Realtime

Turns out Convex is automatically realtime! You don’t have to do anything special if you are already using [query functions](/functions/query-functions.md), [database](/database.md), and [client libraries](/client/react.md) in your app. Convex tracks the dependencies to your query functions, including database changes, and triggers the subscription in the client libraries.

![Convex is automatically reactive and realtime](/assets/images/realtime-3197272a21b075792f6ac922af228378.gif)

Aside from building a highly interactive app with ease, there are other benefits to the realtime architecture of Convex:

## Automatic caching[​](#automatic-caching "Direct link to Automatic caching")

Convex automatically caches the result of your query functions so that future calls just read from the cache. The cache is updated if the data ever changes. You don't get charged for database bandwidth for cached reads.

This requires no work or bookkeeping from you.

## Consistent data across your app[​](#consistent-data-across-your-app "Direct link to Consistent data across your app")

Every client subscription gets updated simultaneously to the same snapshot of the database. Your app always displays the most consistent view of your data.

This avoids bugs like increasing the number of items in the shopping cart and not showing that an item is sold out.

## Learn more[​](#learn-more "Direct link to Learn more")

Learn how to work with realtime and reactive queries in Convex on [Stack](https://stack.convex.dev/tag/Reactivity).

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)



# Authentication

Convex deployment endpoints are exposed to the open internet and the claims clients make about who they are must be authenticated to identify users and restrict what data they can see and edit.

Convex is compatible with most authentication providers because it uses OpenID Connect (based on OAuth) ID tokens in the form of JWTs to authenticate WebSocket connections or RPCs. These JWTs can be provided by any service (including your own Convex backend) that implement the appropriate OAuth endpoints to verify them.

## Third-party authentication platforms[​](#third-party-authentication-platforms "Direct link to Third-party authentication platforms")

Leveraging a Convex integration with a third-party auth provider provides the most comprehensive authentication solutions. Integrating another service provides a ton of functionality like passkeys, two-factor auth, spam protection, and more on top of the authentication basics.

* [Clerk](/auth/clerk.md) has great Next.js and React Native support
* [WorkOS AuthKit](/auth/authkit/.md) is built for B2B apps and free for up to 1M users
* [Auth0](/auth/auth0.md) is more established with more bells and whistles
* [Custom Auth Integration](/auth/advanced/custom-auth.md) allow any OpenID Connect-compatible identity provider to be used for authentication

After you integrate one of these, learn more about accessing authentication information in [Functions](/auth/functions-auth.md) and storing user information in the [Database](/auth/database-auth.md).

## The Convex Auth Library[​](#the-convex-auth-library "Direct link to The Convex Auth Library")

For client-side React and React Native mobile apps you can implement auth directly in Convex with the [Convex Auth](/auth/convex-auth.md) library. This [npm package](https://github.com/get-convex/convex-auth) runs on your Convex deployment and helps you build a custom sign-up/sign-in flow via social identity providers, one-time email or SMS access codes, or via passwords.

Convex Auth is in beta (it isn't complete and may change in backward-incompatible ways) and doesn't provide as many features as third party auth integrations. Since it doesn't require signing up for another service it's the quickest way to get auth up and running.

Convex Auth is in beta

Convex Auth<!-- --> <!-- -->is<!-- --> currently a [beta feature](/production/state/.md#beta-features). If you have feedback or feature requests, [let us know on Discord](https://convex.dev/community)!

Support for Next.js is under active development. If you'd like to help test this experimental support please [give it a try](https://labs.convex.dev/auth)!

## Debugging[​](#debugging "Direct link to Debugging")

If you run into issues consult the [Debugging](/auth/debug.md) guide.

## Service Authentication[​](#service-authentication "Direct link to Service Authentication")

Servers you control or third party services can call Convex functions but may not be able to obtain OpenID JWTs and often do not represent the actions of a specific user.

Say you're running some inference on a [Modal](https://modal.com/) server written in Python. When that server subscribes to a Convex query it doesn't do so with credentials of a particular end-user, rather it's looking for relevant tasks for any users that need that inference task, say summarizing and translating a conversation, completed.

To provide access to Convex queries, mutations, and actions to an external service you can write public functions accessible to the internet that check a shared secret, for example from an environment variable, before doing anything else.

## Authorization[​](#authorization "Direct link to Authorization")

Convex enables a traditional three tier application structure: a client/UI for your app, a backend that handles user requests, and a database for queries. This architecture lets you check every public request against any authorization rules you can define in code.

This means Convex doesn't need an opinionated authorization framework like RLS, which is required in client oriented databases like Firebase or Supabase. This flexibility lets you build and use an [authorization framework](https://en.wikipedia.org/wiki/Authorization) for your needs.

That said, the most common way is to simply write code that checks if the user is logged in and if they are allowed to do the requested action at the beginning of each public function.

For example, the following function enforces that only the currently authenticated user can remove their own user image:

```
export const removeUserImage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return;
    }
    ctx.db.patch("users", userId, { imageId: undefined, image: undefined });
  },
});
```

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)



# Convex & Clerk

[Clerk](https://clerk.com) is an authentication platform providing login via passwords, social identity providers, one-time email or SMS access codes, and multi-factor authentication and user management.

## Get started[​](#get-started "Direct link to Get started")

Convex offers a provider that is specifically for integrating with Clerk called `<ConvexProviderWithClerk>`. It works with any of Clerk's React-based SDKs, such as the Next.js and Expo SDKs.

See the following sections for the Clerk SDK that you're using:

* [React](#react) - Use this as a starting point if your SDK is not listed
* [Next.js](#nextjs)
* [TanStack Start](#tanstack-start)

### React[​](#react "Direct link to React")

**Example:** [React with Convex and Clerk](https://github.com/get-convex/template-react-vite-clerk)

This guide assumes you already have a working React app with Convex. If not follow the [Convex React Quickstart](/quickstart/react.md) first. Then:

1. Sign up for Clerk

   Sign up for a free Clerk account at [clerk.com/sign-up](https://dashboard.clerk.com/sign-up).

   ![Sign up to Clerk](/screenshots/clerk-signup.png)

2. Create an application in Clerk

   Choose how you want your users to sign in.

   ![Create a Clerk application](/screenshots/clerk-createapp.png)

3. Create a JWT Template

   In the Clerk Dashboard, navigate to the [JWT templates](https://dashboard.clerk.com/last-active?path=jwt-templates) page.

   Select *New template* and then from the list of templates, select *Convex*. You'll be redirected to the template's settings page. **Do NOT rename the JWT token. It must be called `convex`.**

   Copy and save the *Issuer* URL somewhere secure. This URL is the issuer domain for Clerk's JWT templates, which is your Clerk app's *Frontend API URL*. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.

   ![Create a JWT template](/screenshots/clerk-createjwt.png)

4. Configure Convex with the Clerk issuer domain

   In your app's `convex` folder, create a new file `auth.config.ts` with the following code. This is the server-side configuration for validating access tokens.

   convex/auth.config.ts

   TS

   ```
   import { AuthConfig } from "convex/server";

   export default {
     providers: [
       {
         // Replace with your own Clerk Issuer URL from your "convex" JWT template
         // or with `process.env.CLERK_JWT_ISSUER_DOMAIN`
         // and configure CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard
         // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances
         domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
         applicationID: "convex",
       },
     ]
   } satisfies AuthConfig;
   ```

5. Deploy your changes

   Run `npx convex dev` to automatically sync your configuration to your backend.

   ```
   npx convex dev
   ```

6. Install clerk

   In a new terminal window, install the Clerk React SDK:

   ```
   npm install @clerk/clerk-react
   ```

7. Set your Clerk API keys

   In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. In the **Quick Copy** section, copy your Clerk Publishable Key and set it as the `CLERK_PUBLISHABLE_KEY` environment variable. If you're using Vite, you will need to prefix it with `VITE_`.

   .env

   ```
   VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

8. Configure ConvexProviderWithClerk

   Both Clerk and Convex have provider components that are required to provide authentication and client context.

   You should already have `<ConvexProvider>` wrapping your app. Replace it with `<ConvexProviderWithClerk>`, and pass Clerk's `useAuth()` hook to it.

   Then, wrap it with `<ClerkProvider>`. `<ClerkProvider>` requires a `publishableKey` prop, which you can set to the `VITE_CLERK_PUBLISHABLE_KEY` environment variable.

   src/main.tsx

   TS

   ```
   import React from "react";
   import ReactDOM from "react-dom/client";
   import App from "./App";
   import "./index.css";
   import { ClerkProvider, useAuth } from "@clerk/clerk-react";
   import { ConvexProviderWithClerk } from "convex/react-clerk";
   import { ConvexReactClient } from "convex/react";

   const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

   ReactDOM.createRoot(document.getElementById("root")!).render(
     <React.StrictMode>
       <ClerkProvider publishableKey="pk_test_...">
         <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
           <App />
         </ConvexProviderWithClerk>
       </ClerkProvider>
     </React.StrictMode>,
   );
   ```

9. Show UI based on authentication state

   You can control which UI is shown when the user is signed in or signed out using Convex's `<Authenticated>`, `<Unauthenticated>` and `<AuthLoading>` helper components. These should be used instead of Clerk's `<SignedIn>`, `<SignedOut>` and `<ClerkLoading>` components, respectively.

   It's important to use the [`useConvexAuth()`](/api/modules/react.md#useconvexauth) hook instead of Clerk's `useAuth()` hook when you need to check whether the user is logged in or not. The `useConvexAuth()` hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend, and that the Convex backend has validated it.

   In the following example, the `<Content />` component is a child of `<Authenticated>`, so its content and any of its child components are guaranteed to have an authenticated user, and Convex queries can require authentication.

   src/App.tsx

   TS

   ```
   import { SignInButton, UserButton } from "@clerk/clerk-react";
   import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
   import { api } from "../convex/_generated/api";

   function App() {
     return (
       <main>
         <Unauthenticated>
           <SignInButton />
         </Unauthenticated>
         <Authenticated>
           <UserButton />
           <Content />
         </Authenticated>
         <AuthLoading>
           <p>Still loading</p>
         </AuthLoading>
       </main>
     );
   }

   function Content() {
     const messages = useQuery(api.messages.getForCurrentUser);
     return <div>Authenticated content: {messages?.length}</div>;
   }

   export default App;
   ```

10. Use authentication state in your Convex functions

    If the client is authenticated, you can access the information stored in the JWT via `ctx.auth.getUserIdentity`.

    If the client isn't authenticated, `ctx.auth.getUserIdentity` will return `null`.

    **Make sure that the component calling this query is a child of `<Authenticated>` from `convex/react`**. Otherwise, it will throw on page load.

    convex/messages.ts

    TS

    ```
    import { query } from "./_generated/server";

    export const getForCurrentUser = query({
      args: {},
      handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
          throw new Error("Not authenticated");
        }
        return await ctx.db
          .query("messages")
          .filter((q) => q.eq(q.field("author"), identity.email))
          .collect();
      },
    });
    ```

### Next.js[​](#nextjs "Direct link to Next.js")

**Example:** [Next.js with Convex and Clerk](https://github.com/get-convex/template-nextjs-clerk)

This guide assumes you already have a working Next.js app with Convex. If not follow the [Convex Next.js Quickstart](/quickstart/nextjs.md) first. Then:

1. Sign up for Clerk

   Sign up for a free Clerk account at [clerk.com/sign-up](https://dashboard.clerk.com/sign-up).

   ![Sign up to Clerk](/screenshots/clerk-signup.png)

2. Create an application in Clerk

   Choose how you want your users to sign in.

   ![Create a Clerk application](/screenshots/clerk-createapp.png)

3. Create a JWT Template

   In the Clerk Dashboard, navigate to the [JWT templates](https://dashboard.clerk.com/last-active?path=jwt-templates) page.

   Select *New template* and then from the list of templates, select *Convex*. You'll be redirected to the template's settings page. **Do NOT rename the JWT token. It must be called `convex`.**

   Copy and save the *Issuer* URL somewhere secure. This URL is the issuer domain for Clerk's JWT templates, which is your Clerk app's *Frontend API URL*. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.

   ![Create a JWT template](/screenshots/clerk-createjwt.png)

4. Configure Convex with the Clerk issuer domain

   In your app's `convex` folder, create a new file `auth.config.ts` with the following code. This is the server-side configuration for validating access tokens.

   convex/auth.config.ts

   TS

   ```
   import { AuthConfig } from "convex/server";

   export default {
     providers: [
       {
         // Replace with your own Clerk Issuer URL from your "convex" JWT template
         // or with `process.env.CLERK_JWT_ISSUER_DOMAIN`
         // and configure CLERK_JWT_ISSUER_DOMAIN on the Convex Dashboard
         // See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances
         domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
         applicationID: "convex",
       },
     ]
   } satisfies AuthConfig;
   ```

5. Deploy your changes

   Run `npx convex dev` to automatically sync your configuration to your backend.

   ```
   npx convex dev
   ```

6. Install clerk

   In a new terminal window, install the Clerk Next.js SDK:

   ```
   npm install @clerk/nextjs
   ```

7. Set your Clerk API keys

   In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. In the **Quick Copy** section, copy your Clerk Publishable and Secret Keys and set them as the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` environment variables, respectively.

   .env

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   CLERK_SECRET_KEY=YOUR_SECRET_KEY
   ```

8. Add Clerk middleware

   Clerk's `clerkMiddleware()` helper grants you access to user authentication state throughout your app.

   Create a `middleware.ts` file.

   In your `middleware.ts` file, export the `clerkMiddleware()` helper:

   ```
   import { clerkMiddleware } from '@clerk/nextjs/server'

   export default clerkMiddleware()

   export const config = {
     matcher: [
       // Skip Next.js internals and all static files, unless found in search params
       '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
       // Always run for API routes
       '/(api|trpc)(.*)',
     ],
   }
   ```

   By default, `clerkMiddleware()` will not protect any routes. All routes are public and you must opt-in to protection for routes.<https://clerk.com/docs/references/nextjs/clerk-middleware>) to learn how to require authentication for specific routes.

9. Configure ConvexProviderWithClerk

   Both Clerk and Convex have provider components that are required to provide authentication and client context.

   Typically, you'd replace `<ConvexProvider>` with `<ConvexProviderWithClerk>`, but with Next.js App Router, things are a bit more complex.

   `<ConvexProviderWithClerk>` calls `ConvexReactClient()` to get Convex's client, so it must be used in a Client Component. Your `app/layout.tsx`, where you would use `<ConvexProviderWithClerk>`, is a Server Component, and a Server Component cannot contain Client Component code. To solve this, you must first create a *wrapper* Client Component around `<ConvexProviderWithClerk>`.

   ```
   'use client'

   import { ReactNode } from 'react'
   import { ConvexReactClient } from 'convex/react'
   import { ConvexProviderWithClerk } from 'convex/react-clerk'
   import { useAuth } from '@clerk/nextjs'

   if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
     throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in your .env file')
   }

   const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)

   export default function ConvexClientProvider({ children }: { children: ReactNode }) {
     return (
       <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
         {children}
       </ConvexProviderWithClerk>
     )
   }
   ```

10. Wrap your app in Clerk and Convex

    Now, your Server Component, `app/layout.tsx`, can render `<ConvexClientProvider>` instead of rendering `<ConvexProviderWithClerk>` directly. It's important that `<ClerkProvider>` wraps `<ConvexClientProvider>`, and not the other way around, as Convex needs to be able to access the Clerk context.

    ```
    import type { Metadata } from 'next'
    import { Geist, Geist_Mono } from 'next/font/google'
    import './globals.css'
    import { ClerkProvider } from '@clerk/nextjs'
    import ConvexClientProvider from '@/components/ConvexClientProvider'

    const geistSans = Geist({
      variable: '--font-geist-sans',
      subsets: ['latin'],
    })

    const geistMono = Geist_Mono({
      variable: '--font-geist-mono',
      subsets: ['latin'],
    })

    export const metadata: Metadata = {
      title: 'Clerk Next.js Quickstart',
      description: 'Generated by create next app',
    }

    export default function RootLayout({
      children,
    }: Readonly<{
      children: React.ReactNode
    }>) {
      return (
        <html lang="en">
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            <ClerkProvider>
              <ConvexClientProvider>{children}</ConvexClientProvider>
            </ClerkProvider>
          </body>
        </html>
      )
    }
    ```

11. Show UI based on authentication state

    You can control which UI is shown when the user is signed in or signed out using Convex's `<Authenticated>`, `<Unauthenticated>` and `<AuthLoading>` helper components. These should be used instead of Clerk's `<SignedIn>`, `<SignedOut>` and `<ClerkLoading>` components, respectively.

    It's important to use the [`useConvexAuth()`](/api/modules/react.md#useconvexauth) hook instead of Clerk's `useAuth()` hook when you need to check whether the user is logged in or not. The `useConvexAuth()` hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend, and that the Convex backend has validated it.

    In the following example, the `<Content />` component is a child of `<Authenticated>`, so its content and any of its child components are guaranteed to have an authenticated user, and Convex queries can require authentication.

    app/page.tsx

    TS

    ```
    "use client";

    import { Authenticated, Unauthenticated } from "convex/react";
    import { SignInButton, UserButton } from "@clerk/nextjs";
    import { useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";

    export default function Home() {
      return (
        <>
          <Authenticated>
            <UserButton />
            <Content />
          </Authenticated>
          <Unauthenticated>
            <SignInButton />
          </Unauthenticated>
        </>
      );
    }

    function Content() {
      const messages = useQuery(api.messages.getForCurrentUser);
      return <div>Authenticated content: {messages?.length}</div>;
    }
    ```

12. Use authentication state in your Convex functions

    If the client is authenticated, you can access the information stored in the JWT via `ctx.auth.getUserIdentity`.

    If the client isn't authenticated, `ctx.auth.getUserIdentity` will return `null`.

    **Make sure that the component calling this query is a child of `<Authenticated>` from `convex/react`**. Otherwise, it will throw on page load.

    convex/messages.ts

    TS

    ```
    import { query } from "./_generated/server";

    export const getForCurrentUser = query({
      args: {},
      handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
          throw new Error("Not authenticated");
        }
        return await ctx.db
          .query("messages")
          .filter((q) => q.eq(q.field("author"), identity.email))
          .collect();
      },
    });
    ```

### TanStack Start[​](#tanstack-start "Direct link to TanStack Start")

**Example:** [TanStack Start with Convex and Clerk](https://github.com/get-convex/templates/tree/main/template-tanstack-start)

See the [TanStack Start with Clerk guide](/client/tanstack/tanstack-start/clerk.md) for more information.

## Next steps[​](#next-steps "Direct link to Next steps")

### Accessing user information in functions[​](#accessing-user-information-in-functions "Direct link to Accessing user information in functions")

See [Auth in Functions](/auth/functions-auth.md) to learn about how to access information about the authenticated user in your queries, mutations and actions.

See [Storing Users in the Convex Database](/auth/database-auth.md) to learn about how to store user information in the Convex database.

### Accessing user information client-side[​](#accessing-user-information-client-side "Direct link to Accessing user information client-side")

To access the authenticated user's information, use Clerk's `User` object, which can be accessed using Clerk's [`useUser()`](https://clerk.com/docs/hooks/use-user) hook. For more information on the `User` object, see the [Clerk docs](https://clerk.com/docs/references/javascript/user).

components/Badge.tsx

TS

```
export default function Badge() {
  const { user } = useUser();

  return <span>Logged in as {user.fullName}</span>;
}
```

## Configuring dev and prod instances[​](#configuring-dev-and-prod-instances "Direct link to Configuring dev and prod instances")

To configure a different Clerk instance between your Convex development and production deployments, you can use environment variables configured on the Convex dashboard.

### Configuring the backend[​](#configuring-the-backend "Direct link to Configuring the backend")

In the Clerk Dashboard, navigate to the [**API keys**](https://dashboard.clerk.com/last-active?path=api-keys) page. Copy your Clerk Frontend API URL. This URL is the issuer domain for Clerk's JWT templates, and is necessary for Convex to validate access tokens. In development, it's format will be `https://verb-noun-00.clerk.accounts.dev`. In production, it's format will be `https://clerk.<your-domain>.com`.

Paste your Clerk Frontend API URL into your `.env` file, set it as the `CLERK_JWT_ISSUER_DOMAIN` environment variable.

.env

```
CLERK_JWT_ISSUER_DOMAIN=https://verb-noun-00.clerk.accounts.dev
```

Then, update your `auth.config.ts` file to use the environment variable.

convex/auth.config.ts

TS

```
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

**Development configuration**

In the left sidenav of the Convex [dashboard](https://dashboard.convex.dev), switch to your development deployment and set the values for your development Clerk instance.

<!-- -->

![Convex dashboard dev deployment settings](/screenshots/clerk-convex-dashboard.png)

Then, to switch your deployment to the new configuration, run `npx convex dev`.

**Production configuration**

In the left sidenav of the Convex [dashboard](https://dashboard.convex.dev), switch to your production deployment and set the values for your production Clerk instance.

<!-- -->

Then, to switch your deployment to the new configuration, run `npx convex deploy`.

### Configuring Clerk's API keys[​](#configuring-clerks-api-keys "Direct link to Configuring Clerk's API keys")

Clerk's API keys differ depending on whether they are for development or production. Don't forget to update the environment variables in your `.env` file as well as your hosting platform, such as Vercel or Netlify.

**Development configuration**

Clerk's Publishable Key for development follows the format `pk_test_...`.

.env.local

```
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

**Production configuration**

Clerk's Publishable Key for production follows the format `pk_live_...`.

.env

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
```

## Debugging authentication[​](#debugging-authentication "Direct link to Debugging authentication")

If a user goes through the Clerk login flow successfully, and after being redirected back to your page, `useConvexAuth()` returns `isAuthenticated: false`, it's possible that your backend isn't correctly configured.

The `auth.config.ts` file contains a list of configured authentication providers. You must run `npx convex dev` or `npx convex deploy` after adding a new provider to sync the configuration to your backend.

For more thorough debugging steps, see [Debugging Authentication](/auth/debug.md).

## Under the hood[​](#under-the-hood "Direct link to Under the hood")

The authentication flow looks like this under the hood:

1. The user clicks a login button
2. The user is redirected to a page where they log in via whatever method you configure in
   <!-- -->
   Clerk
3. After a successful login
   <!-- -->
   Clerk
   <!-- -->
   redirects back to your page, or a different page which you configure via
   <!-- -->
   the
   <!-- -->
   [`afterSignIn`](https://clerk.com/docs/authentication/sign-in#override-ur-ls)
   <!-- -->
   prop
   <!-- -->
   .
4. The `ClerkProvider` now knows that the user is authenticated.
5. The `ConvexProviderWithClerk` fetches an auth token from
   <!-- -->
   Clerk
   <!-- -->
   .
6. The `ConvexReactClient` passes this token down to your Convex backend to validate
7. Your Convex backend retrieves the public key from
   <!-- -->
   Clerk
   <!-- -->
   to check that the token's signature is valid.
8. The `ConvexReactClient` is notified of successful authentication, and `ConvexProviderWithClerk` now knows that the user is authenticated with Convex. `useConvexAuth` returns `isAuthenticated: true` and the `Authenticated` component renders its children.

`ConvexProviderWithClerk` takes care of refetching the token when needed to make sure the user stays authenticated with your backend.


# Storing Users in the Convex Database

*If you're using [Convex Auth](/auth/convex-auth.md) the user information is already stored in your database. There's nothing else you need to implement.*

You might want to store user information directly in your Convex database, for the following reasons:

* Your functions need information about other users, not just about the currently logged-in user
* Your functions need access to information other than the fields available in the [Open ID Connect JWT](/auth/functions-auth.md)

There are two ways you can choose from for storing user information in your database (but only the second one allows storing information not contained in the JWT):

1. Have your app's [client call a mutation](#call-a-mutation-from-the-client) that stores the information from the JWT available on [`ctx.auth`](/api/interfaces/server.Auth.md)
2. [Implement a webhook](#set-up-webhooks) and have your identity provider call it whenever user information changes

## Call a mutation from the client[​](#call-a-mutation-from-the-client "Direct link to Call a mutation from the client")

**Example:** [Convex Authentication with Clerk](https://github.com/get-convex/convex-demos/tree/main/users-and-clerk)

### (optional) Users table schema[​](#optional-users-table-schema "Direct link to (optional) Users table schema")

You can define a `"users"` table, optionally with an [index](/database/reading-data/indexes/.md) for efficient looking up the users in the database.

In the examples below we will use the `tokenIdentifier` from the `ctx.auth.getUserIdentity()` to identify the user, but you could use the `subject` field (which is usually set to the unique user ID from your auth provider) or even `email`, if your authentication provider provides email verification and you have it enabled.

Which field you use will determine how multiple providers interact, and how hard it will be to migrate to a different provider.

convex/schema.ts

```
users: defineTable({
  name: v.string(),
  tokenIdentifier: v.string(),
}).index("by_token", ["tokenIdentifier"]),
```

### Mutation for storing current user[​](#mutation-for-storing-current-user "Direct link to Mutation for storing current user")

This is an example of a mutation that stores the user's `name` and `tokenIdentifier`:

convex/users.ts

TS

```
import { mutation } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    // Check if we've already stored this identity before.
    // Note: If you don't want to define an index right away, you can use
    // ctx.db.query("users")
    //  .filter(q => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
    //  .unique();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      // If we've seen this identity before but the name has changed, patch the value.
      if (user.name !== identity.name) {
        await ctx.db.patch(user._id, { name: identity.name });
      }
      return user._id;
    }
    // If it's a new identity, create a new `User`.
    return await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});
```

### Calling the store user mutation from React[​](#calling-the-store-user-mutation-from-react "Direct link to Calling the store user mutation from React")

You can call this mutation when the user logs in from a `useEffect` hook. After the mutation succeeds you can update local state to reflect that the user has been stored.

This helper hook that does the job:

src/useStoreUserEffect.ts

TS

```
import { useUser } from "@clerk/clerk-react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function useStoreUserEffect() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  // When this state is set we know the server
  // has stored the user.
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const storeUser = useMutation(api.users.store);
  // Call the `storeUser` mutation function to store
  // the current user in the `users` table and return the `Id` value.
  useEffect(() => {
    // If the user is not logged in don't do anything
    if (!isAuthenticated) {
      return;
    }
    // Store the user in the database.
    // Recall that `storeUser` gets the user information via the `auth`
    // object on the server. You don't need to pass anything manually here.
    async function createUser() {
      const id = await storeUser();
      setUserId(id);
    }
    createUser();
    return () => setUserId(null);
    // Make sure the effect reruns if the user logs in with
    // a different identity
  }, [isAuthenticated, storeUser, user?.id]);
  // Combine the local state with the state from context
  return {
    isLoading: isLoading || (isAuthenticated && userId === null),
    isAuthenticated: isAuthenticated && userId !== null,
  };
}
```

You can use this hook in your top-level component. If your queries need the user document to be present, make sure that you only render the components that call them after the user has been stored:

src/App.tsx

TS

```
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useStoreUserEffect } from "./useStoreUserEffect.js";

function App() {
  const { isLoading, isAuthenticated } = useStoreUserEffect();
  return (
    <main>
      {isLoading ? (
        <>Loading...</>
      ) : !isAuthenticated ? (
        <SignInButton />
      ) : (
        <>
          <UserButton />
          <Content />
        </>
      )}
    </main>
  );
}

function Content() {
  const messages = useQuery(api.messages.getForCurrentUser);
  return <div>Authenticated content: {messages?.length}</div>;
}

export default App;
```

In this way the `useStoreUserEffect` hook replaces the `useConvexAuth` hook.

### Using the current user's document ID[​](#using-the-current-users-document-id "Direct link to Using the current user's document ID")

Similarly to the store user mutation, you can retrieve the current user's ID, or throw an error if the user hasn't been stored.

Now that you have users stored as documents in your Convex database, you can use their IDs as foreign keys in other documents:

convex/messages.ts

TS

```
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const send = mutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated call to mutation");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new Error("Unauthenticated call to mutation");
    }
    await ctx.db.insert("messages", { body: args.body, user: user._id });
  },
});
    // do something with `user`...
}
});
```

### Loading users by their ID[​](#loading-users-by-their-id "Direct link to Loading users by their ID")

The information about other users can be retrieved via their IDs:

convex/messages.ts

TS

```
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return Promise.all(
      messages.map(async (message) => {
        // For each message in this channel, fetch the `User` who wrote it and
        // insert their name into the `author` field.
        const user = await ctx.db.get(message.user);
        return {
          author: user?.name ?? "Anonymous",
          ...message,
        };
      }),
    );
  },
});
```

## Set up webhooks[​](#set-up-webhooks "Direct link to Set up webhooks")

This guide will use Clerk, but Auth0 can be set up similarly via [Auth0 Actions](https://auth0.com/docs/customize/actions/actions-overview).

With this implementation Clerk will call your Convex backend via an HTTP endpoint any time a user signs up, updates or deletes their account.

**Example:** [Convex Authentication with Clerk and Webhooks](https://github.com/get-convex/convex-demos/tree/main/users-and-clerk-webhooks)

### Configure the webhook endpoint in Clerk[​](#configure-the-webhook-endpoint-in-clerk "Direct link to Configure the webhook endpoint in Clerk")

On your Clerk dashboard, go to *Webhooks*, click on *+ Add Endpoint*.

Set *Endpoint URL* to `https://<your deployment name>.convex.site/clerk-users-webhook` (note the domain ends in **`.site`**, not `.cloud`). You can see your deployment name in the `.env.local` file in your project directory, or on your Convex dashboard as part of the [Deployment URL](/dashboard/deployments/deployment-settings.md). For example, the endpoint URL could be: `https://happy-horse-123.convex.site/clerk-users-webhook`.

In *Message Filtering*, select **user** for all user events (scroll down or use the search input).

Click on *Create*.

After the endpoint is saved, copy the *Signing Secret* (on the right side of the UI), it should start with `whsec_`. Set it as the value of the `CLERK_WEBHOOK_SECRET` environment variable in your Convex [dashboard](https://dashboard.convex.dev).

### (optional) Users table schema[​](#optional-users-table-schema-1 "Direct link to (optional) Users table schema")

You can define a `"users"` table, optionally with an [index](/database/reading-data/indexes/.md) for efficient looking up the users in the database.

In the examples below we will use the `subject` from the `ctx.auth.getUserIdentity()` to identify the user, which should be set to the Clerk user ID.

convex/schema.ts

```
users: defineTable({
  name: v.string(),
  // this the Clerk ID, stored in the subject JWT field
  externalId: v.string(),
}).index("byExternalId", ["externalId"]),
```

### Mutations for upserting and deleting users[​](#mutations-for-upserting-and-deleting-users "Direct link to Mutations for upserting and deleting users")

This is an example of mutations that handle the updates received via the webhook:

convex/users.ts

TS

```
import { internalMutation, query, QueryCtx } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      name: `${data.first_name} ${data.last_name}`,
      externalId: data.id,
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(
        `Can't delete user, there is none for Clerk user ID: ${clerkUserId}`,
      );
    }
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
```

There are also a few helpers in this file:

* `current` exposes the user information to the client, which will helps the client determine whether the webhook already succeeded
* `upsertFromClerk` will be called when a user signs up or when they update their account
* `deleteFromClerk` will be called when a user deletes their account via Clerk UI from your app
* `getCurrentUserOrThrow` retrieves the currently logged-in user or throws an error
* `getCurrentUser` retrieves the currently logged-in user or returns null
* `userByExternalId` retrieves a user given the Clerk ID, and is used only for retrieving the current user or when updating an existing user via the webhook

### Webhook endpoint implementation[​](#webhook-endpoint-implementation "Direct link to Webhook endpoint implementation")

This how the actual HTTP endpoint can be implemented:

convex/http.ts

TS

```
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
```

If you deploy your code now and sign in, you should see the user being created in your Convex database.

### Using the current user's document[​](#using-the-current-users-document "Direct link to Using the current user's document")

You can use the helpers defined before to retrieve the current user's document.

Now that you have users stored as documents in your Convex database, you can use their IDs as foreign keys in other documents:

convex/messages.ts

TS

```
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

export const send = mutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    await ctx.db.insert("messages", { body: args.body, userId: user._id });
  },
});
```

### Loading users by their ID[​](#loading-users-by-their-id-1 "Direct link to Loading users by their ID")

The information about other users can be retrieved via their IDs:

convex/messages.ts

TS

```
export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return Promise.all(
      messages.map(async (message) => {
        // For each message in this channel, fetch the `User` who wrote it and
        // insert their name into the `author` field.
        const user = await ctx.db.get(message.user);
        return {
          author: user?.name ?? "Anonymous",
          ...message,
        };
      }),
    );
  },
});
```

### Waiting for current user to be stored[​](#waiting-for-current-user-to-be-stored "Direct link to Waiting for current user to be stored")

If you want to use the current user's document in a query, make sure that the user has already been stored. You can do this by explicitly checking for this condition before rendering the components that call the query, or before redirecting to the authenticated portion of your app.

For example you can define a hook that determines the current authentication state of the client, taking into account whether the current user has been stored:

src/useCurrentUser.ts

TS

```
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function useCurrentUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  // Combine the authentication state with the user existence check
  return {
    isLoading: isLoading || (isAuthenticated && user === null),
    isAuthenticated: isAuthenticated && user !== null,
  };
}
```

And then you can use it to render the appropriate components:

src/App.tsx

TS

```
import { useCurrentUser } from "./useCurrentUser";

export default function App() {
  const { isLoading, isAuthenticated } = useCurrentUser();
  return (
    <main>
      {isLoading ? (
        <>Loading...</>
      ) : isAuthenticated ? (
        <Content />
      ) : (
        <LoginPage />
      )}
    </main>
  );
}
```



# Debugging Authentication

You have followed one of our authentication guides but something is not working. You have double checked that you followed all the steps, and that you used the correct secrets, but you are still stuck.

## Frequently encountered issues[​](#frequently-encountered-issues "Direct link to Frequently encountered issues")

### `ctx.auth.getUserIdentity()` returns `null` in a query[​](#ctxauthgetuseridentity-returns-null-in-a-query "Direct link to ctxauthgetuseridentity-returns-null-in-a-query")

This often happens when subscribing to queries via `useQuery` in React, without waiting for the client to be authenticated. Even if the user has been logged-in previously, it takes some time for the client to authenticate with the Convex backend. Therefore on page load, `ctx.auth.getUserIdentity()` called within a query returns `null`.

To handle this, you can either:

1. Use the `Authenticated` component from `convex/react` to wrap the component that includes the `useQuery` call (see the last two steps in the [Clerk guide](/auth/clerk.md#get-started))
2. Or return `null` or some other "sentinel" value from the query and handle it on the client

If you are using `fetchQuery` for [Next.js Server Rendering](/client/nextjs/app-router/server-rendering.md), make sure you are explicitly passing in a JWT token as documented [here](/client/nextjs/app-router/server-rendering.md#server-side-authentication).

If this hasn't helped, follow the steps below to resolve your issue.

## Step 1: Check whether authentication works on the backend[​](#step-1-check-whether-authentication-works-on-the-backend "Direct link to Step 1: Check whether authentication works on the backend")

1. Add the following code to the *beginning* of your function (query, mutation, action or http action):

```
console.log("server identity", await ctx.auth.getUserIdentity());
```

2. Then call this function from whichever client you're using to talk to Convex.

3. Open the [logs page on your dashboard](https://dashboard.convex.dev/deployment/logs).

4. What do you see on the logs page?

   **Answer: I don't see anything**:

   * Potential cause: You don't have the right dashboard open. Confirm that the Deployment URL on *Settings* > *URL and Deploy Key* page matches how your client is configured.
   * Potential cause: Your client is not connected to Convex. Check your client logs (browser logs) for errors. Reload the page / restart the client.
   * Potential cause: The code has not been pushed. For dev deployments make sure you have `npx convex dev` running. For prod deployments make sure you successfully pushed via `npx convex deploy`. Go to the *Functions* page on the dashboard and check that the code shown there includes the `console.log` line you added.

   When you resolved the cause you should see the log appear.

   **Answer: I see a log with `'server identity' null`**:

   * Potential cause: The client is not supplying an auth token.
   * Potential cause: Your deployment is misconfigured.
   * Potential cause: Your client is misconfigured.

   Proceed to [step 2](#step-2-check-whether-authentication-works-on-the-frontend).

   **Answer: I see a log with `'server identity' { tokenIdentifier: '... }`**

   Great, you are all set!

## Step 2: Check whether authentication works on the frontend[​](#step-2-check-whether-authentication-works-on-the-frontend "Direct link to Step 2: Check whether authentication works on the frontend")

No matter which client you use, it must pass a JWT token to your backend for authentication to work.

The most bullet-proof way of ensuring your client is passing the token to the backend, is to inspect the traffic between them.

1. If you're using a client from the web browser, open the *Network* tab in your browser's developer tools.

2. Check the token

   * For Websocket-based clients (`ConvexReactClient` and `ConvexClient`), filter for the `sync` name and select `WS` as the type of traffic. Check the `sync` items. After the client is initialized (commonly after loading the page), it will send a message (check the *Messages* tab) with `type: "Authenticate"`, and `value` will be the authentication token.

     ![Network tab inspecting Websocket messages](/screenshots/auth-ws.png)

   * For HTTP based clients (`ConvexHTTPClient` and the [HTTP API](/http-api/.md)), select `Fetch/XHR` as the type of traffic. You should see an individual network request for each function call, with an `Authorization` header with value `Bearer `followed by the authentication token.

     ![Network tab inspecting HTTP headers](/screenshots/auth-http.png)

3. Do you see the authentication token in the traffic?

   **Answer: No**:

   * Potential cause: The Convex client is not configured to get/fetch a JWT token. You're not using `ConvexProviderWithClerk`/`ConvexProviderWithAuth0`/`ConvexProviderWithAuth` with the `ConvexReactClient` or you forgot to call `setAuth` on `ConvexHTTPClient` or `ConvexClient`.

   * Potential cause: You are not signed in, so the token is `null` or `undefined` and the `ConvexReactClient` skipped authentication altogether. Verify that you are signed in via `console.log`ing the token from whichever auth provider you are using:

     * Clerk:

       ```
       // import { useAuth } from "@clerk/nextjs"; // for Next.js
       import { useAuth } from "@clerk/clerk-react";

       const { getToken } = useAuth();
       console.log(getToken({ template: "convex" }));
       ```

     * Auth0:

       ```
       import { useAuth0 } from "@auth0/auth0-react";

       const { getAccessTokenSilently } = useAuth0();
       const response = await getAccessTokenSilently({
         detailedResponse: true,
       });
       const token = response.id_token;
       console.log(token);
       ```

     * Custom: However you implemented `useAuthFromProviderX`

     If you don't see a long string that looks like a token, check the browser logs for errors from your auth provider. If there are none, check the Network tab to see whether requests to your provider are failing. Perhaps the auth provider is misconfigured. Double check the auth provider configuration (in the corresponding React provider or however your auth provider is configured for the client). Try clearing your cookies in the browser (in dev tools *Application* > *Cookies* > *Clear all cookies* button).

   **Answer: Yes, I see a long string that looks like a JWT**:

   Great, copy the whole token (there can be `.`s in it, so make sure you're not copying just a portion of it).

4. Open <https://jwt.io/>, scroll down and paste the token in the Encoded textarea on the left of the page. On the right you should see:

   * In *HEADER*, `"typ": "JWT"`
   * in *PAYLOAD*, a valid JSON with at least `"aud"`, `"iss"` and `"sub"` fields. If you see gibberish in the payload you probably didn't copy the token correctly or it's not a valid JWT token.

   If you see a valid JWT token, repeat [step 1](#step-1-check-whether-authentication-works-on-the-backend). If you still don't see correct identity, proceed to step 3.

## Step 3: Check that backend configuration matches frontend configuration[​](#step-3-check-that-backend-configuration-matches-frontend-configuration "Direct link to Step 3: Check that backend configuration matches frontend configuration")

You have a valid JWT token on the frontend, and you know that it is being passed to the backend, but the backend is not validating it.

1. Open the *Settings* > *Authentication* on your dashboard. What do you see?

   **Answer: I see `This deployment has no configured authentication providers`**:

   * Cause: You do not have an `auth.config.ts` (or `auth.config.js`) file in your `convex` directory, or you haven't pushed your code. Follow the authentication guide to create a valid auth config file. For dev deployments make sure you have `npx convex dev` running. For prod deployments make sure you successfully pushed via `npx convex deploy`.

   \*\*Answer: I see one or more *Domain* and *Application ID* pairs.

Great, let's check they match the JWT token.

2. Look at the `iss` field in the JWT token payload at <https://jwt.io/>. Does it match a *Domain* on the *Authentication* page?

   **Answer: No, I don't see the `iss` URL on the Convex dashboard**:

   * Potential cause: You copied the wrong value into your

     `auth.config.ts`

     's `domain`, or into the environment variable that is used there. Go back to the authentication guide and make sure you have the right URL from your auth provider.

   * Potential cause: Your client is misconfigured:

     * Clerk: You have the wrong `publishableKey` configured. The key must belong to the Clerk instance that you used to configure your

       `auth.config.ts`.

       * Also make sure that the JWT token in Clerk is called `convex`, as that's the name `ConvexProviderWithClerk` uses to fetch the token!

     * Auth0: You have the wrong `domain` configured (on the client!). The domain must belong to the Auth0 instance that you used to configure your `auth.config.ts`.

     * Custom: Make sure that your client is correctly configured to match your `auth.config.ts`.

   **Answer: Yes, I do see the `iss` URL**:

   Great, let's move one.

3. Look at the `aud` field in the JWT token payload at <https://jwt.io/>. Does it match the *Application ID* under the correct *Domain* on the *Authentication* page?

   **Answer: No, I don't see the `aud` value in the *Application ID* field**:

   * Potential cause: You copied the wrong value into your
     <!-- -->
     `auth.config.ts`
     <!-- -->
     's `applicationID`, or into the environment variable that is used there. Go back to the authentication guide and make sure you have the right value from your auth provider.

   * Potential cause: Your client is misconfigured:

     <!-- -->

     * Clerk: You have the wrong `publishableKey` configured.The key must belong to the Clerk instance that you used to configure your `auth.config.ts`.
     * Auth0: You have the wrong `clientId` configured. Make sure you're using the right `clientId` for the Auth0 instance that you used to configure your `auth.config.ts`.
     * Custom: Make sure that your client is correctly configured to match your `auth.config.ts`.

   **Answer: Yes, I do see the `aud` value in the *Application ID* field**:

   Great, repeat [step 1](#step-1-check-whether-authentication-works-on-the-backend) and you should be all set!



   # Auth in Functions

*If you're using Convex Auth, see the [authorization doc](https://labs.convex.dev/auth/authz#use-authentication-state-in-backend-functions).*

Within a Convex [function](/functions.md), you can access information about the currently logged-in user by using the [`auth`](/api/interfaces/server.Auth.md) property of the [`QueryCtx`](/generated-api/server.md#queryctx), [`MutationCtx`](/generated-api/server.md#mutationctx), or [`ActionCtx`](/generated-api/server.md#actionctx) object:

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";

export const myMutation = mutation({
  args: {
    // ...
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Unauthenticated call to mutation");
    }
    //...
  },
});
```

## User identity fields[​](#user-identity-fields "Direct link to User identity fields")

The [UserIdentity](/api/interfaces/server.UserIdentity.md) object returned by `getUserIdentity` is guaranteed to have `tokenIdentifier`, `subject` and `issuer` fields. Which other fields it will include depends on the identity provider used and the configuration of JWT tokens and [OpenID scopes](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims).

`tokenIdentifier` is a combination of `subject` and `issuer` to ensure uniqueness even when multiple providers are used.

If you followed one of our integrations with Clerk or Auth0 at least the following fields will be present: `familyName`, `givenName`, `nickname`, `pictureUrl`, `updatedAt`, `email`, `emailVerified`. See their corresponding standard definition in the [OpenID docs](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims).

convex/myFunctions.ts

TS

```
import { mutation } from "./_generated/server";

export const myMutation = mutation({
  args: {
    // ...
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const { tokenIdentifier, name, email } = identity!;
    //...
  },
});
```

### Clerk claims configuration[​](#clerk-claims-configuration "Direct link to Clerk claims configuration")

If you're using Clerk, the fields returned by `getUserIdentity` are determined by your JWT template's *Claims* config. If you've set custom claims, they will be returned by `getUserIdentity` as well.

### Custom JWT Auth[​](#custom-jwt-auth "Direct link to Custom JWT Auth")

If you're using [Custom JWT auth](/auth/advanced/custom-jwt.md) instead of OpenID standard fields you'll find each nested field available at dot-containing-string field names like `identity["properties.email"]`.

## HTTP Actions[​](#http-actions "Direct link to HTTP Actions")

You can also access the user identity from an HTTP action [`ctx.auth.getUserIdentity()`](/api/interfaces/server.Auth.md#getuseridentity), by calling your endpoint with an `Authorization` header including a JWT token:

myPage.ts

TS

```
const jwtToken = "...";

fetch("https://<deployment name>.convex.site/myAction", {
  headers: {
    Authorization: `Bearer ${jwtToken}`,
  },
});
```

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)



# Scheduling

Convex lets you easily schedule a function to run once or repeatedly in the future. This allows you to build durable workflows like sending a welcome email a day after someone joins or regularly reconciling your accounts with Stripe. Convex provides two different features for scheduling:

* [Scheduled Functions](/scheduling/scheduled-functions.md) can be scheduled durably by any other function to run at a later point in time. You can schedule functions minutes, days, and even months in the future.
* [Cron Jobs](/scheduling/cron-jobs.md) schedule functions to run on a recurring basis, such as daily.

## Durable function components[​](#durable-function-components "Direct link to Durable function components")

Built-in scheduled functions and crons work well for simpler apps and workflows. If you're operating at high scale or need more specific guarantees, use the following higher-level [components](/components.md) for durable functions.

[Convex Component](https://www.convex.dev/components/workpool)

### [Workpool](https://www.convex.dev/components/workpool)

[Workpool give critical tasks priority by organizing async operations into separate, customizable queues.](https://www.convex.dev/components/workpool)

[Convex Component](https://www.convex.dev/components/workflow)

### [Workflow](https://www.convex.dev/components/workflow)

[Simplify programming long running code flows. Workflows execute durably with configurable retries and delays.](https://www.convex.dev/components/workflow)

[Convex Component](https://www.convex.dev/components/crons)

### [Crons](https://www.convex.dev/components/crons)

[Use cronspec to run functions on a repeated schedule at runtime.](https://www.convex.dev/components/crons)

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)



# Cron Jobs

Convex allows you to schedule functions to run on a recurring basis. For example, cron jobs can be used to clean up data at a regular interval, send a reminder email at the same time every month, or schedule a backup every Saturday.

**Example:** [Cron Jobs](https://github.com/get-convex/convex-demos/tree/main/cron-jobs)

## Defining your cron jobs[​](#defining-your-cron-jobs "Direct link to Defining your cron jobs")

Cron jobs are defined in a `crons.ts` file in your `convex/` directory and look like:

convex/crons.ts

TS

```
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "clear messages table",
  { minutes: 1 }, // every minute
  internal.messages.clearAll,
);

crons.monthly(
  "payment reminder",
  { day: 1, hourUTC: 16, minuteUTC: 0 }, // Every month on the first day at 8:00am PST
  internal.payments.sendPaymentEmail,
  { email: "my_email@gmail.com" }, // argument to sendPaymentEmail
);

// An alternative way to create the same schedule as above with cron syntax
crons.cron(
  "payment reminder duplicate",
  "0 16 1 * *",
  internal.payments.sendPaymentEmail,
  { email: "my_email@gmail.com" }, // argument to sendPaymentEmail
);

export default crons;
```

The first argument is a unique identifier for the cron job.

The second argument is the schedule at which the function should run, see [Supported schedules](/scheduling/cron-jobs.md#supported-schedules) below.

The third argument is the name of the public function or [internal function](/functions/internal-functions.md), either a [mutation](/functions/mutation-functions.md) or an [action](/functions/actions.md).

## Supported schedules[​](#supported-schedules "Direct link to Supported schedules")

* [`crons.interval()`](/api/classes/server.Crons.md#interval) runs a function every specified number of `seconds`, `minutes`, or `hours`. The first run occurs when the cron job is first deployed to Convex. Unlike traditional crons, this option allows you to have seconds-level granularity.
* [`crons.cron()`](/api/classes/server.Crons.md#cron) the traditional way of specifying cron jobs by a string with five fields separated by spaces (e.g. `"* * * * *"`). Times in cron syntax are in the UTC timezone. [Crontab Guru](https://crontab.guru/) is a helpful resource for understanding and creating schedules in this format.
* [`crons.hourly()`](/api/classes/server.Crons.md#cron), [`crons.daily()`](/api/classes/server.Crons.md#daily), [`crons.weekly()`](/api/classes/server.Crons.md#weekly), [`crons.monthly()`](/api/classes/server.Crons.md#monthly) provide an alternative syntax for common cron schedules with explicitly named arguments.

## Viewing your cron jobs[​](#viewing-your-cron-jobs "Direct link to Viewing your cron jobs")

You can view all your cron jobs in the [Convex dashboard cron jobs view](/dashboard/deployments/schedules.md#cron-jobs-ui). You can view added, updated, and deleted cron jobs in the logs and history view. Results of previously executed runs of the cron jobs are also available in the logs view.

## Error handling[​](#error-handling "Direct link to Error handling")

Mutations and actions have the same guarantees that are described in [Error handling](/scheduling/scheduled-functions.md#error-handling) for scheduled functions.

At most one run of each cron job can be executing at any moment. If the function scheduled by the cron job takes too long to run, following runs of the cron job may be skipped to avoid execution from falling behind. Skipping a scheduled run of a cron job due to the previous run still executing logs a message visible in the logs view of the dashboard.


# File Storage

File Storage makes it easy to implement file upload in your app, store files from and send files to third-party APIs, and to serve dynamic files to your users. All file types are supported.

* [Upload](/file-storage/upload-files.md) files to store them in Convex and reference them in your database documents
* [Store](/file-storage/store-files.md) files generated or fetched from third-party APIs
* [Serve](/file-storage/serve-files.md) files via URL
* [Delete](/file-storage/delete-files.md) files stored in Convex
* Access file [metadata](/file-storage/file-metadata.md)

You can manage your stored files on the [dashboard](/dashboard/deployments/file-storage.md).

**Examples:** [File Storage with HTTP Actions](https://github.com/get-convex/convex-demos/tree/main/file-storage-with-http), [File Storage with Queries and Mutations](https://github.com/get-convex/convex-demos/tree/main/file-storage)



# AI Code Generation

## [Prompt to build an app with Convex Chef](https://chef.convex.dev)

Convex is designed around a small set of composable abstractions with strong guarantees that result in code that is not only faster to write, but easier to read and maintain, whether written by a team member or an LLM. Key features make sure you get bug-free AI generated code:

1. **Queries are Just TypeScript** Your database queries are pure TypeScript functions with end-to-end type safety and IDE support. This means AI can generate database code using the large training set of TypeScript code without switching to SQL.
2. **Less Code for the Same Work** Since so much infrastructure and boiler plate is automatically managed by Convex there is less code to write, and thus less code to get wrong.
3. **Automatic Reactivity** The reactive system automatically tracks data dependencies and updates your UI. AI doesn't need to manually manage subscriptions, WebSocket connections, or complex state synchronization—Convex handles all of this automatically.
4. **Transactional Guarantees** Queries are read-only and mutations run in transactions. These constraints make it nearly impossible for AI to write code that could corrupt your data or leave your app in an inconsistent state.

Together, these features mean AI can focus on your business logic while Convex's guarantees prevent common failure modes. For up-to-date information on which models work best with Convex, check out our LLM [leaderboard](https://convex.dev/llm-leaderboard).

## Convex AI rules[​](#convex-ai-rules "Direct link to Convex AI rules")

AI code generation is most effective when you provide it with a set of rules to follow.

See these documents for install instructions:

* [Cursor](/ai/using-cursor.md#add-convex-cursorrules)
* [Windsurf](/ai/using-windsurf.md#add-convex-rules)
* [GitHub Copilot](/ai/using-github-copilot.md#add-convex-instructions)

For all other IDEs, add the following rules file to your project and refer to it when prompting for changes:

* [convex\_rules.txt](https://convex.link/convex_rules.txt)

We're constantly working on improving the quality of these rules for Convex by using rigorous evals. You can help by [contributing to our evals repo](https://github.com/get-convex/convex-evals).

## Using Convex with Background Agents[​](#using-convex-with-background-agents "Direct link to Using Convex with Background Agents")

Remote cloud-based coding agents like Jules, Devin, Codex, and Cursor background agents can use Convex deployments when the CLI is in [Agent Mode](/cli/agent-mode.md). This limits the permissions necessary for these remote dev environments while letting agents run codegen, iterate on code, run tests, run one-off functions.

A good setup script for e.g. ChatGPT Codex might include

```
npm i
CONVEX_AGENT_MODE=anonymous npx convex dev --once
```

or

```
bun i
CONVEX_AGENT_MODE=anonymous bun x convex dev --once
```

This command requires "full" internet access to download the binary.

## Convex MCP Server[​](#convex-mcp-server "Direct link to Convex MCP Server")

[Setup the Convex MCP server](/ai/convex-mcp-server.md) to give your AI coding agent access to your Convex deployment to query and optimize your project.



# Testing

Convex makes it easy to test your app via automated tests running in JS or against a real backend, and manually in dev, preview and staging environments.

## Automated tests[​](#automated-tests "Direct link to Automated tests")

### `convex-test` library[​](#convex-test-library "Direct link to convex-test-library")

[Use the `convex-test` library](/testing/convex-test.md) to test your functions in JS via the excellent Vitest testing framework.

### Testing against a real backend[​](#testing-against-a-real-backend "Direct link to Testing against a real backend")

Convex open source builds allow you to test all of your backend logic running on a real [local Convex backend](/testing/convex-backend.md).

### Set up testing in CI[​](#set-up-testing-in-ci "Direct link to Set up testing in CI")

It's a good idea to test your app continuously in a controlled environment. No matter which way automated method you use, it's easy to run them with [GitHub Actions](/testing/ci.md).

<!-- -->

<!-- -->

## Manual tests[​](#manual-tests "Direct link to Manual tests")

### Running a function in dev[​](#running-a-function-in-dev "Direct link to Running a function in dev")

Manually run a function in dev to quickly see if things are working:

* [Run functions from the command line](/cli.md#run-convex-functions)
* [Run functions from the dashboard](/dashboard/deployments/functions.md#running-functions)

### Preview deployments[​](#preview-deployments "Direct link to Preview deployments")

[Use preview deployments](/production/hosting/preview-deployments.md) to get early feedback from your team for your in-progress features.

### Staging environment[​](#staging-environment "Direct link to Staging environment")

You can set up a separate project as a staging environment to test against. See [Deploying Your App to Production](/production.md#staging-environment).


# Deploying Your App to Production

Convex is built to serve live, production app traffic. Here we cover how to deploy and maintain a production version of your app.

## Project management[​](#project-management "Direct link to Project management")

When you sign up for Convex, a Convex team is created for you. You can [create more teams from the dashboard](/dashboard/teams.md) and add other people to them as members. You can upgrade your team to the [Starter](https://www.convex.dev/pricing) plan to pay as you go or the [Professional](https://www.convex.dev/pricing) for additional features, higher built-in limits, 24h support, and discounted usage-based pricing.

Each team can have multiple projects. When you run `npx convex dev` for the first time, a project is created for you automatically. You can also create a project from the dashboard.

Every project has one shared production deployment and one development deployment per team member. This allows each team member to make and test changes independently before they are deployed to the production deployment.

Usually all deployments belonging to a single project run the same code base (or a version of it), but Convex doesn't enforce this. You can also run the same code base on multiple different prod deployments belonging to different projects, see [staging](#staging-environment) below.

## Deploying to production[​](#deploying-to-production "Direct link to Deploying to production")

Your Convex deployments run your backend logic and in most cases you will also develop a client that uses the backend. If your client is a web app, follow the [Hosting and Deployment](/production/hosting/.md) guide, to learn how to deploy your client and your Convex backend together.

You can also deploy your backend on its own. Check out the [Project Configuration](/production/project-configuration.md) page to learn more.

## Staging environment[​](#staging-environment "Direct link to Staging environment")

With Convex [preview deployments](/production/hosting/preview-deployments.md) your team can test out changes before deploying them to production. If you need a more permanent staging environment, you can use a separate Convex project, and deploy to it by setting the `CONVEX_DEPLOY_KEY` environment variable when running [`npx convex deploy`](/cli.md#deploy-convex-functions-to-production).

## Typical team development workflow[​](#typical-team-development-workflow "Direct link to Typical team development workflow")

Teams developing on Convex usually follow this workflow:

1. If this is the team's first project, one team member creates a team on the dashboard.

2. One team member creates a project by running `npx convex dev`, perhaps starting with a [quickstart](/quickstarts) or a [template](https://www.convex.dev/templates).

3. The team member creates a Git repository from the initial code and shares it with their team (via GitHub, GitLab etc.).

4. Other team members pull the codebase, and get their own dev deployments by running `npx convex dev`.

5. All team members can make backend changes and test them out with their individual dev deployments. When a change is ready the team member opens a pull-request (or commits to a shared branch).

   <!-- -->

   * [Backup / Restore](/database/backup-restore.md) can be used to populate a dev deployment with data from a prod deployment.
   * [Data import](/database/import-export/import.md) can be used to populate a dev deployment with synthetic seed data.
   * Members of a team with the [Pro plan](https://www.convex.dev/pricing) can get separate [preview deployments](/production/hosting/preview-deployments.md) to test each other's pull-requests.

6. Deployment to production can happen [automatically](/production/hosting/.md) when changes get merged to the designated branch (say `main`).
   <!-- -->
   * Alternatively one of the team members can deploy to production manually by running `npx convex deploy`.

### Making safe changes[​](#making-safe-changes "Direct link to Making safe changes")

Especially if your app is live you want to make sure that changes you make to your Convex codebase do not break it.

Some unsafe changes are handled and caught by Convex, but others you need handle yourself.

1. **Schema must always match existing data.** Convex enforces this constraint. You cannot push a schema to a deployment with existing data that doesn't match it, unless you turn off schema enforcement. In general it safe to:

   <!-- -->

   1. Add new tables to the schema.
   2. Add an `optional` field to an existing table's schema, set the field on all documents in the table, and then make the field required.
   3. Mark an existing field as `optional`, remove the field from all documents, and then remove the field.
   4. Mark an existing field as a `union` of the existing type and a new type, modify the field on all documents to match the new type, and then change the type to the new type.

2. **Functions should be backwards compatible.** Even if your only client is a website, and you deploy it together with your backend, your users might still be running the old version of your website when your backend changes. Therefore you should make your functions backwards compatible until you are OK to break old clients. In general it is safe to:

   <!-- -->

   1. Add new functions.
   2. Add an `optional` named argument to an existing function.
   3. Mark an existing named argument as `optional`.
   4. Mark an existing named argument as a `union` of the existing type and a new type.
   5. Change the behavior of the function in such a way that given the arguments from an old client its behavior will still be acceptable to the old client.

3. **Scheduled functions should be backwards compatible.** When you schedule a function to run in the future, you provide the argument values it will receive. Whenever a function runs, it always runs its currently deployed version. If you change the function between the time it was scheduled and the time it runs, you must ensure the new version will behave acceptably given the old arguments.

Related posts from

<!-- -->

[![Stack](/img/stack-logo-dark.svg)![Stack](/img/stack-logo-light.svg)](https://stack.convex.dev/)


# Environment Variables

Environment variables are key-value pairs that are useful for storing values you wouldn't want to put in code or in a table, such as an API key. You can set environment variables in Convex through the dashboard, and you can access them in [functions](/functions.md) using `process.env`.

## Setting environment variables[​](#setting-environment-variables "Direct link to Setting environment variables")

Under [Deployment Settings](/dashboard/deployments/deployment-settings.md) in the Dashboard, you can see a list of environment variables in the current deployment. ![Environment Variables Table](/assets/images/environment_variables_table-1d215d0d797cca385b2c94dad4e938b4.png)

You can add up to 100 environment variables. Environment variable names cannot be more than 40 characters long, and they must start with a letter and only contain letters numbers, and underscores. Environment variable values cannot be larger than 8KB.

You can modify environment variables using the pencil icon button:

![Edit Environment Variable](/assets/images/edit_environment_variable-24411104aa164c750be92ce82fce3f50.png)

Environment variables can also be viewed and modified with the [command line](/cli.md#read-and-write-environment-variables).

```
npx convex env list
npx convex env set API_KEY secret-api-key
```

### Using environment variables in dev and prod deployments[​](#using-environment-variables-in-dev-and-prod-deployments "Direct link to Using environment variables in dev and prod deployments")

Since environment variables are set per-deployment, you can use different values for the same key in dev and prod deployments. This can be useful for when you have different external accounts you'd like to use depending on the environment. For example, you might have a dev and prod SendGrid account for sending emails, and your function expects an environment variable called `SENDGRID_API_KEY` that should work in both environments.

If you expect an environment variable to be always present in a function, you must add it to **all** your deployments. In this example, you would add an environment variable with the name `SENDGRID_API_KEY` to your dev and prod deployments, with a different value for dev and prod.

## Accessing environment variables[​](#accessing-environment-variables "Direct link to Accessing environment variables")

You can access environment variables in Convex functions using `process.env.KEY`. If the variable is set it is a `string`, otherwise it is `undefined`. Here is an example of accessing an environment variable with the key `GIPHY_KEY`:

```
function giphyUrl(query) {
  return (
    "https://api.giphy.com/v1/gifs/translate?api_key=" +
    process.env.GIPHY_KEY +
    "&s=" +
    encodeURIComponent(query)
  );
}
```

Note that you should not condition your Convex function exports on environment variables. The set of Convex functions that can be called is determined during deployment and is not reevaluated when you change an environment variable. The following code will throw an error at runtime, if the DEBUG environment variable changes between deployment and calling the function.

```
// THIS WILL NOT WORK!
export const myFunc = process.env.DEBUG ? mutation(...) : internalMutation(...);
```

Similarly, environment variables used in cron definitions will only be reevaluated on deployment.

## System environment variables[​](#system-environment-variables "Direct link to System environment variables")

The following environment variables are always available in Convex functions:

* `CONVEX_CLOUD_URL` - Your deployment URL (eg. `https://dusty-nightingale-847.convex.cloud`) for use with Convex clients.
* `CONVEX_SITE_URL` - Your deployment site URL (eg. `https://dusty-nightingale-847.convex.site`) for use with [HTTP Actions](/functions/http-actions.md)

## Project environment variable defaults[​](#project-environment-variable-defaults "Direct link to Project environment variable defaults")

You can set up default environment variable values for a project for development and preview deployments in Project Settings.

![Project Default Environment Variables](/assets/images/project_default_environment_variables-94be77c692d0a3c9564cb7f642b6cb64.png)

These default values will be used when creating a new development or preview deployment, and will have no effect on existing deployments (they are not kept in sync).

The Deployment Settings will indicate when a deployment has environment variables that do not match the project defaults. ![Environment Variable Default Mismatch](/assets/images/environment_variable_default_diff-0d02a2a8fe3f8d48d2437e0908421368.png)


# Hosting and Deployment

The easiest way to publish your full-stack web app is to use a hosting provider like [Vercel](https://vercel.com) or [Netlify](https://netlify.com).

Both Vercel and Netlify integrate with Git to deploy code whenever a new revision is pushed. To host your app:

1. Commit all files and push to your favorite Git hosting provider such as [GitHub](https://github.com/), [GitLab](https://gitlab.com/) or [Bitbucket](https://bitbucket.org/).

2. Follow the appropriate guide below.

If you aren't using Netlify or Vercel, you can follow the Custom Hosting guide.

* [Vercel](/production/hosting/vercel.md)
* [Netlify](/production/hosting/netlify.md)
* [Custom Hosting](/production/hosting/custom.md)



# Next.js

[Next.js](https://nextjs.org/) is a React web development framework. When used with Convex, Next.js provides:

* File-system based routing
* Fast refresh in development
* Font and image optimization

and more!

This page covers the App Router variant of Next.js. Alternatively see the [Pages Router](/client/nextjs/pages-router/.md) version of this page.

## Getting started[​](#getting-started "Direct link to Getting started")

Follow the [Next.js Quickstart](/quickstart/nextjs.md) to add Convex to a new or existing Next.js project.

## Calling Convex functions from client code[​](#calling-convex-functions-from-client-code "Direct link to Calling Convex functions from client code")

To fetch and edit the data in your database from client code, use hooks of the [Convex React library](/client/react.md).

## [Convex React library documentation](/client/react.md)

## Server rendering (SSR)[​](#server-rendering-ssr "Direct link to Server rendering (SSR)")

Next.js automatically renders both Client and Server Components on the server during the initial page load.

To keep your UI [automatically reactive](/functions/query-functions.md#caching--reactivity--consistency) to changes in your Convex database it needs to use Client Components. The `ConvexReactClient` will maintain a connection to your deployment and will get updates as data changes and that must happen on the client.

See the dedicated [Server Rendering](/client/nextjs/app-router/server-rendering.md) page for more details about preloading data for Client Components, fetching data and authentication in Server Components, and implementing Route Handlers.

## Adding authentication[​](#adding-authentication "Direct link to Adding authentication")

### Client-side only[​](#client-side-only "Direct link to Client-side only")

The simplest way to add user authentication to your Next.js app is to follow our React-based authentication guides for [Clerk](/auth/clerk.md) or [Auth0](/auth/auth0.md), inside your `app/ConvexClientProvider.tsx` file. For example this is what the file would look like for Auth0:

app/ConvexClientProvider.tsx

TS

```
"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri:
          typeof window === "undefined" ? undefined : window.location.origin,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <ConvexProviderWithAuth0 client={convex}>
        {children}
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}
```

Custom loading and logged out views can be built with the helper `Authenticated`, `Unauthenticated` and `AuthLoading` components from `convex/react`, see the [Convex Next.js demo](https://github.com/get-convex/convex-demos/tree/main/nextjs-pages-router/pages/_app.tsx) for an example.

If only some routes of your app require login, the same helpers can be used directly in page components that do require login instead of being shared between all pages from `app/ConvexClientProvider.tsx`. Share a single [ConvexReactClient](/api/classes/react.ConvexReactClient.md) instance between pages to avoid needing to reconnect to Convex on client-side page navigation.

### Server and client side[​](#server-and-client-side "Direct link to Server and client side")

To access user information or load Convex data requiring `ctx.auth` from Server Components, Server Actions, or Route Handlers you need to use the Next.js specific SDKs provided by Clerk and Auth0.

Additional `.env.local` configuration is needed for these hybrid SDKs.

#### Clerk[​](#clerk "Direct link to Clerk")

For an example of using Convex and with Next.js 15, run

**`npm create convex@latest -- -t nextjs-clerk`**

**``**

Otherwise, follow the [Clerk Next.js quickstart](https://clerk.com/docs/quickstarts/nextjs), a guide from Clerk that includes steps for adding `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to the .env.local file. In Next.js 15, the `<ClerkProvider>` component imported from the `@clerk/nextjs` v6 package functions as both a client and a server context provider so you probably won't need the `ClerkProvider` from `@clerk/clerk-react`.

#### Auth0[​](#auth0 "Direct link to Auth0")

See the [Auth0 Next.js](https://auth0.com/docs/quickstart/webapp/nextjs/01-login) guide.

#### Other providers[​](#other-providers "Direct link to Other providers")

Convex uses JWT identity tokens on the client for live query subscriptions and running mutations and actions, and on the Next.js backend for running queries, mutations, and actions in server components and API routes.

Obtain the appropriate OpenID Identity JWT in both locations and you should be able to use any auth provider. See [Custom Auth](https://docs.convex.dev/auth/advanced/custom-auth) for more.


# Next.js Server Rendering

Next.js automatically renders both Client and Server Components on the server during the initial page load.

By default Client Components will not wait for Convex data to be loaded, and your UI will render in a "loading" state. Read on to learn how to preload data during server rendering and how to interact with the Convex deployment from Next.js server-side.

**Example:** [Next.js App Router](https://github.com/get-convex/convex-demos/tree/main/nextjs-app-router)

This pages covers the App Router variant of Next.js.

Next.js Server Rendering support is in beta

Next.js Server Rendering support<!-- --> <!-- -->is<!-- --> currently a [beta feature](/production/state/.md#beta-features). If you have feedback or feature requests, [let us know on Discord](https://convex.dev/community)!

## Preloading data for Client Components[​](#preloading-data-for-client-components "Direct link to Preloading data for Client Components")

If you want to preload data from Convex and leverage Next.js [server rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#server-rendering-strategies), but still retain reactivity after the initial page load, use [`preloadQuery`](/api/modules/nextjs.md#preloadquery) from [`convex/nextjs`](/api/modules/nextjs.md).

In a [Server Component](https://nextjs.org/docs/app/building-your-application/rendering/server-components) call `preloadQuery`:

app/TasksWrapper.tsx

TS

```
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Tasks } from "./Tasks";

export async function TasksWrapper() {
  const preloadedTasks = await preloadQuery(api.tasks.list, {
    list: "default",
  });
  return <Tasks preloadedTasks={preloadedTasks} />;
}
```

In a [Client Component](https://nextjs.org/docs/app/building-your-application/rendering/client-components) call [`usePreloadedQuery`](/api/modules/react.md#usepreloadedquery):

app/TasksWrapper.tsx

TS

```
"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function Tasks(props: {
  preloadedTasks: Preloaded<typeof api.tasks.list>;
}) {
  const tasks = usePreloadedQuery(props.preloadedTasks);
  // render `tasks`...
  return <div>...</div>;
}
```

[`preloadQuery`](/api/modules/nextjs.md#preloadquery) takes three arguments:

1. The query reference
2. Optionally the arguments object passed to the query
3. Optionally a [NextjsOptions](/api/modules/nextjs.md#nextjsoptions) object

`preloadQuery` uses the [`cache: 'no-store'` policy](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating#opting-out-of-data-caching) so any Server Components using it will not be eligible for [static rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#server-rendering-strategies).

### Using the query result[​](#using-the-query-result "Direct link to Using the query result")

[`preloadQuery`](/api/modules/nextjs.md#preloadquery) returns an opaque `Preloaded` payload that should be passed through to `usePreloadedQuery`. If you want to use the return value of the query, perhaps to decide whether to even render the Client Component, you can pass the `Preloaded` payload to the [`preloadedQueryResult`](/api/modules/nextjs.md#preloadedqueryresult) function.

## Using Convex to render Server Components[​](#using-convex-to-render-server-components "Direct link to Using Convex to render Server Components")

If you need Convex data on the server, you can load data from Convex in your [Server Components](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching), but it will be non-reactive. To do this, use the [`fetchQuery`](/api/modules/nextjs.md#fetchquery) function from `convex/nextjs`:

app/StaticTasks.tsx

TS

```
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function StaticTasks() {
  const tasks = await fetchQuery(api.tasks.list, { list: "default" });
  // render `tasks`...
  return <div>...</div>;
}
```

## Server Actions and Route Handlers[​](#server-actions-and-route-handlers "Direct link to Server Actions and Route Handlers")

Next.js supports building HTTP request handling routes, similar to Convex [HTTP Actions](/functions/http-actions.md). You can use Convex from a [Server Action](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) or a [Route Handler](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) as you would any other database service.

To load and edit Convex data in your Server Action or Route Handler, you can use the `fetchQuery`, `fetchMutation` and `fetchAction` functions.

Here's an example inline Server Action calling a Convex mutation:

app/example/page.tsx

TS

```
import { api } from "@/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { revalidatePath } from "next/cache";

export default async function PureServerPage() {
  const tasks = await fetchQuery(api.tasks.list, { list: "default" });
  async function createTask(formData: FormData) {
    "use server";

    await fetchMutation(api.tasks.create, {
      text: formData.get("text") as string,
    });
    revalidatePath("/example");
  }
  // render tasks and task creation form
  return <form action={createTask}>...</form>;
}
```

Here's an example Route Handler calling a Convex mutation:

app/api/route.ts

TS

```
import { NextResponse } from "next/server";
// Hack for TypeScript before 5.2
const Response = NextResponse;

import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";

export async function POST(request: Request) {
  const args = await request.json();
  await fetchMutation(api.tasks.create, { text: args.text });
  return Response.json({ success: true });
}
```

## Server-side authentication[​](#server-side-authentication "Direct link to Server-side authentication")

To make authenticated requests to Convex during server rendering, pass a JWT token to [`preloadQuery`](/api/modules/nextjs.md#preloadquery) or [`fetchQuery`](/api/modules/nextjs.md#fetchquery) in the third options argument:

app/TasksWrapper.tsx

TS

```
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Tasks } from "./Tasks";

export async function TasksWrapper() {
  const token = await getAuthToken();
  const preloadedTasks = await preloadQuery(
    api.tasks.list,
    { list: "default" },
    { token },
  );
  return <Tasks preloadedTasks={preloadedTasks} />;
}
```

The implementation of `getAuthToken` depends on your authentication provider.

* Clerk
* Auth0

app/auth.ts

TS

```
import { auth } from "@clerk/nextjs/server";

export async function getAuthToken() {
  return (await (await auth()).getToken({ template: "convex" })) ?? undefined;
}
```

app/auth.ts

TS

```
// You'll need v4.3 or later of @auth0/nextjs-auth0
import { getSession } from '@auth0/nextjs-auth0';

export async function getAuthToken() {
  const session = await getSession();
  const idToken = session.tokenSet.idToken;
  return idToken;
}
```

## Configuring Convex deployment URL[​](#configuring-convex-deployment-url "Direct link to Configuring Convex deployment URL")

Convex hooks used by Client Components are configured via the `ConvexReactClient` constructor, as shown in the [Next.js Quickstart](/quickstart/nextjs.md).

To use `preloadQuery`, `fetchQuery`, `fetchMutation` and `fetchAction` in Server Components, Server Actions and Route Handlers you must either:

1. have `NEXT_PUBLIC_CONVEX_URL` environment variable set to the Convex deployment URL
2. or pass the [`url` option](/api/modules/nextjs.md#nextjsoptions) in the third argument to `preloadQuery`, `fetchQuery`, `fetchMutation` or `fetchAction`

## Consistency[​](#consistency "Direct link to Consistency")

[`preloadQuery`](/api/modules/nextjs.md#preloadquery) and [`fetchQuery`](/api/modules/nextjs.md#fetchquery) use the `ConvexHTTPClient` under the hood. This client is stateless. This means that two calls to `preloadQuery` are not guaranteed to return consistent data based on the same database state. This is similar to more traditional databases, but is different from the [guaranteed consistency](/client/react.md#consistency) provided by the `ConvexReactClient`.

To prevent rendering an inconsistent UI avoid using multiple `preloadQuery` calls on the same page.


# Convex React Native

To use Convex in [React Native](https://reactnative.dev/) use the [Convex React client library](/client/react.md).

Follow the [React Native Quickstart](/quickstart/react-native.md) for the different configuration needed specifically for React Native.

You can also clone a working [Convex React Native demo](https://github.com/get-convex/convex-demos/tree/main/react-native).


# Errors and Warnings

This page explains specific errors thrown by Convex.

See [Error Handling](/functions/error-handling/.md) to learn about handling errors in general.

## Write conflict: Optimistic concurrency control[​](#1 "Direct link to Write conflict: Optimistic concurrency control")

This system error is thrown when a mutation repeatedly fails due to conflicting changes from parallel mutation executions.

### Example A[​](#example-a "Direct link to Example A")

A mutation `updateCounter` always updates the same document:

```
export const updateCounter = mutation({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.get("counts", process.env.COUNTER_ID);
    await ctx.db.patch("counts", doc._id, { value: doc.value + 1 });
  },
});
```

If this mutation is called many times per second, many of its executions will conflict with each other. Convex internally does several retries to mitigate this concern, but if the mutation is called more rapidly than Convex can execute it, some of the invocations will eventually throw this error:

> failure `updateCounter`
>
> Documents read from or written to the table "counters" changed while this mutation was being run and on every subsequent retry. Another call to this mutation changed the document with ID "123456789101112".

The error message will note the table name, which mutation caused the conflict (in this example its another call to the same mutation), and one document ID which was part of the conflicting change.

### Example B[​](#example-b "Direct link to Example B")

Mutation `writeCount` depends on the entire `tasks` table:

```
export const writeCount = mutation({
  args: {
    target: v.id("counts"),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect();
    await ctx.db.patch("tasks", args.target, { value: tasks });
  },
});

export const addTask = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text });
  },
});
```

If the mutation `writeCount` is called at the same time as many calls to `addTask` are made, either of the mutations can fail with this error. This is because any change to the `"tasks"` table will conflict with the `writeCount` mutation:

> failure `writeCount`
>
> Documents read from or written to the table "tasks" changed while this mutation was being run and on every subsequent retry. A call to "addTask" changed the document with ID "123456789101112".

### Remediation[​](#remediation "Direct link to Remediation")

To fix this issue:

1. Make sure that your mutations only read the data they need. Consider reducing the amount of data read by using indexed queries with [selective index range expressions](https://docs.convex.dev/database/indexes/).
2. Make sure you are not calling a mutation an unexpected number of times, perhaps from an action inside a loop.
3. Design your data model such that it doesn't require making many writes to the same document.

### Resources[​](#resources "Direct link to Resources")

* Learn more about [optimistic concurrency control](/database/advanced/occ.md).
* See this [Stack post](https://stack.convex.dev/waitlist) for an example of designing an app to avoid mutation conflicts.

### Related Components[​](#related-components "Direct link to Related Components")

[Convex Component](https://www.convex.dev/components/workpool)

### [Workpool](https://www.convex.dev/components/workpool)

[Workpool give critical tasks priority by organizing async operations into separate, customizable queues.](https://www.convex.dev/components/workpool)

[Convex Component](https://www.convex.dev/components/sharded-counter)

### [Sharded Counter](https://www.convex.dev/components/sharded-counter)

[High-throughput counter enables denormalized counts without write conflicts by spreading writes over multiple documents.](https://www.convex.dev/components/sharded-counter)

[Convex Component](https://www.convex.dev/components/action-cache)

### [Action Cache](https://www.convex.dev/components/action-cache)

[Cache frequently run actions. By leveraging the \`force\` parameter to keep the cache populated, you can ensure that the cache is always up to date and avoid data races.](https://www.convex.dev/components/action-cache)


# Convex

TypeScript backend SDK, client libraries, and CLI for Convex.

Convex is the backend application platform with everything you need to build your product.

Get started at [docs.convex.dev](https://docs.convex.dev)!

Or see [Convex demos](https://github.com/get-convex/convex-demos).

Open discussions and issues in this repository about Convex TypeScript/JavaScript clients, the Convex CLI, or the Convex platform in general.

Also feel free to share feature requests, product feedback, or general questions in the [Convex Discord Community](https://convex.dev/community).

# Structure

This package includes several entry points for building apps on Convex:

* [`convex/server`](https://docs.convex.dev/api/modules/server): SDK for defining a Convex backend functions, defining a database schema, etc.
* [`convex/react`](https://docs.convex.dev/api/modules/react): Hooks and a `ConvexReactClient` for integrating Convex into React applications.
* [`convex/browser`](https://docs.convex.dev/api/modules/browser): A `ConvexHttpClient` for using Convex in other browser environments.
* [`convex/values`](https://docs.convex.dev/api/modules/values): Utilities for working with values stored in Convex.
* [`convex/react-auth0`](https://docs.convex.dev/api/modules/react_auth0): A React component for authenticating users with Auth0.
* [`convex/react-clerk`](https://docs.convex.dev/api/modules/react_clerk): A React component for authenticating users with Clerk.
* [`convex/nextjs`](https://docs.convex.dev/api/modules/nextjs): Server-side helpers for SSR, usable by Next.js and other React frameworks.

This package also includes [`convex`](https://docs.convex.dev/using/cli), the command-line interface for managing Convex projects.



# Convex HTTP API

The public functions that define a deployment are exposed at public HTTP endpoints.

## Convex value format[​](#convex-value-format "Direct link to Convex value format")

Each of the HTTP APIs take a `format` query param that describes how documents are formatted. Currently the only supported value is `json`. See our [types page](/database/types.md#convex-values) for details. Note that for simplicity, the `json` format does not support all Convex data types as input, and uses overlapping representation for several data types in output. We plan to add a new format with support for all Convex data types in the future.

## API authentication[​](#api-authentication "Direct link to API authentication")

The Functions API can be optionally authenticated as a user via a bearer token in a `Authorization` header. The value is `Bearer <access_key>` where the key is a token from your auth provider. See the [under the hood](/auth/clerk.md#under-the-hood) portion of the Clerk docs for details on how this works with Clerk.

Streaming export and streaming import requests require deployment admin authorization via the HTTP header `Authorization`. The value is `Convex <access_key>` where the access key comes from "Deploy key" on the Convex dashboard and gives full read and write access to your Convex data.

## Functions API[​](#functions-api "Direct link to Functions API")

### POST `/api/query`, `/api/mutation`, `/api/action`[​](#post-apiquery-apimutation-apiaction "Direct link to post-apiquery-apimutation-apiaction")

These HTTP endpoints allow you to call Convex functions and get the result as a value.

You can find your backend deployment URL on the dashboard [Settings](/dashboard/deployments/deployment-settings.md) page, then the API URL will be `<CONVEX_URL>/api/query` etc., for example:

* Shell
* NodeJS
* Python

```
curl https://acoustic-panther-728.convex.cloud/api/query \
   -d '{"path": "messages:list", "args": {}, "format": "json"}' \
   -H "Content-Type: application/json"
```

```
const url = "https://acoustic-panther-728.convex.cloud/api/query";
const request = { path: "messages:list", args: {}, format: "json" };

const response = fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
});
```

```
import requests

url = "https://acoustic-panther-728.convex.cloud/api/query"
headers = {"accept": "application/json"}
body = {"path": "messages:list", "args": {}, "format": "json"}

response = requests.post(url, headers=headers, json=body)
```

**JSON Body parameters**

| Name   | Type   | Required | Description                                                                                                     |
| ------ | ------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| path   | string | y        | Path to the Convex function formatted as a string as defined [here](/functions/query-functions.md#query-names). |
| args   | object | y        | Named argument object to pass to the Convex function.                                                           |
| format | string | n        | Output format for values. Valid values: \[`json`]                                                               |

**Result JSON on success**

| Field Name | Type          | Description                                            |
| ---------- | ------------- | ------------------------------------------------------ |
| status     | string        | "success"                                              |
| value      | object        | Result of the Convex function in the requested format. |
| logLines   | list\[string] | Log lines printed out during the function execution.   |

**Result JSON on error**

| Field Name   | Type          | Description                                                                                                 |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------- |
| status       | string        | "error"                                                                                                     |
| errorMessage | string        | The error message.                                                                                          |
| errorData    | object        | Error data within an [application error](/functions/error-handling/application-errors.md) if it was thrown. |
| logLines     | list\[string] | Log lines printed out during the function execution.                                                        |

### POST `/api/run/{functionIdentifier}`[​](#post-apirunfunctionidentifier "Direct link to post-apirunfunctionidentifier")

This HTTP endpoint allows you to call arbitrary Convex function types with the path in the request URL and get the result as a value. The function identifier is formatted as a string as defined [here](/functions/query-functions.md#query-names) with a `/` replacing the `:`.

You can find your backend deployment URL on the dashboard [Settings](/dashboard/deployments/deployment-settings.md) page, then the API URL will be `<CONVEX_URL>/api/run/{functionIdentifier}` etc., for example:

* Shell
* NodeJS
* Python

```
curl https://acoustic-panther-728.convex.cloud/api/run/messages/list \
   -d '{"args": {}, "format": "json"}' \
   -H "Content-Type: application/json"
```

```
const url = "https://acoustic-panther-728.convex.cloud/api/run/messages/list";
const request = { args: {}, format: "json" };

const response = fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
});
```

```
import requests

url = "https://acoustic-panther-728.convex.cloud/api/run/messages/list"
headers = {"accept": "application/json"}
body = {"args": {}, "format": "json"}

response = requests.get(url, headers=headers, body=json)
```

**JSON Body parameters**

| Name   | Type   | Required | Description                                                           |
| ------ | ------ | -------- | --------------------------------------------------------------------- |
| args   | object | y        | Named argument object to pass to the Convex function.                 |
| format | string | n        | Output format for values. Defaults to `json`. Valid values: \[`json`] |

**Result JSON on success**

| Field Name | Type          | Description                                            |
| ---------- | ------------- | ------------------------------------------------------ |
| status     | string        | "success"                                              |
| value      | object        | Result of the Convex function in the requested format. |
| logLines   | list\[string] | Log lines printed out during the function execution.   |

**Result JSON on error**

| Field Name   | Type          | Description                                                                                                 |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------- |
| status       | string        | "error"                                                                                                     |
| errorMessage | string        | The error message.                                                                                          |
| errorData    | object        | Error data within an [application error](/functions/error-handling/application-errors.md) if it was thrown. |
| logLines     | list\[string] | Log lines printed out during the function execution.                                                        |



# Convex Documentation

> For general information about Convex, read [https://www.convex.dev/llms.txt](https://www.convex.dev/llms.txt).


## understanding

- [Convex Overview](/understanding.md): Introduction to Convex - the reactive database with TypeScript queries
- [Best Practices](/understanding/best-practices.md): Essential best practices for building scalable Convex applications including database queries, function organization, validation, and security.
- [TypeScript](/understanding/best-practices/typescript.md): Move faster with end-to-end type safety
- [Dev workflow](/understanding/workflow.md): Development workflow from project creation to production deployment
- [The Zen of Convex](/understanding/zen.md): Convex best practices and design philosophy

## quickstart

- [Android Kotlin Quickstart](/quickstart/android.md): Add Convex to an Android Kotlin project
- [Using Convex with Bun](/quickstart/bun.md): Add Convex to a Bun project
- [Next.js Quickstart](/quickstart/nextjs.md): Add Convex to a Next.js project
- [Node.js Quickstart](/quickstart/nodejs.md): Add Convex to a Node.js project
- [Nuxt Quickstart](/quickstart/nuxt.md): Add Convex to a Nuxt project
- [Python Quickstart](/quickstart/python.md): Add Convex to a Python project
- [React Quickstart](/quickstart/react.md): Add Convex to a React project
- [React Native Quickstart](/quickstart/react-native.md): Add Convex to a React Native Expo project
- [Remix Quickstart](/quickstart/remix.md): Add Convex to a Remix project
- [Rust Quickstart](/quickstart/rust.md): Add Convex to a Rust project
- [Script Tag Quickstart](/quickstart/script-tag.md): Add Convex to any website
- [Svelte Quickstart](/quickstart/svelte.md): Add Convex to a Svelte project
- [iOS Swift Quickstart](/quickstart/swift.md): Add Convex to an iOS Swift project
- [TanStack Start Quickstart](/quickstart/tanstack-start.md): Add Convex to a TanStack Start project
- [Vue Quickstart](/quickstart/vue.md): Add Convex to a Vue project

## functions

- [Functions](/functions.md): Write functions to define your server behavior
- [Actions](/functions/actions.md): Call third-party services and external APIs from Convex
- [Bundling](/functions/bundling.md): How Convex bundles and optimizes your function code
- [Debugging](/functions/debugging.md): Debug Convex functions during development and production
- [Error Handling](/functions/error-handling.md): Handle errors in Convex queries, mutations, and actions
- [Application Errors](/functions/error-handling/application-errors.md): Handle expected failures in Convex functions
- [HTTP Actions](/functions/http-actions.md): Build HTTP APIs directly in Convex
- [Internal Functions](/functions/internal-functions.md): Functions that can only be called by other Convex functions
- [Mutations](/functions/mutation-functions.md): Insert, update, and remove data from the database
- [Queries](/functions/query-functions.md): Fetch data from the database with caching and reactivity
- [Runtimes](/functions/runtimes.md): Learn the differences between the Convex and Node.js runtimes for functions
- [Argument and Return Value Validation](/functions/validation.md): Validate function arguments and return values for security

## database

- [Database](/database.md): Store JSON-like documents with a relational data model
- [OCC and Atomicity](/database/advanced/occ.md): Optimistic concurrency control and transaction atomicity in Convex
- [Schema Philosophy](/database/advanced/schema-philosophy.md): Convex schema design philosophy and best practices
- [System Tables](/database/advanced/system-tables.md): Access metadata for Convex built-in features through system tables including scheduled functions and file storage information.
- [Backups](/database/backup-restore.md): Backup and restore your Convex data and files
- [Document IDs](/database/document-ids.md): Create complex, relational data models using IDs
- [Data Import & Export](/database/import-export.md): Import data from existing sources and export data to external systems
- [Data Export](/database/import-export/export.md): Export your data out of Convex
- [Data Import](/database/import-export/import.md): Import data into Convex
- [Paginated Queries](/database/pagination.md): Load paginated queries
- [Reading Data](/database/reading-data.md): Query and read data from Convex database tables
- [Filtering](/database/reading-data/filters.md): Filter documents in Convex queries
- [Indexes](/database/reading-data/indexes.md): Speed up queries with database indexes
- [Introduction to Indexes and Query Performance](/database/reading-data/indexes/indexes-and-query-perf.md): Learn the effects of indexes on query performance
- [Schemas](/database/schemas.md): Schema validation keeps your Convex data neat and tidy. It also gives you end-to-end TypeScript type safety!
- [Data Types](/database/types.md): Supported data types in Convex documents
- [Writing Data](/database/writing-data.md): Insert, update, and delete data in Convex database tables

## realtime

- [Realtime](/realtime.md): Building realtime apps with Convex

## auth

- [Authentication](/auth.md): Add authentication to your Convex app.
- [Custom OIDC Provider](/auth/advanced/custom-auth.md): Integrate Convex with any OpenID Connect identity provider using custom authentication configuration and ConvexProviderWithAuth.
- [Custom JWT Provider](/auth/advanced/custom-jwt.md): Configure Convex to work with custom JWT providers that don't implement full OIDC protocol, including setup and client-side integration.
- [Convex & Auth0](/auth/auth0.md): Integrate Auth0 authentication with Convex
- [Convex & WorkOS AuthKit](/auth/authkit.md): Integrate WorkOS AuthKit authentication with Convex
- [Automatic AuthKit Configuration](/auth/authkit/auto-provision.md): WorkOS AuthKit authentication with Convex
- [AuthKit Troubleshooting](/auth/authkit/troubleshooting.md): Debugging issues with AuthKit authentication with Convex
- [Convex & Clerk](/auth/clerk.md): Integrate Clerk authentication with Convex
- [Convex Auth](/auth/convex-auth.md): Built-in authentication for Convex applications
- [Storing Users in the Convex Database](/auth/database-auth.md): Store user information in your Convex database
- [Debugging Authentication](/auth/debug.md): Troubleshoot authentication issues in Convex
- [Auth in Functions](/auth/functions-auth.md): Access user authentication in Convex functions

## scheduling

- [Scheduling](/scheduling.md): Schedule functions to run once or repeatedly with scheduled functions and cron jobs
- [Cron Jobs](/scheduling/cron-jobs.md): Schedule recurring functions in Convex
- [Scheduled Functions](/scheduling/scheduled-functions.md): Schedule functions to run in the future

## file-storage

- [File Storage](/file-storage.md): Store and serve files of any type
- [Deleting Files](/file-storage/delete-files.md): Delete files stored in Convex
- [Accessing File Metadata](/file-storage/file-metadata.md): Access file metadata stored in Convex
- [Serving Files](/file-storage/serve-files.md): Serve files stored in Convex to users
- [Storing Generated Files](/file-storage/store-files.md): Store files generated in Convex actions
- [Uploading and Storing Files](/file-storage/upload-files.md): Upload files to Convex storage

## search

- [AI & Search](/search.md): Run search queries over your Convex documents
- [Full Text Search](/search/text-search.md): Run search queries over your Convex documents
- [Vector Search](/search/vector-search.md): Run vector search queries on embeddings

## components

- [Components](/components.md): Self contained building blocks of your app
- [Authoring Components](/components/authoring.md): Creating new components
- [Understanding Components](/components/understanding.md): Understanding components
- [Using Components](/components/using.md): Using existing components

## ai

- [AI Code Generation](/ai.md): How to use AI code generation effectively with Convex
- [Convex MCP Server](/ai/convex-mcp-server.md): Convex MCP server
- [Using Cursor with Convex](/ai/using-cursor.md): Tips and best practices for using Cursor with Convex
- [Using GitHub Copilot with Convex](/ai/using-github-copilot.md): Tips and best practices for using GitHub Copilot with Convex
- [Using Windsurf with Convex](/ai/using-windsurf.md): Tips and best practices for using Windsurf with Convex

## agents

- [AI Agents](/agents.md): Building AI Agents with Convex
- [Agent Definition and Usage](/agents/agent-usage.md): Configuring and using the Agent class
- [LLM Context](/agents/context.md): Customizing the context provided to the Agent's LLM
- [Debugging](/agents/debugging.md): Debugging the Agent component
- [Files and Images in Agent messages](/agents/files.md): Working with images and files in the Agent component
- [Getting Started with Agent](/agents/getting-started.md): Setting up the agent component
- [Human Agents](/agents/human-agents.md): Saving messages from a human as an agent
- [Messages](/agents/messages.md): Sending and receiving messages with an agent
- [Playground](/agents/playground.md): A simple way to test, debug, and develop with the agent
- [RAG (Retrieval-Augmented Generation) with the Agent component](/agents/rag.md): Examples of how to use RAG with the Convex Agent component
- [Rate Limiting](/agents/rate-limiting.md): Control the rate of requests to your AI agent
- [Streaming](/agents/streaming.md): Streaming messages with an agent
- [Threads](/agents/threads.md): Group messages together in a conversation history
- [Tools](/agents/tools.md): Using tool calls with the Agent component
- [Usage Tracking](/agents/usage-tracking.md): Tracking token usage of the Agent component
- [Workflows](/agents/workflows.md): Defining long-lived workflows for the Agent component

## testing

- [Testing](/testing.md): Testing your backend
- [Continuous Integration](/testing/ci.md): Set up continuous integration testing for Convex applications
- [Testing Local Backend](/testing/convex-backend.md): Test functions using the local open-source Convex backend
- [convex-test](/testing/convex-test.md): Mock Convex backend for fast automated testing of functions

## production

- [Deploying Your App to Production](/production.md): Tips for building safe and reliable production apps
- [Contact Us](/production/contact.md): Get support, provide feedback, stay updated with Convex releases, and report security vulnerabilities through our community channels.
- [Environment Variables](/production/environment-variables.md): Store and access environment variables in Convex
- [Hosting and Deployment](/production/hosting.md): Share your Convex backend and web app with the world
- [Custom Domains & Hosting](/production/hosting/custom.md): Serve requests from any domains and host your frontend on any static hosting provider, such as GitHub.
- [Using Convex with Netlify](/production/hosting/netlify.md): Host your frontend on Netlify and your backend on Convex
- [Preview Deployments](/production/hosting/preview-deployments.md): Use Convex with your hosting provider's preview deployments
- [Using Convex with Vercel](/production/hosting/vercel.md): Host your frontend on Vercel and your backend on Convex
- [Integrations](/production/integrations.md): Integrate Convex with third party services
- [Exception Reporting](/production/integrations/exception-reporting.md): Configure exception reporting integrations for your Convex deployment
- [Log Streams](/production/integrations/log-streams.md): Configure logging integrations for your Convex deployment
- [(Legacy) Event schema](/production/integrations/log-streams/legacy-event-schema.md): Log streams configured before May 23, 2024 will use the legacy format
- [Streaming Data in and out of Convex](/production/integrations/streaming-import-export.md): Streaming Data in and out of Convex
- [Multiple Repositories](/production/multiple-repos.md): Use Convex in multiple repositories
- [Pausing a Deployment](/production/pause-deployment.md): Temporarily disable a deployment without deleting data
- [Project Configuration](/production/project-configuration.md): Configure your Convex project for development and production deployment using convex.json, environment variables, and deployment settings.
- [Status and Guarantees](/production/state.md): Learn about Convex's production guarantees, availability targets, data durability, security features, and upcoming platform enhancements.
- [Limits](/production/state/limits.md): We’d love for you to have unlimited joy building on Convex but engineering

## self-hosting

- [Self Hosting](/self-hosting.md): Self Hosting Convex Projects

## cli

- [CLI](/cli.md): Command-line interface for managing Convex projects and functions
- [Agent Mode](/cli/agent-mode.md): Configure anonymous development mode for cloud-based coding agents
- [Deploy keys](/cli/deploy-key-types.md): Use deploy keys for authentication in production build environments
- [Local Deployments for Development](/cli/local-deployments.md): Develop with Convex using deployments running locally on your machine

## client

- [Android Kotlin](/client/android.md): Android Kotlin client library for mobile applications using Convex
- [Kotlin and Convex type conversion](/client/android/data-types.md): Customizing and converting types between the Kotlin app and Convex
- [Convex JavaScript Clients](/client/javascript.md): JavaScript clients for Node.js and browser applications using Convex
- [Bun](/client/javascript/bun.md): Use Convex clients with the Bun JavaScript runtime
- [Node.js](/client/javascript/node.md): Use Convex HTTP and subscription clients in Node.js applications
- [Script Tag](/client/javascript/script-tag.md): Use Convex directly in HTML with script tags, no build tools required
- [Next.js](/client/nextjs/app-router.md): How Convex works in a Next.js app
- [Next.js Server Rendering](/client/nextjs/app-router/server-rendering.md): Implement server-side rendering with Convex in Next.js App Router using preloadQuery, fetchQuery, and server actions for improved performance.
- [Next.js Pages Router](/client/nextjs/pages-router.md): Complete guide to using Convex with Next.js Pages Router including client-side authentication, API routes, and server-side rendering.
- [Next.js Pages Quickstart](/client/nextjs/pages-router/quickstart.md): Get started with Convex in Next.js Pages Router by building a reactive task list app with queries, mutations, and real-time updates.
- [OpenAPI & Other Languages](/client/open-api.md): Convex doesn’t have explicit support for many languages including Go, Java, and
- [Python](/client/python.md): Python client library for building applications with Convex
- [Convex React](/client/react.md): React client library for interacting with your Convex backend
- [Convex React Native](/client/react-native.md): How Convex works in a React Native app
- [Configuring Deployment URL](/client/react/deployment-urls.md): Configuring your project to run with Convex
- [Optimistic Updates](/client/react/optimistic-updates.md): Make your React app more responsive with optimistic UI updates
- [Rust](/client/rust.md): Rust client library for building applications with Convex
- [Svelte](/client/svelte.md): Reactive Svelte client library for Convex applications
- [iOS & macOS Swift](/client/swift.md): Swift client library for iOS and macOS applications using Convex
- [Swift and Convex type conversion](/client/swift/data-types.md): Customizing and converting types between the Swift app and Convex
- [Convex with TanStack Query](/client/tanstack/tanstack-query.md): Integrate Convex with TanStack Query for advanced data fetching patterns
- [TanStack Start](/client/tanstack/tanstack-start.md): How Convex works with TanStack Start
- [TanStack Start with Clerk](/client/tanstack/tanstack-start/clerk.md): Learn how to integrate Clerk authentication with Convex in TanStack Start applications using ID tokens and ConvexProviderWithClerk.
- [Vue](/client/vue.md): Community-maintained Vue integration for Convex applications
- [Nuxt](/client/vue/nuxt.md): Nuxt is a powerful web framework powered by Vue.

## dashboard

- [Dashboard](/dashboard.md): Learn how to use the Convex dashboard
- [Deployments](/dashboard/deployments.md): Understand Convex deployments including production, development, and preview deployments, and how to switch between them in the dashboard.
- [Data](/dashboard/deployments/data.md): View, edit, and manage database tables and documents in the dashboard
- [Settings](/dashboard/deployments/deployment-settings.md): Configure your Convex deployment settings including URLs, environment variables, authentication, backups, integrations, and deployment management.
- [File Storage](/dashboard/deployments/file-storage.md): Upload, download, and manage files stored in your Convex deployment
- [Functions](/dashboard/deployments/functions.md): Run, test, and monitor Convex functions with metrics and performance data
- [Health](/dashboard/deployments/health.md): Monitor your Convex deployment health including failure rates, cache performance, scheduler status, and deployment insights for optimization.
- [History](/dashboard/deployments/history.md): View an audit log of configuration-related events in your Convex deployment including function deployments, index changes, and environment variable updates.
- [Logs](/dashboard/deployments/logs.md): View real-time function logs and deployment activity in your dashboard
- [Schedules](/dashboard/deployments/schedules.md): Monitor and manage scheduled functions and cron jobs in your deployment
- [Projects](/dashboard/projects.md): Create and manage Convex projects, settings, and deployments
- [Teams](/dashboard/teams.md): Manage team settings, members, billing, and access control in Convex

## error

- [Errors and Warnings](/error.md): Understand specific errors thrown by Convex

## eslint

- [ESLint rules](/eslint.md): ESLint rules for Convex

## tutorial

- [Convex Tutorial: A chat app](/tutorial.md): Build a real-time chat application with Convex using queries, mutations, and the sync engine for automatic updates across all connected clients.
- [Convex Tutorial: Calling external services](/tutorial/actions.md): Extend your chat app by calling external APIs using Convex actions and the scheduler to integrate Wikipedia summaries into your application.
- [Convex Tutorial: Scaling your app](/tutorial/scale.md): Learn how to scale your Convex application using indexes, handling write conflicts, and leveraging Convex Components for best practices.

## api

- [Convex](/api.md): TypeScript backend SDK, client libraries, and CLI for Convex.
- [Class: BaseConvexClient](/api/classes/browser.BaseConvexClient.md): browser.BaseConvexClient
- [Class: ConvexClient](/api/classes/browser.ConvexClient.md): browser.ConvexClient
- [Class: ConvexHttpClient](/api/classes/browser.ConvexHttpClient.md): browser.ConvexHttpClient
- [Class: ConvexReactClient](/api/classes/react.ConvexReactClient.md): react.ConvexReactClient
- [Class: Crons](/api/classes/server.Crons.md): server.Crons
- [Class: Expression<T>](/api/classes/server.Expression.md): server.Expression
- [Class: FilterExpression<T>](/api/classes/server.FilterExpression.md): server.FilterExpression
- [Class: HttpRouter](/api/classes/server.HttpRouter.md): server.HttpRouter
- [Class: IndexRange](/api/classes/server.IndexRange.md): server.IndexRange
- [Class: SchemaDefinition<Schema, StrictTableTypes>](/api/classes/server.SchemaDefinition.md): server.SchemaDefinition
- [Class: SearchFilter](/api/classes/server.SearchFilter.md): server.SearchFilter
- [Class: TableDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes>](/api/classes/server.TableDefinition.md): server.TableDefinition
- [Class: ConvexError<TData>](/api/classes/values.ConvexError.md): values.ConvexError
- [Class: VAny<Type, IsOptional, FieldPaths>](/api/classes/values.VAny.md): values.VAny
- [Class: VArray<Type, Element, IsOptional>](/api/classes/values.VArray.md): values.VArray
- [Class: VBoolean<Type, IsOptional>](/api/classes/values.VBoolean.md): values.VBoolean
- [Class: VBytes<Type, IsOptional>](/api/classes/values.VBytes.md): values.VBytes
- [Class: VFloat64<Type, IsOptional>](/api/classes/values.VFloat64.md): values.VFloat64
- [Class: VId<Type, IsOptional>](/api/classes/values.VId.md): values.VId
- [Class: VInt64<Type, IsOptional>](/api/classes/values.VInt64.md): values.VInt64
- [Class: VLiteral<Type, IsOptional>](/api/classes/values.VLiteral.md): values.VLiteral
- [Class: VNull<Type, IsOptional>](/api/classes/values.VNull.md): values.VNull
- [Class: VObject<Type, Fields, IsOptional, FieldPaths>](/api/classes/values.VObject.md): values.VObject
- [Class: VRecord<Type, Key, Value, IsOptional, FieldPaths>](/api/classes/values.VRecord.md): values.VRecord
- [Class: VString<Type, IsOptional>](/api/classes/values.VString.md): values.VString
- [Class: VUnion<Type, T, IsOptional, FieldPaths>](/api/classes/values.VUnion.md): values.VUnion
- [Interface: BaseConvexClientOptions](/api/interfaces/browser.BaseConvexClientOptions.md): browser.BaseConvexClientOptions
- [Interface: MutationOptions](/api/interfaces/browser.MutationOptions.md): browser.MutationOptions
- [Interface: OptimisticLocalStore](/api/interfaces/browser.OptimisticLocalStore.md): browser.OptimisticLocalStore
- [Interface: SubscribeOptions](/api/interfaces/browser.SubscribeOptions.md): browser.SubscribeOptions
- [Interface: ConvexReactClientOptions](/api/interfaces/react.ConvexReactClientOptions.md): react.ConvexReactClientOptions
- [Interface: MutationOptions<Args>](/api/interfaces/react.MutationOptions.md): react.MutationOptions
- [Interface: ReactAction<Action>](/api/interfaces/react.ReactAction.md): react.ReactAction
- [Interface: ReactMutation<Mutation>](/api/interfaces/react.ReactMutation.md): react.ReactMutation
- [Interface: Watch<T>](/api/interfaces/react.Watch.md): react.Watch
- [Interface: WatchQueryOptions](/api/interfaces/react.WatchQueryOptions.md): react.WatchQueryOptions
- [Interface: Auth](/api/interfaces/server.Auth.md): server.Auth
- [Interface: BaseTableReader<DataModel, TableName>](/api/interfaces/server.BaseTableReader.md): server.BaseTableReader
- [Interface: BaseTableWriter<DataModel, TableName>](/api/interfaces/server.BaseTableWriter.md): server.BaseTableWriter
- [Interface: CronJob](/api/interfaces/server.CronJob.md): server.CronJob
- [Interface: DefineSchemaOptions<StrictTableNameTypes>](/api/interfaces/server.DefineSchemaOptions.md): server.DefineSchemaOptions
- [Interface: FilterBuilder<TableInfo>](/api/interfaces/server.FilterBuilder.md): server.FilterBuilder
- [Interface: GenericActionCtx<DataModel>](/api/interfaces/server.GenericActionCtx.md): server.GenericActionCtx
- [Interface: GenericDatabaseReader<DataModel>](/api/interfaces/server.GenericDatabaseReader.md): server.GenericDatabaseReader
- [Interface: GenericDatabaseReaderWithTable<DataModel>](/api/interfaces/server.GenericDatabaseReaderWithTable.md): server.GenericDatabaseReaderWithTable
- [Interface: GenericDatabaseWriter<DataModel>](/api/interfaces/server.GenericDatabaseWriter.md): server.GenericDatabaseWriter
- [Interface: GenericDatabaseWriterWithTable<DataModel>](/api/interfaces/server.GenericDatabaseWriterWithTable.md): server.GenericDatabaseWriterWithTable
- [Interface: GenericMutationCtx<DataModel>](/api/interfaces/server.GenericMutationCtx.md): server.GenericMutationCtx
- [Interface: GenericQueryCtx<DataModel>](/api/interfaces/server.GenericQueryCtx.md): server.GenericQueryCtx
- [Interface: IndexRangeBuilder<Document, IndexFields, FieldNum>](/api/interfaces/server.IndexRangeBuilder.md): server.IndexRangeBuilder
- [Interface: OrderedQuery<TableInfo>](/api/interfaces/server.OrderedQuery.md): server.OrderedQuery
- [Interface: PaginationOptions](/api/interfaces/server.PaginationOptions.md): server.PaginationOptions
- [Interface: PaginationResult<T>](/api/interfaces/server.PaginationResult.md): server.PaginationResult
- [Interface: Query<TableInfo>](/api/interfaces/server.Query.md): server.Query
- [Interface: QueryInitializer<TableInfo>](/api/interfaces/server.QueryInitializer.md): server.QueryInitializer
- [Interface: Scheduler](/api/interfaces/server.Scheduler.md): server.Scheduler
- [Interface: SearchFilterBuilder<Document, SearchIndexConfig>](/api/interfaces/server.SearchFilterBuilder.md): server.SearchFilterBuilder
- [Interface: SearchFilterFinalizer<Document, SearchIndexConfig>](/api/interfaces/server.SearchFilterFinalizer.md): server.SearchFilterFinalizer
- [Interface: SearchIndexConfig<SearchField, FilterFields>](/api/interfaces/server.SearchIndexConfig.md): server.SearchIndexConfig
- [Interface: StorageActionWriter](/api/interfaces/server.StorageActionWriter.md): server.StorageActionWriter
- [Interface: StorageReader](/api/interfaces/server.StorageReader.md): server.StorageReader
- [Interface: StorageWriter](/api/interfaces/server.StorageWriter.md): server.StorageWriter
- [Interface: SystemDataModel](/api/interfaces/server.SystemDataModel.md): server.SystemDataModel
- [Interface: UserIdentity](/api/interfaces/server.UserIdentity.md): server.UserIdentity
- [Interface: ValidatedFunction<Ctx, ArgsValidator, Returns>](/api/interfaces/server.ValidatedFunction.md): server.ValidatedFunction
- [Interface: VectorFilterBuilder<Document, VectorIndexConfig>](/api/interfaces/server.VectorFilterBuilder.md): server.VectorFilterBuilder
- [Interface: VectorIndexConfig<VectorField, FilterFields>](/api/interfaces/server.VectorIndexConfig.md): server.VectorIndexConfig
- [Interface: VectorSearchQuery<TableInfo, IndexName>](/api/interfaces/server.VectorSearchQuery.md): server.VectorSearchQuery
- [convex](/api/modules.md): Modules
- [Module: browser](/api/modules/browser.md): Tools for accessing Convex in the browser.
- [Module: nextjs](/api/modules/nextjs.md): Helpers for integrating Convex into Next.js applications using server rendering.
- [Module: react](/api/modules/react.md): Tools to integrate Convex into React applications.
- [Module: react-auth0](/api/modules/react_auth0.md): React login component for use with Auth0.
- [Module: react-clerk](/api/modules/react_clerk.md): React login component for use with Clerk.
- [Module: server](/api/modules/server.md): Utilities for implementing server-side Convex query and mutation functions.
- [Module: values](/api/modules/values.md): Utilities for working with values stored in Convex.
- [Namespace: Base64](/api/namespaces/values.Base64.md): values.Base64

## generated-api

- [Generated Code](/generated-api.md): Auto-generated JavaScript and TypeScript code specific to your app's API
- [api.js](/generated-api/api.md): Generated API references for your Convex functions and internal calls
- [dataModel.d.ts](/generated-api/data-model.md): Generated TypeScript types for your database schema and documents
- [server.js](/generated-api/server.md): Generated utilities for implementing Convex queries, mutations, and actions

## http-api

- [Convex HTTP API](/http-api.md): Connecting to Convex directly with HTTP

## chef

- [Chef](/chef.md): How to use Chef by Convex

## deployment-api

- [Deployment API](/deployment-api.md): Deployment API
- [Convex Deployment API](/deployment-api/convex-deployment-api.md): Admin API for interacting with deployments.
- [Create log stream](/deployment-api/create-log-stream.md): Create a new log stream for the deployment. Errors if a log stream of the
- [Delete log stream](/deployment-api/delete-log-stream.md): Delete the deployment's log stream with the given id.
- [Get canonical URLs](/deployment-api/get-canonical-urls.md): Get the canonical URLs for a deployment.
- [Get log stream](/deployment-api/get-log-stream.md): Get the config for a specific log stream by id.
- [List environment variables](/deployment-api/list-environment-variables.md): Get all environment variables in a deployment.
- [List log streams](/deployment-api/list-log-streams.md): List configs for all existing log streams in a deployment.
- [Rotate webhook log stream secret](/deployment-api/rotate-webhook-secret.md): Rotate the secret for the webhook log stream.
- [Update canonical URL](/deployment-api/update-canonical-url.md): Set or unset the canonical URL for a deployment's convex.cloud or
- [Update environment variables](/deployment-api/update-environment-variables.md): Update one or many environment variables in a deployment.
- [Update log stream](/deployment-api/update-log-stream.md): Update an existing log stream for the deployment. Omit a field to keep the

## deployment-platform-api

- [Deployment Platform API](/deployment-platform-api.md): Deployment API

## management-api

- [Management API](/management-api.md): Creating and managing Convex deployments by API
- [Convex Management API](/management-api/convex-management-api.md): Management API for provisioning and managing Convex projects and deployments.
- [Create custom domain](/management-api/create-custom-domain.md): Create custom domain
- [Create deploy key](/management-api/create-deploy-key.md): Create a deploy key like 'dev:happy-animal-123|ey...' which can be
- [Create project](/management-api/create-project.md): Create a new project on a team and provision a dev or prod deployment.
- [Delete custom domain](/management-api/delete-custom-domain.md): Remove a custom domain from a deployment.
- [Delete project](/management-api/delete-project.md): Delete a project. Deletes all deployments in the project as well.
- [Get token details](/management-api/get-token-details.md): Returns the team ID for team tokens.
- [List custom domains](/management-api/list-custom-domains.md): Get all custom domains configured for a deployment.
- [List deployments](/management-api/list-deployments.md): List deployments for a projects.
- [List projects](/management-api/list-projects.md): List all projects for a team.

## platform-apis

- [Platform APIs](/platform-apis.md): Convex Platform APIs are in openly available in Beta. Please contact
- [Embedding the dashboard](/platform-apis/embedded-dashboard.md): Convex provides a hosted dashboard that is embeddable via iframe. Embedding the
- [OAuth Applications](/platform-apis/oauth-applications.md): Convex allows third-party app developers to manage a user's projects on their

## public-deployment-api

- [Convex Public HTTP routes](/public-deployment-api/convex-public-http-routes.md): Endpoints that require no authentication
- [Execute action](/public-deployment-api/public-action-post.md): Execute an action function.
- [Execute any function](/public-deployment-api/public-function-post.md): Execute a query, mutation, or action function by name.
- [Execute function by URL path](/public-deployment-api/public-function-post-with-path.md): Execute a query, mutation, or action function by path in URL.
- [Get latest timestamp](/public-deployment-api/public-get-query-ts.md): Get the latest timestamp for queries.
- [Execute mutation](/public-deployment-api/public-mutation-post.md): Execute a mutation function.
- [Execute query at timestamp](/public-deployment-api/public-query-at-ts-post.md): Execute a query function at a specific timestamp.
- [Execute query batch](/public-deployment-api/public-query-batch-post.md): Execute multiple query functions in a batch.
- [Execute query (GET)](/public-deployment-api/public-query-get.md): Execute a query function via GET request.
- [Execute query (POST)](/public-deployment-api/public-query-post.md): Execute a query function via POST request.

## streaming-export-api

- [Streaming Export](/streaming-export-api.md): Streaming data out of Convex

## streaming-import-api

- [Streaming Import](/streaming-import-api.md): Streaming data into Convex