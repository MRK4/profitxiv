/**
 * Script to test item icon retrieval from XIVAPI.
 * Run: npx tsx scripts/test-item-icon.ts
 */

import { getItemIcons, getItemData } from "../lib/xivapi";

const TEST_ITEM_ID = 9295;

async function main() {
  console.log(`\n=== Testing icon retrieval for item ID ${TEST_ITEM_ID} ===\n`);

  // Test getItemIcons
  console.log("1. getItemIcons([9295])");
  const icons = await getItemIcons([TEST_ITEM_ID]);
  console.log("   Result:", icons);
  console.log("   Icon URL:", icons[TEST_ITEM_ID] ?? "(none)");

  // Test getItemData (names + icons)
  console.log("\n2. getItemData([9295])");
  const { names, icons: icons2 } = await getItemData([TEST_ITEM_ID]);
  console.log("   Names:", names);
  console.log("   Icons:", icons2);
  console.log("   Icon URL:", icons2[TEST_ITEM_ID] ?? "(none)");

  // Direct XIVAPI fetch to see raw response (search)
  console.log("\n3. Raw XIVAPI search response");
  const searchUrl = `https://xivapi.com/search?indexes=Item&filters=ID|=${TEST_ITEM_ID}&columns=ID,Name,Icon&limit=1`;
  console.log("   URL:", searchUrl);
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  console.log("   Status:", searchRes.status);
  console.log("   Results count:", searchData.Results?.length ?? 0);
  console.log("   First result:", JSON.stringify(searchData.Results?.[0], null, 2));
  if (searchData.Message) console.log("   Error:", searchData.Message);

  // Direct XIVAPI /item/{id} endpoint (fallback)
  console.log("\n4. Raw XIVAPI /item/{id} response");
  const itemUrl = `https://xivapi.com/item/${TEST_ITEM_ID}?columns=ID,Name,Icon`;
  console.log("   URL:", itemUrl);
  const itemRes = await fetch(itemUrl);
  const itemData = await itemRes.json();
  console.log("   Status:", itemRes.status);
  console.log("   Icon:", itemData.Icon);
  console.log("   Full URL:", itemData.Icon ? `https://xivapi.com${itemData.Icon}` : "(none)");

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
