/**
 * fe-web WebSocket Client (Server-side)
 *
 * RFC 6455 compliant WebSocket client for irssi fe-web module.
 * Implements the protocol specified in CLIENT-SPEC.md
 *
 * This is a server-side port of client/js/feWebSocket.ts using Node.js 'ws' library.
 */

import WebSocket from "ws";
import {FeWebEncryption} from "./feWebEncryption";

// Message types from CLIENT-SPEC.md
export interface FeWebMessage {
	id?: string;
	type: string;
	timestamp?: number;
	server?: string;
	channel?: string;
	nick?: string;
	text?: string;
	level?: number;
	is_own?: boolean;
	response_to?: string;
	extra?: Record<string, any>;
	command?: string;
}

// Client → Server message types
export type ClientMessageType = "sync_server" | "command" | "ping" | "close_query";

// Server → Client message types
export type ServerMessageType =
	| "auth_ok"
	| "message"
	| "server_status"
	| "channel_join"
	| "channel_part"
	| "channel_kick"
	| "user_quit"
	| "topic"
	| "channel_mode"
	| "nicklist"
	| "nick_change"
	| "user_mode"
	| "away"
	| "whois"
	| "channel_list"
	| "state_dump"
	| "query_opened"
	| "query_closed"
	| "error"
	| "pong";

export interface FeWebConfig {
	host: string;
	port: number;
	password?: string; // WebSocket authentication password (also used as encryption salt)
	encryption?: boolean; // Use AES-256-GCM encryption (default: true)
	userPassword?: string; // User's The Lounge password (for encryption key derivation)
	autoConnect?: boolean;
	defaultServer?: string;
	reconnect?: boolean;
	reconnectDelay?: number;
	maxReconnectDelay?: number;
	pingInterval?: number;
}

type MessageHandler = (message: FeWebMessage) => void;

export class FeWebSocket {
	private config: Required<FeWebConfig>;
	private ws: WebSocket | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingIntervalTimer: NodeJS.Timeout | null = null;
	private currentReconnectDelay: number;
	private messageHandlers: Map<ServerMessageType, MessageHandler[]> = new Map();
	private isConnected = false;
	private isAuthenticated = false;
	private messageIdCounter = 0;
	private encryption: FeWebEncryption | null = null;

	constructor(config: FeWebConfig) {
		this.config = {
			host: config.host,
			port: config.port,
			password: config.password ?? "",
			encryption: config.encryption ?? true, // Encryption enabled by default
			userPassword: config.userPassword ?? "",
			autoConnect: config.autoConnect ?? true,
			defaultServer: config.defaultServer ?? "*",
			reconnect: config.reconnect ?? true,
			reconnectDelay: config.reconnectDelay ?? 1000,
			maxReconnectDelay: config.maxReconnectDelay ?? 30000,
			pingInterval: config.pingInterval ?? 30000, // 30s as per CLIENT-SPEC.md
		};

		this.currentReconnectDelay = this.config.reconnectDelay;

		// Initialize encryption if enabled
		if (this.config.encryption && this.config.userPassword && this.config.password) {
			this.encryption = new FeWebEncryption(
				this.config.userPassword, // User's The Lounge password
				this.config.password, // irssi WebSocket password (salt)
				true
			);
		}
	}

	/**
	 * Get connection status
	 */
	get connected(): boolean {
		return this.isConnected && this.isAuthenticated;
	}

	/**
	 * Connect to fe-web WebSocket server
	 */
	async connect(): Promise<void> {
		// Derive encryption key if encryption is enabled
		if (this.encryption) {
			console.log("[FeWebSocket] Deriving encryption key...");
			await this.encryption.deriveKey();
		}

		return new Promise((resolve, reject) => {
			// Always use plain ws:// - encryption is at application level
			let url = `ws://${this.config.host}:${this.config.port}/`;

			// Add password as query parameter if provided
			if (this.config.password && this.config.password.length > 0) {
				url += `?password=${encodeURIComponent(this.config.password)}`;
			}

			const encStatus = this.encryption ? "encrypted" : "plain";
			console.log(
				`[FeWebSocket] Connecting to ws://${this.config.host}:${this.config.port}/ (${encStatus})...`
			);

			try {
				this.ws = new WebSocket(url);
			} catch (error) {
				console.error("[FeWebSocket] Failed to create WebSocket:", error);
				reject(error);
				return;
			}

			// Register auth handler BEFORE opening connection
			const authHandler = (msg: FeWebMessage) => {
				if (msg.type === "auth_ok") {
					console.log("[FeWebSocket] Authenticated");
					this.isAuthenticated = true;
					this.off("auth_ok", authHandler);
					clearTimeout(authTimeout);

					// Start keepalive ping
					this.startPing();

					// Auto sync to default server
					if (this.config.defaultServer) {
						this.syncServer(this.config.defaultServer);
					}

					resolve();
				}
			};

			this.on("auth_ok", authHandler);

			// Timeout if no auth_ok received
			const authTimeout = setTimeout(() => {
				if (!this.isAuthenticated) {
					this.off("auth_ok", authHandler);
					reject(new Error("Authentication timeout - no auth_ok received from server"));
				}
			}, 10000); // 10 seconds

			// Connection opened
			this.ws.on("open", () => {
				console.log("[FeWebSocket] WebSocket connected, waiting for auth_ok...");
				this.isConnected = true;
				this.currentReconnectDelay = this.config.reconnectDelay;
			});

			// Message received
			this.ws.on("message", (data: WebSocket.Data) => {
				this.handleMessage(data);
			});

			// Connection error
			this.ws.on("error", (error: Error) => {
				console.error("[FeWebSocket] WebSocket error:", error);
				reject(error);
			});

			// Connection closed
			this.ws.on("close", (code: number, reason: Buffer) => {
				const reasonStr = reason.toString();
				console.log(
					`[FeWebSocket] WebSocket closed (code: ${code}, reason: ${reasonStr})`
				);
				this.isConnected = false;
				this.isAuthenticated = false;
				this.stopPing();

				// Check for authentication failure (HTTP 401 → WebSocket close code 1002)
				if (code === 1002) {
					const authError = new Error(
						"Authentication failed - invalid or missing password"
					);
					console.error("[FeWebSocket]", authError.message);
					reject(authError);
					return; // Don't attempt reconnection on auth failure
				}

				// Attempt reconnection if enabled
				if (this.config.reconnect) {
					this.scheduleReconnect();
				}
			});
		});
	}

	/**
	 * Disconnect from fe-web server
	 */
	disconnect(): void {
		console.log("[FeWebSocket] Disconnecting...");
		this.config.reconnect = false; // Disable auto-reconnect

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.stopPing();

		if (this.ws) {
			this.ws.close(1000, "Client disconnect");
			this.ws = null;
		}

		this.isConnected = false;
		this.isAuthenticated = false;
	}

	/**
	 * Send a message to fe-web server
	 */
	send(message: FeWebMessage): void {
		// Call async version but don't wait
		this.sendAsync(message).catch((error) => {
			console.error("[FeWebSocket] Failed to send message:", error);
		});
	}

	/**
	 * Send a message to fe-web server (async version)
	 */
	private async sendAsync(message: FeWebMessage): Promise<void> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error("[FeWebSocket] Cannot send message: not connected");
			return;
		}

		// Add message ID if not present
		if (!message.id && message.type !== "pong") {
			message.id = this.generateMessageId();
		}

		const json = JSON.stringify(message);
		console.log("[FeWebSocket] Sending:", json);

		try {
			if (this.encryption) {
				// Encrypt and send as binary frame
				const encrypted = await this.encryption.encrypt(json);
				this.ws.send(encrypted);
			} else {
				// Send as text frame (plain)
				this.ws.send(json);
			}
		} catch (error) {
			console.error("[FeWebSocket] Encryption failed:", error);
			throw error;
		}
	}

	/**
	 * Register a message handler for a specific message type
	 */
	on(type: ServerMessageType, handler: MessageHandler): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}

		this.messageHandlers.get(type)!.push(handler);
	}

	/**
	 * Unregister a message handler
	 */
	off(type: ServerMessageType, handler: MessageHandler): void {
		const handlers = this.messageHandlers.get(type);

		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Sync with IRC server (CLIENT-SPEC.md: sync_server)
	 */
	syncServer(serverTag: string): void {
		this.send({
			type: "sync_server",
			server: serverTag,
		});
	}

	/**
	 * Execute IRC command (CLIENT-SPEC.md: command)
	 */
	executeCommand(command: string, server?: string): void {
		// Ensure command starts with /
		if (!command.startsWith("/")) {
			command = "/" + command;
		}

		console.log(
			`[FeWebSocket] Executing command: ${command}`,
			server ? `on server: ${server}` : ""
		);

		const msg: any = {
			type: "command",
			command: command,
		};

		// Add server tag if provided
		if (server) {
			msg.server = server;
		}

		this.send(msg);
	}

	/**
	 * Send keepalive ping (CLIENT-SPEC.md: ping)
	 */
	ping(): void {
		this.send({
			type: "ping",
			id: `ping-${Date.now()}`,
		});
	}

	/**
	 * Close query window (CLIENT-SPEC.md: close_query)
	 */
	closeQuery(server: string, nick: string): void {
		console.log(`[FeWebSocket] Closing query: ${nick} on ${server}`);
		this.send({
			type: "close_query",
			server: server,
			nick: nick,
		});
	}

	/**
	 * Check if connected and authenticated
	 */
	isReady(): boolean {
		return this.isConnected && this.isAuthenticated;
	}

	/**
	 * Handle incoming WebSocket message
	 */
	private async handleMessage(data: WebSocket.Data): Promise<void> {
		try {
			let json: string;

			// Check if message is binary (encrypted) or text (plain)
			if (Buffer.isBuffer(data)) {
				// Binary frame - decrypt
				if (!this.encryption) {
					console.error(
						"[FeWebSocket] Received encrypted message but encryption is disabled"
					);
					return;
				}

				json = await this.encryption.decrypt(data);
			} else if (typeof data === "string") {
				// Text frame - plain JSON
				json = data;
			} else {
				console.error("[FeWebSocket] Unexpected message type:", typeof data);
				return;
			}

			const message: FeWebMessage = JSON.parse(json);
			console.log("[FeWebSocket] Received:", message);

			// Dispatch to registered handlers
			const handlers = this.messageHandlers.get(message.type as ServerMessageType);

			if (handlers) {
				console.log(
					`[FeWebSocket] Calling ${handlers.length} handler(s) for type: ${message.type}`
				);
				handlers.forEach((handler) => {
					try {
						handler(message);
					} catch (error) {
						console.error(`[FeWebSocket] Error in handler for ${message.type}:`, error);
					}
				});
			} else {
				console.warn(
					`[FeWebSocket] No handlers registered for message type: ${message.type}`
				);
			}
		} catch (error) {
			console.error("[FeWebSocket] Failed to parse message:", error);
		}
	}

	/**
	 * Start keepalive ping interval
	 */
	private startPing(): void {
		this.stopPing();

		this.pingIntervalTimer = setInterval(() => {
			if (this.isConnected) {
				this.ping();
			}
		}, this.config.pingInterval);
	}

	/**
	 * Stop keepalive ping interval
	 */
	private stopPing(): void {
		if (this.pingIntervalTimer !== null) {
			clearInterval(this.pingIntervalTimer);
			this.pingIntervalTimer = null;
		}
	}

	/**
	 * Schedule reconnection with exponential backoff
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer !== null) {
			return; // Already scheduled
		}

		console.log(`[FeWebSocket] Reconnecting in ${this.currentReconnectDelay}ms...`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			this.connect().catch((error) => {
				console.error("[FeWebSocket] Reconnection failed:", error);

				// Exponential backoff
				this.currentReconnectDelay = Math.min(
					this.currentReconnectDelay * 2,
					this.config.maxReconnectDelay
				);
			});
		}, this.currentReconnectDelay);
	}

	/**
	 * Generate unique message ID
	 */
	private generateMessageId(): string {
		return `msg-${Date.now()}-${++this.messageIdCounter}`;
	}
}

