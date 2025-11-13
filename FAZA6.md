# FAZA 6: ESLint Ecosystem (NAJTRUDNIEJSZA!)

**Branch:** `update/eslint-v9`
**Ryzyko:** 🔴 BARDZO WYSOKIE (największy breaking change!)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Migracja do ESLint 9 z kompletnie nowym systemem konfiguracji (Flat Config). To NAJWIĘKSZA zmiana w całym planie - ESLint 9 wyrzucił starą konfigurację `.eslintrc` i wymaga nowego formatu `eslint.config.js`.

### Co aktualizujemy?

1. **ESLint** - linter (8.57.0 → 9.39.1) **MAJOR UPDATE z BREAKING CHANGES**
2. **@typescript-eslint*** - TypeScript support (7.8.0 → 8.46.4) **MAJOR UPDATE**
3. **eslint-plugin-vue** - Vue linting (9.25.0 → 9.33.0)
4. **Migracja konfiguracji** - `.eslintrc.cjs` → `eslint.config.js` (FLAT CONFIG)

### Dlaczego to najtrudniejsze?

- ESLint 9 zmienia CAŁKOWICIE system konfiguracji
- Flat config ma kompletnie inną składnię
- Wszystkie pluginy muszą być kompatybilne
- Może wykryć SETKI nowych błędów w kodzie
- @typescript-eslint 8 też ma breaking changes


---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `eslint-disable` dla całych plików "żeby przeszło"
- Żadnych obniżania rule severity (error → warn → off)
- Żadnych "temporary disable rules" - naprawiamy kod!
- Jeśli rule ma 100+ errors - NAPRAWIAMY wszystkie 100+

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- ESLint 9.39.1 - najnowsza stabilna
- Flat config - nowy standard (nie legacy)
- @typescript-eslint 8.46.4 - najnowsza
- Wszystkie ESLint plugins kompatybilne z v9
- Zero lint errors po ukończeniu fazy

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
# Core ESLint
eslint: 8.57.0 → 9.39.1 ⚠️ (MAJOR - BREAKING!)

# TypeScript Support
@typescript-eslint/eslint-plugin: 7.8.0 → 8.46.4 ⚠️ (MAJOR)
@typescript-eslint/parser: 7.8.0 → 8.46.4 ⚠️ (MAJOR)

# Vue Support
eslint-plugin-vue: 9.25.0 → 9.33.0
vue-eslint-parser: 9.4.3 → 9.4.3 ✓ (sprawdź ESLint 9 compat)

# Config
eslint-config-prettier: 10.0.3 → 10.0.3 ✓ (już updated w FAZA 5)
eslint-define-config: 2.1.0 → USUŃ (deprecated w flat config)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie i Backup

```bash
git checkout main
git pull origin main
git checkout -b update/eslint-v9

# BACKUP obecnej konfiguracji
cp .eslintrc.cjs .eslintrc.cjs.backup
cp .eslintignore .eslintignore.backup
# (Te pliki NIE idą do git)

# Sprawdź obecny stan
yarn lint:eslint
```

### Krok 2: Research Phase (WAŻNE - NIE SKIP!)

⚠️ **PRZECZYTAJ PRZED KONTYNUACJĄ:**

```bash
# Otwórz te linki w przeglądarce i PRZECZYTAJ:
# 1. ESLint 9 Migration Guide:
#    https://eslint.org/docs/latest/use/migrate-to-9.0.0

# 2. typescript-eslint v8 Release Notes:
#    https://typescript-eslint.io/blog/announcing-typescript-eslint-v8

# 3. Flat Config Guide:
#    https://eslint.org/docs/latest/use/configure/configuration-files

# 4. Flat Config Migration Tool:
#    https://eslint.org/docs/latest/use/configure/migration-guide
```

**Checklist Research:**
- [ ] Przeczytany ESLint 9 migration guide
- [ ] Przeczytany @typescript-eslint v8 release notes
- [ ] Przeczytany flat config guide
- [ ] Zrozumiane główne breaking changes
- [ ] Notatki sporządzone

### Krok 3: Instalacja Pakietów

```bash
# Zainstaluj nowe wersje
yarn add -D eslint@9.39.1 \
  @typescript-eslint/eslint-plugin@8.46.4 \
  @typescript-eslint/parser@8.46.4 \
  eslint-plugin-vue@9.33.0

# Usuń deprecated pakiety
yarn remove eslint-define-config
```

**Checklist Instalacja:**
- [ ] ESLint 9.39.1 zainstalowany
- [ ] @typescript-eslint 8.46.4 zainstalowany (oba pakiety)
- [ ] eslint-plugin-vue 9.33.0 zainstalowany
- [ ] eslint-define-config usunięty
- [ ] `yarn eslint --version` pokazuje 9.39.1
- [ ] Commit: `chore(deps): update ESLint to 9.39.1 and typescript-eslint to 8.46.4`

### Krok 4: Stworzenie Flat Config

⚠️ **TO NAJWAŻNIEJSZY KROK - ROBIMY RĘCZNIE**

Stwórz nowy plik `eslint.config.js` w root:

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  // JavaScript recommended
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Migrate your rules from .eslintrc.cjs here
      // Start with typescript-eslint recommended:
      ...tseslint.configs.recommended.rules,

      // Add your custom rules here
      // TODO: Copy rules from .eslintrc.cjs.backup
    },
  },

  // Vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...vuePlugin.configs['vue3-recommended'].rules,

      // Add your custom Vue rules here
      // TODO: Copy rules from .eslintrc.cjs.backup
    },
  },

  // Prettier (must be last!)
  prettierConfig,

  // Ignores (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      'coverage/**',
      '*.min.js',
      // Add other ignores from .eslintignore.backup
    ],
  },
];
```

**Checklist Flat Config:**
- [ ] `eslint.config.js` utworzony
- [ ] Import statements działają (ESM syntax)
- [ ] TypeScript files config OK
- [ ] Vue files config OK
- [ ] Ignores config OK
- [ ] Prettier config na końcu
- [ ] Rules przeportowane z .eslintrc.cjs
- [ ] Config się ładuje: `yarn eslint --print-config server/index.ts`

### Krok 5: Usuń Stare Pliki Config

```bash
# Usuń stare pliki (ale ZACHOWAJ .backup!)
git rm .eslintrc.cjs
git rm .eslintignore

# Commit
git add eslint.config.js
git commit -m "refactor(config): migrate to ESLint 9 flat config"
```

**Checklist Cleanup:**
- [ ] `.eslintrc.cjs` usunięty z git
- [ ] `.eslintignore` usunięty z git
- [ ] `.backup` pliki zachowane lokalnie (NIE w git)
- [ ] `eslint.config.js` w git
- [ ] Commit done

### Krok 6: First Lint Run (przygotuj się na DUŻO błędów)

```bash
# Uruchom linter
yarn lint:eslint 2>&1 | tee eslint-output.txt

# Sprawdź ile błędów
grep "error" eslint-output.txt | wc -l
grep "warning" eslint-output.txt | wc -l
```

**Checklist First Run:**
- [ ] ESLint się uruchomił (no config errors)
- [ ] Liczba errors policz: _____ errors
- [ ] Liczba warnings policzona: _____ warnings
- [ ] Output zapisany do eslint-output.txt
- [ ] Przeanalizowane TOP 5 najczęstszych errors

### Krok 7: Fix Configuration Errors (najpierw)

Jeśli są błędy **konfiguracji** (nie kodu):

```bash
# Przykłady błędów konfiguracji:
# - "Unknown rule '@typescript-eslint/xyz'"
# - "Parser error"
# - "Plugin not found"

# Fix w eslint.config.js i re-run
yarn lint:eslint
```

**Checklist Config Errors:**
- [ ] Wszystkie configuration errors naprawione
- [ ] ESLint parsuję wszystkie pliki
- [ ] Tylko code errors pozostają
- [ ] Commit: `fix(eslint): resolve flat config issues`

### Krok 8: Fix Code Errors (DŁUGIE!)

⚠️ **TO ZAJMIE 4-8 GODZIN**

Strategy:
1. **Auto-fix co się da:**
   ```bash
   yarn eslint --fix "**/*.{ts,js,vue}"
   ```

2. **Napraw najczęstsze errors (top 3-5 types):**
   ```bash
   # Znajdź najczęstsze
   grep "error" eslint-output.txt | sort | uniq -c | sort -rn | head -10

   # Przykład: jeśli "@typescript-eslint/no-explicit-any" jest top error
   # Znajdź wszystkie i fix batch'ami
   yarn eslint --format=compact | grep "no-explicit-any"
   ```

3. **Napraw plik po pliku:**
   ```bash
   # Fix server files
   yarn eslint server/**/*.ts --fix

   # Fix client files
   yarn eslint client/**/*.{ts,vue} --fix

   # Fix test files
   yarn eslint test/**/*.ts --fix
   ```

**Checklist Code Fixes:**
- [ ] Auto-fix wykonany (`--fix`)
- [ ] Top 5 error types naprawione
- [ ] Server files lint-clean
- [ ] Client files lint-clean
- [ ] Test files lint-clean
- [ ] Config files (webpack.config.js etc.) lint-clean
- [ ] `yarn lint:eslint` → **ZERO ERRORS**
- [ ] Commits: Wiele small commits podczas fixowania (np. `fix(lint): resolve no-explicit-any errors in server/`)

### Krok 9: Handle Warnings (optional but recommended)

```bash
# Sprawdź warnings
yarn lint:eslint --max-warnings=0

# Jeśli są - rozważ naprawienie lub disable specific ones
```

**Checklist Warnings:**
- [ ] Warnings policzone: _____ warnings
- [ ] Krityczne warnings naprawione
- [ ] Decyzja: Fix all vs. allow some warnings
- [ ] Jeśli allowed - dodaj `--max-warnings=N` do package.json script

### Krok 10: Test Build & Tests

```bash
# Full build
yarn build

# Full test suite
yarn test

# Lint + build + test
yarn lint && yarn build && yarn test
```

**Checklist Full Test:**
- [ ] `yarn build` przechodzi
- [ ] `yarn test` przechodzi (wszystkie testy)
- [ ] `yarn lint` przechodzi (zero errors)
- [ ] Aplikacja działa (manual test)
- [ ] Dev server działa
- [ ] Production build działa

### Krok 11: Update package.json Scripts (jeśli potrzebne)

Sprawdź czy package.json scripts używają deprecated ESLint flags:

```json
{
  "scripts": {
    "lint:eslint": "eslint . --report-unused-disable-directives --color"
  }
}
```

**Checklist Scripts:**
- [ ] package.json scripts checked
- [ ] Deprecated flags usunięte (jeśli były)
- [ ] `yarn lint:eslint` działa z nowego script
- [ ] Commit: `chore(config): update ESLint scripts for v9` (jeśli były zmiany)

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin update/eslint-v9
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Wiele small commits (nie jeden gigantyczny)
- [ ] Flat config w repo
- [ ] Stare pliki usunięte
- [ ] **ZERO** ESLint errors
- [ ] Build działa
- [ ] Tests pass
- [ ] **Napisane do Claude:** "Faza 6 done, review please (najtrudniejsza!)"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ ESLint 9.39.1 zainstalowany
✅ Flat config (`eslint.config.js`) działa
✅ @typescript-eslint 8.46.4 działa
✅ **ZERO ESLint errors** (yarn lint:eslint → clean)
✅ Build działa
✅ Tests pass
✅ Stara config usunięta

### Nice to Have (OPCJONALNE):
⭐ Zero warnings też
⭐ Lint time krótszy (ESLint 9 benefit)
⭐ Lepszy code quality (dzięki new rules)

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: 500+ ESLint errors po migracji

**Symptom:** ESLint pokazuje setki errors

**Rozwiązanie:**
1. To NORMALNE - ESLint 9 jest strict
2. Użyj `--fix` najpierw (auto-fix 60-80%)
3. Reszta - fix batch'ami (grupa similar errors)
4. Możesz commitować fixes incremental (wiele commitów OK)
5. NIE obniżaj severity rules - napraw kod!

### Problem: Flat config import errors

**Symptom:** `Cannot use import statement outside a module`

**Rozwiązanie:**
1. `eslint.config.js` używa ESM syntax
2. Dodaj `"type": "module"` do package.json (jeśli nie ESM project)
3. LUB użyj `eslint.config.mjs` (force ESM)
4. LUB użyj dynamic import w CommonJS project

### Problem: @typescript-eslint/parser errors

**Symptom:** `Parsing error: Cannot read file 'tsconfig.json'`

**Rozwiązanie:**
1. Sprawdź path do tsconfig.json w config
2. Upewnij się że `parserOptions.project` jest poprawny
3. Możliwe że potrzebujesz multiple configs dla different tsconfigs
4. Sprawdź docs: https://typescript-eslint.io/getting-started/

### Problem: Plugin compatibility issues

**Symptom:** `Plugin "xyz" is not compatible with ESLint 9`

**Rozwiązanie:**
1. Sprawdź czy plugin ma wersję dla ESLint 9
2. Update plugin do najnowszej: `yarn add -D eslint-plugin-xyz@latest`
3. Jeśli nie ma ESLint 9 support - znajdź alternatywę lub usuń
4. Check plugin issues on GitHub

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Stats:**
- ESLint errors przed fixami: _____ errors
- ESLint errors po fixach: _____ errors (should be 0!)
- Time spent: _____ hours
- Files modified: _____ files

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] **ZERO** ESLint errors
- [ ] Build działa
- [ ] Tests pass
- [ ] Flat config working
- [ ] **Napisane do Claude:** "Faza 6 done, review please - najtrudniejsza faza ukończona!"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Czas trwania:** _____ days
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**⚠️ GRATULACJE!** Po ukończeniu tej fazy najgorsza część jest za Tobą! 🎉

**Poprzednia faza:** FAZA 5 - Code Formatting
**Następna faza:** FAZA 7 - Express Framework
