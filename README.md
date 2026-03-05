# MTWallet Frontend

A modern, offline-first React PWA tailored for automated personal finance tracking in India. It works in tandem with the [MTWallet Backend](../mtwallet-backend) and the [iOS Scraper Shortcut](../MTWallet-scraper).

Built cleanly on top of Vite and TailwindCSS, pulling transaction data sorted by a custom AI agent.

## Core Features

- **Automated PWA Dashboard**: Installable as a native-feeling progressive web app.
- **Deduplication Engine**: Smart UI for resolving identical transactions generated across dual-SIM or duplicate SMS sources.
- **Rule Automation**: Absolute control with "Always Remember" mapping features. Force alias specific fuzzy matches to bank accounts or categories automatically for all future transactions.
- **Live Push Notifications**: Utilizing Service Workers and Web Push VAPID keys, you get notified instantly when the backend successfully digests your latest swiped card.
- **Advanced Insights**: Deep filtering by `Groups`, `Accounts`, standard time frames, or custom manual dates.

## Setup & Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Setup environment variables:**
   Duplicate the `.env.example` file to `.env` and fill out your keys:
   ```bash
   VITE_SUPABASE_URL=your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-role-key
   ```
3. **Start the dev server:**
   ```bash
   npm run dev
   ```

## Infrastructure Status & Security
MTWallet operates securely. Only valid transactional SMS is processed, dropping personal messages or OTPs securely at the execution edge.

All state lives seamlessly in Supabase. Supabase operations were deliberately migrated to Azure UAE North to bypass regional ISP throttles in India, assuring sub-second roundtrip performance.
