# XIVAPI Rate Limit Fix — Implementation Guide

## Objective

Prevent `429 (Rate Limit)` errors from XIVAPI by:

- Eliminating request bursts
- Controlling concurrency globally
- Reducing total number of requests
- Moving static data fetching out of runtime when possible

---

# 1. Problem Summary

Current issues:

- Multiple `Promise.all` sending requests in parallel
- No global coordination between functions
- High number of requests per item (names, icons, metadata)

Result:
- Burst traffic
- Exceeding ~20 req/sec limit
- Frequent `429` errors

---

# 2. Core Strategy

Apply **3 key changes**:

1. Introduce a **global request queue**
2. **Batch requests** instead of per-item calls
3. Reduce or eliminate **runtime calls to XIVAPI**

---

# 3. Step 1 — Create a Global Request Queue

All XIVAPI calls must go through a single queue.

## Implementation

```ts
const queue: (() => Promise<void>)[] = []
let isRunning = false

const RATE = 200 // ms between requests (≈5 req/sec)

async function runQueue() {
  if (isRunning) return
  isRunning = true

  while (queue.length > 0) {
    const job = queue.shift()
    if (job) await job()
    await new Promise(res => setTimeout(res, RATE))
  }

  isRunning = false
}
```

---

# 4. Step 2 — Wrap All XIVAPI Calls

Create a wrapper to enqueue every request.
```ts
function xivRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const result = await fn()
        resolve(result)
      } catch (err) {
        reject(err)
      }
    })

    runQueue()
  })
}
```

---

# 5. Step 3 — Replace Direct Calls
❌ Before
```ts
await Promise.all(items.map(id => fetchItem(id)))
```
✅ After
```ts
await Promise.all(
  items.map(id =>
    xivRequest(() => fetchItem(id))
  )
)
```

Result:
- No burst
- Requests executed sequentially
- Rate limit respected

---

# 6. Step 4 — Batch Requests (Critical Optimization)

Avoid:
```ts
1 request = 1 item
```

Use:
```ts
1 request = 50–100 items
```

**Example**
```ts
xivRequest(() =>
  fetch(`/v2/search?sheets=Item&query=ID=1,2,3,4`)
)
```

Apply this to:
- Item names
- Icons
- Metadata

---

# 7. Step 5 — Fix Existing Functions
**getItemNames**
- Replace per-item requests
- Use batch search

**getGatherableItems**
- Remove parallel batches
- Pass all calls through queue OR batch

**getItemIcons**
- Already batched → keep
- Still route through queue for safety

---

# 8. Step 6 — Reduce Runtime API Calls

## Important:

Item data does not change frequently:

- Names
- Icons
- Craftability
- Gatherability

## Recommended

Move XIVAPI calls to:

- Cron job
- Build step
- Preprocessing script

Store results in:

- Redis (Vercel KV)

---

# 9. Target Architecture

## Before

- Runtime → many XIVAPI calls  
- Parallel requests → rate limit  
- Multiple `Promise.all` → burst traffic  
- No central control of requests  

## After

- Cron → fetch + cache data (Universalis + optional XIVAPI)  
- Runtime → read from Redis only  
- XIVAPI → minimal or no usage at runtime  
- All requests controlled via a global queue  

---

# 10. Safe Limits

Recommended usage:

- ≤ 5 requests / second  
- Always batch requests when possible  
- Avoid parallel bursts (`Promise.all` without control)  
- Add delay between calls (~200ms)  

---

# 11. Expected Result

After implementation:

- No more `429 (Rate Limit)` errors  
- Stable and predictable API usage  
- Faster UI (less network calls)  
- Better scalability  
- Reduced load on external APIs  

---

# 12. Optional Improvements

- Add retry logic on 429 (exponential backoff)  
- Deduplicate identical requests  
- Cache results in memory during session  
- Use a dedicated rate limiting library:
  - `p-limit`
  - `Bottleneck`  

---

# Final Recommendation

## Minimum viable fix

- Implement global queue  
- Route all XIVAPI calls through it  
- Batch requests  

## Optimal solution

- Remove XIVAPI from runtime entirely  
- Precompute all item data (names, icons, metadata)  
- Store results in Redis or static JSON  
- Serve only cached data to the frontend  