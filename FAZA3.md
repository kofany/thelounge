# FAZA 3: CSS Pipeline

**Branch:** `update/css-pipeline`
**Ryzyko:** 🟡 ŚREDNIE (multiple major updates)
**Status:** ⏳ DO WYKONANIA

---

## 🎯 CEL FAZY

Zaktualizowanie całego pipeline'u CSS - od preprocessingu (PostCSS), przez linting (Stylelint), aż po optymalizację (CSSNano). CSS pipeline odpowiada za transformacje, prefixowanie, linting i minifikację wszystkich stylów w aplikacji.

### Co aktualizujemy?

1. **PostCSS** - CSS preprocessor i transformation tool
2. **PostCSS Preset Env** - autoprefixer i modern CSS features
3. **PostCSS Loader** - webpack loader dla PostCSS
4. **PostCSS Import** - @import resolution
5. **Stylelint** - CSS linter
6. **CSSNano** - CSS minifier
7. **CSS Loader** - webpack CSS loader

### Dlaczego to ważne?

- PostCSS 8.5.6 ma poprawki bezpieczeństwa
- Stylelint 16 ma nowe reguły i lepsze performance
- CSSNano 7 lepiej optymalizuje CSS (mniejszy bundle)
- Preset Env 10 wspiera najnowsze CSS features

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych wyłączania stylelint rules "żeby przeszło"
- Żadnych `!important` dodawanych dla workaround
- Żadnych pomijania CSS errors
- Jeśli stylelint failuje - naprawiamy CSS, nie wyłączamy linter

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- PostCSS 8.5.6 - najnowsza wersja 8.x
- Stylelint 16.25.0 - najnowsza major
- CSSNano 7.1.2 - najnowsza z pełną optymalizacją
- Wszystkie loadery kompatybilne z Webpack 5.102+

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
# PostCSS Core
postcss: 8.4.47 → 8.5.6
postcss-preset-env: 7.3.0 → 10.4.0 ⚠️ (MAJOR)
postcss-loader: 6.2.1 → 8.2.0 ⚠️ (MAJOR)
postcss-import: 14.0.2 → 16.1.1 ⚠️ (MAJOR)

# Stylelint
stylelint: 14.3.0 → 16.25.0 ⚠️ (MAJOR)
stylelint-config-standard: 24.0.0 → 36.0.1 ⚠️ (MAJOR)

# CSS Processing
cssnano: 5.0.17 → 7.1.2 ⚠️ (MAJOR)
css-loader: 6.5.1 → 7.1.2 ⚠️ (MAJOR)
```

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
git checkout main
git pull origin main
git checkout -b update/css-pipeline

# Test obecnego stanu
yarn lint:stylelint
yarn build:client
```

### Krok 2: Aktualizacja PostCSS Core

```bash
yarn add -D postcss@8.5.6 postcss-import@16.1.1
```

**Checklist PostCSS Core:**
- [ ] PostCSS 8.5.6 zainstalowany
- [ ] postcss-import 16.1.1 zainstalowany
- [ ] `yarn build:client` działa
- [ ] CSS kompiluje się bez błędów
- [ ] Commit: `chore(deps): update PostCSS core to 8.5.6`

### Krok 3: Aktualizacja PostCSS Loaders

```bash
yarn add -D postcss-loader@8.2.0 postcss-preset-env@10.4.0
```

**Checklist PostCSS Loaders:**
- [ ] postcss-loader 8.2.0 zainstalowany
- [ ] postcss-preset-env 10.4.0 zainstalowany
- [ ] Sprawdź webpack.config.js - czy config jest kompatybilny
- [ ] Możliwa zmiana API - sprawdź docs PostCSS Loader 8
- [ ] `yarn build:client` działa
- [ ] Autoprefixer nadal działa (sprawdź output CSS)
- [ ] Modern CSS features są transpilowane
- [ ] Commit: `chore(deps): update PostCSS loaders to latest`

### Krok 4: Aktualizacja CSS Loader

```bash
yarn add -D css-loader@7.1.2
```

**Checklist CSS Loader:**
- [ ] css-loader 7.1.2 zainstalowany
- [ ] CSS modules działają (jeśli używane)
- [ ] @import działa poprawnie
- [ ] url() resolution działa
- [ ] Commit: `chore(deps): update css-loader to 7.1.2`

### Krok 5: Aktualizacja CSSNano

```bash
yarn add -D cssnano@7.1.2
```

**Checklist CSSNano:**
- [ ] cssnano 7.1.2 zainstalowany
- [ ] Production build minifikuje CSS
- [ ] CSS size nie wzrósł (powinien być mniejszy!)
  - Przed: `du -sh public/css` → _____ KB
  - Po: `du -sh public/css` → _____ KB
- [ ] CSS nadal działa (sprawdź wizualnie)
- [ ] Commit: `chore(deps): update cssnano to 7.1.2`

### Krok 6: Aktualizacja Stylelint

```bash
yarn add -D stylelint@16.25.0 stylelint-config-standard@36.0.1
```

**Checklist Stylelint:**
- [ ] stylelint 16.25.0 zainstalowany
- [ ] stylelint-config-standard 36.0.1 zainstalowany
- [ ] Sprawdź .stylelintrc - może wymagać migracji
- [ ] `yarn lint:stylelint` uruchamia się
- [ ] Sprawdź output - może być dużo nowych errors (to OK)
- [ ] Commit: `chore(deps): update Stylelint to 16.25.0`

### Krok 7: Fix Stylelint Errors (jeśli są)

```bash
# Sprawdź co trzeba naprawić
yarn lint:stylelint

# Autofix co się da
yarn stylelint --fix "client/**/*.css"

# Reszta ręcznie
```

**Checklist Stylelint Fixes:**
- [ ] Wszystkie auto-fixable errors naprawione
- [ ] Pozostałe errors naprawione ręcznie (ZERO workarounds!)
- [ ] Żadne reguły nie są disable'd dla wygody
- [ ] `yarn lint:stylelint` przechodzi bez błędów
- [ ] Commit: `style: fix stylelint errors after update`

### Krok 8: Visual CSS Testing

```bash
# Build i uruchom dev server
yarn build
yarn dev

# Otwórz http://localhost:9000
# Sprawdź wizualnie kilka stron
```

**Checklist Visual Testing:**
- [ ] Strona główna wygląda poprawnie
- [ ] Wszystkie kolory są OK
- [ ] Layout nie jest zepsuty
- [ ] Responsywność działa
- [ ] Dark mode działa (jeśli jest)
- [ ] Animacje działają
- [ ] Ikony są na miejscu
- [ ] Fonts się ładują
- [ ] Brak CSS errors w DevTools

### Krok 9: Full Build Test

```bash
yarn build
yarn test
```

**Checklist Full Build:**
- [ ] `yarn build` przechodzi
- [ ] CSS bundle size OK (sprawdź public/css/)
- [ ] All tests pass
- [ ] CSS minified w production
- [ ] CSS readable w development
- [ ] Source maps działają

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin update/css-pipeline
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Wszystkie commity OK
- [ ] CSS wizualnie wygląda identycznie
- [ ] Stylelint przechodzi
- [ ] Bundle size mniejszy lub równy
- [ ] **Napisane do Claude:** "Faza 3 done, review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ PostCSS 8.5.6 + wszystkie loadery zaktualizowane
✅ Stylelint 16.25.0 przechodzi bez błędów
✅ CSSNano 7.1.2 optymalizuje CSS
✅ Build działa (client + server)
✅ CSS wygląda identycznie jak przed update
✅ Autoprefixer działa

### Nice to Have (OPCJONALNE):
⭐ CSS bundle mniejszy
⭐ Build time krótszy
⭐ Brak stylelint warnings

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: Stylelint 16 ma nowe reguły

**Symptom:** Dużo nowych errors po update

**Rozwiązanie:**
1. To NORMALNE - Stylelint 16 jest strict
2. Nie wyłączaj reguł - napraw CSS
3. Użyj `--fix` dla auto-fixable
4. Resztę napraw ręcznie (lepszy CSS = win)

### Problem: PostCSS Loader 8 API changes

**Symptom:** `TypeError: postcssLoader is not a function`

**Rozwiązanie:**
1. Sprawdź webpack.config.js
2. API mogło się zmienić
3. Docs: https://github.com/webpack-contrib/postcss-loader

### Problem: CSSNano 7 over-optymalizuje

**Symptom:** CSS wygląda źle, niektóre style znikają

**Rozwiązanie:**
1. Sprawdź cssnano config
2. Wyłącz aggressive optimizations: `preset: ['default', { discardComments: { removeAll: false } }]`
3. Test produkcyjny build dokładnie

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Metryki:**
- CSS size przed: _____ KB
- CSS size po: _____ KB

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Tests pass
- [ ] CSS looks identical
- [ ] Stylelint passes
- [ ] **Napisane do Claude:** "Faza 3 done, review please"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**Poprzednia faza:** FAZA 2 - Webpack Build Chain
**Następna faza:** FAZA 4 - Testing Framework
