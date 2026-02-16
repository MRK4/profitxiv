# ProfitXIV

**ProfitXIV** is a lightweight web tool designed to optimize gil-making in Final Fantasy XIV by identifying the most profitable items to craft and resell in real time.

The application analyzes marketboard prices across servers and calculates potential profit margins based on crafting costs, material prices, and current sell values — all without storing any data in a database.

This project is built for fun and personal gameplay optimization.

---

## Features

- Retrieve real-time marketboard prices for items across multiple servers  
- Identify items with the highest resale value
- Fully client-driven with no database  

---

## How it works

ProfitXIV fetches marketboard data from a public FFXIV API and performs all calculations on demand.

For each item:
1. Current sell prices are retrieved per server  
2. Crafting recipe and required materials are analyzed (for the v2)
3. Material costs are calculated using current market prices
4. Final profit margin is computed
5. Items are ranked by profitability

---

## Tech Stack

- Next.js  
- TypeScript  
- TailwindCSS 
- Shadcn/ui
- [Universalis API](https://docs.universalis.app/)

---

## Disclaimer

This project is a personal tool created for gameplay optimization and experimentation.  
All data belongs to their respective sources and APIs.
