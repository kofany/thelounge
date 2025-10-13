# The Lounge + irssi fe-web Integration - Message Storage Implementation

## 🎯 CEL PROJEKTU

Dostosowanie implementacji **The Lounge** do łączenia się z WebSocket modułem **fe-web dla irssi** (budowanym równolegle).

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

### 2. Implementacja - Krok po kroku

#### A. Włączyć message storage
```typescript
// server/irssiClient.ts - handleMessage()

private handleMessage(networkUuid: string, channelId: number, msg: Msg): void {
    const network = this.networks.find((n) => n.uuid === networkUuid);
    const channel = network?.channels.find((c) => c.id === channelId);
    
    if (!channel) return;
    
    // 1. ADD TO CACHE (memory)
    channel.messages.push(msg);
    
    // Keep only last 1000 in cache
    if (channel.messages.length > 1000) {
        channel.messages.shift(); // Remove oldest
    }
    
    // 2. SAVE TO STORAGE (disk) - ASYNC!
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
    
    // 3. BROADCAST to all browsers
    this.broadcastToAllBrowsers("msg", {
        chan: channelId,
        msg: msg,
        unread: ...,
        highlight: ...,
    });
}
```

#### B. Loadować messages przy init
```typescript
// server/irssiClient.ts - handleInit()

private async handleInit(networks: NetworkData[]): Promise<void> {
    this.networks = networks;
    
    // Load last 1000 messages from storage for each channel
    if (this.messageStorage) {
        for (const network of networks) {
            for (const channel of network.channels) {
                try {
                    const messages = await this.messageStorage.getMessages(
                        {uuid: network.uuid} as Network,
                        {name: channel.name} as Channel,
                        () => this.idMsg++
                    );
                    
                    // Keep only last 1000 in cache
                    channel.messages = messages.slice(-1000);
                } catch (err) {
                    log.error(`Failed to load messages for ${channel.name}: ${err}`);
                    channel.messages = [];
                }
            }
        }
    }
    
    // Send init to all browsers
    this.broadcastToAllBrowsers("init", {...});
}
```

#### C. Wysyłać init do nowych przeglądarek
```typescript
// server/irssiClient.ts - attachBrowser()

attachBrowser(socket: Socket, openChannel: number = -1): void {
    const socketId = socket.id;
    
    this.attachedBrowsers.set(socketId, {socket, openChannel});
    
    log.info(`User ${this.name}: browser attached (${socketId}), total: ${this.attachedBrowsers.size}`);
    
    // If networks exist (not first browser), send init NOW
    if (this.networks.length > 0) {
        log.info(`User ${this.name}: sending init to new browser ${socketId}`);
        this.sendInitToSocket(socket);
    } else {
        log.info(`User ${this.name}: waiting for state_dump before sending init`);
    }
}

private sendInitToSocket(socket: Socket): void {
    // Convert NetworkData[] to SharedNetwork[] (same as handleInit)
    const sharedNetworks = this.networks.map(net => ({
        uuid: net.uuid,
        name: net.name,
        nick: net.nick,
        serverOptions: {...},
        status: {...},
        channels: net.channels.map(ch => ch.getFilteredClone(true)),
    }));
    
    socket.emit("init", {
        active: this.lastActiveChannel,
        networks: sharedNetworks,
        token: ...,
    });
}
```

#### D. Rozszerzyć `more()` o storage fallback
```typescript
// server/irssiClient.ts - more()

async more(data: {target: number; lastId: number}): Promise<{...} | null> {
    const channel = ...; // Find channel
    if (!channel) return null;
    
    let messages: Msg[] = [];
    let index = data.lastId < 0 
        ? channel.messages.length 
        : channel.messages.findIndex(m => m.id === data.lastId);
    
    if (index > 0) {
        const startIndex = Math.max(0, index - 100);
        messages = channel.messages.slice(startIndex, index);
    }
    
    // If cache doesn't have enough, load from storage
    if (messages.length < 100 && this.messageStorage) {
        const oldestCachedTime = channel.messages[0]?.time.getTime() || Date.now();
        
        // Load 100 older messages from storage
        const olderMessages = await this.messageStorage.getMessagesBefore(
            network.uuid,
            channel.name,
            oldestCachedTime,
            100
        );
        
        // Add to cache (prepend)
        channel.messages.unshift(...olderMessages);
        
        // Keep max 5000 in cache
        if (channel.messages.length > 5000) {
            channel.messages = channel.messages.slice(-5000);
        }
        
        messages = olderMessages;
    }
    
    return {chan: data.target, messages, totalMessages: ...};
}
```

#### E. Dodać metodę do EncryptedMessageStorage
```typescript
// server/plugins/messageStorage/encrypted.ts

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
    
    // Decrypt and return
    return rows.reverse().map(row => {
        const decrypted = this.decrypt(row.encrypted_data);
        const msg = JSON.parse(decrypted);
        msg.time = row.time;
        return new Msg(msg);
    });
}
```

---

## 🔐 ENCRYPTION

### Hasło użytkownika → Klucze:

```
User Password (bcrypt hash w config.password)
    ↓
PBKDF2(password, "thelounge_irssi_temp_salt", 10k iter, 256-bit)
    ↓
Encryption Key (32 bytes)
    ↓
    ├─→ Encrypt irssi WebSocket password → config.irssiConnection.passwordEncrypted
    ├─→ Encrypt messages → SQLite encrypted_data column
    └─→ Derive fe-web key → PBKDF2(irssi_password, "irssi-fe-web-v1", 10k iter)
```

### Message encryption format:
```
[IV 12 bytes][Ciphertext][Auth Tag 16 bytes]
```

### SQLite schema:
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

- **Buffer size:** 1000 messages w cache, max 5000 po lazy load
- **Storage retention:** 10 lat (wszystko!)
- **Lazy load:** 100 messages per request
- **Encryption:** AES-256-GCM (to samo hasło co fe-web)
- **Message types:** WSZYSTKO (MESSAGE, JOIN, PART, QUIT, KICK, MODE, TOPIC, etc.)
- **Timestamps:** TAK - wszystkie messages mają `time` field

---

## 🔗 PLIKI DO MODYFIKACJI

1. `server/irssiClient.ts` - główna logika
2. `server/plugins/messageStorage/encrypted.ts` - nowa metoda `getMessagesBefore()`
3. `server/feWebClient/feWebAdapter.ts` - wszystkie handlery (MESSAGE, JOIN, PART, etc.)

---

**Data utworzenia:** 2025-10-13  
**Status:** Ready for implementation

