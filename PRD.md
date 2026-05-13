# Paperain Website — Product Requirements Document (PRD)

---

## 1. Project Overview

Moving off Shopify to a self-hosted, low-cost website for **Paperain**. Phase 1 focuses on **product showcase** and a **lightweight checkout** — no user authentication, no payment gateway integration. Orders are collected via a form and processed manually.

**Design reference:** [muwiart.com](https://muwiart.com/) — clean, cute, minimal shop layout with product cards, favorite picks, and a warm aesthetic.

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | **Astro** | Lightweight static site generator, multi-page, component-based, zero JS by default |
| **Styling** | **Tailwind CSS** | Rapid, modern UI without writing custom CSS |
| **Hosting** | **Vercel** | Free tier, instant deploys from Git, great for Astro |
| **Product Data** | **Google Sheets** (as a simple database) | Easy to update products without touching code |
| **Backend / Order Processing** | **Google Apps Script** (as a web API) | Free. Receives orders, saves to Google Sheets, sends email receipts |
| **Email Receipts** | **Gmail via Apps Script** (`MailApp.sendEmail`) | Free, built-in, no third-party service needed |
| **Images** | **Google Drive** or hosted in repo `/public/images/` | Free image hosting |

### Cost Summary

| Item | Monthly Cost |
|---|---|
| Hosting (Vercel free tier) | **Free** |
| Google Sheets + Apps Script | **Free** |
| Gmail email sending | **Free** (up to ~100/day) |
| Domain name (if custom) | ~**$10–15/year** |
| **Total** | **$0–1.25/month** |

---

## 3. Site Architecture

```
paperain-website/
├── src/
│   ├── layouts/
│   │   └── Layout.astro          ← Shared layout (head, navbar, footer)
│   ├── components/
│   │   ├── AnnouncementBar.astro  ← Scrolling promo text
│   │   ├── Navbar.astro           ← Navigation bar
│   │   ├── Footer.astro           ← Footer
│   │   ├── HeroCarousel.astro     ← Hero image carousel
│   │   ├── ProductCard.astro      ← Reusable product card
│   │   ├── ProductFilter.astro    ← Category filter buttons
│   │   ├── CartDrawer.astro       ← Cart sidebar/drawer
│   │   └── CheckoutForm.astro     ← Order form
│   ├── pages/
│   │   ├── index.astro            ← Home page
│   │   ├── products.astro         ← Products listing with filters
│   │   ├── product/[id].astro     ← Single product detail page
│   │   ├── checkout.astro         ← Checkout page
│   │   ├── about.astro            ← About page
│   │   └── policies/
│   │       ├── shipping-refund.astro
│   │       ├── terms.astro
│   │       └── privacy.astro
│   ├── data/
│   │   └── products.json          ← Local product data (fallback / initial)
│   └── styles/
│       └── global.css             ← Global styles, Tailwind directives
├── public/
│   ├── images/
│   │   ├── hero/                  ← Carousel images
│   │   └── products/              ← Product images
│   └── logo.png                   ← Paperain logo
├── scripts/
│   └── google-apps-script.js      ← Apps Script code (for reference/deploy)
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── PRD.md                         ← This file
```

---

## 4. Feature Breakdown — Phase 1

### 4.1 Announcement Bar (Top)
- Running/scrolling text: *"Spend $50 and get 20% off!"*
- Fixed at the very top of every page
- Subtle background color, small font

### 4.2 Navigation Bar
| Element | Behavior |
|---|---|
| **Logo** | Links to home page |
| **Products** | Links to `/products` |
| **About** | Links to `/about` |
| **Store Policy** | Dropdown → Shipping & Refund, Terms & Conditions, Privacy Policy |
| **Login / Sign Up** | Button (placeholder for Phase 1, non-functional) |
| **Cart icon** | Opens cart drawer, shows item count badge |

Mobile: hamburger menu.

### 4.3 Hero Section (Home Page)
- Image carousel with 3–5 selected images
- Auto-advances every 4–5 seconds
- Manual left/right navigation + dots
- Full-width, visually prominent

### 4.4 New Items Section (Home Page)
- Heading: "New Arrivals"
- 3–4 product cards in a responsive grid
- Each card: **image, title, price**
- Clicking a card → goes to `/product/[id]`

### 4.5 Favorite Picks Section (Home Page)
- Heading: "⋆ Favorite Picks ⋆" (similar to muwiart style)
- 3–4 product cards, same format

### 4.6 Products Page
- Displays all products
- **Filter bar** with categories:
  - All
  - Sticker
  - Keychain
  - Phone Grips
  - Art Prints
  - Greeting Cards
- Product cards same format (image, title, price)
- Responsive grid layout

### 4.7 Product Detail Page
- Larger product image
- Title, price, description
- **"Add to Cart"** button
- Quantity selector

### 4.8 Cart (localStorage-based)
- No authentication needed
- Cart stored in browser `localStorage`
- Cart icon in navbar shows item count
- Cart drawer shows items, quantities, total price
- Auto-applies 20% discount if total ≥ $50

### 4.9 Checkout Page
- **Form fields:**
  - Full Name
  - Phone Number
  - Email Address
  - Shipping Address (street, city, state/province, postal code, country)
- **Order summary** (items, quantities, prices, discount if applicable, total)
- **"Place Order"** button → submits to Google Apps Script

### 4.10 Google Apps Script Backend
- **Endpoint 1: GET products** — reads from a "Products" Google Sheet and returns JSON
- **Endpoint 2: POST order** — receives order data, writes to an "Orders" Google Sheet, sends email receipt to customer via Gmail

### 4.11 Google Sheets Structure

**Products Sheet:**

| id | title | price | category | image_url | description | is_new | is_favorite |
|---|---|---|---|---|---|---|---|
| 001 | Cat Sticker | 3.00 | sticker | https://... | Cute cat sticker | TRUE | FALSE |

**Orders Sheet:**

| order_id | timestamp | name | email | phone | address | items_json | subtotal | discount | total | status |
|---|---|---|---|---|---|---|---|---|---|---|
| ORD-001 | 2026-05-12 | John | john@email.com | +1... | 123 Main St... | [{...}] | 60.00 | 12.00 | 48.00 | pending |

---

## 5. Execution Plan

### Phase 1A — Foundation (Day 1–2)

| # | Task | Details |
|---|---|---|
| 1 | Initialize Astro project with Tailwind | `npm create astro`, add Tailwind integration |
| 2 | Build announcement bar | Scrolling text component, included in layout |
| 3 | Build navigation bar | Logo, links, dropdown for policies, cart icon, login button (placeholder) |
| 4 | Build footer | Basic footer with links and copyright |
| 5 | Create shared Layout.astro | Announcement bar + navbar + footer, consistent across all pages |

### Phase 1B — Home Page (Day 2–3)

| # | Task | Details |
|---|---|---|
| 6 | Hero carousel | 3–5 image slideshow with auto-play and manual controls |
| 7 | New Items section | Product card component, rendered from data |
| 8 | Favorite Picks section | Same card component, filtered by `is_favorite` |
| 9 | Responsive design | Mobile-first, test all breakpoints |

### Phase 1C — Google Sheets + Products (Day 3–4)

| # | Task | Details |
|---|---|---|
| 10 | Set up Products Google Sheet | Create sheet with columns matching schema |
| 11 | Google Apps Script — GET endpoint | `doGet()` function that returns products as JSON |
| 12 | Products page | Fetch products from Apps Script, render cards |
| 13 | Filter functionality | Client-side filter buttons for each category |
| 14 | Product detail page | Dynamic page that loads product by ID |

### Phase 1D — Cart + Checkout (Day 4–5)

| # | Task | Details |
|---|---|---|
| 15 | Cart logic (localStorage) | Add to cart, update quantity, remove, calculate totals |
| 16 | Cart UI | Cart drawer showing items and totals |
| 17 | Discount logic | Auto-apply 20% off when subtotal ≥ $50 |
| 18 | Checkout form | Customer info form + order summary |
| 19 | Google Apps Script — POST endpoint | `doPost()` that saves order + sends receipt email |
| 20 | Email receipt template | Clean HTML email with order details |

### Phase 1E — Static Pages + Polish (Day 5–6)

| # | Task | Details |
|---|---|---|
| 21 | About page | Brand story, images |
| 22 | Shipping & Refund policy page | Policy content |
| 23 | Terms & Conditions page | Terms content |
| 24 | Privacy Policy page | Privacy policy content |
| 25 | Final responsive testing | Test all pages on mobile, tablet, desktop |
| 26 | Deploy to Vercel | Connect repo, configure, deploy |

---

## 6. Buying Flow

```
Customer browses products
        ↓
Adds items to cart (stored in localStorage)
        ↓
Goes to checkout → fills in name, phone, email, address
        ↓
Clicks "Place Order"
        ↓
JS sends POST request to Google Apps Script
        ↓
Apps Script:
  1. Generates order ID
  2. Writes order to "Orders" Google Sheet
  3. Sends email receipt to customer via Gmail
  4. Returns success response
        ↓
Customer sees "Order placed!" confirmation
        ↓
You check the Orders Google Sheet and fulfill manually
```

---

## 7. Future Phases (Out of Scope for Phase 1)

| Phase | Features |
|---|---|
| **Phase 2** | User authentication (login/signup), order history |
| **Phase 3** | Payment gateway (Stripe / PayPal), auto order confirmation |
| **Phase 4** | Admin dashboard, inventory management |
| **Phase 5** | Reviews, wishlist, SEO optimization |
