# Refactor — Item Search & Filtering Logic

## Goal
Unify all item filters into a single coherent pipeline to avoid conflicts between:
- Craftable filter
- Gatherable filter
- Recipe component preservation

Ensure no useful item is accidentally removed during multi-filter scans.

---

## Core Principle
Filtering must be **state-driven**, not sequential destructive filtering.  
Instead of removing items step-by-step, compute item metadata first, then apply a final visibility decision.

---

## Step 1 — Build Item Metadata Map
For each item ID scanned, compute once:

- `id`
- `isCraftable`
- `isGatherable`
- `isRecipeComponent`
- `hasRecipe`
- `usedInRecipes: []`

### Sources
- XIVAPI recipes → craftable + components  
- Gathering data → gatherable status  
- Recipe lookup → detect if used in other crafts  

Store everything in a single `itemMap`.

---

## Step 2 — Determine Visibility Rules
Create a single function:

```ts
function shouldDisplayItem(item, filters) { ... }
```

Rules

Craftable filter enabled
Show item if:

Craftable
OR

Used as recipe component

Gatherable filter enabled
Hide only if:

Not gatherable
AND

Not used in any recipe
AND

Not craftable

Both filters enabled
Keep item if:

Craftable

Gatherable

Used in any recipe chain

Hide item if:

Purely market/NPC item

Not gatherable

Not craftable

Not used anywhere

Step 3 — Apply Filters Safely

Do NOT chain filters destructively:
`items -> filter craftable -> filter gatherable`

Instead:

`items -> enrich metadata -> visibility decision`

This prevents:

    Component loss

    Filter conflicts

    Inconsistent scan results

Step 4 — Optional: Debug Mode

Add trace logging:

Item hidden because:
- Not craftable
- Not gatherable
- Not used in recipes


Useful for verifying logic during scans.

Result

No filter conflicts

Predictable item list

Stable scan output

Easier future feature additions