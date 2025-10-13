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
import User from "./models/user";
import Config from "./config";
import {SharedMention} from "../shared/types/mention";
import ClientManager from "./clientManager";
import {EncryptedMessageStorage} from "./plugins/messageStorage/encrypted";
import {ServerToClientEvents} from "../shared/types/socket-events";
import {FeWebSocket, FeWebConfig, FeWebMessage} from "./feWebClient/feWebSocket";
import {FeWebEncryption} from "./feWebClient/feWebEncryption";
import {FeWebAdapter, FeWebAdapterCallbacks, NetworkData} from "./feWebClient/feWebAdapter";
import UAParser from "ua-parser-js";

// irssi connection config (stored in user.json)
export type IrssiConnectionConfig = {
	host: string;
	port: number;
	passwordEncrypted: string; // Encrypted with encryption key
	encryption: boolean;
	useTLS: boolean; // Use wss:// (required for fe-web v1.5)
	rejectUnauthorized: boolean; // Accept self-signed certificates
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
	feWebAdapter: FeWebAdapter | null = null;
	encryptionKey: Buffer | null = null;
	irssiPassword: string | null = null; // Decrypted irssi password (in memory)
	userPassword: string | null = null; // User's The Lounge password (in memory, for encryption)

	// Networks from irssi (managed by FeWebAdapter)
	networks: NetworkData[] = [];

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

		// Check if irssi password is configured
		if (!this.config.irssiConnection.passwordEncrypted) {
			log.warn(
				`User ${colors.bold(
					this.name
				)} has no irssi password configured - skipping connection`
			);
			// Don't throw error - user can configure it later in Settings
			return;
		}

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

		// Step 4: Connect to irssi fe-web (ASYNCHRONOUSLY - don't block login!)
		// WebSocket będzie używał:
		// - Auth: /?password=<irssiPassword>
		// - Encryption: PBKDF2(irssiPassword, salt="irssi-fe-web-v1")
		// Don't await - let it connect in background
		// If it fails, user can still use The Lounge UI and fix config in Settings
		this.connectToIrssi().catch((error) => {
			log.error(`Failed to connect to irssi for user ${colors.bold(this.name)}: ${error}`);
			// Don't throw - user is already logged in to The Lounge
		});

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

		// Initialize FeWebAdapter with callbacks
		const adapterCallbacks: FeWebAdapterCallbacks = {
			onNetworkUpdate: (network) => this.handleNetworkUpdate(network),
			onMessage: (networkUuid, channelId, msg) =>
				this.handleMessage(networkUuid, channelId, msg),
			onChannelJoin: (networkUuid, channel) => this.handleChannelJoin(networkUuid, channel),
			onChannelPart: (networkUuid, channelId) =>
				this.handleChannelPart(networkUuid, channelId),
			onNicklistUpdate: (networkUuid, channelId, users) =>
				this.handleNicklistUpdate(networkUuid, channelId, users),
			onTopicUpdate: (networkUuid, channelId, topic) =>
				this.handleTopicUpdate(networkUuid, channelId, topic),
			onInit: (networks) => this.handleInit(networks),
		};

		this.feWebAdapter = new FeWebAdapter(this.irssiConnection, adapterCallbacks);

		// Set up event handlers
		this.setupIrssiEventHandlers();

		// Connect
		await this.irssiConnection.connect();

		log.info(
			`User ${colors.bold(this.name)} connected to irssi at wss://${feWebConfig.host}:${
				feWebConfig.port
			} (dual-layer security)`
		);
	}

	/**
	 * Set up event handlers for irssi WebSocket
	 * Note: Most events are handled by FeWebAdapter, these are just for logging
	 */
	private setupIrssiEventHandlers(): void {
		if (!this.irssiConnection) {
			return;
		}

		// Connection events (for logging only - FeWebAdapter handles the actual events)
		// Note: Using 'as any' because these are custom events not in ServerMessageType
		(this.irssiConnection as any).on("connected", () => {
			log.info(`User ${colors.bold(this.name)}: irssi WebSocket connected`);
		});

		(this.irssiConnection as any).on("disconnected", () => {
			log.warn(`User ${colors.bold(this.name)}: irssi WebSocket disconnected`);
		});

		this.irssiConnection.on("error", (msg: FeWebMessage) => {
			log.error(`User ${colors.bold(this.name)}: irssi WebSocket error: ${msg.text}`);
		});

		this.irssiConnection.on("auth_ok", () => {
			log.info(`User ${colors.bold(this.name)}: irssi authentication successful`);
		});

		(this.irssiConnection as any).on("auth_fail", () => {
			log.error(`User ${colors.bold(this.name)}: irssi authentication failed`);
		});
	}

	/**
	 * Handle input from browser (user command/message)
	 */
	async handleInput(socketId: string, data: {target: number; text: string}): Promise<void> {
		if (!this.irssiConnection) {
			log.error(`User ${colors.bold(this.name)}: cannot send input, not connected to irssi`);
			return;
		}

		const text = data.text;

		// Split multi-line input
		const lines = text.split("\n");
		for (const line of lines) {
			if (!line.trim()) continue;

			// Check if it's a command (starts with /)
			if (line.charAt(0) === "/" && line.charAt(1) !== "/") {
				// Command - find network for target channel to send server tag
				let serverTag: string | undefined;

				for (const net of this.networks) {
					const channel = net.channels.find((c) => c.id === data.target);
					if (channel) {
						serverTag = net.serverTag;
						break;
					}
				}

				const command = line.substring(1); // Remove leading /
				await this.irssiConnection.executeCommand(command, serverTag);
				log.debug(
					`User ${colors.bold(this.name)}: sent command: /${command}${
						serverTag ? ` on ${serverTag}` : ""
					}`
				);
			} else {
				// Regular message - find channel in ALL networks
				let channel: Chan | undefined;
				let network: NetworkData | undefined;

				for (const net of this.networks) {
					channel = net.channels.find((c) => c.id === data.target);
					if (channel) {
						network = net;
						break;
					}
				}

				if (!channel || !network) {
					log.warn(
						`User ${colors.bold(this.name)}: channel ${
							data.target
						} not found in any network`
					);
					return;
				}

				// Remove leading / if escaped (//)
				const messageText =
					line.charAt(0) === "/" && line.charAt(1) === "/" ? line.substring(1) : line;

				// Send message to channel with server tag
				const command = `msg ${channel.name} ${messageText}`;
				await this.irssiConnection.executeCommand(command, network.serverTag);
				log.debug(
					`User ${colors.bold(this.name)}: sent message to ${channel.name} on ${
						network.serverTag
					}`
				);
			}
		}
	}

	/**
	 * Get message history for a channel
	 */
	more(data: {target: number; lastId: number; condensed?: boolean}): {
		chan: number;
		messages: Msg[];
		totalMessages: number;
	} | null {
		// Find channel by ID across all networks
		let targetChannel: Chan | null = null;
		let targetNetwork: NetworkData | null = null;

		for (const network of this.networks) {
			const channel = network.channels.find((c) => c.id === data.target);
			if (channel) {
				targetChannel = channel;
				targetNetwork = network;
				break;
			}
		}

		if (!targetChannel) {
			log.warn(`User ${colors.bold(this.name)}: channel ${data.target} not found for more`);
			return null;
		}

		const chan = targetChannel;
		let messages: Msg[] = [];
		let index = 0;

		// If client requests -1, send last 100 messages
		if (data.lastId < 0) {
			index = chan.messages.length;
		} else {
			index = chan.messages.findIndex((val) => val.id === data.lastId);
		}

		// If requested id is not found, an empty array will be sent
		if (index > 0) {
			const startIndex = Math.max(0, index - 100); // Get up to 100 messages
			messages = chan.messages.slice(startIndex, index);
		}

		return {
			chan: data.target,
			messages: messages,
			totalMessages: chan.messages.length,
		};
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

		log.info(
			`User ${colors.bold(this.name)}: browser attached (${socketId}), total: ${
				this.attachedBrowsers.size
			}`
		);

		// Send initial state to browser
		this.sendInitialState(socket);
	}

	/**
	 * Detach a browser session
	 */
	detachBrowser(socketId: string): void {
		this.attachedBrowsers.delete(socketId);

		log.info(
			`User ${colors.bold(this.name)}: browser detached (${socketId}), remaining: ${
				this.attachedBrowsers.size
			}`
		);

		// Note: We keep the irssi connection alive even if no browsers are attached
		// This is the key feature - persistent connection!
	}

	/**
	 * Send initial state to a newly attached browser
	 */
	private async sendInitialState(socket: Socket): Promise<void> {
		try {
			// TODO: Implement with FeWebAdapter
			// Send networks, channels, messages from irssi state

			// For now, send empty state
			socket.emit("init", {
				networks: this.networks || [],
				active: this.lastActiveChannel || -1,
			});

			log.info(`User ${colors.bold(this.name)}: sent initial state to browser ${socket.id}`);
		} catch (error) {
			log.error(`Failed to send initial state to browser ${socket.id}: ${error}`);
		}
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
			this.manager.saveUser(this as any); // IrssiClient is compatible with Client interface
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

	/**
	 * Generate authentication token
	 */
	generateToken(callback: (token: string) => void): void {
		crypto.randomBytes(64, (err, buf) => {
			if (err) {
				throw err;
			}
			callback(buf.toString("hex"));
		});
	}

	/**
	 * Calculate token hash (SHA-512)
	 */
	calculateTokenHash(token: string): string {
		return crypto.createHash("sha512").update(token).digest("hex");
	}

	/**
	 * Update session information
	 */
	updateSession(token: string, ip: string, request: any): void {
		const agent = UAParser(request.headers["user-agent"] || "");
		let friendlyAgent = "";

		if (agent.browser.name) {
			friendlyAgent = `${agent.browser.name} ${agent.browser.major || ""}`;
		} else {
			friendlyAgent = "Unknown browser";
		}

		if (agent.os.name) {
			friendlyAgent += ` on ${agent.os.name}`;

			if (agent.os.version) {
				friendlyAgent += ` ${agent.os.version}`;
			}
		}

		this.config.sessions[token] = _.assign(this.config.sessions[token] || {}, {
			lastUse: Date.now(),
			ip: ip,
			agent: friendlyAgent,
		});

		this.save();
	}

	/**
	 * Save user config to disk
	 */
	save(): void {
		this.manager.saveUser(this as any); // IrssiClient is compatible with Client interface
	}

	// FeWebAdapter callback handlers

	private handleNetworkUpdate(network: NetworkData): void {
		log.debug(`[IrssiClient] Network update: ${network.name}`);
		// Update networks array
		const index = this.networks.findIndex((n) => n.uuid === network.uuid);
		if (index !== -1) {
			this.networks[index] = network;
		} else {
			this.networks.push(network);
		}

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("network:status", {
			network: network.uuid,
			connected: network.connected,
			secure: true, // irssi connection is always secure (wss:// + AES-256-GCM)
		});
	}

	private handleMessage(networkUuid: string, channelId: number, msg: Msg): void {
		log.debug(`[IrssiClient] Message: ${msg.text?.substring(0, 50)}`);

		// Save to encrypted storage
		if (this.messageStorage) {
			const network = this.networks.find((n) => n.uuid === networkUuid);
			const channel = network?.channels.find((c) => c.id === channelId);
			if (network && channel) {
				// TODO: Convert to proper network/channel format for storage
				// await this.messageStorage.index(network, channel, msg);
			}
		}

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("msg", {
			chan: channelId,
			msg: msg,
			unread: msg.self ? 0 : 1,
			highlight: 0, // TODO: implement highlight detection
		});
	}

	private handleChannelJoin(networkUuid: string, channel: Chan): void {
		log.info(`[IrssiClient] Channel join: ${channel.name}`);

		// Broadcast to all browsers
		// Note: join event expects SharedNetworkChan which includes network info
		this.broadcastToAllBrowsers("join", {
			shouldOpen: false,
			index: channel.id,
			network: networkUuid,
			chan: channel.getFilteredClone(true) as any, // Convert to SharedNetworkChan
		});
	}

	private handleChannelPart(networkUuid: string, channelId: number): void {
		log.info(`[IrssiClient] Channel part: ${channelId}`);

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("part", {
			chan: channelId,
		});
	}

	private handleNicklistUpdate(networkUuid: string, channelId: number, users: User[]): void {
		log.debug(`[IrssiClient] Nicklist update: ${channelId} (${users.length} users)`);

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("users", {
			chan: channelId,
		});

		this.broadcastToAllBrowsers("names", {
			id: channelId,
			users: users,
		});
	}

	private handleTopicUpdate(networkUuid: string, channelId: number, topic: string): void {
		log.debug(`[IrssiClient] Topic update: ${channelId}`);

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("topic", {
			chan: channelId,
			topic: topic,
		});
	}

	private handleInit(networks: NetworkData[]): void {
		log.info(`[IrssiClient] Init with ${networks.length} networks`);
		this.networks = networks;

		// Convert NetworkData[] to SharedNetwork[] for Socket.IO
		const sharedNetworks = networks.map((net) => {
			// Serialize Prefix class to plain object for JSON
			const serverOptions = {
				CHANTYPES: net.serverOptions.CHANTYPES,
				PREFIX: {
					prefix: net.serverOptions.PREFIX.prefix, // Extract array from Prefix class
					modeToSymbol: net.serverOptions.PREFIX.modeToSymbol,
					symbols: net.serverOptions.PREFIX.symbols,
				},
				NETWORK: net.serverOptions.NETWORK,
			};

			log.debug(
				`[IrssiClient] Network ${net.name} serverOptions:`,
				JSON.stringify(serverOptions)
			);

			return {
				uuid: net.uuid,
				name: net.name,
				nick: net.nick,
				serverOptions: serverOptions,
				status: {
					connected: net.connected,
					secure: true,
				},
				channels: net.channels.map((ch) => ch.getFilteredClone(true)),
			};
		}) as any[];

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("init", {
			networks: sharedNetworks,
			active: -1,
		});
	}
}

export default IrssiClient;
