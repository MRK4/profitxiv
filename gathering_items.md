# Gatherable Items Filter

## Goal

Add a filter allowing users to hide items that cannot be gathered directly.

This helps players who prefer farming materials themselves and want to focus only on gatherable-based crafting profitability.

---

## Behavior

New filter:

```
Hide non-gatherable items
```

When enabled:

* Only items that can be gathered via mining, botany, or fishing remain visible
* All other items are hidden from scan results

When disabled:

* All items remain visible (default behavior)

---

## How to Detect Gatherable Items

This information comes from XIVAPI.

An item is considered gatherable if it exists in gathering-related data:

* mining
* botany
* fishing

If the item is linked to a gathering node → it is gatherable.

If no gathering source exists:

* crafted only
* vendor only
* drop only
* market only
  → considered non-gatherable

---

## Implementation Logic

For each item:

1. Fetch item data from XIVAPI
2. Check for gathering source
3. Set flag:

```
isGatherable = true | false
```

Store result in memory cache.

---

## UI Integration

Filter placement:

* scan results header
* or advanced filters section

Optional future improvement:

```
Item source filter:
[ ] Gatherable
[ ] Craftable
[ ] Vendor
[ ] Drop
```

---

## Notes

* Universalis cannot provide this information
* Must be resolved via XIVAPI
* Cache results long-term (item source never changes)
* Filtering should be instant once data is cached
