/**
 * irssi Client - Modified Client class for irssi proxy mode
 *
 * This replaces the traditional IRC client with a persistent WebSocket connection to irssi fe-web.
 * Key differences from original Client:
 * - No Network[] management (irssi handles IRC connections)
 * - Persistent WebSocket connection to irssi (always active)
 * - Encryption key stored in memory (for message encryption)
 * - Multiple browser sessions per user (attachedBrowsers)
 * - Encrypted message storage (EncryptedMessageStorage)
 */

import _ from "lodash";
import {v4 as uuidv4} from "uuid";
import crypto from "crypto";
import colors from "chalk";
import type {Socket} from "socket.io";

import log from "./log";
import Chan from "./models/chan";
import Msg from "./models/msg";
import Config from "./config";
import {SharedMention} from "../shared/types/mention";
import ClientManager from "./clientManager";
import {EncryptedMessageStorage} from "./plugins/messageStorage/encrypted";
import {ServerToClientEvents} from "../shared/types/socket-events";
import {FeWebSocket, FeWebConfig} from "./feWebClient/feWebSocket";
import {FeWebEncryption} from "./feWebClient/feWebEncryption";

// irssi connection config (stored in user.json)
export type IrssiConnectionConfig = {
	host: string;
	port: number;
	passwordEncrypted: string; // Encrypted with encryption key
	encryption: boolean;
};

// User config for irssi proxy mode
export type IrssiUserConfig = {
	log: boolean;
	password: string; // bcrypt hash (for authentication)
	irssiConnection: IrssiConnectionConfig;
	sessions: {
		[token: string]: {
			lastUse: number;
			ip: string;
			agent: string;
		};
	};
	clientSettings: {
		[key: string]: any;
	};
	browser?: {
		language?: string;
		ip?: string;
		hostname?: string;
		isSecure?: boolean;
	};
};

// Browser session info
type BrowserSession = {
	socket: Socket;
	openChannel: number;
};

export class IrssiClient {
	// Basic properties
	id: string;
	name: string;
	manager: ClientManager;
	config: IrssiUserConfig;

	// irssi connection (persistent!)
	irssiConnection: FeWebSocket | null = null;
	encryptionKey: Buffer | null = null;
	irssiPassword: string | null = null; // Decrypted irssi password (in memory)
	userPassword: string | null = null; // User's The Lounge password (in memory, for encryption)

	// Browser sessions (multiple browsers per user)
	attachedBrowsers: Map<string, BrowserSession> = new Map();

	// Message storage (encrypted)
	messageStorage: EncryptedMessageStorage | null = null;

	// State
	awayMessage: string = "";
	lastActiveChannel: number = -1;
	mentions: SharedMention[] = [];
	fileHash: string = "";

	// ID generators
	idMsg: number = 1;
	idChan: number = 1;

	// Networks from irssi (virtual, for compatibility with frontend)
	// These are populated from irssi state_dump messages
	networks: any[] = [];

	constructor(manager: ClientManager, name: string, config: IrssiUserConfig) {
		this.id = uuidv4();
		this.name = name;
		this.manager = manager;
		this.config = config;

		// Ensure config has required fields
		this.config.log = Boolean(this.config.log);
		this.config.password = String(this.config.password);

		if (!_.isPlainObject(this.config.sessions)) {
			this.config.sessions = {};
		}

		if (!_.isPlainObject(this.config.clientSettings)) {
			this.config.clientSettings = {};
		}

		if (!_.isPlainObject(this.config.browser)) {
			this.config.browser = {};
		}

		if (this.config.clientSettings.awayMessage) {
			this.awayMessage = this.config.clientSettings.awayMessage;
		}

		log.info(`irssi client created for user ${colors.bold(this.name)}`);
	}

	/**
	 * Login user - derive encryption key and connect to irssi
	 *
	 * Encryption architecture (fe-web v1.5):
	 * 1. WebSocket auth + encryption: JEDNO hasło (irssiPassword)
	 *    - Auth: /?password=<irssiPassword>
	 *    - Encryption: PBKDF2(irssiPassword, salt="irssi-fe-web-v1")
	 * 2. Message storage encryption: PBKDF2(userPassword, salt=irssiPassword)
	 *    - Osobny klucz dla lokalnego storage (nie związany z WebSocket)
	 */
	async login(userPassword: string): Promise<void> {
		log.info(`User ${colors.bold(this.name)} logging in...`);

		// Store user password in memory (for message storage encryption)
		this.userPassword = userPassword;

		// Step 1: Decrypt irssi password using temporary encryption
		// Używamy userPassword do odszyfrowania irssiPassword z config
		const tempSalt = "thelounge_irssi_temp_salt"; // Temporary salt for bootstrapping

		// Create temp encryption with userPassword
		const tempKey = crypto.pbkdf2Sync(userPassword, tempSalt, 10000, 32, "sha256");

		// Decrypt irssi password
		const encryptedIrssiPassword = Buffer.from(
			this.config.irssiConnection.passwordEncrypted,
			"base64"
		);

		// Manual decrypt (since we can't use FeWebEncryption with custom salt easily)
		const iv = encryptedIrssiPassword.slice(0, 12);
		const tag = encryptedIrssiPassword.slice(-16);
		const ciphertext = encryptedIrssiPassword.slice(12, -16);

		const decipher = crypto.createDecipheriv("aes-256-gcm", tempKey, iv);
		decipher.setAuthTag(tag);

		const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		this.irssiPassword = decrypted.toString("utf8");

		log.info(`irssi password decrypted for user ${colors.bold(this.name)}`);

		// Step 2: Derive message storage encryption key
		// Use userPassword + irssiPassword as salt (RÓŻNY od WebSocket encryption!)
		this.encryptionKey = crypto.pbkdf2Sync(
			userPassword,
			this.irssiPassword,
			10000,
			32,
			"sha256"
		);

		log.info(`Message storage encryption key derived for user ${colors.bold(this.name)}`);

		// Step 3: Initialize encrypted message storage
		if (this.config.log && !Config.values.public) {
			this.messageStorage = new EncryptedMessageStorage(this.name, this.encryptionKey);
			await this.messageStorage.enable();
			log.info(`Encrypted message storage enabled for user ${colors.bold(this.name)}`);
		}

		// Step 4: Connect to irssi fe-web
		// WebSocket będzie używał:
		// - Auth: /?password=<irssiPassword>
		// - Encryption: PBKDF2(irssiPassword, salt="irssi-fe-web-v1")
		await this.connectToIrssi();

		log.info(`User ${colors.bold(this.name)} logged in successfully`);
	}

	/**
	 * Connect to irssi fe-web (persistent connection with dual-layer security)
	 *
	 * fe-web v1.5 uses:
	 * - Layer 1: wss:// (SSL/TLS with self-signed cert)
	 * - Layer 2: AES-256-GCM with PBKDF2(irssiPassword, salt="irssi-fe-web-v1")
	 */
	async connectToIrssi(): Promise<void> {
		if (this.irssiConnection) {
			log.warn(`User ${colors.bold(this.name)} already connected to irssi`);
			return;
		}

		if (!this.irssiPassword || !this.encryptionKey) {
			throw new Error("Cannot connect to irssi: encryption key not derived");
		}

		const feWebConfig: FeWebConfig = {
			host: this.config.irssiConnection.host,
			port: this.config.irssiConnection.port,
			password: this.irssiPassword, // irssi WebSocket password (for PBKDF2 with FIXED salt)
			encryption: true, // ALWAYS true for fe-web v1.5

			// SSL/TLS options (fe-web v1.5 REQUIRES wss://)
			useTLS: true, // ALWAYS true for fe-web v1.5
			rejectUnauthorized: false, // Accept self-signed certificates

			reconnect: true,
			reconnectDelay: 1000,
			maxReconnectDelay: 30000,
		};

		this.irssiConnection = new FeWebSocket(feWebConfig);

		// Set up event handlers
		this.setupIrssiEventHandlers();

		// Connect
		await this.irssiConnection.connect();

		log.info(
			`User ${colors.bold(this.name)} connected to irssi at wss://${feWebConfig.host}:${feWebConfig.port} (dual-layer security)`
		);
	}

	/**
	 * Set up event handlers for irssi WebSocket
	 */
	private setupIrssiEventHandlers(): void {
		if (!this.irssiConnection) {
			return;
		}

		// Connection events
		this.irssiConnection.on("connected", () => {
			log.info(`User ${colors.bold(this.name)}: irssi WebSocket connected`);
			this.broadcastToAllBrowsers("irssi:connected", {});
		});

		this.irssiConnection.on("disconnected", () => {
			log.warn(`User ${colors.bold(this.name)}: irssi WebSocket disconnected`);
			this.broadcastToAllBrowsers("irssi:disconnected", {});
		});

		this.irssiConnection.on("error", (error: Error) => {
			log.error(`User ${colors.bold(this.name)}: irssi WebSocket error: ${error.message}`);
			this.broadcastToAllBrowsers("irssi:error", {message: error.message});
		});

		// Message events (will be implemented with FeWebAdapter)
		this.irssiConnection.on("message", (data: any) => {
			this.handleIrssiMessage(data);
		});

		this.irssiConnection.on("auth_ok", () => {
			log.info(`User ${colors.bold(this.name)}: irssi authentication successful`);
		});

		this.irssiConnection.on("auth_fail", () => {
			log.error(`User ${colors.bold(this.name)}: irssi authentication failed`);
			this.broadcastToAllBrowsers("irssi:auth_fail", {});
		});
	}

	/**
	 * Handle message from irssi
	 */
	private async handleIrssiMessage(data: any): Promise<void> {
		// TODO: Implement with FeWebAdapter
		// For now, just log
		log.debug(`User ${colors.bold(this.name)}: irssi message: ${JSON.stringify(data).substring(0, 100)}`);

		// Save to encrypted storage if enabled
		if (this.messageStorage && data.type === "message") {
			// TODO: Convert irssi message format to The Lounge format
			// await this.messageStorage.index(network, channel, msg);
		}

		// Broadcast to all attached browsers
		this.broadcastToAllBrowsers("msg", data);
	}

	/**
	 * Handle input from browser (user command/message)
	 */
	async handleInput(target: number, text: string): Promise<void> {
		if (!this.irssiConnection) {
			log.error(`User ${colors.bold(this.name)}: cannot send input, not connected to irssi`);
			return;
		}

		// TODO: Convert The Lounge input format to irssi command format
		// For now, just send as command
		await this.irssiConnection.executeCommand(text);

		log.debug(`User ${colors.bold(this.name)}: sent input to irssi: ${text}`);
	}

	/**
	 * Attach a browser session
	 */
	attachBrowser(socket: Socket, openChannel: number = -1): void {
		const socketId = socket.id;

		this.attachedBrowsers.set(socketId, {
			socket,
			openChannel,
		});

		log.info(`User ${colors.bold(this.name)}: browser attached (${socketId}), total: ${this.attachedBrowsers.size}`);

		// Send initial state to browser
		this.sendInitialState(socket);
	}

	/**
	 * Detach a browser session
	 */
	detachBrowser(socketId: string): void {
		this.attachedBrowsers.delete(socketId);

		log.info(`User ${colors.bold(this.name)}: browser detached (${socketId}), remaining: ${this.attachedBrowsers.size}`);

		// Note: We keep the irssi connection alive even if no browsers are attached
		// This is the key feature - persistent connection!
	}

	/**
	 * Send initial state to a newly attached browser
	 */
	private async sendInitialState(socket: Socket): Promise<void> {
		// TODO: Implement with FeWebAdapter
		// Send networks, channels, messages from irssi state

		// For now, send empty state
		socket.emit("init", {
			networks: this.networks,
			active: this.lastActiveChannel,
		});

		log.info(`User ${colors.bold(this.name)}: sent initial state to browser ${socket.id}`);
	}

	/**
	 * Broadcast event to all attached browsers
	 */
	private broadcastToAllBrowsers<Ev extends keyof ServerToClientEvents>(
		event: Ev,
		...args: Parameters<ServerToClientEvents[Ev]>
	): void {
		for (const [socketId, session] of this.attachedBrowsers) {
			session.socket.emit(event, ...args);
		}
	}

	/**
	 * Emit event to all attached browsers (alias for compatibility)
	 */
	emit<Ev extends keyof ServerToClientEvents>(
		event: Ev,
		...args: Parameters<ServerToClientEvents[Ev]>
	): void {
		this.broadcastToAllBrowsers(event, ...args);
	}

	/**
	 * Disconnect from irssi and cleanup
	 */
	async quit(shouldSave = true): Promise<void> {
		log.info(`User ${colors.bold(this.name)} quitting...`);

		// Disconnect all browsers
		for (const [socketId, session] of this.attachedBrowsers) {
			session.socket.disconnect(true);
		}
		this.attachedBrowsers.clear();

		// Disconnect from irssi
		if (this.irssiConnection) {
			await this.irssiConnection.disconnect();
			this.irssiConnection = null;
		}

		// Close message storage
		if (this.messageStorage) {
			await this.messageStorage.close();
			this.messageStorage = null;
		}

		// Clear sensitive data from memory
		if (this.encryptionKey) {
			this.encryptionKey.fill(0); // Overwrite with zeros
			this.encryptionKey = null;
		}

		this.irssiPassword = null;
		this.userPassword = null;

		if (shouldSave) {
			this.manager.saveUser(this);
		}

		log.info(`User ${colors.bold(this.name)} quit successfully`);
	}

	/**
	 * Create a channel (for compatibility with frontend)
	 */
	createChannel(attr: Partial<Chan>): Chan {
		const chan = new Chan(attr);
		chan.id = this.idChan++;
		return chan;
	}

	/**
	 * Get next message ID
	 */
	nextMessageId(): number {
		return this.idMsg++;
	}
}

export default IrssiClient;

