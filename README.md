# Centable

A personal budget management mobile app built with React Native and Expo. Track your income, expenses, and budgets with ease.

## Features

- 💰 **Income & Expense Tracking**: Add and manage recurring or one-time income and expenses
- 📊 **Budget Management**: Automatically generate budgets based on your income and expenses
- 🔄 **Recurring Transactions**: Support for daily, weekly, monthly, and semi-monthly frequencies
- 💾 **Local Storage**: All data stored locally using SQLite
- 🎨 **Dark/Light Theme**: Automatic theme support
- 📱 **Cross-Platform**: Works on iOS, Android, and Web

## Tech Stack

- **Framework**: Expo SDK 52
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **Database**: Expo SQLite
- **UI**: React Native with custom components

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (optional, but recommended)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/AngelWiebe/centable.git
   cd centable
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the development server

   ```bash
   npm start
   # or
   npx expo start
   ```

4. Run on your preferred platform

   ```bash
   # iOS
   npm run ios

   # Android
   npm run android

   # Web
   npm run web
   ```

## Project Structure

```
centable/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Budget list (home)
│   │   ├── incomes.tsx    # Income management
│   │   ├── expenses.tsx   # Expense management
│   │   ├── reports.tsx    # Reports and analytics
│   │   └── settings.tsx   # App settings
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── BudgetItem.tsx     # Budget card component
│   ├── BudgetList.tsx     # Budget list view
│   ├── FinancialForm.tsx  # Income/expense form
│   └── ...
├── database/              # SQLite database operations
│   └── database.ts        # Database CRUD functions
├── app/store/             # Zustand state management
│   └── useBudgetStore.ts  # Main app store
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── assets/                # Images, fonts, etc.
```

## Key Features Explained

### Budget Generation

Budgets are automatically generated based on your income and expense patterns. The app:

- Generates budgets for the next 3 months
- Assigns expenses to budgets based on dates and available balance
- Preserves manual edits (amounts, paid status) when refreshing

### Data Persistence

All data is stored locally in SQLite:

- Incomes and expenses are saved immediately
- Budget modifications persist across app restarts
- Manual budget edits are preserved unless explicitly refreshed

### Refresh Button

The refresh button in the budget view recalculates budgets from scratch based on current income and expense data. Manual edits are preserved where possible.

## Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm test` - Run tests

### Building for Production

This project uses EAS Build for production builds. See [EAS documentation](https://docs.expo.dev/build/introduction/) for more information.

## License

Private project - All rights reserved

## Contributing

This is a private project. Contributions are not currently accepted.
