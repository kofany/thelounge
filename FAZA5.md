# FAZA 5: Code Formatting (Prettier)

**Branch:** `update/prettier`
**Szacowany czas:** 2-3 godziny
**Ryzyko:** 🟡 ŚREDNIE (może zmienić formatowanie całego kodu)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Zaktualizowanie Prettier (code formatter) do wersji 3.x. Prettier automatycznie formatuje kod (JS, TS, CSS, Vue) - update może zmienić formatowanie tysięcy linii, ale da nam najnowsze features i bugfixy.

### Co aktualizujemy?

1. **Prettier** - główny formatter (2.5.1 → 3.6.2) **MAJOR UPDATE**
2. **eslint-config-prettier** - wyłącza ESLint rules konfliktujące z Prettier
3. **pretty-quick** - hook do formatowania na pre-commit

### Dlaczego to ważne?

- Prettier 3 jest szybszy (~30% faster)
- Lepsze formatowanie dla modern JavaScript/TypeScript
- Wymagane dla innych toolów (niektóre wymagają Prettier 3)
- Konsystentny code style w całym projekcie

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `.prettierignore` dla całych folderów "bo się nie formatuje"
- Żadnych wyłączania formatowania dla plików
- Żadnych custom rules typu `printWidth: 10000` żeby nic się nie zmieniło
- Jeśli Prettier zmienia formatowanie - TO DOBRZE, to jest cel

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- Prettier 3.6.2 - najnowsza stabilna
- eslint-config-prettier 10.x - kompatybilny z Prettier 3
- pretty-quick 4.x - kompatybilny z Prettier 3
- Wszystkie pliki sformatowane według nowych reguł

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
prettier: 2.5.1 → 3.6.2 ⚠️ (MAJOR)
eslint-config-prettier: 9.1.0 → 10.0.3 ⚠️ (MAJOR)
pretty-quick: 3.1.3 → 4.0.0 ⚠️ (MAJOR)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
git checkout main
git pull origin main
git checkout -b update/prettier

# Sprawdź obecne formatowanie
yarn prettier --check "**/*.*" | head -20
```

### Krok 2: Aktualizacja Prettier

```bash
yarn add -D prettier@3.6.2
```

**Checklist Prettier Core:**
- [ ] Prettier 3.6.2 zainstalowany
- [ ] `yarn prettier --version` pokazuje 3.6.2
- [ ] Commit: `chore(deps): update prettier to 3.6.2`

### Krok 3: Preview Changes (WAŻNE!)

```bash
# Sprawdź CO DOKŁADNIE Prettier zmieni
yarn prettier --check "**/*.*" > prettier-changes.txt

# Przejrzyj plik
less prettier-changes.txt

# Alternatywnie sprawdź konkretne foldery
yarn prettier --check "client/**/*.{js,ts,vue}"
yarn prettier --check "server/**/*.ts"
```

**Checklist Preview:**
- [ ] Przejrzane prettier-changes.txt
- [ ] Zrozumiane jakie zmiany będą
- [ ] Większość zmian to trailing spaces, końce linii, etc.
- [ ] Brak drastycznych zmian (jeśli są - sprawdź config)

### Krok 4: DECYZJA - Formatowanie

⚠️ **WAŻNA DECYZJA:**

**Opcja A: Reformat wszystkiego NOW (zalecane)**
- Pros: Clean cut, wszystko sformatowane teraz
- Cons: Ogromny diff (trudniejsze review)

**Opcja B: Stopniowe formatowanie**
- Pros: Małe diffy, łatwiejsze review
- Cons: Niespójny styl przez jakiś czas

**Rekomendacja:** Opcja A (reformat wszystkiego) → łatwiejsze

```bash
# Jeśli wybrałeś Opcję A:
yarn format:prettier

# Sprawdź diff
git diff --stat
```

**Checklist Formatowania:**
- [ ] Decyzja podjęta (A lub B)
- [ ] Jeśli A: `yarn format:prettier` wykonane
- [ ] Jeśli A: git diff sprawdzony (should be HUGE but clean)
- [ ] Jeśli B: plan stopniowego formatowania ustalony
- [ ] Commit: `style: reformat code with prettier 3.6.2` (jeśli A)

### Krok 5: Aktualizacja ESLint Config

```bash
yarn add -D eslint-config-prettier@10.0.3

# Sprawdź czy nadal działa z ESLint
yarn lint:check-eslint
```

**Checklist ESLint Config:**
- [ ] eslint-config-prettier 10.0.3 zainstalowany
- [ ] `yarn lint:check-eslint` przechodzi
- [ ] Brak konfliktów między ESLint a Prettier
- [ ] Commit: `chore(deps): update eslint-config-prettier to 10.0.3`

### Krok 6: Aktualizacja Pretty Quick

```bash
yarn add -D pretty-quick@4.0.0

# Test czy działa
yarn pretty-quick --staged
```

**Checklist Pretty Quick:**
- [ ] pretty-quick 4.0.0 zainstalowany
- [ ] `yarn pretty-quick --staged` działa
- [ ] Git hooks działają (jeśli używane)
- [ ] Commit: `chore(deps): update pretty-quick to 4.0.0`

### Krok 7: Verification

```bash
# Sprawdź czy wszystko jest sformatowane
yarn prettier --check "**/*.*"

# Sprawdź czy kod się kompiluje
yarn build

# Sprawdź czy testy działają
yarn test
```

**Checklist Verification:**
- [ ] `yarn prettier --check` → zero plików do formatowania
- [ ] `yarn build` przechodzi
- [ ] `yarn test` przechodzi
- [ ] Kod działa identycznie (tylko formatowanie zmienione)
- [ ] Brak syntactic errors wprowadzonych przez formatter

### Krok 8: Manual Code Review

```bash
# Sprawdź kilka plików ręcznie
git diff client/index.html.tpl
git diff server/index.ts
git diff webpack.config.js
```

**Checklist Manual Review:**
- [ ] Formatting changes są sensowne
- [ ] Brak zmian w logice (only whitespace/formatting)
- [ ] Strings nie zostały zepsute
- [ ] Regex patterns OK
- [ ] Comments są czytelne

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin update/prettier
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Jeśli Opcja A: Jeden duży commit z reformatowaniem (to OK!)
- [ ] Jeśli Opcja B: Plan jasno opisany
- [ ] Build działa
- [ ] Tests pass
- [ ] **Napisane do Claude:** "Faza 5 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ Prettier 3.6.2 zainstalowany i działający
✅ eslint-config-prettier 10.x kompatybilny
✅ `yarn prettier --check` przechodzi (wszystko sformatowane)
✅ Build działa
✅ Tests pass
✅ Kod działa identycznie

### Nice to Have (OPCJONALNE):
⭐ Całość sformatowana w jednym commicie (clean diff)
⭐ Git hooks działają (auto-format on commit)
⭐ Faster formatting time (Prettier 3 benefit)

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: Prettier 3 łamie składnię

**Symptom:** Kod się nie kompiluje po formatowaniu

**Rozwiązanie:**
1. To NIE POWINNO SIĘ ZDARZYĆ - Prettier jest syntax-aware
2. Sprawdź czy .prettierrc jest poprawny
3. Sprawdź czy Prettier parsuje plik poprawnie: `yarn prettier --debug-check file.ts`
4. Jeśli problem persystuje - bug w Prettier, dodaj do .prettierignore TEMPORARY

### Problem: Ogromny diff (10k+ linii)

**Symptom:** git diff pokazuje tysiące zmian

**Rozwiązanie:**
1. To NORMALNE dla Prettier update
2. Sprawdź czy to tylko whitespace: `git diff -w` (ignore whitespace)
3. Review logic changes (jeśli są) dokładnie
4. Commit z jasnym message: "style: reformat code with prettier 3"

### Problem: ESLint conflicts z Prettier

**Symptom:** ESLint failuje na kodzie sformatowanym przez Prettier

**Rozwiązanie:**
1. Sprawdź czy eslint-config-prettier jest w .eslintrc
2. Musi być OSTATNI w extends array
3. Run: `yarn lint:check-eslint` - pokaże konflikty
4. Fix config, nie formatowanie

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Stats:**
- Files reformatted: _____ files
- Lines changed: _____ lines
- Build time before: _____ s
- Build time after: _____ s

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Wszystko sformatowane
- [ ] Build działa
- [ ] Tests pass
- [ ] **Napisane do Claude:** "Faza 5 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**Poprzednia faza:** FAZA 4 - Testing Framework
**Następna faza:** FAZA 6 - ESLint Ecosystem (NAJTRUDNIEJSZA!)
