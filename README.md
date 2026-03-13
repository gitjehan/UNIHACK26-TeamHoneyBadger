# KINETIC

Bio-responsive ambient workspace desktop app for UNIHACK 2026.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (do not commit secrets):

```bash
cp .env.example .env.local
```

3. Compile gamma helper once:

```bash
swiftc src/main/gamma-helper.swift -o src/main/gamma-helper
```

4. Install brightness CLI:

```bash
brew install brightness
```

## Run

```bash
npm run dev
```

## Verification

```bash
npm run verify
npm run test:ipc
npm run test:ambient
npm run test:e2e
```
