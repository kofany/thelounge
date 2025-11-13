# FAZA 8: ESM Migration (WYMAGANE dla BLEEDING EDGE)

**Branch:** `migrate/esm-full`
**Szacowany czas:** 1-2 TYGODNIE (20-40 godzin!)
**Ryzyko:** 🔴 BARDZO WYSOKIE (zmienia całą architekturę modułów)
**Target:** Node.js 24.11.1+ (LTS)
**Status:** ⏳ DO WYKONANIA (REQUIRED!)

---

## 🎯 CEL FAZY

**FULL ESM MIGRATION** - Migracja całego projektu z CommonJS (require/module.exports) na ECMAScript Modules (import/export). To największa architekturalna zmiana - wpływa na WSZYSTKIE pliki, webpack config, TypeScript config, package.json, i runtime.

### Dlaczego ESM jest WYMAGANE?

**Wiele pakietów wymaga ESM w najnowszych wersjach:**
- **chalk** 5.x (ESM only)
- **got** 12+ (ESM only) - lub zamień na native `fetch()`
- **uuid** 9+ (ESM only)
- **file-type** 17+ (ESM only)
- **filenamify** 5+ (ESM only)
- **read-chunk** 4+ (ESM only)
- **read** 2+ (ESM only)
- **package-json** 8+ (ESM only)
- **linkify-it** 4+ (ESM only)
- **babel-loader** 10+ (ESM only)

### Cel: Node.js 24.11.1+ (LTS) Compatibility

**Nasz projekt będzie kompatybilny z Node.js 24 LTS i przyszłymi wersjami:**
- ✅ **Node 24 = LTS** (Long Term Support) - stabilność production
- ✅ ESM jest STANDARD od Node.js 14+, fully stable w 18+, perfected w 24 LTS
- ✅ CommonJS jest LEGACY - Node.js przestaje go popierać
- ✅ Wszystkie nowe features Node.js będą ESM-first
- ✅ Lepsze tree-shaking, mniejsze bundle sizes
- ✅ Native top-level await
- ✅ Przyszłościowe podejście + stabilność LTS

**To nie jest opcja - to KONIECZNOŚĆ dla bleeding edge projektu na LTS foundation!**

---

## ⚠️ ZASADY REALIZACJI

### 🚫 NIE CHCĘ ŻADNYCH HACK CZY WORKAROUND!

- Żadnych `require()` w ESM projects (use dynamic import if needed)
- Żadnych workarounds typu `.default` all over the place
- Żadnych mixed CommonJS/ESM w jednym pliku
- PROPER ESM migration - albo full ESM, albo nie rób tego

### ✅ AKTUALIZUJEMY WSZYSTKO, PROJEKT MA BYĆ EDGE UP TO DATE

- package.json `"type": "module"`
- **Node.js 24.11.1+ (LTS)** jako minimum target
- All imports używają ESM syntax
- All files `.js` extension in imports
- `__dirname`/`__filename` → `import.meta.url`
- Top-level await gdzie potrzebne
- Wszystkie ESM-only packages updated do **latest bleeding edge**
- Zero CommonJS legacy code

---

## 📋 PAKIETY DO AKTUALIZACJI (po ESM migration)

```bash
# ESM-only packages - update PO migracji
chalk: 4.1.2 → 5.6.2
got: 11.8.6 → 14.6.3 (lub zamień na fetch())
uuid: 8.3.2 → 13.0.0
file-type: 16.5.4 → 21.1.0
filenamify: 4.3.0 → 7.0.1
read-chunk: 3.2.0 → 5.0.0
read: 1.0.7 → 5.0.1
package-json: 7.0.0 → 10.0.1
linkify-it: 3.0.3 → 5.0.0
babel-loader: 8.2.5 → 10.0.0
```

---

## 🔧 PLAN WYKONANIA (DŁUGI!)

### ⏰ Realistic Timeline:

- **Week 1, Day 1-2:** Setup + config changes (8-12h)
- **Week 1, Day 3-5:** Server files migration (12-16h)
- **Week 2, Day 1-3:** Client files migration (8-12h)
- **Week 2, Day 4-5:** Testing + fixes (8-12h)

TOTAL: ~36-52 hours

---

### Krok 1: Research & Preparation (4h)

⚠️ **PRZECZYTAJ WSZYSTKO PRZED UPDATE:**

```bash
# Required reading (NIE SKIP!):
# 1. Node.js ESM Guide:
#    https://nodejs.org/api/esm.html

# 2. TypeScript ESM Guide:
#    https://www.typescriptlang.org/docs/handbook/esm-node.html

# 3. Webpack ESM Guide:
#    https://webpack.js.org/guides/ecma-script-modules/

# 4. Vue ESM:
#    https://vuejs.org/guide/scaling-up/tooling.html#note-on-in-browser-template-compilation
```

**Checklist Research:**
- [ ] Przeczytany Node.js ESM guide
- [ ] Przeczytany TypeScript ESM guide
- [ ] Przeczytany Webpack ESM guide
- [ ] Zrozumiane:
  - [ ] `"type": "module"` w package.json
  - [ ] `.js` extensions w imports
  - [ ] `import.meta.url` zamiast `__dirname`
  - [ ] Dynamic imports dla CommonJS modules
  - [ ] Top-level await
- [ ] Notatki sporządzone

### Krok 2: Node.js Version Check

⚠️ **WAŻNE:** Projekt targetuje Node 24 LTS

```bash
node --version

# WYMAGANE: Node.js 24.11.1+ (LTS)
# Jeśli < 24: Upgrade Node.js!
# Install: nvm install 24
# Use: nvm use 24
```

**Checklist Node:**
- [ ] Node.js **24.11.1+** zainstalowany i aktywny
- [ ] Update .nvmrc: `echo "24" > .nvmrc`
- [ ] Verify: `node --version` → pokazuje 24.x.x

### Krok 3: Backup Everything (1h)

```bash
git checkout main
git pull origin main
git checkout -b migrate/esm-full

# Create full backup
git branch backup-before-esm

# Backup critical files
cp package.json package.json.backup
cp tsconfig.json tsconfig.json.backup
cp webpack.config.js webpack.config.js.backup
cp server/tsconfig.json server/tsconfig.json.backup
# (Backups NIE idą do git)
```

**Checklist Backup:**
- [ ] Backup branch utworzony
- [ ] Wszystkie kluczowe pliki zbackupowane

### Krok 4: Update package.json (1h)

```json
{
  "type": "module",
  "engines": {
    "node": ">=24.11.1"  // Target Node 24 LTS for stability + bleeding edge
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Checklist package.json:**
- [ ] `"type": "module"` added
- [ ] `"engines"` updated (Node **24.11.1+** LTS)
- [ ] `"exports"` field added (jeśli library)
- [ ] Scripts checked (mogą wymagać zmian)
- [ ] Commit: `refactor: migrate to ESM - target Node 24 LTS`

### Krok 5: Update TypeScript Config (2h)

```json
// tsconfig.json & server/tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",  // or "node16"
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  }
}
```

**Checklist TypeScript:**
- [ ] `module: "ESNext"` w tsconfig.json
- [ ] `moduleResolution: "bundler"` (lub "node16")
- [ ] Server tsconfig.json updated
- [ ] Client tsconfig.json updated (jeśli osobny)
- [ ] Test tsconfig.json updated
- [ ] Commit: `refactor: update TypeScript config for ESM`

### Krok 6: Update Webpack Config (4h)

```javascript
// webpack.config.js → webpack.config.mjs (or .js with "type": "module")
import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
// ... other imports

// Replace __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // ... rest of config
  experiments: {
    outputModule: true  // Enable ESM output
  }
};
```

**Checklist Webpack:**
- [ ] webpack.config.js → .mjs (lub keep .js jeśli "type": "module")
- [ ] All `require()` → `import`
- [ ] `__dirname` → `import.meta.url` conversion
- [ ] `module.exports` → `export default`
- [ ] Wszystkie plugins jako ESM imports
- [ ] `experiments.outputModule: true` (jeśli output ESM)
- [ ] Test: `yarn build:client`
- [ ] Commit: `refactor: migrate webpack config to ESM`

### Krok 7: Migrate Server Files (12-20h!)

⚠️ **TO NAJDŁUŻSZA CZĘŚĆ**

Strategy:
1. Start from leaves (utility files without dependencies)
2. Work up to root (server/index.ts last)

```bash
# Znajdź wszystkie server files
find server -name "*.ts" -type f

# Dla każdego pliku:
# 1. require() → import
# 2. module.exports → export
# 3. __dirname → import.meta.url
# 4. Add .js extensions to imports
```

**Common transformations:**

```typescript
// BEFORE (CommonJS):
const express = require('express');
const path = require('path');
module.exports = function createServer() {
  const __dirname = path.dirname(__filename);
  // ...
};

// AFTER (ESM):
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function createServer() {
  // ...
}
```

```typescript
// Import with .js extension:
// BEFORE:
import { helper } from './utils/helper';

// AFTER:
import { helper } from './utils/helper.js';  // Add .js!
```

**Checklist Server Migration:**
- [ ] All `require()` → `import`
- [ ] All `module.exports` → `export`
- [ ] All imports have `.js` extensions
- [ ] `__dirname`/`__filename` converted to `import.meta.url`
- [ ] Dynamic imports for any CommonJS-only modules
- [ ] `yarn build:server` przechodzi
- [ ] Commits: Batch commits per file group (np. `refactor: migrate server utils to ESM`)

### Krok 8: Migrate Client Files (8h)

Client może być łatwiejszy (webpack already handles):

```bash
# Check client files
find client -name "*.ts" -name "*.js" -type f

# Similar transformations
```

**Checklist Client Migration:**
- [ ] Vue components checked (should be OK with vue-loader)
- [ ] Client utils migrated
- [ ] All imports ESM style
- [ ] `yarn build:client` przechodzi
- [ ] Commit: `refactor: migrate client to ESM`

### Krok 9: Migrate Test Files (4h)

```javascript
// test/.mocharc.yml - może wymagać changes
// Enable ESM loader
loader: 'tsx/esm'  // lub podobny ESM loader
```

**Checklist Tests:**
- [ ] Test files migrated to ESM
- [ ] Mocha config updated for ESM
- [ ] `yarn test:mocha` działa
- [ ] All tests pass
- [ ] Commit: `refactor: migrate tests to ESM`

### Krok 10: Update ESM-Only Packages (2h)

Teraz możesz zaktualizować pakiety ESM-only:

```bash
yarn add chalk@5.6.2 uuid@13.0.0 \
  file-type@21.1.0 filenamify@7.0.1 \
  read-chunk@5.0.0 read@5.0.1 \
  package-json@10.0.1 linkify-it@5.0.0

# Rozważ got → fetch()
yarn remove got
# Zamień got na native fetch() w kodzie

# Update babel-loader
yarn add -D babel-loader@10.0.0
```

**Checklist ESM Packages:**
- [ ] chalk 5.6.2 zainstalowany
- [ ] uuid 13.0.0 zainstalowany
- [ ] file-type 21.1.0 zainstalowany
- [ ] Pozostałe ESM packages updated
- [ ] got zamieniony na fetch() (lub updated)
- [ ] babel-loader 10.0.0 zainstalowany
- [ ] Wszystkie imports działają
- [ ] Commit: `chore(deps): update ESM-only packages to latest`

### Krok 11: Replace `got` with `fetch()` (4h)

Native fetch() jest w Node.js 18+:

```typescript
// BEFORE (got):
import got from 'got';
const response = await got('https://api.example.com/data');
const data = JSON.parse(response.body);

// AFTER (fetch):
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

**Checklist fetch():**
- [ ] All `got()` calls replaced with `fetch()`
- [ ] Error handling updated (fetch doesn't throw on 4xx/5xx)
- [ ] Response parsing updated (.json(), .text(), etc.)
- [ ] `yarn remove got`
- [ ] Tests updated
- [ ] Commit: `refactor: replace got with native fetch()`

### Krok 12: Replace `__dirname` everywhere (2h)

```typescript
// Helper function (create in utils):
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export function getDirname(importMetaUrl: string) {
  return dirname(fileURLToPath(importMetaUrl));
}

// Usage:
import { getDirname } from './utils/path.js';
const __dirname = getDirname(import.meta.url);
```

**Checklist __dirname:**
- [ ] All `__dirname` replaced
- [ ] All `__filename` replaced
- [ ] Helper function created (optional)
- [ ] Build działa
- [ ] Commit: `refactor: replace __dirname with import.meta.url`

### Krok 13: Full Build & Test (8h)

```bash
# Clean everything
rm -rf node_modules dist public/js public/css
yarn install

# Full build
yarn build

# Full test
yarn test

# Dev server
yarn dev

# Production test
NODE_ENV=production yarn start
```

**Checklist Full Test:**
- [ ] Clean install działa
- [ ] `yarn build` przechodzi (client + server)
- [ ] `yarn test` przechodzi (all tests)
- [ ] `yarn dev` działa (dev server)
- [ ] `yarn start` działa (production)
- [ ] Application loads w przeglądarce
- [ ] All features działają
- [ ] WebSocket działa
- [ ] No ESM-related errors w console

### Krok 14: Performance Check (2h)

```bash
# Check bundle sizes
du -sh public/js
du -sh public/css

# Check build time
time yarn build

# Check startup time
time yarn start
```

**Checklist Performance:**
- [ ] Bundle size nie wzrósł (może być mniejszy!)
- [ ] Build time OK (może być szybszy)
- [ ] Startup time OK
- [ ] Runtime performance OK
- [ ] Memory usage OK

---

## 🚀 PUSH I REVIEW

```bash
git push -u origin migrate/esm-full
```

**Checklist Push:**
- [ ] Branch wypushowany
- [ ] Wszystkie pliki migrated
- [ ] Build działa
- [ ] Tests pass
- [ ] App działa w dev i production
- [ ] ESM-only packages updated
- [ ] **Napisane do Claude:** "Faza 8 done (ESM migration complete!), review please"

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
✅ `"type": "module"` w package.json
✅ Wszystkie pliki używają ESM syntax
✅ Build działa (client + server)
✅ Tests pass
✅ App działa w dev mode
✅ App działa w production
✅ ESM-only packages updated do latest
✅ Zero CommonJS require() w kodzie

### Nice to Have (OPCJONALNE):
⭐ Bundle size mniejszy (ESM tree-shaking)
⭐ Build time krótszy
⭐ Better code organization

---

## 🐛 COMMON ISSUES I ROZWIĄZANIA

### Problem: "Cannot find module" z .js extension

**Symptom:** `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/file.js'`

**Rozwiązanie:**
1. ESM wymaga `.js` extension w imports
2. Nawet dla `.ts` files - import with `.js`
3. TypeScript to handle: `import { x } from './file.js'` → finds `file.ts`

### Problem: "__dirname is not defined"

**Symptom:** `ReferenceError: __dirname is not defined`

**Rozwiązanie:**
1. ESM nie ma `__dirname`
2. Use: `import.meta.url` + `fileURLToPath()`
3. See helper function w Krok 11

### Problem: Default imports don't work

**Symptom:** `TypeError: x is not a function`

**Rozwiązanie:**
1. CommonJS modules w ESM wymagają `.default`
2. Lub use `import * as x from 'module'`
3. Lub włącz `esModuleInterop` w tsconfig

### Problem: Circular dependencies

**Symptom:** `ReferenceError: Cannot access 'X' before initialization`

**Rozwiązanie:**
1. ESM jest strict o circular deps
2. Refactor code - remove circular imports
3. Use dependency injection gdzie możliwe

---

## 📝 NOTATKI I PROBLEMY

**Problemy:**
- [ ] _Dodaj tutaj napotkane problemy_

**Rozwiązania:**
- [ ] _Dodaj tutaj jak je rozwiązałeś_

**Stats:**
- Files migrated: _____ files
- Lines changed: _____ lines
- Time spent: _____ days
- Bundle size before: _____ KB
- Bundle size after: _____ KB

---

## ✅ SIGN-OFF

- [ ] Wszystkie checklisty zaznaczone
- [ ] Branch wypushowany
- [ ] Full ESM migration complete
- [ ] Build działa
- [ ] Tests pass
- [ ] App działa
- [ ] ESM packages updated
- [ ] **Napisane do Claude:** "Faza 8 done, review please - FULL ESM BLEEDING EDGE ACHIEVED! 🎉"

**Data rozpoczęcia:** _____
**Data zakończenia:** _____
**Czas trwania:** _____ weeks
**Reviewer Claude:** ⬜ Nie zweryfikowane

---

**⚠️ GRATULACJE!** Ukończyłeś najtrudniejszą migrację - projekt jest teraz FULL ESM BLEEDING EDGE na Node 24 LTS! 🚀

**Node.js 24 LTS (Bleeding Edge on Stable Foundation) Achieved!** ✅

**Poprzednia faza:** FAZA 7 - Express Framework
**Następna faza:** FAZA 9 - Final Cleanup (ostatnia prosta!)
