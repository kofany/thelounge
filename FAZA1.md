# FAZA 1: TypeScript Toolchain + Vue Ecosystem

**Branch:** `update/typescript-toolchain-vue-ecosystem`
**Szacowany czas:** 2-3 godziny
**Ryzyko:** 🟢 NISKIE
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Zaktualizowanie fundamentalnego toolchain TypeScript oraz całego ekosystemu Vue.js do najnowszych stabilnych wersji. Ta faza stanowi fundament dla wszystkich kolejnych aktualizacji - stabilny TypeScript i Vue są kluczowe dla powodzenia całego procesu modernizacji.

### Co aktualizujemy?

1. **TypeScript** - kompilator TypeScript do najnowszej wersji 5.9.3
2. **ts-node** - runtime TypeScript dla Node.js
3. **ts-loader** - webpack loader dla TypeScript
4. **Vue Ecosystem** - Vue 3, Vue Router, Vuex, Vue Loader i wszystkie powiązane pakiety

### Dlaczego zaczynamy od tego?

- TypeScript jest używany przez **wszystkie** inne narzędzia (ESLint, Webpack, testy)
- Vue jest sercem frontendu - musi być stabilne przed dalszymi zmianami
- Te pakiety są stosunkowo bezpieczne do aktualizacji (backward compatible)
- Dają solidną podstawę do testowania kolejnych faz

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `@ts-ignore` tylko po to, żeby zbudować projekt
- Żadnych temporary fixes "na później"
- Żadnych skipowania błędów kompilacji
- Jeśli coś nie działa - naprawiamy WŁAŚCIWIE, nie obchodzimy problemu

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- Używamy TYLKO najnowszych stabilnych wersji (nie beta, nie RC)
- Wszystkie pakiety @vue/* muszą być w tej samej wersji
- Wszystkie pakiety @types/* muszą pasować do wersji runtime
- Zero deprecated dependencies po tej fazie

---

## 📋 PAKIETY DO AKTUALIZACJI

### TypeScript Toolchain

```bash
typescript: 5.4.5 → 5.9.3
ts-node: 10.7.0 → 10.9.2
ts-loader: 9.3.0 → 9.5.4
```

### Vue Ecosystem

```bash
vue: 3.2.35 → 3.5.24
@vue/runtime-dom: 3.2.33 → 3.5.24
@vue/test-utils: 2.4.6 → 2.4.6 ✓ (już aktualne)
vue-router: 4.0.15 → 4.6.3
vuex: 4.0.2 → 4.1.0
vue-loader: 17.0.1 → 17.4.2
vue-eslint-parser: 9.4.3 → 9.4.3 ✓ (już aktualne)
```

### @types Packages

```bash
@types/node: 17.0.45 → 24.10.1 ⚠️ (MAJOR - może wymagać drobnych poprawek)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
# Upewnij się że jesteś na main i masz najnowsze zmiany
git checkout main
git pull origin main

# Stwórz nowy branch dla tej fazy
git checkout -b update/typescript-toolchain-vue-ecosystem

# Sprawdź obecny stan
yarn build
yarn test:mocha
```

### Krok 2: Aktualizacja TypeScript Toolchain

```bash
# Aktualizuj TypeScript i narzędzia
yarn add -D typescript@5.9.3 ts-node@10.9.2 ts-loader@9.5.4

# Sprawdź czy build działa
yarn build:server
```

**Checklist TypeScript:**
- [ ] TypeScript 5.9.3 zainstalowany
- [ ] `yarn build:server` przechodzi bez błędów
- [ ] Brak nowych TypeScript errors
- [ ] Sprawdź czy wszystkie tsconfig.json są kompatybilne
- [ ] Commit: `chore(deps): update TypeScript toolchain to latest (5.9.3)`

### Krok 3: Aktualizacja @types/node

```bash
# Aktualizuj @types/node
yarn add -D @types/node@24.10.1

# Sprawdź kompilację
yarn build
```

**Checklist @types/node:**
- [ ] @types/node 24.10.1 zainstalowany
- [ ] Sprawdź czy są nowe errory związane z Node.js types
- [ ] Jeśli są błędy - napraw je (ŻADNYCH @ts-ignore!)
- [ ] `yarn build` przechodzi bez błędów
- [ ] Commit: `chore(deps): update @types/node to 24.10.1`

### Krok 4: Aktualizacja Vue Ecosystem

```bash
# Aktualizuj wszystkie pakiety Vue
yarn add vue@3.5.24 vue-router@4.6.3 vuex@4.1.0
yarn add -D @vue/runtime-dom@3.5.24 vue-loader@17.4.2

# Sprawdź build klienta
yarn build:client
```

**Checklist Vue:**
- [ ] Vue 3.5.24 zainstalowany
- [ ] Vue Router 4.6.3 zainstalowany
- [ ] Vuex 4.1.0 zainstalowany
- [ ] Wszystkie @vue/* pakiety w wersji 3.5.24
- [ ] Vue Loader 17.4.2 zainstalowany
- [ ] `yarn build:client` tworzy bundle bez błędów
- [ ] Bundle size nie wzrósł drastycznie (sprawdź public/js/)
- [ ] Commit: `chore(deps): update Vue ecosystem to 3.5.24`

### Krok 5: Full Build Test

```bash
# Pełny build (server + client)
yarn build

# Sprawdź czy watch mode działa
yarn watch &
# Poczekaj 5 sekund i zabij proces
kill %1

# Sprawdź dev server
yarn dev &
# Testuj przez 30 sekund czy nie ma błędów w konsoli
# Ctrl+C żeby zabić
```

**Checklist Full Build:**
- [ ] `yarn build` (production build) działa bez błędów
- [ ] `yarn watch` (watch mode) startuje bez błędów
- [ ] `yarn dev` (dev server) startuje bez błędów
- [ ] Hot Module Replacement (HMR) działa w dev mode
- [ ] Brak deprecation warnings w konsoli
- [ ] Brak TypeScript errors w output

### Krok 6: Testy

```bash
# Uruchom wszystkie testy
yarn test:mocha

# Sprawdź linting
yarn lint:eslint
```

**Checklist Testy:**
- [ ] Wszystkie testy przechodzą (zero failures)
- [ ] Linting przechodzi (może być dużo warnings - to OK, naprawimy w późniejszych fazach)
- [ ] Brak nowych błędów TypeScript w testach
- [ ] Commit: `test: verify all tests pass after TypeScript/Vue updates`

### Krok 7: Yarn Lock Cleanup

```bash
# Usuń stare wpisy z yarn.lock jeśli są konflikty
yarn install --check-files

# Sprawdź czy yarn.lock jest czysty
git diff yarn.lock
```

**Checklist Yarn:**
- [ ] yarn.lock zaktualizowany poprawnie
- [ ] Brak konfliktów w yarn.lock
- [ ] `yarn install` przechodzi bez warnings
- [ ] Commit: `chore: update yarn.lock`

### Krok 8: Final Verification

```bash
# Pełna weryfikacja
yarn clean || echo "No clean script"
yarn install
yarn build
yarn test
```

**Checklist Final:**
- [ ] Clean install działa
- [ ] Build działa
- [ ] Testy przechodzą
- [ ] Dev server działa
- [ ] Brak błędów TypeScript
- [ ] Brak błędów Vue w runtime
- [ ] Bundle size rozsądny (sprawdź public/)

---

## 🚀 PUSH I REVIEW

```bash
# Push branch do remote
git push -u origin update/typescript-toolchain-vue-ecosystem

# Skopiuj URL do przeglądarki i sprawdź diff
# Upewnij się że wszystkie zmiany są zamierzone
```

**Checklist Push:**
- [ ] Branch wypushowany do remote
- [ ] Wszystkie commity mają sensowne messages
- [ ] package.json zawiera poprawne wersje
- [ ] yarn.lock zaktualizowany
- [ ] Brak przypadkowych zmian w kodzie (tylko dependencies)
- [ ] Napisz do Claude: "Faza 1 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ TypeScript 5.9.3 zainstalowany i działający
✅ Vue 3.5.24 zainstalowany i działający
✅ Wszystkie buildy przechodzą (client + server)
✅ Wszystkie testy przechodzą
✅ Dev server działa z HMR
✅ Zero błędów TypeScript
✅ Zero błędów runtime Vue

### Nice to Have (OPCJONALNE):
⭐ Bundle size mniejszy lub równy
⭐ Build time krótszy lub równy
⭐ Brak warnings (jeśli możliwe)

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: TypeScript errors po aktualizacji @types/node

**Symptom:** Błędy typu `Property 'foo' does not exist on type 'NodeJS.Process'`

**Rozwiązanie:**
1. Sprawdź czy używasz deprecated Node.js APIs
2. Zaktualizuj kod do nowych types (np. `process.env` → `process.env as Record<string, string>`)
3. **NIE** używaj `@ts-ignore` - napraw problem właściwie

### Problem: Vue template compilation errors

**Symptom:** `Failed to compile template` lub `Unknown custom element`

**Rozwiązanie:**
1. Sprawdź czy wszystkie Vue plugins są zarejestrowane
2. Upewnij się że vue-loader config jest poprawny
3. Sprawdź czy wszystkie komponenty są właściwie zaimportowane

### Problem: Module resolution errors

**Symptom:** `Cannot find module 'vue'` lub podobne

**Rozwiązanie:**
1. Usuń node_modules: `rm -rf node_modules`
2. Usuń yarn.lock: `rm yarn.lock`
3. Reinstall: `yarn install`
4. Rebuild: `yarn build`

---

## 📝 NOTATKI I PROBLEMY

_(Zapisuj tutaj wszystkie problemy napotkane podczas implementacji)_

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

---

## ✅ SIGN-OFF

Po zakończeniu fazy:

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Testy przechodzą
- [ ] Build działa
- [ ] Brak błędów TypeScript
- [ ] **Napisane do Claude:** "Faza 1 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**Następna faza:** FAZA 3 - Webpack Build Chain
