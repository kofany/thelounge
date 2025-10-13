# Flow Analysis: Frontend ↔ Backend ↔ fe-web

## 1. POŁĄCZENIE I AUTENTYKACJA (✅ DZIAŁA)

### Frontend → Backend (Socket.IO)
```
Browser connects to http://localhost:9000
Socket.IO handshake
Login with The Lounge password
```

### Backend → fe-web (WebSocket)
```
1. Connect to wss://localhost:9001/?password=Pulinek1708
2. TLS handshake (TLSv1.2/1.3)
3. WebSocket handshake
4. Receive auth_ok
5. Send sync_server with server="*"
```

**STATUS:** ✅ DZIAŁA - autentykacja OK, połączenie OK

---

## 2. SYNCHRONIZACJA STANU (state_dump)

### fe-web → Backend
```json
{"type": "state_dump", "server": "IRCal"}
{"type": "channel_join", "server": "IRCal", "channel": "#irc.al", "nick": "kfn"}
{"type": "nicklist", "server": "IRCal", "channel": "#irc.al", "text": "[{...}]"}
{"type": "channel_join", "server": "IRCal", "channel": "#cz", "nick": "kfn"}
{"type": "nicklist", "server": "IRCal", "channel": "#cz", "text": "[{...}]"}
...
{"type": "state_dump", "server": "IRCnet"}
{"type": "channel_join", "server": "IRCnet", "channel": "#test", "nick": "kfn"}
...
```

### Backend Processing (FeWebAdapter)
```
1. handleStateDump() - tworzy/aktualizuje NetworkData
2. handleChannelJoin() - tworzy Chan, dodaje do network.channels
3. handleNicklist() - parsuje JSON, tworzy User[], dodaje do channel.users
4. onInit() callback - emituje init event z wszystkimi networks
```

### Backend → Frontend (Socket.IO)
```javascript
socket.emit("init", {
    networks: [
        {
            uuid: "...",
            name: "IRCal",
            nick: "kfn",
            serverOptions: {
                CHANTYPES: ["#", "&"],
                PREFIX: {
                    prefix: [{symbol: "@", mode: "o"}, ...],
                    modeToSymbol: {...},
                    symbols: ["@", "+", ...]
                },
                NETWORK: ""
            },
            status: {connected: true, secure: true},
            channels: [
                {
                    id: 1,
                    name: "#irc.al",
                    type: "channel",
                    users: [
                        {nick: "kofany", mode: "o"},
                        {nick: "kfn", mode: ""}
                    ]
                },
                ...
            ]
        },
        ...
    ],
    active: -1
})
```

**PROBLEMY:**
- ❌ TODO: sendInitialState() nie jest używane
- ❌ Frontend nie renderuje networks poprawnie (brak podziału na sieci)
- ❌ Frontend nie pokazuje userów w nicklist

---

## 3. WYSYŁANIE WIADOMOŚCI

### Frontend → Backend
```javascript
socket.emit("input", {
    target: 4,  // channel.id
    text: "Hello world"
})
```

### Backend Processing
```typescript
// irssiClient.ts input()
1. Znajdź kanał we WSZYSTKICH networks po channel.id
2. Znajdź network dla tego kanału
3. Wyślij komendę z server tag:
   executeCommand("msg #channel Hello world", "IRCal")
```

### Backend → fe-web
```json
{
    "type": "command",
    "command": "/msg #channel Hello world",
    "server": "IRCal"
}
```

### fe-web → Backend (echo własnej wiadomości)
```json
{
    "type": "message",
    "server": "IRCal",
    "channel": "#channel",
    "nick": "kfn",
    "text": "Hello world",
    "level": 1,
    "is_own": true
}
```

### Backend → Frontend
```javascript
socket.emit("msg", {
    chan: 4,  // channel.id
    msg: Msg object,
    unread: 0,
    highlight: 0
})
```

**STATUS:** ✅ NAPRAWIONE - szuka kanału we wszystkich networks, wysyła server tag

---

## 4. ODBIERANIE WIADOMOŚCI

### fe-web → Backend
```json
{
    "type": "message",
    "server": "IRCal",
    "channel": "#channel",
    "nick": "alice",
    "text": "Hi there!",
    "level": 4,
    "is_own": false
}
```

### Backend Processing
```typescript
// FeWebAdapter handleMessage()
1. Znajdź network po server tag
2. Znajdź channel po nazwie
3. Utwórz Msg object
4. onMessage callback
```

### Backend → Frontend
```javascript
socket.emit("msg", {
    chan: 4,
    msg: {
        type: "message",
        from: {nick: "alice"},
        text: "Hi there!",
        time: Date.now(),
        self: false
    },
    unread: 1,
    highlight: 0
})
```

**PROBLEMY:**
- ❌ TODO: highlight detection nie jest zaimplementowane
- ❌ TODO: message storage nie jest używane

---

## 5. CHANNEL EVENTS

### JOIN
```
fe-web: {"type": "channel_join", "server": "IRCal", "channel": "#new", "nick": "alice"}
Backend: handleChannelJoin() - dodaje user do channel.users
Frontend: socket.emit("join", {network: uuid, index: id, chan: {...}})
```

### PART
```
fe-web: {"type": "channel_part", "server": "IRCal", "channel": "#old", "nick": "alice"}
Backend: handleChannelPart() - usuwa user z channel.users
Frontend: socket.emit("part", {chan: id})
```

### KICK
```
fe-web: {"type": "channel_kick", "server": "IRCal", "channel": "#chan", "nick": "spammer"}
Backend: handleChannelKick() - usuwa user z channel.users
Frontend: socket.emit("kick", {chan: id, from: "spammer"})
```

### QUIT
```
fe-web: {"type": "user_quit", "server": "IRCal", "nick": "alice"}
Backend: handleUserQuit() - usuwa user ze WSZYSTKICH kanałów
Frontend: socket.emit("quit", {network: uuid, nick: "alice"})
```

**STATUS:** ✅ ZAIMPLEMENTOWANE - wszystkie handlery działają

---

## 6. NICKLIST UPDATES

### fe-web → Backend
```json
{
    "type": "nicklist",
    "server": "IRCal",
    "channel": "#channel",
    "text": "[{\"nick\":\"alice\",\"prefix\":\"@\"},{\"nick\":\"bob\",\"prefix\":\"+\"}]"
}
```

### Backend Processing
```typescript
// FeWebAdapter handleNicklist()
1. Parse JSON z text field
2. Clear channel.users
3. Dla każdego user: utwórz User object z mode
4. Sort users by mode
5. onNicklistUpdate callback
```

### Backend → Frontend
```javascript
socket.emit("users", {chan: 4})
socket.emit("names", {id: 4, users: [...]})
```

**PROBLEM:**
- ❌ Frontend nie renderuje nicklist (problem po stronie frontendu)

---

## 7. TOPIC

### fe-web → Backend
```json
{
    "type": "topic",
    "server": "IRCal",
    "channel": "#channel",
    "text": "Welcome to the channel!",
    "extra": {
        "topic_by": "operator",
        "topic_time": "1706198350"
    }
}
```

### Backend → Frontend
```javascript
socket.emit("topic", {
    chan: 4,
    topic: "Welcome to the channel!"
})
```

**STATUS:** ✅ DZIAŁA - topic jest wyświetlany poprawnie

---

## 8. MODE CHANGES

### CHANNEL MODE
```
fe-web: {"type": "channel_mode", "server": "IRCal", "channel": "#chan", "extra": {"mode": "+o", "params": ["alice"]}}
Backend: handleChannelMode() - aktualizuje user mode
Frontend: socket.emit("mode", {chan: 4, mode: "+o", params: ["alice"]})
```

### USER MODE
```
fe-web: {"type": "user_mode", "server": "IRCal", "nick": "kfn", "text": "+i"}
Backend: handleUserMode() - loguje zmianę
Frontend: (brak event - user mode nie jest wyświetlany w UI)
```

**STATUS:** ✅ ZAIMPLEMENTOWANE

---

## 9. WHOIS

### Frontend → Backend → fe-web
```
Frontend: socket.emit("input", {target: 4, text: "/whois alice"})
Backend: executeCommand("whois alice", "IRCal")
fe-web: {"type": "command", "command": "/whois alice", "server": "IRCal"}
```

### fe-web → Backend → Frontend
```json
{
    "type": "whois",
    "server": "IRCal",
    "nick": "alice",
    "extra": {
        "user": "alice",
        "host": "host.example.com",
        "realname": "Alice Smith",
        "channels": "#polska #test @#ops",
        ...
    }
}
```

**STATUS:** ✅ ZAIMPLEMENTOWANE - handleWhois() tworzy Msg z whois info

---

## TODO LIST

### KRYTYCZNE (muszą być naprawione):
1. ❌ `sendInitialState()` - nie jest używane, usuń lub zaimplementuj
2. ❌ `highlight detection` - zaimplementuj wykrywanie highlightów
3. ❌ `message storage` - podłącz do EncryptedMessageStorage

### FRONTEND (problemy renderowania):
4. ❌ Networks nie są pogrupowane w UI
5. ❌ Nicklist nie jest wyświetlany
6. ❌ Users w kanałach nie są widoczni

### NICE TO HAVE:
7. ⚠️ Away status - handleAway() jest zaimplementowany ale nie używany
8. ⚠️ Query management - query_opened/closed są obsługiwane

