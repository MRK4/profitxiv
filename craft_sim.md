# Craft Yield Simulator (Dialog Feature)

This feature allows players to simulate crafting profitability based on which materials they gather/craft themselves versus buying from the market or NPCs.

---

## Goal

Provide a dialog showing the full recipe tree of an item and let users choose how they obtain each material.

The system recalculates total cost and profit depending on user choices.

---

## Behavior

When opening the dialog:

* Display full recipe for the selected item
* Show all required materials (including sub-crafts if applicable)
* All materials are checked by default

Checked = player will craft/gather
Unchecked = player will buy at lowest available price

---

## Yield Calculation

For each material:

If checked:

* Use crafting cost (sum of sub-materials)

If unchecked:

* Use lowest market/NPC price

Total craft cost updates in real time.

Final display:

* Total material cost
* Final item sell price
* Expected profit
* Profit margin (%)

---

## UI Structure

Dialog content:

* Final item (name + icon)
* Recipe tree
* Checkbox per material
* Real-time cost summary
* Profit preview

Optional:

* Expand sub-crafts
* Highlight most expensive materials

---

## Result

Players can instantly see:

* full craft profitability
* partial craft profitability
* buy vs craft impact
* optimal strategy to maximize profit
