# FAZA 7: Express Framework

**Branch:** `update/express-v5`
**Szacowany czas:** 4-6 godzin
**Ryzyko:** 🔴 WYSOKIE (backend framework - krytyczny dla działania app)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Aktualizacja Express z wersji 4.x do 5.x - pierwsza major release Express od 10 lat! Express to fundament backend servera - obsługuje wszystkie HTTP requests, WebSocket connections, static files, i API endpoints.

### Co aktualizujemy?

1. **Express** - HTTP framework (4.20.0 → 5.1.0) **MAJOR UPDATE**
2. **@types/express** - TypeScript definitions (4.17.21 → 5.0.5)

### Dlaczego to ryzykowne?

- Express to SERCE backend servera
- Breaking changes mogą zepsuć routing, middleware, authentication
- WebSocket connections muszą działać (socket.io)
- Static file serving musi działać
- Każdy endpoint musi być tested

### Dlaczego to ważne?

- Express 5 jest szybszy i bardziej secure
- Lepsze async/await support
- Poprawki bezpieczeństwa
- Required for modern Node.js features

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `@ts-ignore` w Express middleware
- Żadnych "temporary" fixes dla routing
- Żadnych workarounds dla authentication
- Jeśli middleware failuje - naprawiamy WŁAŚCIWIE

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- Express 5.1.0 - najnowsza major release
- @types/express 5.0.5 - matching TypeScript types
- Wszystkie middleware kompatybilne z Express 5
- Zero deprecated middleware/patterns

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
express: 4.20.0 → 5.1.0 ⚠️ (MAJOR - BREAKING CHANGES!)
@types/express: 4.17.21 → 5.0.5 ⚠️ (MAJOR)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Research Phase (KRYTYCZNE!)

⚠️ **PRZECZYTAJ PRZED UPDATE:**

```bash
# Otwórz i PRZECZYTAJ:
# Express 5 Migration Guide:
# https://expressjs.com/en/guide/migrating-5.html

# Express 5 Release Notes:
# https://github.com/expressjs/express/releases/tag/v5.0.0
```

**Checklist Research:**
- [ ] Przeczytany Express 5 migration guide
- [ ] Przeczytane release notes
- [ ] Zrozumiane breaking changes:
  - [ ] `app.del()` removed → use `app.delete()`
  - [ ] `app.param(fn)` signature changed
  - [ ] `req.host` behavior changed
  - [ ] Path regex changes (security)
  - [ ] Removed deprecated middleware
- [ ] Notatki sporządzone

### Krok 2: Backup i Prepare

```bash
git checkout main
git pull origin main
git checkout -b update/express-v5

# Backup server config
cp server/index.ts server/index.ts.backup
# (NIE commituj .backup)

# Test obecnego stanu
yarn build:server
yarn start
# Ctrl+C po verificacji że działa
```

### Krok 3: Inventory Current Express Usage

```bash
# Znajdź wszystkie miejsca używające Express
grep -r "express" server/ --include="*.ts"
grep -r "req\." server/ --include="*.ts"
grep -r "res\." server/ --include="*.ts"
grep -r "app\." server/ --include="*.ts"

# Sprawdź middleware
grep -r "app.use" server/ --include="*.ts"

# Save output
grep -r "app\." server/ --include="*.ts" > express-usage.txt
```

**Checklist Inventory:**
- [ ] Wszystkie Express usages znalezione
- [ ] Middleware listed
- [ ] Routes listed
- [ ] Static file serving found
- [ ] WebSocket integration found
- [ ] express-usage.txt created

### Krok 4: Update Packages

```bash
yarn add express@5.1.0 @types/express@5.0.5

# Verify versions
npm list express
npm list @types/express
```

**Checklist Update:**
- [ ] Express 5.1.0 zainstalowany
- [ ] @types/express 5.0.5 zainstalowany
- [ ] Commit: `chore(deps): update Express to 5.1.0`

### Krok 5: Fix TypeScript Errors

```bash
# Build server
yarn build:server
```

Jeśli są TypeScript errors:

**Common TypeScript issues:**
1. Request/Response types changed
2. Middleware signatures changed
3. Router types updated

**Checklist TypeScript:**
- [ ] `yarn build:server` przechodzi **bez błędów**
- [ ] Wszystkie middleware properly typed
- [ ] Request handlers properly typed
- [ ] Response methods properly typed
- [ ] Zero `@ts-ignore` użytych
- [ ] Commit: `fix(types): update Express types to v5`

### Krok 6: Fix Breaking Changes w Kodzie

Sprawdź migration guide i fix:

```typescript
// 1. app.del() → app.delete()
// BEFORE (Express 4):
app.del('/user/:id', handler);

// AFTER (Express 5):
app.delete('/user/:id', handler);

// 2. Check req.host changes
// May need to check code using req.host

// 3. Path-to-regexp updates (security improvement)
// Check all route patterns with regex
```

**Checklist Breaking Changes:**
- [ ] `app.del()` replaced with `app.delete()` (if used)
- [ ] `req.host` usage checked and updated
- [ ] Route patterns reviewed (regex)
- [ ] Deprecated middleware removed/replaced
- [ ] Commit: `refactor(server): fix Express 5 breaking changes`

### Krok 7: Test Server Startup

```bash
# Build
yarn build:server

# Start server
yarn start

# W innym terminalu - test endpoints:
curl http://localhost:9000/
curl http://localhost:9000/ping  # jeśli jest
```

**Checklist Server Start:**
- [ ] Server startuje bez crashy
- [ ] No errors w konsoli
- [ ] Port binding działa
- [ ] Process nie kończy się sam

### Krok 8: Test HTTP Endpoints

```bash
# W przeglądarce lub curl test wszystkich głównych endpoints:

# Homepage
curl http://localhost:9000/

# Static files
curl http://localhost:9000/js/bundle.js

# API endpoints (jeśli są)
curl http://localhost:9000/api/...

# Check wszystkie response codes
```

**Checklist Endpoints:**
- [ ] Homepage (GET /) działa
- [ ] Static files serwowane poprawnie
- [ ] API endpoints działają
- [ ] Error handling działa (test 404, 500)
- [ ] Middleware chain działa (auth, logging, etc.)
- [ ] Response headers poprawne

### Krok 9: Test WebSocket (socket.io)

```bash
# Start server
yarn dev

# W przeglądarce otwórz DevTools → Network → WS
# Sprawdź czy WebSocket connection ustanowione

# Albo test programatically:
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:9000');
socket.on('connect', () => {
  console.log('Connected!');
  process.exit(0);
});
socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});
"
```

**Checklist WebSocket:**
- [ ] WebSocket connection established
- [ ] socket.io działa z Express 5
- [ ] Messages są wysyłane/odbierane
- [ ] No connection errors
- [ ] Reconnection działa

### Krok 10: Test Authentication & Sessions (jeśli jest)

```bash
# Test login/logout flow
# Test session persistence
# Test protected routes
```

**Checklist Auth:**
- [ ] Login działa
- [ ] Logout działa
- [ ] Sessions persist
- [ ] Protected routes require auth
- [ ] Auth middleware działa

### Krok 11: Full Integration Test

```bash
# Full stack test:
yarn build
yarn start

# W przeglądarce:
# 1. Otwórz http://localhost:9000
# 2. Login (jeśli jest)
# 3. Test głównej functionality app
# 4. Sprawdź DevTools Console - zero errors
# 5. Sprawdź Network tab - wszystkie requests OK
# 6. Test kilka różnych pages/features
```

**Checklist Integration:**
- [ ] Aplikacja ładuje się w przeglądarce
- [ ] Login/logout działa
- [ ] Wszystkie features działają
- [ ] Zero errors w konsoli przeglądarki
- [ ] Zero errors w konsoli servera
- [ ] Performance OK (no slowdowns)

### Krok 12: Test Suite

```bash
# Run all tests
yarn test

# Specifically server tests
yarn test server/
```

**Checklist Tests:**
- [ ] Wszystkie testy przechodzą
- [ ] Server tests pass
- [ ] Integration tests pass
- [ ] No flaky tests
- [ ] Coverage nie spadło

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin update/express-v5
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Server działa w dev mode
- [ ] Server działa w production mode
- [ ] Wszystkie endpoints tested
- [ ] WebSocket działa
- [ ] Tests pass
- [ ] **Napisane do Claude:** "Faza 7 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ Express 5.1.0 zainstalowany i działający
✅ Server startuje bez błędów
✅ Wszystkie endpoints działają
✅ WebSocket działa
✅ Authentication działa (jeśli jest)
✅ Static files serwowane poprawnie
✅ Tests pass

### Nice to Have (OPCJONALNE):
⭐ Performance improvements (Express 5 benefit)
⭐ Better error handling
⭐ Improved logging

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: Server crashes on startup

**Symptom:** `TypeError: app.xxx is not a function`

**Rozwiązanie:**
1. Sprawdź czy używasz deprecated methods
2. Check migration guide for renamed methods
3. Update middleware that may be Express 4 specific

### Problem: socket.io nie łączy się

**Symptom:** WebSocket connection failed

**Rozwiązanie:**
1. Sprawdź socket.io version - może wymagać update
2. Check socket.io Express 5 compatibility
3. Verify CORS settings (mogły się zmienić)

### Problem: Static files 404

**Symptom:** GET /js/bundle.js → 404

**Rozwiązanie:**
1. Sprawdź `express.static()` middleware
2. Path resolution mogło się zmienić
3. Check middleware order (static before routes)

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Server działa stabilnie
- [ ] All endpoints tested
- [ ] WebSocket działa
- [ ] Tests pass
- [ ] **Napisane do Claude:** "Faza 7 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**⚠️ CHECKPOINT 2** - Po tej fazie wszystkie major frameworks zaktualizowane!

**Poprzednia faza:** FAZA 6 - ESLint Ecosystem
**Następna faza:** FAZA 8 - ESM Migration (OPCJONALNE ale ZALECANE)
