# FAZA 4: Testing Framework

**Branch:** `update/testing-framework`
**Ryzyko:** 🟡 ŚREDNIE (Chai major może łamać assercje)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Zaktualizowanie całego frameworku testowego - Mocha (test runner), Chai (assertions), Sinon (mocks/stubs). Testing framework jest krytyczny dla jakości kodu - musimy mieć pewność że testy działają poprawnie.

### Co aktualizujemy?

1. **Mocha** - test runner (9.2.2 → 11.7.5) **MAJOR UPDATE**
2. **Chai** - assertion library (4.3.7 → 6.2.1) **MAJOR UPDATE** ⚠️ MOŻE ŁAMAĆ!
3. **Sinon** - mocking library (13.0.2 → 21.0.0) **MAJOR UPDATE**
4. **@types/*** - TypeScript definitions dla wszystkich powyższych

### Dlaczego to ważne?

- Mocha 11 ma lepsze performance i async handling
- Chai 6 ma nową assertion syntax (ale może łamać starą!)
- Sinon 21 ma lepsze TypeScript support
- Nowoczesne testy = lepsze wykrywanie bugów

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych skip'owania failujących testów
- Żadnych `@ts-ignore` w testach
- Żadnych obniżania code coverage "żeby przeszło"
- Jeśli Chai 6 łamie testy - naprawiamy assertions, nie rollback

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- Mocha 11.7.5 - najnowsza przed v12 (która wymaga Node 20.19+)
- Chai 6.2.1 - najnowsza major z breaking changes
- Sinon 21.0.0 - najnowsza stabilna
- Wszystkie @types/* matching runtime versions

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
# Test Runners & Assertions
mocha: 9.2.2 → 11.7.5 ⚠️ (MAJOR)
chai: 4.3.7 → 6.2.1 ⚠️ (MAJOR - BREAKING!)
sinon: 13.0.2 → 21.0.0 ⚠️ (MAJOR)
ts-sinon: 2.0.2 → 2.0.2 ✓ (już aktualne)

# TypeScript Types
@types/mocha: 9.1.1 → 10.0.11 ⚠️ (MAJOR)
@types/chai: 4.3.5 → 5.2.3 ⚠️ (MAJOR - dla Chai 5+, może być 6.x dla Chai 6)

# Coverage Tools
nyc: 15.1.0 → 15.1.0 ✓ (już najnowsze w v15)
@istanbuljs/nyc-config-typescript: 1.0.2 → 1.0.2 ✓
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
git checkout main
git pull origin main
git checkout -b update/testing-framework

# Test obecnego stanu
yarn test:mocha
```

### Krok 2: Aktualizacja Mocha (bezpieczna)

```bash
yarn add -D mocha@11.7.5 @types/mocha@10.0.11

# Test czy testy działają
yarn test:mocha
```

**Checklist Mocha:**
- [ ] Mocha 11.7.5 zainstalowany
- [ ] @types/mocha 10.0.11 zainstalowany
- [ ] `yarn test:mocha` działa
- [ ] Wszystkie testy przechodzą (should be same as before)
- [ ] Test output jest czytelny
- [ ] Async tests działają poprawnie
- [ ] Commit: `chore(deps): update Mocha to 11.7.5`

### Krok 3: Aktualizacja Sinon

```bash
yarn add -D sinon@21.0.0

# Test czy mocks działają
yarn test:mocha
```

**Checklist Sinon:**
- [ ] Sinon 21.0.0 zainstalowany
- [ ] Wszystkie mocks/stubs/spies działają
- [ ] `yarn test:mocha` przechodzi
- [ ] TypeScript types dla sinon działają
- [ ] Sprawdź czy używamy deprecated Sinon APIs (migrate if needed)
- [ ] Commit: `chore(deps): update Sinon to 21.0.0`

### Krok 4: Aktualizacja Chai (RYZYKOWNE!)

⚠️ **UWAGA:** Chai 6 może łamać assertions. Testuj dokładnie!

```bash
# Najpierw sprawdź Chai 5 (mniej breaking)
yarn add -D chai@5.1.2 @types/chai@5.2.3
yarn test:mocha

# Jeśli działa, spróbuj Chai 6
yarn add -D chai@6.2.1 @types/chai@6.x.x  # Sprawdź najnowszy @types/chai dla v6
yarn test:mocha
```

**Checklist Chai:**
- [ ] Chai zaktualizowany (5.x lub 6.x)
- [ ] @types/chai matching version
- [ ] `yarn test:mocha` uruchamia się
- [ ] Sprawdź output - ile testów failuje?
  - **Jeśli 0 failures** → PERFECT! Commit and continue
  - **Jeśli < 10 failures** → Napraw i commit
  - **Jeśli > 10 failures** → Rozważ zostanie na Chai 4.x (dodaj komentarz dlaczego)

### Krok 5: Fix Chai Breaking Changes (jeśli potrzebne)

**Common Chai 6 breaking changes:**

1. `.to.be.a('function')` → może wymagać `.to.be.a.function`
2. `.to.have.property('x', value)` → składnia może się zmienić
3. Assertion chaining może działać inaczej

```bash
# Znajdź failing tests
yarn test:mocha 2>&1 | grep "failing"

# Napraw każdy test osobno (ZERO skip'owania!)
# ... editing test files ...

# Re-run po każdej poprawce
yarn test:mocha
```

**Checklist Chai Fixes:**
- [ ] Wszystkie failing tests zidentyfikowane
- [ ] Każdy failure naprawiony (PROPER FIX, no hacks)
- [ ] `yarn test:mocha` → 0 failures
- [ ] Assertions nadal testują to co powinny
- [ ] Code coverage nie spadł
- [ ] Commit: `test: fix chai 6 breaking changes in test assertions`

### Krok 6: Test Coverage Check

```bash
# Run coverage
yarn coverage

# Sprawdź raport
open coverage/index.html  # lub xdg-open na Linux
```

**Checklist Coverage:**
- [ ] Coverage percentage >= baseline (check previous coverage %)
- [ ] Wszystkie critical paths covered
- [ ] nyc raport generuje się poprawnie
- [ ] Brak uncovered critical code

### Krok 7: Full Test Suite

```bash
# Wszystkie testy z lintingiem
yarn test

# Build + tests
yarn build && yarn test
```

**Checklist Full Suite:**
- [ ] `yarn test` przechodzi (lint + tests)
- [ ] Wszystkie test suites pass
- [ ] Build działa przed testami
- [ ] Test artifacts cleanupują się

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin update/testing-framework
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Wszystkie testy przechodzą
- [ ] Żadne testy nie są skip'owane
- [ ] Coverage nie spadł
- [ ] Commit messages jasne
- [ ] **Napisane do Claude:** "Faza 4 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ Mocha 11.7.5 działa
✅ Chai updated (5.x minimum, 6.x preferred)
✅ Sinon 21.0.0 działa
✅ Wszystkie testy przechodzą (0 failures)
✅ Test coverage >= baseline
✅ Brak skip'owanychtestów

### Nice to Have (OPCJONALNE):
⭐ Chai 6.2.1 (latest)
⭐ Test execution time krótszy
⭐ Coverage wyższy niż baseline

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: Chai 6 łamie dużo testów

**Symptom:** 50+ failures po update do Chai 6

**Rozwiązanie:**
1. Zostań na Chai 5.x (bezpieczniejsze)
2. LUB napraw wszystkie failures (czasochłonne ale PROPER)
3. Dodaj komentarz w package.json dlaczego zostałeś na 5.x
4. Zaplanuj Chai 6 migration w przyszłości

### Problem: Sinon TypeScript types nie działają

**Symptom:** `Type 'SinonStub' is not assignable to...`

**Rozwiązanie:**
1. Użyj `ts-sinon` dla better types
2. Albo explicit type assertions: `stub as sinon.SinonStub<...>`
3. Sprawdź sinon docs - types mogły się zmienić

### Problem: Mocha async tests hang

**Symptom:** Tests timeout po update

**Rozwiązanie:**
1. Sprawdź czy używasz `done()` callback properly
2. Mocha 11 ma lepszy async handling - może wykrywać bugs które były ukryte
3. Sprawdź czy promises są properly returned/awaited

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Metryki:**
- Tests before: _____ passing
- Tests after: _____ passing
- Coverage before: _____ %
- Coverage after: _____ %
- Chai version used: _____ (4.x / 5.x / 6.x)

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] All tests pass
- [ ] Coverage OK
- [ ] Zero skipped tests
- [ ] **Napisane do Claude:** "Faza 4 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**⚠️ CHECKPOINT 1** - Po tej fazie cały build pipeline + testy powinny działać stabilnie

**Poprzednia faza:** FAZA 3 - CSS Pipeline
**Następna faza:** FAZA 5 - Code Formatting (Prettier)
