# Retrieving Item Icons from FFXIV (XIVAPI)

This document explains how to retrieve item icons using the public FFXIV API.

ProfitXIV uses item IDs to dynamically display icons without storing any images locally.

---

# 1. Get Item Data from XIVAPI

To retrieve an item icon, you first need the item data.

Endpoint:

```
https://xivapi.com/item/{itemId}
```

Example:

```
https://xivapi.com/item/5333
```

Response example:

```json
{
  "ID": 5333,
  "Name": "Mythril Ingot",
  "Icon": "/i/020000/020123.png"
}
```

The important field is:

```
Icon
```

This field contains the relative path to the image.

---

# 2. Build the Full Image URL

The `Icon` value returned by the API is not a complete URL.

You must prepend:

```
https://xivapi.com
```

Example:

```
https://xivapi.com/i/020000/020123.png
```

This is the usable image URL.

---

# 3. Batch Retrieve Multiple Item Icons (Optimized)

Avoid requesting items one by one.

Use the search endpoint to retrieve multiple icons in one request:

```
https://xivapi.com/search?indexes=Item&filters=ID=5333,2,5,8&columns=ID,Name,Icon
```

Response includes:

* item ID
* item name
* icon path

This reduces API calls significantly.

---

# 4. Caching Strategy

Item icons never change.

You should cache:

* icon paths
* built URLs

Recommended:

* in-memory cache (server)
* static mapping
* edge caching if deployed

Avoid refetching icons repeatedly.

---

# 5. Example Workflow

1. Retrieve item data in batch
2. Extract the `Icon` field
3. Build full URL
4. Store result in cache
5. Display in UI

---

# 6. Example Final URL

Standard icon:

```
https://xivapi.com/i/020000/020123.png
```

Example usage in frontend:

```
<img src="https://xivapi.com/i/020000/020123_hr1.png" alt="item icon" />
```

---

**Use Image component from Nextjs and add the xivapi domain.**

---

# Summary

To retrieve item images:

1. Fetch item data from XIVAPI
2. Extract the `Icon` field
3. Prefix with `https://xivapi.com`
4. Use `_hr1` for high resolution
5. Cache permanently for performance
