# The Lounge Backend Architecture - irssi Proxy Mode

**Wersja:** 2.0 (Backend Proxy)
**Data:** 2025-10-12
**Status:** 🚧 W implementacji

## 🎯 Cel

Przekształcenie The Lounge w **multi-user proxy** do irssi z:
- Persistent WebSocket connections (zawsze aktywne)
- Encrypted message storage (AES-256-GCM)
- Multi-session support (wiele przeglądarek per user)
- Synchronizacja stanu między wszystkimi urządzeniami

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    PRZEGLĄDARKI                              │
│  Browser 1 (Desktop) | Browser 2 (Mobile) | Browser 3 (Work) │
└────────────┬─────────────────┬─────────────────┬────────────┘
             │ Socket.IO       │ Socket.IO       │ Socket.IO
             └─────────────────┴─────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│              THE LOUNGE BACKEND (Node.js)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ClientManager                                         │ │
│  │  - Zarządza wszystkimi użytkownikami                   │ │
│  │  - Ładuje users z ~/.thelounge/users/*.json            │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │  Client (per user: "alice")                            │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ encryptionKey: Buffer (in RAM)                   │ │ │
│  │  │ - PBKDF2(userPassword, salt=irssiPassword)       │ │ │
│  │  │ - Przechowywany ZAWSZE (persistent)              │ │ │
│  │  │ - Używany do szyfrowania logów                   │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ irssiConnection: FeWebSocket (persistent!)       │ │ │
│  │  │ - WebSocket do irssi fe-web                      │ │ │
│  │  │ - AES-256-GCM encryption                         │ │ │
│  │  │ - Auto-reconnect (exponential backoff)           │ │ │
│  │  │ - ZAWSZE aktywne (nawet gdy user offline)        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ attachedBrowsers: Map<socketId, Socket>          │ │ │
│  │  │ - Browser 1: socket_abc123                       │ │ │
│  │  │ - Browser 2: socket_def456                       │ │ │
│  │  │ - Browser 3: socket_ghi789                       │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ messageStorage: EncryptedMessageStorage          │ │ │
│  │  │ - SQLite database (~/.thelounge/logs/alice.db)   │ │ │
│  │  │ - Messages encrypted: [IV 12B][Cipher][Tag 16B]  │ │ │
│  │  │ - LRU cache dla performance                      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ WebSocket (ws://)
                            │ Binary frames (encrypted)
┌───────────────────────────▼──────────────────────────────────┐
│                  irssi fe-web module                         │
│  - WebSocket server (port 9001)                             │
│  - Per-user authentication (password)                       │
│  - IRC state management                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Encryption Architecture

### Dual-Key System

**1. Authentication Key** (bcrypt hash):
```json
// ~/.thelounge/users/alice.json
{
  "password": "$2a$11$xyz..." // bcrypt hash - weryfikacja logowania do The Lounge
}
```

**2. Encryption Key** (PBKDF2-derived, in-memory):
```typescript
// Generowany podczas logowania
const encryptionKey = crypto.pbkdf2Sync(
  userPassword,      // "secret123" (hasło użytkownika do The Lounge)
  irssiPassword,     // "irssi_pass_456" (hasło do irssi WebSocket - SALT)
  10000,             // iterations
  32,                // key length (256 bits)
  'sha256'
);
```

**3. irssi Password** (encrypted, on-disk):
```json
// ~/.thelounge/users/alice.json
{
  "irssiConnection": {
    "host": "127.0.0.1",
    "port": 9001,
    "passwordEncrypted": "..." // Encrypted with encryptionKey
  }
}
```

### Encryption Flow

**Logowanie użytkownika**:
```
1. User → Browser: username="alice", password="secret123"
2. Backend: bcrypt.compare("secret123", stored_hash) ✓
3. Backend: Decrypt irssi password:
   - encryptionKey = PBKDF2("secret123", salt="temporary_salt")
   - irssiPassword = decrypt(passwordEncrypted, encryptionKey)
4. Backend: Derive final encryption key:
   - encryptionKey = PBKDF2("secret123", salt=irssiPassword)
5. Backend: Store in memory:
   - client.encryptionKey = encryptionKey
6. Backend: Connect to irssi:
   - irssiConnection = new FeWebSocket({password: irssiPassword, userPassword: "secret123"})
7. Backend: Initialize message storage:
   - messageStorage = new EncryptedMessageStorage(encryptionKey)
```

**Zapisywanie wiadomości**:
```
1. irssi → Backend: {"type": "message", "text": "Secret message", ...}
2. Backend: Encrypt message:
   - plaintext = JSON.stringify(message)
   - iv = crypto.randomBytes(12)
   - cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
   - encrypted = [iv, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]
3. Backend: Save to SQLite:
   - INSERT INTO messages (user, network, channel, time, encrypted_data) VALUES (...)
4. Backend: Broadcast to all browsers:
   - for (socket of attachedBrowsers) { socket.emit("msg", message) }
```

## 📊 Database Schema

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,           -- "alice"
  network TEXT NOT NULL,         -- "libera"
  channel TEXT NOT NULL,         -- "#irssi"
  time INTEGER NOT NULL,         -- Unix timestamp
  encrypted_data BLOB NOT NULL   -- [IV 12B][Encrypted JSON][Tag 16B]
);

CREATE INDEX idx_messages_user_channel ON messages(user, network, channel, time);
```

**Encrypted Data Format**:
```
[IV 12 bytes][Ciphertext (variable)][Auth Tag 16 bytes]
```

**Decrypted JSON**:
```json
{
  "type": "message",
  "from_nick": "bob",
  "text": "Secret message",
  "self": false,
  "hostmask": "bob@example.com",
  "timestamp": 1706198400
}
```

## 🔄 Message Flow

### Scenario 1: User loguje się (pierwsza sesja)

```
1. Browser → Backend (Socket.IO)
   Event: "auth:perform" {username: "alice", password: "secret123"}

2. Backend (server/server.ts):
   - Weryfikuje password: bcrypt.compare("secret123", stored_hash)
   - Wywołuje: clientManager.loginUser("alice", "secret123")

3. ClientManager:
   - Znajduje lub tworzy Client object dla "alice"
   - Wywołuje: client.login("secret123")

4. Client.login():
   - Decrypt irssi password: irssiPassword = decrypt(passwordEncrypted, tempKey)
   - Generuje encryption key: PBKDF2("secret123", salt=irssiPassword)
   - Zapisuje: this.encryptionKey = key
   - Tworzy EncryptedMessageStorage: new EncryptedMessageStorage(key)
   - Tworzy FeWebSocket: new FeWebSocket({password: irssiPassword, userPassword: "secret123"})
   - Łączy do irssi: await this.irssiConnection.connect()
   - Rejestruje event handlers: this.irssiConnection.on("message", this.handleIrssiMessage)

5. irssi fe-web → Backend (WebSocket)
   Binary frame: [IV][Encrypted JSON][Tag]
   Decrypted: {"type": "auth_ok"}

6. irssi fe-web → Backend (WebSocket)
   Binary frame: [IV][Encrypted JSON][Tag]
   Decrypted: {"type": "state_dump", "server": "libera"}
   Decrypted: {"type": "channel_join", "server": "libera", "channel": "#irssi", ...}
   Decrypted: {"type": "message", "server": "libera", "channel": "#irssi", "text": "Hello", ...}

7. Client.handleIrssiMessage():
   - Zapisuje do EncryptedMessageStorage: await this.messageStorage.saveMessage(msg)
   - Emituje do wszystkich attachedBrowsers: socket.emit("msg", {chan, msg})

8. Backend → Browser (Socket.IO)
   Event: "init" {networks: [...], active: -1}
   Event: "msg" {chan: 123, msg: {...}}
```

### Scenario 2: User wysyła wiadomość

```
1. Browser → Backend (Socket.IO)
   Event: "input" {target: 123, text: "/msg #irssi Hello"}

2. Backend (server/server.ts):
   - Znajduje Client object dla tego socket
   - Wywołuje: client.handleInput(target, text)

3. Client.handleInput():
   - Konwertuje input → fe-web command format
   - Wysyła do irssi: this.irssiConnection.executeCommand("/msg #irssi Hello")

4. Backend → irssi (WebSocket)
   Binary frame: [IV][Encrypted JSON][Tag]
   Decrypted: {"type": "command", "command": "/msg #irssi Hello"}

5. irssi fe-web → Backend (WebSocket)
   Binary frame: [IV][Encrypted JSON][Tag]
   Decrypted: {"type": "message", "channel": "#irssi", "text": "Hello", "is_own": true}

6. Client.handleIrssiMessage():
   - Zapisuje do EncryptedMessageStorage
   - Emituje do WSZYSTKICH attachedBrowsers (włącznie z nadawcą)
```

### Scenario 3: User loguje się z drugiego urządzenia

```
1. Browser 2 → Backend (Socket.IO)
   Event: "auth:perform" {username: "alice", password: "secret123"}

2. Backend:
   - Client object już istnieje (persistent connection do irssi)
   - Weryfikuje password
   - Wywołuje: client.attachBrowser(socket)

3. Client.attachBrowser():
   - Dodaje socket do attachedBrowsers
   - Wysyła initial state z messageStorage:
     - socket.emit("init", {networks: [...]})
     - socket.emit("msg", {chan, msg}) // dla każdej wiadomości z historii

4. Od teraz:
   - Wszystkie wiadomości z irssi są broadcastowane do Browser 1 i Browser 2
   - Wiadomości wysłane z Browser 1 są widoczne na Browser 2 (i vice versa)
```

## 🔧 Kluczowe Komponenty

### 1. FeWebSocket (server/feWebClient/feWebSocket.ts)
- WebSocket client do irssi fe-web (Node.js `ws` library)
- AES-256-GCM encryption/decryption
- Auto-reconnect z exponential backoff
- Event handlers dla 20 server message types

### 2. FeWebEncryption (server/feWebClient/feWebEncryption.ts)
- PBKDF2 key derivation (userPassword + irssiPassword salt)
- AES-256-GCM encrypt/decrypt
- Node.js crypto API

### 3. EncryptedMessageStorage (server/plugins/messageStorage/encrypted.ts)
- SQLite database z encrypted messages
- LRU cache dla performance
- Re-encryption support (password change)

### 4. Modified Client (server/client.ts)
- Usunięte: `networks: Network[]` (IRC zarządzane przez irssi)
- Dodane: `irssiConnection: FeWebSocket`
- Dodane: `encryptionKey: Buffer`
- Dodane: `attachedBrowsers: Map<string, Socket>`
- Dodane: `messageStorage: EncryptedMessageStorage`

## ⚠️ Bezpieczeństwo

### ✅ Zalety:
- Logi szyfrowane AES-256-GCM (nie plaintext na dysku)
- Encryption key derived z hasła użytkownika
- irssi password szyfrowane (nie plaintext w config)
- Każdy user ma osobny encryption key

### ⚠️ Ograniczenia:
- Encryption key przechowywany w RAM (persistent)
- Admin z root access może dump memory → extract key
- Wymaga zaufania do administratora serwera

### 🛡️ Mitigacje:
- Uruchom The Lounge w izolowanym środowisku (Docker, VM)
- Użyj encrypted swap (Linux: dm-crypt)
- Regularnie restartuj serwer (clear memory)
- Użyj strong passwords (min 16 znaków)

## 📅 Status Implementacji

- [x] FeWebEncryption (server-side)
- [x] FeWebSocket (server-side)
- [ ] FeWebAdapter (server-side)
- [ ] EncryptedMessageStorage
- [ ] Modified Client class
- [ ] Server integration
- [ ] Testing

