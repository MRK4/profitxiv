# Marketboard Comparison Feature (Universalis API)

This document explains how to implement a feature that compares item prices across all worlds using the Universalis API.

---

## Goal

Display where an item sells:

* cheapest
* most expensive
* average price per world

This allows identifying the best world to buy or sell.

---

## 1. Fetch Market Data

Use the Universalis endpoint:

```
https://universalis.app/api/v2/{region}/{itemId}
```

Example (Europe):

```
https://universalis.app/api/v2/Europe/5333
```

You can request multiple items:

```
https://universalis.app/api/v2/Europe/5333,2,5,8
```

---

## 2. Parse Response

Response structure:

```
items → itemId → worlds → worldName
```

Each world contains:

* minPrice
* currentAveragePrice
* listings
* recentHistory

Example:

```
items["5333"].worlds["Ragnarok"].minPrice
```

---

## 3. Find Cheapest and Most Expensive

Loop through all worlds and compare prices.

Use:

* `minPrice` for instant sell price
* `currentAveragePrice` for realistic market value

Example logic:

```
cheapest world
most expensive world
price difference
```

Ignore worlds with no listings:

```
if listings.length === 0 → skip
```

---

## 4. Display in UI

Suggested display:

Item name
Cheapest world + price
Most expensive world + price
Difference (%)

Optional:

* full table of all worlds
* profit potential
* last updated time

---

## 5. Performance Tips

Always batch requests:

```
/api/v2/Europe/item1,item2,item3
```

Cache results:

* 2–5 minutes recommended
* market data does not change instantly

Never call the API per item in the UI.

---

## Summary

1. Fetch item prices from Universalis
2. Parse prices for each world
3. Find cheapest and most expensive
4. Display comparison
5. Cache results for performance
