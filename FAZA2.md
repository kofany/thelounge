# FAZA 2: Webpack Build Chain

**Branch:** `update/webpack-chain`
**Szacowany czas:** 3-4 godziny
**Ryzyko:** 🟡 ŚREDNIE (webpack-cli major update)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Zaktualizowanie całego łańcucha budowania Webpack do najnowszych wersji. Webpack jest sercem procesu budowania aplikacji - odpowiada za kompilację klienta, bundling, HMR (Hot Module Replacement), oraz optymalizację produkcyjną.

### Co aktualizujemy?

1. **Webpack** - główny bundler (5.94.0 → 5.102.1)
2. **Webpack CLI** - interfejs linii poleceń (4.9.2 → 6.0.1) **MAJOR UPDATE**
3. **Webpack Dev Middleware** - middleware deweloperskie (5.3.4 → 7.4.2) **MAJOR UPDATE**
4. **Webpack Hot Middleware** - Hot Module Replacement
5. **Mini CSS Extract Plugin** - ekstrakcja CSS do osobnych plików

### Dlaczego to ważne?

- Webpack 5.102 ma poprawki wydajności i bezpieczeństwa
- Webpack CLI 6 wprowadza nowe featury i lepszą ergonomię
- Dev middleware 7 ma lepszą kompatybilność z Express 5 (przygotowanie na FAZĘ 7)
- Nowoczesny build pipeline = szybsze buildy

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `@ts-expect-error` w webpack config
- Żadnych pomijania warningów w build output
- Żadnych "temporary" workarounds dla HMR
- Jeśli webpack config się nie kompiluje - naprawiamy types, nie obchodzimy

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- Webpack 5.102.1 - najnowsza stabilna wersja 5.x
- Webpack CLI 6.0.1 - najnowsza major
- Wszystkie pluginy Webpack kompatybilne z Webpack 5.102+
- Zero deprecated loaders po tej fazie

---

## 📋 PAKIETY DO AKTUALIZACJI

### Webpack Core

```bash
webpack: 5.94.0 → 5.102.1
webpack-cli: 4.9.2 → 6.0.1 ⚠️ (MAJOR - może zmienić CLI args)
```

### Webpack Middleware (dla dev servera)

```bash
webpack-dev-middleware: 5.3.4 → 7.4.2 ⚠️ (MAJOR)
webpack-hot-middleware: 2.25.4 → 2.26.1
```

### Webpack Plugins

```bash
mini-css-extract-plugin: 2.5.3 → 2.9.4
copy-webpack-plugin: 10.2.4 → 10.2.4 ✓ (już aktualne)
fork-ts-checker-webpack-plugin: 7.2.13 → 9.1.0 ⚠️ (MAJOR - będzie w FAZA1 lub tutaj)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
# Upewnij się że jesteś na main i masz najnowsze zmiany
git checkout main
git pull origin main

# Merge poprzedniej fazy jeśli jeszcze nie
# git merge update/typescript-toolchain-vue-ecosystem

# Stwórz nowy branch dla tej fazy
git checkout -b update/webpack-chain

# Sprawdź obecny stan
yarn build
```

### Krok 2: Backup Webpack Config

```bash
# Skopiuj obecną konfigurację na wszelki wypadek
cp webpack.config.js webpack.config.js.backup
# (Ten plik NIE idzie do git)
```

### Krok 3: Aktualizacja Webpack Core

```bash
# Aktualizuj Webpack i Webpack CLI
yarn add -D webpack@5.102.1 webpack-cli@6.0.1

# Test czy webpack CLI działa
yarn webpack --version
```

**Checklist Webpack Core:**
- [ ] Webpack 5.102.1 zainstalowany
- [ ] Webpack CLI 6.0.1 zainstalowany
- [ ] `yarn webpack --version` pokazuje 5.102.1
- [ ] `yarn webpack --help` działa (sprawdź czy format się nie zmienił)
- [ ] Commit: `chore(deps): update webpack to 5.102.1 and webpack-cli to 6.0.1`

### Krok 4: Aktualizacja Fork TS Checker (jeśli nie było w FAZA1)

```bash
# Aktualizuj fork-ts-checker-webpack-plugin
yarn add -D fork-ts-checker-webpack-plugin@9.1.0
```

**Checklist Fork TS Checker:**
- [ ] fork-ts-checker-webpack-plugin 9.1.0 zainstalowany
- [ ] Sprawdź czy config w webpack.config.js jest kompatybilny
- [ ] Możliwe że trzeba zaktualizować opcje pluginu - sprawdź docs
- [ ] Commit: `chore(deps): update fork-ts-checker-webpack-plugin to 9.1.0`

### Krok 5: Aktualizacja Mini CSS Extract Plugin

```bash
# Aktualizuj mini-css-extract-plugin
yarn add -D mini-css-extract-plugin@2.9.4
```

**Checklist Mini CSS Extract:**
- [ ] mini-css-extract-plugin 2.9.4 zainstalowany
- [ ] Plugin config w webpack.config.js nie wymaga zmian
- [ ] Commit: `chore(deps): update mini-css-extract-plugin to 2.9.4`

### Krok 6: Production Build Test

```bash
# Test production build
yarn build

# Sprawdź output
ls -lh public/js/
ls -lh public/css/
```

**Checklist Production Build:**
- [ ] `yarn build` przechodzi bez błędów
- [ ] Bundle size nie wzrósł drastycznie (sprawdź public/js/)
  - Zapisz wielkość: `du -sh public/js` → _____ MB
- [ ] CSS files się generują poprawnie
  - Zapisz wielkość: `du -sh public/css` → _____ MB
- [ ] Source maps się generują (sprawdź czy są pliki .map)
- [ ] Brak webpack warnings w output
- [ ] Sprawdź webpack stats - czy optimizations działają

### Krok 7: Aktualizacja Dev Middleware

```bash
# Aktualizuj webpack middleware
yarn add -D webpack-dev-middleware@7.4.2 webpack-hot-middleware@2.26.1
```

**Checklist Dev Middleware:**
- [ ] webpack-dev-middleware 7.4.2 zainstalowany
- [ ] webpack-hot-middleware 2.26.1 zainstalowany
- [ ] Sprawdź czy server/index.ts używa middleware poprawnie
- [ ] Możliwe że API się zmieniło - sprawdź migration guide
- [ ] Commit: `chore(deps): update webpack middleware to latest`

### Krok 8: Dev Server Test

```bash
# Uruchom dev server
yarn dev

# W innym terminalu - testuj HMR:
# 1. Otwórz http://localhost:9000 w przeglądarce
# 2. Zmień jakiś plik .vue
# 3. Sprawdź czy HMR zadziałał (bez pełnego reload)
```

**Checklist Dev Server:**
- [ ] `yarn dev` startuje bez błędów
- [ ] Server nasłuchuje na porcie 9000
- [ ] Aplikacja ładuje się w przeglądarce
- [ ] Hot Module Replacement (HMR) działa
  - [ ] Zmiana pliku .vue → hot reload
  - [ ] Zmiana pliku .css → hot reload
  - [ ] Zmiana pliku .ts → full reload (to OK)
- [ ] Brak błędów w konsoli przeglądarki
- [ ] Brak błędów w konsoli servera
- [ ] WebSocket connection działa (sprawdź DevTools → Network → WS)

### Krok 9: Watch Mode Test

```bash
# Test watch mode
yarn watch

# W innym terminalu:
# 1. Zmień jakiś plik server/*.ts
# 2. Sprawdź czy webpack rebuilduję
# 3. Sprawdź timing rebuildu

# Ctrl+C żeby zatrzymać watch
```

**Checklist Watch Mode:**
- [ ] `yarn watch` startuje bez błędów
- [ ] Webpack rebuilduję na zmianę plików
- [ ] Rebuild time rozsądny (<5s dla małych zmian)
- [ ] Brak memory leaks (sprawdź `ps aux | grep node` po kilku rebuildach)
- [ ] Incremental compilation działa (drugi build szybszy niż pierwszy)

### Krok 10: Config Validation

```bash
# Sprawdź czy webpack config się type-checkuje
yarn tsc --noEmit webpack.config.js

# Albo jeśli to nie działa, sprawdź imports
node -e "require('./webpack.config.js')"
```

**Checklist Config:**
- [ ] webpack.config.js jest poprawny JavaScript/TypeScript
- [ ] Wszystkie importy działają
- [ ] Żadne deprecated opcje nie są używane
- [ ] Config jest czytelny i dobrze sformatowany

### Krok 11: Full Test Suite

```bash
# Uruchom pełny test suite
yarn test
```

**Checklist Testy:**
- [ ] Wszystkie testy przechodzą
- [ ] Webpack builduję przed testami
- [ ] Test coverage działa (jeśli używane)
- [ ] Brak nowych failur

### Krok 12: Bundle Analysis (opcjonalne, ale zalecane)

```bash
# Dodaj webpack-bundle-analyzer tymczasowo
yarn add -D webpack-bundle-analyzer

# Dodaj do webpack.config.js (development mode):
# const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
# plugins: [..., new BundleAnalyzerPlugin()]

# Build i otwórz raport
yarn build
# Powinno otworzyć przeglądarkę z wizualizacją bundle

# Usuń analyzer przed commitem
yarn remove webpack-bundle-analyzer
# Cofnij zmiany w webpack.config.js
```

**Checklist Bundle Analysis:**
- [ ] Bundle size rozsądny
- [ ] Brak duplikatów bibliotek
- [ ] Vendor chunks properly split
- [ ] No huge dependencies that could be lazy loaded
- [ ] Tree shaking działa (sprawdź czy unused exports są wyrzucone)

---

## 🚀 PUSH I REVIEW

```bash
# Push branch do remote
git push -u origin update/webpack-chain

# Sprawdź diff na GitHub
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Wszystkie commity mają sensowne messages
- [ ] package.json zaktualizowany poprawnie
- [ ] yarn.lock zaktualizowany
- [ ] webpack.config.js.backup NIE jest w repo
- [ ] Brak przypadkowych zmian w kodzie
- [ ] Napisz do Claude: "Faza 2 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ Webpack 5.102.1 zainstalowany i działający
✅ Webpack CLI 6.0.1 działa
✅ Production build przechodzi bez błędów
✅ Dev server działa z HMR
✅ Watch mode działa
✅ Bundle size nie wzrósł znacząco (+/- 5% OK)
✅ Wszystkie testy przechodzą

### Nice to Have (OPCJONALNE):
⭐ Build time krótszy
⭐ Bundle size mniejszy (dzięki lepszym optimizations)
⭐ HMR szybszy
⭐ Brak warnings w build output

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: Webpack CLI 6 zmienił argumenty

**Symptom:** `Unknown option '--some-option'`

**Rozwiązanie:**
1. Sprawdź migration guide: https://github.com/webpack/webpack-cli/releases/tag/v6.0.0
2. Zaktualizuj package.json scripts jeśli używają deprecated flags
3. Przykład: `--mode production` może się zmienić na `--node-env production`

### Problem: webpack-dev-middleware 7 API changes

**Symptom:** `TypeError: devMiddleware is not a function`

**Rozwiązanie:**
1. Sprawdź docs: https://github.com/webpack/webpack-dev-middleware
2. API mogło się zmienić z v5 na v7
3. Przykład fix w server/index.ts:
   ```typescript
   // OLD (v5):
   app.use(devMiddleware(compiler, { /* options */ }))

   // NEW (v7):
   app.use(devMiddleware(compiler, { /* different options */ }))
   ```

### Problem: HMR nie działa po aktualizacji

**Symptom:** Strona robi full reload zamiast hot reload

**Rozwiązanie:**
1. Sprawdź czy webpack-hot-middleware jest poprawnie podłączony
2. Sprawdź webpack.config.js - czy HMR plugins są włączone
3. Sprawdź console - czy WebSocket connection działa
4. Sprawdź czy client ma `webpack-hot-middleware/client` w entry points

### Problem: Bundle size drastycznie wzrósł

**Symptom:** public/js/bundle.js jest 2x większy

**Rozwiązanie:**
1. Sprawdź webpack stats: `yarn webpack --profile --json > stats.json`
2. Użyj webpack-bundle-analyzer do analizy
3. Sprawdź czy minification działa (production mode)
4. Sprawdź czy tree shaking nie został wyłączony

### Problem: Source maps nie działają

**Symptom:** Błędy w konsoli pokazują zminifikowany kod

**Rozwiązanie:**
1. Sprawdź webpack.config.js: `devtool: 'source-map'`
2. Upewnij się że .map pliki są generowane
3. Sprawdź czy server serwuje .map files
4. W dev mode użyj `devtool: 'eval-source-map'` (szybsze)

---

## 📝 NOTATKI I PROBLEMY

_(Zapisuj tutaj wszystkie problemy napotkane podczas implementacji)_

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Metryki:**
- Bundle size przed: _____ MB
- Bundle size po: _____ MB
- Build time przed: _____ s
- Build time po: _____ s

---

## ✅ SIGN-OFF

Po zakończeniu fazy:

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Testy przechodzą
- [ ] Production build działa
- [ ] Dev server działa z HMR
- [ ] Watch mode działa
- [ ] Bundle size OK
- [ ] **Napisane do Claude:** "Faza 2 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**Poprzednia faza:** FAZA 1 - TypeScript Toolchain + Vue Ecosystem
**Następna faza:** FAZA 3 - CSS Pipeline
