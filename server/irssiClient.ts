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
import Network from "./models/network";
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

// Unread marker (activity tracking)
export enum DataLevel {
	NONE = 0, // No activity (read)
	TEXT = 1, // Normal text (gray)
	MSG = 2, // Message or highlight word (blue)
	HILIGHT = 3, // Nick mention (red)
}

export interface UnreadMarker {
	network: string; // Network UUID
	channel: string; // Channel name (lowercase)
	unreadCount: number; // Number of unread messages
	lastReadTime: number; // Unix timestamp of last read
	lastMessageTime: number; // Unix timestamp of last message
	dataLevel: DataLevel; // Activity level (from irssi)
}

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

	// Unread markers (activity tracking) - in-memory only!
	private unreadMarkers: Map<string, UnreadMarker> = new Map();

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

		// Step 1: Decrypt irssi password using IP+PORT salt
		// Import decryptIrssiPassword from irssiConfigHelper
		const {decryptIrssiPassword} = await import("./irssiConfigHelper");

		this.irssiPassword = await decryptIrssiPassword(
			this.config.irssiConnection.passwordEncrypted,
			this.config.irssiConnection.host,
			this.config.irssiConnection.port
		);

		log.info(`irssi password decrypted for user ${colors.bold(this.name)}`);

		// Step 2: Derive message storage encryption key
		// NOTE: If autoconnect already initialized storage with irssiPassword,
		// we continue using that key. Only derive new key if not already set.
		if (!this.encryptionKey) {
			// Use irssiPassword for encryption (same as autoconnect)
			this.encryptionKey = crypto.pbkdf2Sync(
				this.irssiPassword,
				"irssi-message-storage-v1", // Fixed salt (same as autoconnect)
				10000,
				32,
				"sha256"
			);
			log.info(`Message storage encryption key derived for user ${colors.bold(this.name)}`);
		} else {
			log.info(`Message storage encryption key already exists (from autoconnect)`);
		}

		// Step 3: Initialize encrypted message storage (if not already enabled by autoconnect)
		if (this.config.log && !Config.values.public && !this.messageStorage) {
			this.messageStorage = new EncryptedMessageStorage(this.name, this.encryptionKey);
			await this.messageStorage.enable();
			log.info(`Encrypted message storage enabled for user ${colors.bold(this.name)}`);
		} else if (this.messageStorage) {
			log.info(`Message storage already enabled (from autoconnect)`);
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
	 * Auto-connect to irssi at startup (without user password)
	 * Uses IP+PORT encryption to decrypt irssi password
	 * Message storage is enabled using irssiPassword (no userPassword needed!)
	 */
	async autoConnectToIrssi(): Promise<void> {
		log.info(`User ${colors.bold(this.name)} auto-connecting to irssi...`);

		// Check if irssi password is configured
		if (!this.config.irssiConnection.passwordEncrypted) {
			log.warn(
				`User ${colors.bold(
					this.name
				)} has no irssi password configured - skipping autoconnect`
			);
			return;
		}

		// Decrypt irssi password using IP+PORT salt
		const {decryptIrssiPassword} = await import("./irssiConfigHelper");

		this.irssiPassword = await decryptIrssiPassword(
			this.config.irssiConnection.passwordEncrypted,
			this.config.irssiConnection.host,
			this.config.irssiConnection.port
		);

		log.info(`irssi password decrypted for user ${colors.bold(this.name)}`);

		// Derive message storage encryption key from irssiPassword
		// Use fixed salt since we don't have userPassword during autoconnect
		this.encryptionKey = crypto.pbkdf2Sync(
			this.irssiPassword,
			"irssi-message-storage-v1", // Fixed salt
			10000,
			32,
			"sha256"
		);

		log.info(`Message storage encryption key derived for user ${colors.bold(this.name)}`);

		// Initialize encrypted message storage
		if (this.config.log && !Config.values.public) {
			this.messageStorage = new EncryptedMessageStorage(this.name, this.encryptionKey);
			await this.messageStorage.enable();
			log.info(`Encrypted message storage enabled for user ${colors.bold(this.name)}`);
		}

		// Connect to irssi (with message storage enabled!)
		await this.connectToIrssiInternal();
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

		await this.connectToIrssiInternal();
	}

	/**
	 * Internal method to connect to irssi WebSocket
	 */
	private async connectToIrssiInternal(): Promise<void> {
		if (this.irssiConnection) {
			log.warn(`User ${colors.bold(this.name)} already connected to irssi`);
			return;
		}

		if (!this.irssiPassword) {
			throw new Error("Cannot connect to irssi: irssi password not decrypted");
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

		// Activity tracking (unread markers)
		(this.irssiConnection as any).on("activity_update", (msg: FeWebMessage) => {
			this.handleActivityUpdate(msg);
		});

		// Query closed in irssi (2-way sync)
		(this.irssiConnection as any).on("query_closed", (msg: FeWebMessage) => {
			this.handleQueryClosed(msg);
		});
	}

	/**
	 * Handle NAMES request from browser (refresh nicklist)
	 */
	async handleNamesRequest(socketId: string, data: {target: number}): Promise<void> {
		if (!this.irssiConnection) {
			log.error(
				`User ${colors.bold(this.name)}: cannot request names, not connected to irssi`
			);
			return;
		}

		// Find channel in ALL networks
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
				`User ${colors.bold(this.name)}: channel ${data.target} not found for NAMES request`
			);
			return;
		}

		// Execute /NAMES command in irssi to refresh internal state
		const command = `names ${channel.name}`;
		await this.irssiConnection.executeCommand(command, network.serverTag);

		log.info(
			`User ${colors.bold(this.name)}: requested NAMES for ${channel.name} on ${
				network.serverTag
			}`
		);

		// fe-web will send nicklist message after executing NAMES
		// We don't need to do anything else here - the nicklist handler will take care of it
	}

	/**
	 * Handle input from browser (user command/message)
	 * Includes command translation layer for Vue-specific commands
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
				// Find channel and network for this target
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
						} not found for command`
					);
					return;
				}

				// Parse command and args
				const parts = line.substring(1).split(" ");
				const commandName = parts[0].toLowerCase();
				const args = parts.slice(1);

				// Command translation layer
				const translated = await this.translateCommand(commandName, args, channel, network);

				if (translated === false) {
					// Command was handled by translator, don't forward to irssi
					continue;
				}

				// Use translated command if available, otherwise use original
				const finalCommand = translated || line.substring(1);

				await this.irssiConnection.executeCommand(finalCommand, network.serverTag);
				log.debug(
					`User ${colors.bold(this.name)}: sent command: /${finalCommand} on ${
						network.serverTag
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
	 * Command Translation Layer
	 * Translates Vue/The Lounge specific commands to irssi-compatible commands
	 * Returns:
	 * - null: no translation needed, use original command
	 * - string: translated command to send to irssi
	 * - false: command was handled, don't forward to irssi
	 */
	private async translateCommand(
		command: string,
		args: string[],
		channel: Chan,
		network: NetworkData
	): Promise<string | false | null> {
		const {ChanType} = await import("../shared/types/chan");

		switch (command) {
			case "close":
				// /close → translate based on channel type
				if (channel.type === ChanType.CHANNEL) {
					// For channels: /part #channel
					log.info(
						`[CommandTranslator] /close → /part ${channel.name} (channel) on ${network.serverTag}`
					);
					return `part ${channel.name}`;
				} else if (channel.type === ChanType.QUERY) {
					// For queries: send close_query message to irssi
					log.info(
						`[CommandTranslator] /close → close_query ${channel.name} (query) on ${network.serverTag}`
					);
					this.irssiConnection?.send({
						type: "close_query" as any,
						server: network.serverTag,
						nick: channel.name,
					});
					return false; // Handled
				}
				break;

			case "banlist":
				// /banlist → /mode #channel +b
				log.info(
					`[CommandTranslator] /banlist → /mode ${channel.name} +b on ${network.serverTag}`
				);
				return `mode ${channel.name} +b`;

			case "quit":
				// /quit in lobby → /disconnect (for this network only!)
				if (channel.type === ChanType.LOBBY) {
					log.info(
						`[CommandTranslator] /quit → /disconnect (lobby) on ${network.serverTag}`
					);
					// irssi command: /disconnect <server_tag>
					return `disconnect ${network.serverTag}`;
				}
				// /quit in channel/query → pass through (normal IRC quit)
				break;
		}

		return null; // No translation needed
	}

	/**
	 * Get message history for a channel (lazy loading)
	 * ALWAYS loads from storage (not from cache!)
	 */
	async more(data: {target: number; lastId: number; condensed?: boolean}): Promise<{
		chan: number;
		messages: Msg[];
		totalMessages: number;
	} | null> {
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

		if (!targetChannel || !targetNetwork) {
			log.warn(`User ${colors.bold(this.name)}: channel ${data.target} not found for more`);
			return null;
		}

		// ALWAYS load from storage (not from cache!)
		if (!this.messageStorage) {
			log.warn(
				`User ${colors.bold(this.name)}: message storage not enabled, returning empty`
			);
			return {
				chan: data.target,
				messages: [],
				totalMessages: 0,
			};
		}

		let messages: Msg[] = [];

		try {
			if (data.lastId < 0) {
				// Initial load - last 100 messages
				messages = await this.messageStorage.getLastMessages(
					targetNetwork.uuid,
					targetChannel.name,
					100
				);
			} else {
				// Lazy load - 100 messages before lastId
				// Find the message with lastId to get its timestamp
				const allMessages = await this.messageStorage.getLastMessages(
					targetNetwork.uuid,
					targetChannel.name,
					1000 // Get more to find the lastId
				);

				const lastMsgIndex = allMessages.findIndex((m) => m.id === data.lastId);

				if (lastMsgIndex > 0) {
					// Get timestamp of the message before lastId
					const beforeTime = allMessages[lastMsgIndex - 1].time.getTime();

					// Load 100 messages before that timestamp
					messages = await this.messageStorage.getMessagesBefore(
						targetNetwork.uuid,
						targetChannel.name,
						beforeTime,
						100
					);
				}
			}

			// Assign IDs to messages
			for (const msg of messages) {
				msg.id = this.nextMessageId();
			}

			// Get total count
			const totalMessages = await this.messageStorage.getMessageCount(
				targetNetwork.uuid,
				targetChannel.name
			);

			log.debug(
				`User ${colors.bold(this.name)}: loaded ${messages.length} messages for channel ${
					data.target
				} (total: ${totalMessages})`
			);

			return {
				chan: data.target,
				messages: messages,
				totalMessages: totalMessages,
			};
		} catch (err) {
			log.error(
				`Failed to load messages for ${targetNetwork.name}/${targetChannel.name}: ${err}`
			);
			return {
				chan: data.target,
				messages: [],
				totalMessages: 0,
			};
		}
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

		// Three cases:
		// 1. Networks exist (second+ browser) → send init NOW with cached data
		// 2. No irssi password configured → send EMPTY init (allow user to configure in Settings)
		// 3. Irssi password configured but not connected yet → wait for state_dump
		if (this.networks.length > 0) {
			log.info(
				`User ${colors.bold(this.name)}: sending init to new browser ${socketId} (${
					this.networks.length
				} networks)`
			);
			this.sendInitialState(socket);
		} else if (!this.config.irssiConnection.passwordEncrypted) {
			log.info(
				`User ${colors.bold(
					this.name
				)}: no irssi password configured, sending empty init to ${socketId}`
			);
			// Send empty init - user can configure irssi in Settings
			socket.emit("init", {
				networks: [],
				active: -1,
			});
		} else {
			log.info(
				`User ${colors.bold(
					this.name
				)}: waiting for state_dump before sending init to ${socketId}`
			);
		}
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
	 * Converts NetworkData[] to SharedNetwork[] format for frontend
	 * LOADS 100 LAST MESSAGES from storage for each channel/query
	 */
	private async sendInitialState(socket: Socket): Promise<void> {
		try {
			log.info(`[IrssiClient] ⏰ TIMING: sendInitialState() START for socket ${socket.id}`);

			// STEP 1: Load messages from storage for each channel/query
			if (this.messageStorage) {
				log.info(
					`[IrssiClient] Loading messages from storage for ${this.networks.length} networks...`
				);

				for (const network of this.networks) {
					for (const channel of network.channels) {
						try {
							// Load last 100 messages from encrypted storage
							const messages = await this.messageStorage.getLastMessages(
								network.uuid,
								channel.name,
								100
							);

							// Assign IDs to messages
							for (const msg of messages) {
								msg.id = this.nextMessageId();
							}

							// TEMPORARILY add to channel.messages (only for this init!)
							channel.messages = messages;

							log.debug(
								`[IrssiClient] Loaded ${messages.length} messages for ${network.name}/${channel.name}`
							);
						} catch (err) {
							log.error(
								`Failed to load messages for ${network.name}/${channel.name}: ${err}`
							);
							channel.messages = [];
						}
					}
				}
			}

			// STEP 2: Convert NetworkData[] to SharedNetwork[] for Socket.IO
			const sharedNetworks = this.networks.map((net) => {
				// Serialize Prefix class to plain object for JSON
				const serverOptions = {
					CHANTYPES: net.serverOptions.CHANTYPES,
					PREFIX: {
						prefix: net.serverOptions.PREFIX.prefix,
						modeToSymbol: net.serverOptions.PREFIX.modeToSymbol,
						symbols: net.serverOptions.PREFIX.symbols,
					},
					NETWORK: net.serverOptions.NETWORK,
				};

				return {
					uuid: net.uuid,
					name: net.name,
					nick: net.nick,
					serverOptions: serverOptions,
					status: {
						connected: net.connected,
						secure: true,
					},
					channels: net.channels.map((ch) => ch.getFilteredClone(true)), // Contains messages!
				};
			}) as any[];

			// STEP 3: Clear messages from cache (we don't keep them in memory!)
			for (const network of this.networks) {
				for (const channel of network.channels) {
					channel.messages = [];
				}
			}

			// STEP 4: Send init event to browser
			socket.emit("init", {
				networks: sharedNetworks,
				active: this.lastActiveChannel || -1,
			});

			log.info(
				`[IrssiClient] ⏰ TIMING: sendInitialState() SENT init event for socket ${socket.id} with ${sharedNetworks.length} networks`
			);

			// Send names event for each channel with users
			// This ensures frontend has nicklist data immediately after init
			for (const net of this.networks) {
				for (const channel of net.channels) {
					if (channel.users.size > 0) {
						const usersArray = Array.from(channel.users.values());
						socket.emit("names", {
							id: channel.id,
							users: usersArray,
						});
						log.debug(
							`[IrssiClient] Sent names for channel ${channel.id} (${usersArray.length} users) in init`
						);
					}
				}
			}

			// STEP 5: Send activity_update for channels with unread markers
			// This ensures frontend shows activity status from irssi immediately
			// Count unread from message storage (messages newer than lastReadTime)
			for (const net of this.networks) {
				for (const channel of net.channels) {
					const key = this.getMarkerKey(net.uuid, channel.name);
					const marker = this.unreadMarkers.get(key);

					if (marker && marker.dataLevel > DataLevel.NONE) {
						// Count unread from DB (messages after lastReadTime)
						let unreadCount = marker.unreadCount;
						if (this.messageStorage) {
							try {
								unreadCount = await this.messageStorage.getUnreadCount(
									net.uuid,
									channel.name,
									marker.lastReadTime
								);
								marker.unreadCount = unreadCount;
								this.unreadMarkers.set(key, marker);
							} catch (err) {
								log.error(
									`Failed to get unread count for ${net.name}/${channel.name}: ${err}`
								);
							}
						}

						socket.emit("activity_update", {
							chan: channel.id,
							unread: unreadCount,
							highlight: marker.dataLevel === DataLevel.HILIGHT ? unreadCount : 0,
						});
						log.debug(
							`[IrssiClient] Sent activity_update for channel ${channel.id} (unread=${unreadCount}, level=${marker.dataLevel}) in init`
						);
					}
				}
			}

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

	// Unread marker helpers

	/**
	 * Get marker key for Map lookup (network:channel lowercase)
	 */
	private getMarkerKey(network: string, channel: string): string {
		return `${network}:${channel.toLowerCase()}`;
	}

	/**
	 * Handle ACTIVITY_UPDATE from irssi (channel/query got new activity)
	 * Updates unread marker and broadcasts to all browsers
	 */
	private handleActivityUpdate(msg: FeWebMessage): void {
		// irssi sends "server" and "channel" fields (not "server_tag" and "target")
		const serverTag = msg.server || msg.server_tag;
		const channelName = msg.channel || msg.target;

		if (!serverTag || !channelName) {
			log.warn(
				`[IrssiClient] Invalid ACTIVITY_UPDATE message (missing server/channel): ${JSON.stringify(
					msg
				)}`
			);
			return;
		}

		// Find network by server_tag
		const network = this.networks.find((n) => n.serverTag === serverTag);
		if (!network) {
			log.warn(`[IrssiClient] ACTIVITY_UPDATE for unknown server: ${serverTag}`);
			return;
		}

		// Find channel by name
		const channel = network.channels.find(
			(c) => c.name.toLowerCase() === channelName.toLowerCase()
		);
		if (!channel) {
			log.warn(
				`[IrssiClient] ACTIVITY_UPDATE for unknown channel: ${channelName} on ${serverTag}`
			);
			return;
		}

		const key = this.getMarkerKey(network.uuid, channel.name);
		const dataLevel = msg.level || DataLevel.NONE;

		// Update or create unread marker
		const marker = this.unreadMarkers.get(key) || {
			network: network.uuid,
			channel: channel.name,
			unreadCount: 0,
			lastReadTime: 0,
			lastMessageTime: Date.now(),
			dataLevel: DataLevel.NONE,
		};

		marker.dataLevel = dataLevel;
		marker.lastMessageTime = Date.now();

		// Update unread count based on activity level
		// NOTE: irssi sends activity LEVEL (0-3), not message COUNT
		// We DON'T increment here - instead we count messages in DB that are newer than lastReadTime
		if (dataLevel === DataLevel.NONE) {
			// Marked as read - update lastReadTime and clear count
			marker.lastReadTime = Date.now();
			marker.unreadCount = 0;
		} else {
			// New activity - count unread from message storage
			if (this.messageStorage) {
				this.messageStorage
					.getUnreadCount(network.uuid, channel.name, marker.lastReadTime)
					.then((count) => {
						marker.unreadCount = count;
						this.unreadMarkers.set(key, marker);

						log.debug(
							`[IrssiClient] Activity update: ${network.name}/${channel.name} level=${dataLevel} unread=${count} (from DB)`
						);

						// Broadcast to all browsers with actual count from DB
						this.broadcastToAllBrowsers("activity_update" as any, {
							chan: channel.id,
							unread: count,
							highlight: dataLevel === DataLevel.HILIGHT ? count : 0,
						});
					})
					.catch((err) => {
						log.error(
							`Failed to get unread count for ${network.name}/${channel.name}: ${err}`
						);
						// Fallback: use old increment logic
						marker.unreadCount++;
						this.unreadMarkers.set(key, marker);

						this.broadcastToAllBrowsers("activity_update" as any, {
							chan: channel.id,
							unread: marker.unreadCount,
							highlight: dataLevel === DataLevel.HILIGHT ? marker.unreadCount : 0,
						});
					});
				return; // Don't broadcast yet - wait for DB query
			} else {
				// No message storage - fallback to increment
				marker.unreadCount++;
			}
		}

		this.unreadMarkers.set(key, marker);

		log.debug(
			`[IrssiClient] Activity update: ${network.name}/${channel.name} level=${dataLevel} unread=${marker.unreadCount}`
		);

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("activity_update" as any, {
			chan: channel.id,
			unread: marker.unreadCount,
			highlight: dataLevel === DataLevel.HILIGHT ? marker.unreadCount : 0,
		});
	}

	/**
	 * Mark channel as read (from browser or irssi)
	 * Clears unread marker and broadcasts to all browsers
	 */
	markAsRead(network: string, channel: string): void {
		const key = this.getMarkerKey(network, channel);
		const marker = this.unreadMarkers.get(key);

		if (marker) {
			marker.dataLevel = DataLevel.NONE;
			marker.unreadCount = 0;
			marker.lastReadTime = Date.now();
			this.unreadMarkers.set(key, marker);
		}

		log.debug(`[IrssiClient] Marked as read: ${network}/${channel}`);

		// Find network and channel IDs for broadcast
		const net = this.networks.find((n) => n.uuid === network);
		if (net) {
			const chan = net.channels.find((c) => c.name.toLowerCase() === channel.toLowerCase());
			if (chan) {
				// Broadcast to all browsers
				this.broadcastToAllBrowsers("activity_update" as any, {
					chan: chan.id,
					unread: 0,
					highlight: 0,
				});

				// Send mark_read to irssi to clear activity there too
				if (this.irssiConnection) {
					this.irssiConnection.send({
						type: "mark_read" as any,
						server: net.serverTag,
						target: chan.name,
					});
				}
			}
		}
	}

	/**
	 * Handle query_closed from irssi (query window closed in irssi)
	 * Removes query from network and broadcasts to all browsers (2-way sync)
	 */
	private async handleQueryClosed(msg: FeWebMessage): Promise<void> {
		const serverTag = msg.server || msg.server_tag;
		const nick = msg.nick;

		if (!serverTag || !nick) {
			log.warn(
				`[IrssiClient] Invalid query_closed message (missing server/nick): ${JSON.stringify(
					msg
				)}`
			);
			return;
		}

		// Find network by server_tag
		const network = this.networks.find((n) => n.serverTag === serverTag);
		if (!network) {
			log.warn(`[IrssiClient] query_closed for unknown server: ${serverTag}`);
			return;
		}

		// Import ChanType dynamically
		const {ChanType} = await import("../shared/types/chan");

		// Find query by nick
		const query = network.channels.find(
			(c) => c.type === ChanType.QUERY && c.name.toLowerCase() === nick.toLowerCase()
		);

		if (!query) {
			log.warn(`[IrssiClient] query_closed for unknown query: ${nick} on ${serverTag}`);
			return;
		}

		log.info(`[IrssiClient] Query closed in irssi: ${nick} on ${serverTag}`);

		// Remove query from network
		const index = network.channels.indexOf(query);
		if (index !== -1) {
			network.channels.splice(index, 1);
		}

		// Broadcast to all browsers (close query window in frontend)
		this.broadcastToAllBrowsers("part", {
			chan: query.id,
		});

		log.debug(`[IrssiClient] Broadcasted part for query ${query.id} (${nick}) to all browsers`);
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

		const network = this.networks.find((n) => n.uuid === networkUuid);
		const channel = network?.channels.find((c) => c.id === channelId);

		// Save to encrypted storage (ASYNC - don't block!)
		// Create minimal Network/Channel objects for storage
		if (this.messageStorage && network && channel) {
			// Create minimal Network object (only uuid and name needed for storage)
			const networkForStorage = {
				uuid: network.uuid,
				name: network.name,
			} as Network;

			// Create minimal Channel object (only name needed for storage)
			const channelForStorage = {
				name: channel.name,
			} as Chan;

			// Save encrypted to SQLite (async - don't await!)
			this.messageStorage.index(networkForStorage, channelForStorage, msg).catch((err) => {
				log.error(
					`Failed to save message to storage for ${network.name}/${channel.name}: ${err}`
				);
			});
		}

		// Detect highlight (mention of user's nick)
		const isHighlight =
			network && msg.text
				? msg.text.toLowerCase().includes(network.nick.toLowerCase())
				: false;

		// Broadcast to all browsers (live update)
		this.broadcastToAllBrowsers("msg", {
			chan: channelId,
			msg: msg,
			unread: msg.self ? 0 : 1,
			highlight: isHighlight && !msg.self ? 1 : 0,
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

		// DON'T send 'users' event - it triggers frontend to request /names which is wasteful!
		// In irssi mode we already have the data, just send 'names' event directly

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

		// Log structure for debugging
		log.debug(
			`[IrssiClient] Init event structure: ${sharedNetworks.length} networks, ` +
				`channels: ${sharedNetworks
					.map((n) => `${n.name}(${n.channels.length})`)
					.join(", ")}`
		);

		// Broadcast to all browsers
		this.broadcastToAllBrowsers("init", {
			networks: sharedNetworks,
			active: -1,
		});

		log.info(`[IrssiClient] ⏰ TIMING: Sent init event with ${sharedNetworks.length} networks`);

		// Send names event for each channel with users
		// This ensures frontend has nicklist data immediately after init
		for (const net of networks) {
			for (const channel of net.channels) {
				if (channel.users.size > 0) {
					const usersArray = Array.from(channel.users.values());
					this.broadcastToAllBrowsers("names", {
						id: channel.id,
						users: usersArray,
					});
					log.info(
						`[IrssiClient] ⏰ TIMING: Sent names for channel ${channel.id} (${usersArray.length} users) after init`
					);
				}
			}
		}

		log.info(`[IrssiClient] ⏰ TIMING: handleInit() COMPLETED`);
	}
}

export default IrssiClient;
