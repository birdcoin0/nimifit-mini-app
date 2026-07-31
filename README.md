# NimiFit — Wellness That Pays You Back

> *Scan meals. Drink water. Touch grass. Earn NIM.*

![NimiFit](https://nimifit-mini-29vb5u9ut-minii.vercel.app)

---

## What is NimiFit?

NimiFit is a **Nimiq Pay Mini App** that turns your daily wellness habits into real crypto rewards. Most health apps ask you to stay consistent with nothing in return. NimiFit changes that — every healthy choice you make earns you tickets, and tickets unlock real value inside the Nimiq ecosystem.

No gimmicks. No luck. Just your habits, made visible and rewarded.

---

## Live Demo

🔗 **[nimifit-mini-29vb5u9ut-minii.vercel.app](https://nimifit-mini-29vb5u9ut-minii.vercel.app)**

---

## The Core Loop

```
Scan a meal      →  +20 tickets  🥗
Log water        →  +5 tickets   💧
Touch Grass post →  +50 tickets  ✦
Enter competition → compete for glory 🏆
3,700 tickets    →  1 free Pro month
       OR
    100 NIM      →  Unlock Pro instantly ⚡
```

---

## Features

### 🥗 AI Meal Scanner (Gemini)
Take a photo of any meal. Gemini AI instantly estimates your **calories, protein, carbs, and fats** — no manual input, no spreadsheets. Your daily nutrition updates in real time with a visual ring and progress bars. Every scan earns **+20 tickets**.

### 💧 Hydration Tracker
Log every 250ml glass of water and earn **+5 tickets** per glass. A cooldown system prevents abuse — one glass every few minutes. Visual glass icons fill up as you hydrate toward your personal daily target (calculated from your weight).

### ✦ Touch Grass — The Social Feed
This is NimiFit's most unique feature. **Touch Grass** is a social feed where users share real outdoor moments — a walk, a workout, a meal outside, anything that got them away from the screen.

- Post a photo + caption → earn **+50 tickets**
- Like and comment on others' moments
- Build a community around real movement, not virtual steps

> *Touch Grass is NimiFit's creative heart. In a world of screen addiction, we reward the act of stepping outside. Web3 users spend hours staring at charts — NimiFit gives them a reason to look up.*

### 🏆 Competitions
Four weekly and monthly competitions run simultaneously:

| Competition | Period | Metric |
|---|---|---|
| 🎟 Ticket Sprint | Weekly | Most tickets earned |
| 💧 Hydration Relay | Weekly | Most water glasses logged |
| ⚖ Goal Sprint | Weekly | Progress toward weight goal |
| 🏆 Month Maker | Monthly | Strongest monthly streak |

Enter any competition with **10 tickets** as stake. Live leaderboards show your ranking in real time. Rankings reward consistency, not luck.

### ⚡ Nimiq Pay Integration
NimiFit is built natively around **Nimiq Pay** — not as an afterthought, but as the product's core:

- **Connect your Nimiq wallet** directly inside the app via `@nimiq/mini-app-sdk`
- **Pay 100 NIM** to unlock Pro access instantly — transaction confirmed on-chain
- **Earn your way to Pro** — accumulate 3,700 tickets through healthy habits and redeem for a free month
- NIM payments go directly to the project wallet: `NQ78 SF1K A42M CPT7 0LDP YT52 A747 8DB6 PX7P`
- Pro is cheaper than all other calorie AI apps, and **10 of those 100 NIM go directly to your account** — you never lose money, you just earn

> *NIM is part of the product, not a logo in the corner.*

### 👤 Personalized Nutrition Goals
Set your weight, goal weight, height, age, and activity level. NimiFit calculates your personal **TDEE** (Total Daily Energy Expenditure) and sets targets for:
- Daily calories (deficit or surplus based on your goal)
- Protein target (1.8g per kg body weight)
- Carbs and fats
- Daily water glasses (35ml per kg body weight)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Pure CSS (custom design system) |
| Auth | Firebase Authentication (Email + Google) |
| Database | Firebase Firestore |
| AI | Google Gemini (via Vercel API routes) |
| Payments | Nimiq Pay (`@nimiq/mini-app-sdk`) |
| Backend | Vercel Serverless Functions |
| Hosting | Vercel |

---

## Why NimiFit Wins

### 1. NIM is the product
Most hackathon apps bolt crypto onto a feature. In NimiFit, **you cannot use the app fully without NIM being part of the experience** — pay with NIM, earn toward NIM value, connect your Nimiq wallet. The blockchain is the business model.

### 2. Touch Grass is original
No other submission has a social outdoor movement feed. It's creative, it's on-brand for Web3 culture ("touch grass" is literally internet slang for "go outside"), and it rewards real-world behavior with on-chain value. Judges will remember it.

### 3. The ticket economy is smart
3,700 tickets = 1 free month. At 20 tickets per meal scan, that's ~185 meals = ~62 days of active use before you earn your free month. The math rewards genuine daily users, not exploiters.

### 4. Design quality
NimiFit uses a custom design system with:
- Fraunces serif display font for elegance
- DM Mono for data and metrics
- A warm parchment palette (`#f5f1e8`) that feels premium, not clinical
- Fully responsive mobile-first layout
- Smooth animations on the meal scan line and progress rings

### 5. It actually works
- Real AI meal analysis via Gemini
- Real Firestore data persistence
- Real Nimiq wallet connection
- Real competition leaderboards
- Real social feed with photos

---

## Project Structure

```
nimifit-mini-app/
├── api/                    # Vercel serverless functions
│   ├── analyzeMeal.js      # Gemini AI meal analysis
│   ├── logMealScanned.js   # Save meal + award tickets
│   ├── logWaterGlass.js    # Log hydration + tickets
│   ├── joinCompetition.js  # Enter competition with stake
│   ├── createPost.js       # Touch Grass post creation
│   ├── toggleLike.js       # Like system
│   ├── addComment.js       # Comment system
│   ├── confirmNimiqPayment.js  # On-chain payment verification
│   └── redeemTicketsForFreeMonth.js
├── src/
│   ├── App.jsx             # Main app + all screens
│   ├── TouchGrass.jsx      # Social feed component
│   ├── lib/
│   │   ├── firebase.js     # Firebase config
│   │   └── api.js          # API helper
│   ├── App.css             # Design system
│   └── index.css           # Global styles
└── package.json
```

---

## Setup & Run

```bash
git clone https://github.com/birdcoin0/nimifit-mini-app
cd nimifit-mini-app
npm install
cp .env.example .env.local   # Add your Firebase + Gemini keys
npm run dev
```

### Required Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
GEMINI_API_KEY=
```

---

## The Vision

NimiFit is proof that **health and crypto are natural partners**. Both require consistency, discipline, and delayed gratification. The people most drawn to Nimiq's mission — financial freedom, real value, decentralization — are the same people who understand that the best investments are in yourself.

NimiFit makes that literal.

*Scan your meals. Drink your water. Touch some grass. Your habits are worth something.*

---

**Built for the Nimiq Mini Apps Competition 2025**  
*By birdcoin0*
