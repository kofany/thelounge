# Network/Server Management Implementation

## Cel projektu
Implementacja graficznego zarządzania sieciami IRC i serwerami w irssilounge poprzez adaptację przycisku "Connect to network" z Vue UI.

## Zakres funkcjonalności
1. **Lista zapisanych sieci** - wyświetlanie sieci z `~/.irssi/config`
2. **Dodawanie nowej sieci** - formularz w Vue + komendy irssi (`/NETWORK ADD`, `/SERVER ADD`, `/SAVE`)
3. **Łączenie do sieci** - przycisk connect z poziomu UI (`/CONNECT`)
4. **Usuwanie sieci** - usunięcie konfiguracji z irssi
5. **Edycja sieci** - modyfikacja istniejących ustawień

## Architektura rozwiązania

### Backend (Node.js + TypeScript)
- **irssiNetworkManager.ts** - moduł zarządzający sieciami IRC
- **Socket events** - `network:list`, `network:add`, `network:connect`, `network:remove`
- **Config parser** - parsowanie `~/.irssi/config` do odczytu sieci

### Frontend (Vue 3)
- **NetworkManager.vue** - komponent z formularzem i listą sieci
- **Router integration** - podpięcie pod `/connect` route
- **Socket.io client** - komunikacja z backendem

### irssi fe-web (C)
- **Command execution** - wykonywanie komend przez `fe_web_client_execute_command()`
- **Config synchronization** - automatyczne `/SAVE` po zmianach

## Technologie
- **Backend**: Node.js, TypeScript, Socket.io
- **Frontend**: Vue 3, Composition API
- **irssi**: Native commands (`/NETWORK`, `/SERVER`, `/CONNECT`, `/SAVE`)

## Bezpieczeństwo
- Walidacja wszystkich parametrów przed wysłaniem do irssi
- Sanityzacja danych wejściowych (SQL injection prevention)
- Używanie natywnych komend irssi zamiast bezpośredniej modyfikacji pliku config

---

## Task List

### Phase 1: Backend Foundation ✅ COMPLETED
- [x] 1.1. Utworzyć interfejsy TypeScript dla IrssiServer i IrssiNetwork
- [x] 1.2. Utworzyć klasę IrssiNetworkManager z podstawową strukturą
- [x] 1.3. Zaimplementować parser `~/.irssi/config` (metoda `parseIrssiConfig()`)
- [x] 1.4. Zaimplementować metodę `listNetworks()` zwracającą listę sieci
- [x] 1.5. Sprawdzić kompilację TypeScript (`npx tsc --noEmit`)

### Phase 2: Backend Network Management ✅ COMPLETED
- [x] 2.1. Zaimplementować metodę `addNetwork()` z komendą `/NETWORK ADD`
- [x] 2.2. Zaimplementować metodę `addServerToNetwork()` z komendą `/SERVER ADD`
- [x] 2.3. Zaimplementować metodę `connectToNetwork()` z komendą `/CONNECT`
- [x] 2.4. Zaimplementować metodę `disconnectFromNetwork()` z komendą `/DISCONNECT`
- [x] 2.5. Zaimplementować metodę `removeNetwork()` z komendami `/SERVER REMOVE` i `/NETWORK REMOVE`
- [x] 2.6. Sprawdzić kompilację TypeScript (`npx tsc --noEmit`)

### Phase 3: Socket.io Integration ✅ COMPLETED
- [x] 3.1. Dodać socket event `network:list` w server.ts
- [x] 3.2. Dodać socket event `network:add` w server.ts
- [x] 3.3. Dodać socket event `network:connect` w server.ts
- [x] 3.4. Dodać socket event `network:disconnect` w server.ts
- [x] 3.5. Dodać socket event `network:remove` w server.ts
- [x] 3.6. Zintegrować IrssiNetworkManager z IrssiClient
- [x] 3.7. Sprawdzić kompilację TypeScript (`npx tsc --noEmit`)

### Phase 4: Frontend - NetworkManager Component
- [ ] 4.1. Utworzyć komponent `NetworkManager.vue` z podstawową strukturą
- [ ] 4.2. Dodać sekcję "Saved Networks" z listą sieci
- [ ] 4.3. Dodać formularz "Add New Network"
- [ ] 4.4. Zaimplementować logikę dodawania serwerów do sieci (multi-server support)
- [ ] 4.5. Dodać przyciski Connect/Edit/Remove dla każdej sieci
- [ ] 4.6. Zaimplementować obsługę socket events w komponencie

### Phase 5: Frontend - Socket Events & Integration
- [ ] 5.1. Dodać socket event types w shared/types/socket-events.d.ts
- [ ] 5.2. Utworzyć socket event handler dla `network:list`
- [ ] 5.3. Utworzyć socket event handler dla `network:add`
- [ ] 5.4. Utworzyć socket event handler dla `network:connect`
- [ ] 5.5. Utworzyć socket event handler dla `network:remove`

### Phase 6: Router & UI Integration
- [ ] 6.1. Dodać route `/connect` w Vue Router
- [ ] 6.2. Zintegrować NetworkManager.vue z layoutem aplikacji
- [ ] 6.3. Sprawdzić czy przycisk "Connect to network" w Sidebar.vue działa
- [ ] 6.4. Dodać style CSS dla NetworkManager komponentu

### Phase 7: Testing & Refinement
- [ ] 7.1. Sprawdzić kompilację TypeScript (`npx tsc --noEmit`)
- [ ] 7.2. Sprawdzić build Vue (`npm run build`)
- [ ] 7.3. Sprawdzić kompilację irssi C code (jeśli były zmiany)
- [ ] 7.4. Przegląd kodu - usunięcie wszystkich TODO komentarzy
- [ ] 7.5. Commit finalny z pełną implementacją

---

## Notatki implementacyjne

### Format ~/.irssi/config
```
servers = (
  { address = "irc.libera.chat"; chatnet = "liberachat"; port = "6697"; use_tls = "yes"; }
);

chatnets = {
  liberachat = { type = "IRC"; max_kicks = "1"; max_msgs = "4"; };
};
```

### Przykładowe komendy irssi
```
/NETWORK ADD liberachat
/NETWORK MODIFY -nick myname liberachat
/SERVER ADD -auto -tls -network liberachat irc.libera.chat 6697
/SAVE
/CONNECT liberachat
```

### Ważne uwagi
- Parser musi obsługiwać zagnieżdżone struktury config irssi
- Wszystkie komendy muszą być walidowane przed wysłaniem
- `/SAVE` musi być wywoływane po każdej zmianie konfiguracji
- Należy obsłużyć przypadki edge (brak sieci, duplikaty, błędy połączenia)

---

## Status: 🟢 IN PROGRESS
**Current Phase**: Phase 4 - Frontend NetworkManager Component
**Completed**: Phase 1 ✅, Phase 2 ✅, Phase 3 ✅
**Last Updated**: 2025-10-15
