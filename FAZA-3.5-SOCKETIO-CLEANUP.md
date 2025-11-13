# FAZA 3.5: Socket.IO Cleanup & Update

**Branch:** `update/socketio-cleanup`
**Ryzyko:** 🟡 ŚREDNIE (backend WebSocket layer)
**Status:** ⏳ TODO
**Szacowany czas:** 3-4 godziny

---

## 🎯 CEL FAZY

Naprawić problem z test hanging poprzez proper cleanup Socket.IO connections oraz zaktualizować Socket.IO do najnowszej wersji.

### Aktualny problem:

**Root Cause:** `server/server.ts` tworzy Socket.IO instance jako lokalną zmienną (linia 221) która NIE jest eksportowana. Gdy testy wywołują `server.close(done)`, zamyka to tylko HTTP server, ale Socket.IO connections pozostają otwarte i trzymają event loop aktywny.

**Symptom:** Testy kończą wykonywanie (229 passing) ale proces się nie kończy - wymaga `--exit` flag w mocha.

**Dowód:** `test/.mocharc.yml` linia 5-9 zawiera TODO z dokładnym opisem problemu.

---

## 📋 PAKIETY DO AKTUALIZACJI

```bash
socket.io: 4.6.2 → 4.8.1
socket.io-client: 4.5.0 → 4.8.1
```

**Breaking Changes:** Brak (minor updates)

---

## 🔧 PLAN WYKONANIA

### Krok 1: Przygotowanie

```bash
# Upewnij się że jesteś na main i masz najnowsze zmiany
git checkout main
git pull origin main

# Stwórz nowy branch
git checkout -b update/socketio-cleanup

# Sprawdź obecny stan testów (powinny timeout po ~3 minutach)
timeout 180 yarn test:mocha 2>&1 | tail -50
```

**Oczekiwany rezultat:** Testy się wykonają (229 passing) ale proces się nie zakończy i timeout po 180s.

---

### Krok 2: Aktualizacja Socket.IO pakietów

```bash
yarn add socket.io@4.8.1 socket.io-client@4.8.1

# Sprawdź czy aktualizacja się udała
grep "socket.io" package.json
```

**Checklist:**
- [ ] `socket.io: 4.8.1` w package.json
- [ ] `socket.io-client: 4.8.1` w package.json
- [ ] `yarn.lock` zaktualizowany
- [ ] Commit: `chore(deps): update socket.io to 4.8.1`

---

### Krok 3: Refaktoryzacja server.ts - Eksport Socket.IO

**Cel:** Zmienić return value z `server` na obiekt `{httpServer, io}`.

#### 3.1. Zmień interface return type

**File:** `server/server.ts`

**Lokalizacja:** Linia 68-72 (funkcja export default)

**PRZED:**
```typescript
export default async function (
	options: ServerOptions = {
		dev: false,
	}
) {
```

**PO:**
```typescript
export type ServerInstance = {
	httpServer: import("http").Server | import("https").Server;
	io: Server;
	stop: (callback: (err?: Error) => void) => void;
};

export default async function (
	options: ServerOptions = {
		dev: false,
	}
): Promise<ServerInstance> {
```

**Wyjaśnienie:**
- Dodajemy nowy type `ServerInstance` który zawiera HTTP server, Socket.IO instance i metodę `stop()`
- Zmieniony return type funkcji na `Promise<ServerInstance>`

---

#### 3.2. Zmień deklarację sockets variable

**Lokalizacja:** Linia 221 (wewnątrz server.listen callback)

**PRZED:**
```typescript
const sockets: Server = new ioServer(server, {
```

**PO:**
```typescript
let sockets: Server | null = null;

// ... (reszta kodu w server.listen)

sockets = new ioServer(server, {
```

**Wyjaśnienie:** Deklarujemy `sockets` przed callback aby była dostępna w całym scope funkcji.

---

#### 3.3. Dodaj metodę stop()

**Lokalizacja:** Tuż przed `return server` (około linia 324)

**PRZED:**
```typescript
	return server;
}
```

**PO:**
```typescript
	// Create stop method that properly closes everything
	const stop = (callback: (err?: Error) => void) => {
		// First close Socket.IO (disconnect all clients)
		if (sockets) {
			sockets.close(() => {
				// Then close HTTP server
				server.close(callback);
			});
		} else {
			// If sockets not initialized, just close HTTP server
			server.close(callback);
		}
	};

	return {
		httpServer: server,
		io: sockets!,
		stop,
	};
}
```

**Wyjaśnienie:**
- Metoda `stop()` najpierw zamyka Socket.IO (`sockets.close()`)
- Potem zamyka HTTP server (`server.close()`)
- Kolejność jest KRYTYCZNA: Socket.IO przed HTTP server
- Non-null assertion `sockets!` jest bezpieczny bo `server.listen()` callback już się wykonał

---

#### 3.4. Checklist dla server.ts

- [ ] Dodany type `ServerInstance` na górze pliku
- [ ] Zmieniony return type funkcji na `Promise<ServerInstance>`
- [ ] Deklaracja `sockets` przeniesiona przed callback
- [ ] Dodana metoda `stop()` która zamyka w poprawnej kolejności
- [ ] Return statement zwraca obiekt `{httpServer, io, stop}`
- [ ] TypeScript kompiluje się bez błędów: `yarn tsc --noEmit`
- [ ] Commit: `refactor(server): expose Socket.IO instance for proper cleanup`

---

### Krok 4: Aktualizacja testów

#### 4.1. Fix test/server.ts

**File:** `test/server.ts`

**Lokalizacja:** Linia 16, 38, 47

**PRZED:**
```typescript
let server;

// ...

server = await (await import("../server/server")).default({} as any);

// ...

after(function (done) {
	logInfoStub.restore();
	logWarnStub.restore();
	checkForUpdatesStub.restore();
	server.close(done);
});
```

**PO:**
```typescript
let serverInstance: import("../server/server").ServerInstance;

// ...

serverInstance = await (await import("../server/server")).default({} as any);

// ...

after(function (done) {
	logInfoStub.restore();
	logWarnStub.restore();
	checkForUpdatesStub.restore();
	// Use stop() method which properly closes Socket.IO then HTTP server
	serverInstance.stop(done);
});
```

**Wyjaśnienie:**
- Używamy typu `ServerInstance` dla lepszej type safety
- Wywołujemy `serverInstance.stop(done)` zamiast `server.close(done)`
- `stop()` automatycznie zamknie Socket.IO connections przed HTTP server

---

#### 4.2. Checklist dla test/server.ts

- [ ] Zmieniona deklaracja zmiennej na `ServerInstance` type
- [ ] Używamy `serverInstance.stop(done)` w `after` hook
- [ ] TypeScript kompiluje się: `yarn tsc --noEmit`
- [ ] Commit: `test: use proper server cleanup method`

---

### Krok 5: Usuń --exit flag (KLUCZOWE!)

**File:** `test/.mocharc.yml`

**PRZED:**
```yaml
color: true
check-leaks: true
recursive: true
reporter: dot
# TODO: Remove --exit flag after fixing Socket.IO cleanup
# Root cause: server/server.ts creates Socket.IO instance (line 221) but doesn't
# export it, so tests cannot call sockets.close() before server.close().
# This leaves Socket.IO connections open, preventing process exit.
# Proper fix requires refactoring to expose sockets instance for test teardown.
exit: true
ignore: "test/client/**"
```

**PO:**
```yaml
color: true
check-leaks: true
recursive: true
reporter: dot
ignore: "test/client/**"
```

**Checklist:**
- [ ] Usunięte: linie 5-10 (TODO comment + exit flag)
- [ ] Commit: `test: remove --exit flag after Socket.IO cleanup fix`

---

### Krok 6: WERYFIKACJA (najważniejszy krok!)

#### 6.1. Test czy testy się kończą BEZ --exit

```bash
# Clean build
yarn build

# Run tests with timeout - powinny się ZAKOŃCZYĆ przed timeoutem!
timeout 60 yarn test:mocha 2>&1 | tail -30
```

**Oczekiwany rezultat:**
```
  229 passing (14s)
  13 failing

# I proces SIĘ KOŃCZY (nie wisi!)
```

**Jeśli proces nadal wisi:** Coś jest nie tak - sprawdź logi, diagnostyka poniżej.

---

#### 6.2. Test czy Socket.IO działa poprawnie

```bash
# Start server w background
yarn start &
SERVER_PID=$!

# Poczekaj na start
sleep 3

# Test WebSocket connection (manual test w przeglądarce)
# Otwórz http://localhost:9000
# Sprawdź DevTools → Network → WS tab
# Powinno być active WebSocket connection

# Stop server
kill $SERVER_PID
```

**Checklist:**
- [ ] Server startuje bez błędów
- [ ] WebSocket connection działa
- [ ] Clients mogą się połączyć
- [ ] Server gracefully shutdowns po `kill`

---

#### 6.3. Full test suite

```bash
# Run FULL test suite (linters + tests)
timeout 180 yarn test 2>&1 | tail -50
```

**Checklist:**
- [ ] Wszystkie linters przechodzą (ESLint, Prettier, Stylelint)
- [ ] 229 tests passing
- [ ] 13 tests failing (to są istniejące failures - sinon stubbing issues)
- [ ] **Proces się kończy w < 60 sekund** (nie timeout!)

---

### Krok 7: Dev server test

```bash
# Test dev mode (with webpack HMR)
timeout 30 yarn dev &
DEV_PID=$!

sleep 10

# Check if running
curl http://localhost:9000/ | grep "The Lounge"

# Stop
kill $DEV_PID
wait $DEV_PID
```

**Checklist:**
- [ ] Dev server startuje
- [ ] Webpack HMR działa
- [ ] Server odpowiada na requests
- [ ] Server się kończy po kill (nie wisi!)

---

### Krok 8: Production build test

```bash
# Build production
yarn build

# Check bundle sizes (powinny być identyczne jak wcześniej)
ls -lh public/js/*.js
ls -lh public/css/*.css

# Test że production bundle działa
NODE_ENV=production yarn start &
PROD_PID=$!
sleep 5
curl http://localhost:9000/ | grep "The Lounge"
kill $PROD_PID
```

**Checklist:**
- [ ] Production build bez błędów
- [ ] Bundle sizes OK (js: 4.4M, css: 234K)
- [ ] Production server działa
- [ ] Graceful shutdown works

---

### Krok 9: PUSH!

```bash
# Sprawdź status
git status
git log --oneline -5

# Push branch
git push -u origin update/socketio-cleanup 2>&1
```

**Checklist:**
- [ ] Branch wypushowany
- [ ] Wszystkie commity mają sensowne messages
- [ ] package.json i yarn.lock zaktualizowane
- [ ] Brak przypadkowych zmian

---

## 🐛 TROUBLESHOOTING

### Problem: Testy nadal się wieszą po zmianach

**Diagnoza:**
```bash
# Run testy w background
yarn test:mocha &
TEST_PID=$!

# Po 30 sekundach sprawdź co trzyma proces
sleep 30
lsof -p $TEST_PID | grep -E "LISTEN|TCP"

# Lub w Node:
node -e "setTimeout(() => console.log(process._getActiveHandles()), 20000)" &
yarn test:mocha
```

**Możliwe przyczyny:**
1. Socket.IO connections nie są zamykane → sprawdź czy `sockets.close()` się wywołuje
2. HTTP server nie zamyka się → sprawdź czy `server.close()` się wywołuje
3. Inne timers/intervals → szukaj `setInterval` w kodzie

**Fix:**
- Dodaj debug logging do `stop()` metody:
```typescript
const stop = (callback: (err?: Error) => void) => {
	console.log('[DEBUG] Stopping server...');
	if (sockets) {
		console.log('[DEBUG] Closing Socket.IO...');
		sockets.close(() => {
			console.log('[DEBUG] Socket.IO closed, closing HTTP server...');
			server.close((err) => {
				console.log('[DEBUG] HTTP server closed');
				callback(err);
			});
		});
	} else {
		server.close(callback);
	}
};
```

---

### Problem: TypeScript errors po zmianach

**Error:** `Type 'ServerInstance' does not satisfy...`

**Fix:** Sprawdź czy:
1. Typ `ServerInstance` jest poprawnie zdefiniowany
2. Wszystkie fields są zwracane w return statement
3. `sockets!` ma non-null assertion (bo jest utworzony w callback)

---

### Problem: Socket.IO clients nie mogą się połączyć

**Symptom:** `client.on("auth:success")` nie dostaje eventu

**Diagnoza:**
```bash
# Check Socket.IO logs
DEBUG=socket.io:* yarn start
```

**Fix:** Sprawdź czy `serverInstance.io` jest dostępny i nie jest `null`.

---

## 📊 KRYTERIA SUKCESU

### Must Have (WYMAGANE):
- ✅ Socket.IO 4.8.1 zainstalowany
- ✅ Server.ts eksportuje `ServerInstance` z `{httpServer, io, stop}`
- ✅ Metoda `stop()` zamyka Socket.IO PRZED HTTP server
- ✅ Test używa `serverInstance.stop(done)` w teardown
- ✅ `--exit` flag USUNIĘTY z `.mocharc.yml`
- ✅ **Testy kończą się w < 60s (bez timeout!)**
- ✅ Wszystkie testy przechodzą (229 passing)
- ✅ Production build działa
- ✅ Dev server działa z HMR
- ✅ WebSocket connections działają poprawnie

### Nice to Have (OPCJONALNE):
- ⭐ Zero test failures (obecnie 13 failing - sinon issues)
- ⭐ Graceful shutdown message w logach
- ⭐ Performance metrics (czy shutdown jest szybszy)

---

## 📝 KOLEJNOŚĆ COMMITÓW

1. `chore(deps): update socket.io to 4.8.1`
2. `refactor(server): expose Socket.IO instance for proper cleanup`
3. `test: use proper server cleanup method`
4. `test: remove --exit flag after Socket.IO cleanup fix`

**Każdy commit powinien być buildable i testable osobno!**

---

## ⏱️ TIMELINE

- **Krok 1-2:** 30 min (setup + aktualizacja pakietów)
- **Krok 3:** 60 min (refaktoryzacja server.ts) ⚠️ najtrudniejszy
- **Krok 4:** 15 min (fix testów)
- **Krok 5:** 5 min (usuń --exit)
- **Krok 6-8:** 45 min (weryfikacja i testy)
- **Krok 9:** 10 min (push)

**TOTAL:** ~3 godziny (z buforem 4h)

---

## 🎯 NASTĘPNE KROKI PO FAZIE 3.5

Po ukończeniu tej fazy:
1. ✅ Napisz "Faza 3.5 done, review please"
2. ✅ Poczekaj na review
3. ✅ Merge do main
4. ➡️ Przejdź do **FAZA 4: CSS Pipeline**

---

## 💡 WAŻNE UWAGI

1. **Kolejność zamykania jest KRYTYCZNA:**
   - Najpierw Socket.IO (`sockets.close()`)
   - Potem HTTP server (`server.close()`)
   - Odwrotna kolejność = connections leak!

2. **Non-null assertion `sockets!` jest bezpieczny:**
   - `sockets` jest always initialized w `server.listen()` callback
   - Return statement jest wewnątrz tego callback
   - Więc `sockets` ZAWSZE będzie non-null w return

3. **Nie zmieniaj kolejności steps:**
   - Najpierw aktualizuj pakiety
   - Potem refaktoryzuj kod
   - Na końcu usuń `--exit`
   - Ta kolejność pozwala na rollback jeśli coś pójdzie nie tak

4. **Ten fix rozwiązuje problem ROOT CAUSE:**
   - Nie jest to workaround
   - Nie jest to hack
   - To proper architectural fix
   - Socket.IO connections są teraz properly managed

---

**Good luck! 🚀**

**Data utworzenia:** 2025-11-13
**Utworzył:** Claude Code
**Status:** ⏳ Gotowy do implementacji
