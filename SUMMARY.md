# The Lounge + irssi fe-web Integration - Message Storage Implementation

## 🎯 CEL PROJEKTU

Dostosowanie implementacji **The Lounge** do łączenia się z WebSocket modułem **fe-web dla irssi** (budowanym równolegle).

### ⚠️ WAŻNE - AUTOCONNECT NA STARCIE!

**PROBLEM DO ROZWIĄZANIA (PRIORYTET #1):**

Jeśli user ma już skonfigurowane irssi proxy (host, port, password), to backend **POWINIEN ŁĄCZYĆ SIĘ DO IRSSI OD RAZU** przy starcie The Lounge (`npm start`), **NIE CZEKAJĄC** na pierwszą przeglądarkę!

**Obecny flow (ZŁY):**
```
npm start → Backend startuje → Czeka na login → User loguje się → Backend łączy do irssi
```

**Docelowy flow (DOBRY):**
```
npm start → Backend startuje → Sprawdza config → Jeśli passwordEncrypted != "" → Łączy do irssi OD RAZU
                                                                                    ↓
                                                                    User loguje się → Dostaje init z cache!
```

**Rozwiązanie encryption:**
- Używamy **IP+PORT** jako salt do szyfrowania hasła irssi
- `PBKDF2(irssiPassword, "${host}:${port}", 10k iter, 256-bit)` → Encryption Key
- Zapisujemy encrypted password w config
- Przy starcie: odczytujemy IP+PORT z config → derive key → decrypt password → connect!

### Architektura:
```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Browser 1  │◄───────►│                  │◄───────►│             │
├─────────────┤  HTTP   │  The Lounge      │  WSS    │   irssi     │
│  Browser 2  │◄───────►│  Backend         │◄───────►│  + fe-web   │
├─────────────┤         │                  │         │             │
│  Browser 3  │◄───────►│  (Node.js)       │         │  (Perl)     │
└─────────────┘         └──────────────────┘         └─────────────┘
                         ▲                             ▲
                         │                             │
                    Encrypted                     Encrypted
                    SQLite DB                     WebSocket
                    (AES-256-GCM)                (AES-256-GCM)
```

### Kluczowe założenia:
1. **NIE UŻYWAMY trybu IRC** - The Lounge działa TYLKO jako proxy do irssi
2. **Backend trzyma połączenie z irssi** - jedno WebSocket connection per user
3. **Frontend łączy się do backendu** - wiele przeglądarek per user
4. **Backend cachuje stan** - networks, channels, users, messages
5. **Wszystkie przeglądarki widzą to samo** - synchronizacja przez backend

---

## 🔧 OBECNY STAN (CO JUŻ DZIAŁA)

### ✅ Zaimplementowane:
1. **FeWebSocket** - WebSocket client dla irssi fe-web
   - Dual-layer encryption: TLS + AES-256-GCM
   - PBKDF2 key derivation (password + "irssi-fe-web-v1", 10k iterations)
   - Binary frames, ping/pong keepalive

2. **FeWebAdapter** - mapowanie fe-web messages → The Lounge events
   - 20 server→client message types
   - 4 client→server message types
   - Pełna implementacja CLIENT-SPEC.md

3. **IrssiClient** - zmodyfikowany Client class
   - Persistent WebSocket connection do irssi
   - Multiple browser sessions (`attachedBrowsers: Map<socketId, BrowserSession>`)
   - Networks cache (`networks: NetworkData[]`)
   - Encrypted message storage (wyłączony - do włączenia!)

4. **Frontend integration**
   - Socket.IO events
   - Vue components (MessageList, nicklist, etc.)
   - Lazy loading UI ("Show older messages" button)

5. **Message types**
   - MESSAGE, NOTICE, JOIN, PART, QUIT, KICK, MODE, TOPIC
   - Nicklist updates (delta updates dla wydajności)
   - Channel modes, user modes
   - WHOIS, channel list

### ❌ NIE DZIAŁA (DO NAPRAWY):
1. **Messages NIE SĄ ZAPISYWANE** do storage
   - `if (this.messageStorage && false)` - wyłączone!
   - `channel.messages` pozostaje puste

2. **Messages NIE SĄ DODAWANE** do cache
   - `handleMessage()` tylko emituje event do frontendów
   - Nie dodaje do `channel.messages` array

3. **Druga przeglądarka NIE DOSTAJE init event**
   - `attachBrowser()` nie wysyła init jeśli `this.networks` już istnieje
   - Czeka na `state_dump` który NIE PRZYJDZIE (bo już połączony)

4. **Lazy loading NIE DZIAŁA**
   - Frontend wysyła `socket.emit("more")`
   - Backend `more()` zwraca `chan.messages.slice()`
   - Ale `chan.messages` jest PUSTE!

---

## 🎯 CO TRZEBA ZROBIĆ

### 1. Message Storage - Wymagania

#### Buffer w pamięci (cache):
- **1000 ostatnich linii** per kanał/query
- Nowe messages wypychają stare (FIFO)
- Używany dla:
  - Initial load (100 messages dla aktywnego kanału, 1 dla innych)
  - Lazy loading (`more` event - 100 messages per request)

#### Storage na dysku (SQLite):
- **10 lat wstecz** - wszystko!
- **Encrypted** - AES-256-GCM (to samo hasło co fe-web)
- **Wszystkie message types:**
  - MESSAGE, NOTICE (chat messages)
  - JOIN, PART, QUIT (user events)
  - KICK, MODE, TOPIC (channel events)
  - Wszystko z timestampami!

#### Lazy loading:
- Scroll w górę → "Show older messages" button
- Klik → `socket.emit("more", {target, lastId})`
- Backend → pobiera 100 starszych messages z cache
- Jeśli cache nie ma → pobiera z storage (SQLite)
- Max 5000 messages w cache (po lazy load)

### 2. Backend Cache - CO TRZYMAMY W PAMIĘCI

**WAŻNE:** Backend cache **NIE TRZYMA MESSAGES**!

```typescript
this.networks = [
  {
    uuid: "...",
    name: "IRCnet",
    nick: "kofany",
    channels: [
      {
        id: 1,
        name: "#polska",
        users: Map<nick, User>,  // ✅ ZAWSZE AKTUALNY (nicklist)
        messages: []              // ❌ PUSTE! Nie cachujemy messages!
      }
    ]
  }
]
```

**Co trzymamy:**
- ✅ Networks (uuid, name, nick, serverOptions)
- ✅ Channels (id, name, topic, state)
- ✅ Users (nicklist - Map<nick, User>)
- ✅ Open queries (prywatne rozmowy)
- ❌ Messages (tylko w SQLite storage!)

**Dlaczego nie cachujemy messages:**
- Pamięć: 1000 messages × 100 kanałów × 10 users = dużo RAM!
- Storage jest szybki (SQLite + encryption)
- Frontend ładuje lazy (100 messages per request)

### 3. Initial Load - KAŻDA Przeglądarka (1sza, 2ga, 5ta - bez różnicy!)

**WAŻNE:** Initial load robi **BACKEND**, nie frontend! Każda przeglądarka jest obsługiwana **IDENTYCZNIE**!

**Flow dla KAŻDEJ przeglądarki:**

```
Browser podłącza się (obojętnie która - 1sza, 2ga, 5ta)
    ↓
Backend: attachBrowser()
    ↓
Backend: sendInitToSocket(socket)
    ↓
Dla KAŻDEGO kanału/query w this.networks[].channels[]:
  - Pobiera 100 ostatnich messages z STORAGE (SQLite)
  - Dodaje do channel.messages (tymczasowo, tylko dla tego init)
    ↓
Wysyła init event:
  - networks (z cache)
  - channels (z cache + 100 messages z storage dla każdego!)
  - users (z cache)
    ↓
Frontend otrzymuje init
    ↓
Frontend wyświetla wszystko OD RAZU:
  - Networks, channels, nicklist
  - 100 ostatnich messages dla każdego kanału/query
    ↓
User scrolluje w górę → "Show older messages" button
    ↓
Frontend: socket.emit("more", {target: channelId, lastId: oldestId})
    ↓
Backend: more() - pobiera kolejne 100 z storage
    ↓
Frontend: dodaje starsze messages na początek listy
```

**WAŻNE:**
- Open queries też muszą być w cache (`this.networks[].channels[]`)!
- Jeśli ktoś napisał do nas godzinę temu, query **MUSI BYĆ** w channels[] żeby backend mógł załadować messages przy init!
- Backend ładuje messages **PRZY KAŻDYM INIT** (dla każdej przeglądarki osobno)

### 4. Implementacja - Krok po kroku

#### A. Zapisywać messages do storage (BEZ CACHE!)

```typescript
// server/irssiClient.ts - handleMessage()

private handleMessage(networkUuid: string, channelId: number, msg: Msg): void {
    const network = this.networks.find((n) => n.uuid === networkUuid);
    const channel = network?.channels.find((c) => c.id === channelId);

    if (!channel) return;

    // 1. SAVE TO STORAGE (disk) - ASYNC!
    // NIE DODAJEMY DO channel.messages - to zostaje PUSTE!
    if (this.messageStorage) {
        // Create minimal Network/Channel objects for storage
        const networkForStorage = {
            uuid: network.uuid,
            name: network.name,
        } as Network;

        const channelForStorage = {
            name: channel.name,
        } as Channel;

        // Save encrypted to SQLite
        this.messageStorage.index(networkForStorage, channelForStorage, msg)
            .catch(err => log.error(`Failed to save message: ${err}`));
    }

    // 2. BROADCAST to all browsers (live update)
    this.broadcastToAllBrowsers("msg", {
        chan: channelId,
        msg: msg,
        unread: ...,
        highlight: ...,
    });
}
```

#### B. Loadować messages przy KAŻDYM sendInitToSocket()

```typescript
// server/irssiClient.ts - handleInit()

private async handleInit(networks: NetworkData[]): Promise<void> {
    this.networks = networks;

    // NIE ŁADUJEMY MESSAGES tutaj!
    // Będziemy ładować przy sendInitToSocket() dla każdej przeglądarki osobno

    // Send init to all browsers (jeśli są już podłączone)
    this.broadcastToAllBrowsers("init", {...});
}
```

#### C. Wysyłać init do KAŻDEJ przeglądarki (z messages!)

```typescript
// server/irssiClient.ts - attachBrowser()

attachBrowser(socket: Socket, openChannel: number = -1): void {
    const socketId = socket.id;

    this.attachedBrowsers.set(socketId, {socket, openChannel});

    log.info(`User ${this.name}: browser attached (${socketId}), total: ${this.attachedBrowsers.size}`);

    // If networks exist, send init NOW (dla KAŻDEJ przeglądarki!)
    if (this.networks.length > 0) {
        log.info(`User ${this.name}: sending init to browser ${socketId}`);
        this.sendInitToSocket(socket);
    } else {
        log.info(`User ${this.name}: waiting for state_dump before sending init`);
    }
}

private async sendInitToSocket(socket: Socket): Promise<void> {
    // ŁADUJEMY MESSAGES Z STORAGE dla każdego kanału/query!
    if (this.messageStorage) {
        for (const network of this.networks) {
            for (const channel of network.channels) {
                try {
                    // Pobierz 100 ostatnich messages z storage
                    const messages = await this.messageStorage.getLastMessages(
                        network.uuid,
                        channel.name,
                        100
                    );

                    // TYMCZASOWO dodaj do channel.messages (tylko dla tego init!)
                    channel.messages = messages;
                } catch (err) {
                    log.error(`Failed to load messages for ${channel.name}: ${err}`);
                    channel.messages = [];
                }
            }
        }
    }

    // Convert NetworkData[] to SharedNetwork[]
    const sharedNetworks = this.networks.map(net => ({
        uuid: net.uuid,
        name: net.name,
        nick: net.nick,
        serverOptions: {...},
        status: {...},
        channels: net.channels.map(ch => ch.getFilteredClone(true)), // Zawiera messages!
    }));

    // Wyczyść messages z cache (nie trzymamy w pamięci!)
    for (const network of this.networks) {
        for (const channel of network.channels) {
            channel.messages = [];
        }
    }

    socket.emit("init", {
        active: this.lastActiveChannel,
        networks: sharedNetworks,
        token: ...,
    });
}
```

#### D. Zmienić `more()` - ZAWSZE pobierać z storage

```typescript
// server/irssiClient.ts - more()

async more(data: {target: number; lastId: number}): Promise<{...} | null> {
    const channel = ...; // Find channel
    const network = ...; // Find network
    if (!channel || !network) return null;

    // ZAWSZE pobieramy z storage (NIE Z CACHE!)
    if (!this.messageStorage) {
        return {chan: data.target, messages: [], totalMessages: 0};
    }

    let messages: Msg[] = [];

    if (data.lastId < 0) {
        // Initial load - last 100 messages
        messages = await this.messageStorage.getLastMessages(
            network.uuid,
            channel.name,
            100
        );
    } else {
        // Lazy load - 100 messages before lastId
        const lastMsg = await this.messageStorage.getMessageById(data.lastId);
        if (lastMsg) {
            messages = await this.messageStorage.getMessagesBefore(
                network.uuid,
                channel.name,
                lastMsg.time.getTime(),
                100
            );
        }
    }

    // Get total count for "moreHistoryAvailable"
    const totalMessages = await this.messageStorage.getMessageCount(
        network.uuid,
        channel.name
    );

    return {
        chan: data.target,
        messages,
        totalMessages
    };
}
```

#### E. Dodać metody do EncryptedMessageStorage

```typescript
// server/plugins/messageStorage/encrypted.ts

// Get last N messages
async getLastMessages(
    networkUuid: string,
    channelName: string,
    limit: number
): Promise<Message[]> {
    await this.initDone.promise;
    if (!this.isEnabled) return [];

    const rows = await this.serialize_fetchall(
        "SELECT encrypted_data, time FROM messages WHERE network = ? AND channel = ? ORDER BY time DESC LIMIT ?",
        networkUuid,
        channelName.toLowerCase(),
        limit
    );

    return rows.reverse().map(row => {
        const decrypted = this.decrypt(row.encrypted_data);
        const msg = JSON.parse(decrypted);
        msg.time = row.time;
        msg.id = this.nextId(); // Generate new ID
        return new Msg(msg);
    });
}

// Get messages before timestamp
async getMessagesBefore(
    networkUuid: string,
    channelName: string,
    beforeTime: number,
    limit: number
): Promise<Message[]> {
    await this.initDone.promise;
    if (!this.isEnabled) return [];

    const rows = await this.serialize_fetchall(
        "SELECT encrypted_data, time FROM messages WHERE network = ? AND channel = ? AND time < ? ORDER BY time DESC LIMIT ?",
        networkUuid,
        channelName.toLowerCase(),
        beforeTime,
        limit
    );

    return rows.reverse().map(row => {
        const decrypted = this.decrypt(row.encrypted_data);
        const msg = JSON.parse(decrypted);
        msg.time = row.time;
        msg.id = this.nextId();
        return new Msg(msg);
    });
}

// Get total message count
async getMessageCount(
    networkUuid: string,
    channelName: string
): Promise<number> {
    await this.initDone.promise;
    if (!this.isEnabled) return 0;

    const row = await this.serialize_get(
        "SELECT COUNT(*) as count FROM messages WHERE network = ? AND channel = ?",
        networkUuid,
        channelName.toLowerCase()
    );

    return row?.count || 0;
}

// Get message by ID (for lazy loading)
async getMessageById(messageId: number): Promise<Message | null> {
    // This requires storing message ID in database
    // For now, we can skip this and use timestamp-based approach
    return null;
}
```

#### F. Autoconnect przy starcie The Lounge

```typescript
// server/clientManager.ts - loadUser()

loadUser(name: string): IrssiClient {
    const userConfig = this.readUserConfig(name);
    const client = new IrssiClient(this, name, userConfig);

    this.clients.push(client);

    // ✅ AUTOCONNECT: Jeśli user ma skonfigurowane irssi, połącz OD RAZU!
    if (userConfig.irssiConnection?.passwordEncrypted) {
        log.info(`User ${name} has irssi config - autoconnecting...`);

        // Decrypt password using IP+PORT as salt
        const host = userConfig.irssiConnection.host;
        const port = userConfig.irssiConnection.port;
        const salt = `${host}:${port}`;

        try {
            const key = crypto.pbkdf2Sync(
                userConfig.irssiConnection.passwordEncrypted,
                salt,
                10000,
                32,
                "sha256"
            );

            // Decrypt password
            const decrypted = this.decryptWithKey(
                userConfig.irssiConnection.passwordEncrypted,
                key
            );

            // Connect to irssi
            client.autoConnect(decrypted).catch(err => {
                log.error(`Autoconnect failed for ${name}: ${err}`);
            });
        } catch (err) {
            log.error(`Failed to decrypt irssi password for ${name}: ${err}`);
        }
    }

    return client;
}
```

#### G. Zmienić encryption na IP+PORT salt

```typescript
// server/irssiConfigHelper.ts

export async function encryptIrssiPassword(
    irssiPassword: string,
    host: string,
    port: number
): Promise<string> {
    // Use IP+PORT as salt
    const salt = `${host}:${port}`;
    const key = crypto.pbkdf2Sync(irssiPassword, salt, 10000, 32, "sha256");

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);

    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(irssiPassword, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Format: [IV (12 bytes)] [Ciphertext] [Tag (16 bytes)]
    const result = Buffer.concat([iv, encrypted, tag]);
    return result.toString("base64");
}

export async function decryptIrssiPassword(
    encryptedPassword: string,
    host: string,
    port: number
): Promise<string> {
    // Use IP+PORT as salt
    const salt = `${host}:${port}`;
    const key = crypto.pbkdf2Sync(encryptedPassword, salt, 10000, 32, "sha256");

    const encryptedBuffer = Buffer.from(encryptedPassword, "base64");

    // Parse: [IV (12 bytes)] [Ciphertext] [Tag (16 bytes)]
    const iv = encryptedBuffer.slice(0, 12);
    const tag = encryptedBuffer.slice(-16);
    const ciphertext = encryptedBuffer.slice(12, -16);

    // Decrypt with AES-256-GCM
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
}
```

---

## 🔐 ENCRYPTION - NOWA ARCHITEKTURA

### ⚠️ ZMIANA: IP+PORT jako salt (zamiast user password)

**STARA METODA (wymagała user password przy starcie):**
```
User Password → PBKDF2 → Encryption Key → Decrypt irssi password
```
❌ Problem: Nie możemy autoconnect przy starcie (nie mamy user password)

**NOWA METODA (używa IP+PORT):**
```
irssi Password + IP+PORT → PBKDF2 → Encrypted Password → Save to config
```
✅ Rozwiązanie: IP+PORT są w config (plaintext), możemy decrypt przy starcie!

### Encryption flow:

```
1. User zapisuje irssi config (host, port, password):
   PBKDF2(irssiPassword, "${host}:${port}", 10k iter, 256-bit) → Encryption Key
   Encrypt(irssiPassword, key) → passwordEncrypted → Save to config

2. Backend startuje (npm start):
   Read config → host, port, passwordEncrypted
   PBKDF2(passwordEncrypted, "${host}:${port}", 10k iter) → Encryption Key
   Decrypt(passwordEncrypted, key) → irssiPassword
   Connect to irssi!

3. User zmienia IP/PORT:
   Re-encrypt password z nowym salt "${newHost}:${newPort}"
```

### Message encryption (bez zmian):

```
[IV 12 bytes][Ciphertext][Auth Tag 16 bytes]
```

Używamy user password do encryption key dla messages:
```
User Password → PBKDF2("thelounge_irssi_temp_salt") → Message Encryption Key
```

### SQLite schema (bez zmian):

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network TEXT,           -- plaintext (for indexing)
    channel TEXT,           -- plaintext (for indexing)
    time INTEGER,           -- plaintext (for sorting)
    encrypted_data BLOB     -- [IV][Encrypted JSON][Tag]
);
CREATE INDEX network_channel ON messages (network, channel);
CREATE INDEX time ON messages (time);
```

---

## 📊 FLOW DIAGRAM

### Initial connection (first browser):
```
Browser 1 → Login → Backend
                      ↓
                  Connect to irssi (WebSocket)
                      ↓
                  Receive state_dump
                      ↓
                  Load messages from SQLite (last 1000 per channel)
                      ↓
                  Store in this.networks[].channels[].messages
                      ↓
                  Send init event → Browser 1
```

### Second browser connection:
```
Browser 2 → Login → Backend
                      ↓
                  irssi already connected ✅
                      ↓
                  this.networks already populated ✅
                      ↓
                  Send init event → Browser 2 (from cache!)
```

### New message arrives:
```
irssi → fe-web message → Backend
                           ↓
                      Add to channel.messages (cache)
                           ↓
                      Save to SQLite (async)
                           ↓
                      Broadcast to ALL browsers
```

### Lazy loading (scroll up):
```
Browser → "Show older messages" → socket.emit("more", {target, lastId})
                                        ↓
                                   Backend: more()
                                        ↓
                                   Check cache (channel.messages)
                                        ↓
                                   If not enough → Load from SQLite
                                        ↓
                                   Add to cache (max 5000)
                                        ↓
                                   Return 100 messages → Browser
```

---

## 🚀 NASTĘPNE KROKI

1. **Włączyć message storage** - usunąć `&& false` w `handleMessage()`
2. **Dodać messages do cache** - `channel.messages.push(msg)`
3. **Loadować z storage przy init** - `getMessages()` dla każdego kanału
4. **Wysyłać init do nowych przeglądarek** - `sendInitToSocket()`
5. **Rozszerzyć `more()`** - fallback do storage jeśli cache nie ma
6. **Dodać `getMessagesBefore()`** - nowa metoda w EncryptedMessageStorage
7. **Testować** - wiele przeglądarek, lazy loading, encryption

---

## 📝 NOTATKI

- **Backend cache:** NIE TRZYMA MESSAGES! Tylko networks, channels, users
- **Storage retention:** 10 lat (wszystko!)
- **Lazy load:** 100 messages per request (ZAWSZE z storage)
- **Encryption irssi password:** IP+PORT jako salt (autoconnect!)
- **Encryption messages:** User password jako salt (jak dotychczas)
- **Message types:** WSZYSTKO (MESSAGE, JOIN, PART, QUIT, KICK, MODE, TOPIC, etc.)
- **Timestamps:** TAK - wszystkie messages mają `time` field
- **Open queries:** Muszą być w cache (channels[]) żeby frontend mógł pobrać messages!

---

## 🔗 PLIKI DO MODYFIKACJI

1. `server/irssiClient.ts` - główna logika
2. `server/plugins/messageStorage/encrypted.ts` - nowa metoda `getMessagesBefore()`
3. `server/feWebClient/feWebAdapter.ts` - wszystkie handlery (MESSAGE, JOIN, PART, etc.)

---

**Data utworzenia:** 2025-10-13  
**Status:** Ready for implementation

