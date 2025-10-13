/**
 * fe-web Event Adapter (Server-side)
 *
 * Maps fe-web JSON messages to The Lounge event format.
 * Implements 100% of CLIENT-SPEC.md message types.
 *
 * This is a server-side port of client/js/feWebAdapter.ts
 * Key differences:
 * - No Vue store - uses callback functions instead
 * - No socketWrapper - emits events directly to IrssiClient
 * - Server-side types (Chan, Msg, Network from server/models)
 */

import type {FeWebSocket, FeWebMessage} from "./feWebSocket";
import Chan from "../models/chan";
import Msg, {MessageType} from "../models/msg";
import User from "../models/user";
import log from "../log";
import colors from "chalk";

// Callback types for IrssiClient integration
export type NetworkData = {
	uuid: string;
	name: string;
	nick: string;
	serverTag: string;
	channels: Chan[];
	connected: boolean;
};

export type FeWebAdapterCallbacks = {
	onNetworkUpdate: (network: NetworkData) => void;
	onMessage: (networkUuid: string, channelId: number, msg: Msg) => void;
	onChannelJoin: (networkUuid: string, channel: Chan) => void;
	onChannelPart: (networkUuid: string, channelId: number) => void;
	onNicklistUpdate: (networkUuid: string, channelId: number, users: User[]) => void;
	onTopicUpdate: (networkUuid: string, channelId: number, topic: string) => void;
	onInit: (networks: NetworkData[]) => void;
};

export class FeWebAdapter {
	private socket: FeWebSocket;
	private callbacks: FeWebAdapterCallbacks;
	private serverTagToNetworkMap: Map<string, NetworkData> = new Map();
	private messageIdCounter = 1;
	private channelIdCounter = 1;
	private initEmitted = false;

	constructor(socket: FeWebSocket, callbacks: FeWebAdapterCallbacks) {
		this.socket = socket;
		this.callbacks = callbacks;
		this.registerHandlers();
	}

	/**
	 * Register all message handlers according to CLIENT-SPEC.md
	 */
	private registerHandlers(): void {
		log.info("[FeWebAdapter] Registering fe-web message handlers");

		// 1. auth_ok - Authentication successful
		this.socket.on("auth_ok", (msg) => this.handleAuthOk(msg));

		// 2. message - IRC message (public/private)
		this.socket.on("message", (msg) => this.handleMessage(msg));

		// 3. server_status - Server connection status
		this.socket.on("server_status", (msg) => this.handleServerStatus(msg));

		// 4. channel_join - User joined channel
		this.socket.on("channel_join", (msg) => this.handleChannelJoin(msg));

		// 5. channel_part - User left channel
		this.socket.on("channel_part", (msg) => this.handleChannelPart(msg));

		// 6. channel_kick - User kicked from channel
		this.socket.on("channel_kick", (msg) => this.handleChannelKick(msg));

		// 7. user_quit - User quit IRC
		this.socket.on("user_quit", (msg) => this.handleUserQuit(msg));

		// 8. topic - Channel topic
		this.socket.on("topic", (msg) => this.handleTopic(msg));

		// 9. channel_mode - Channel mode change
		this.socket.on("channel_mode", (msg) => this.handleChannelMode(msg));

		// 10. nicklist - Complete channel nicklist
		this.socket.on("nicklist", (msg) => this.handleNicklist(msg));

		// 11. nick_change - Nick change
		this.socket.on("nick_change", (msg) => this.handleNickChange(msg));

		// 12. user_mode - User mode change
		this.socket.on("user_mode", (msg) => this.handleUserMode(msg));

		// 13. away - Away status change
		this.socket.on("away", (msg) => this.handleAway(msg));

		// 14. whois - WHOIS response
		this.socket.on("whois", (msg) => this.handleWhois(msg));

		// 15. channel_list - Channel list response
		this.socket.on("channel_list", (msg) => this.handleChannelList(msg));

		// 16. state_dump - Initial state dump
		this.socket.on("state_dump", (msg) => this.handleStateDump(msg));

		// 17. query_opened - Query window opened
		this.socket.on("query_opened", (msg) => this.handleQueryOpened(msg));

		// 18. query_closed - Query window closed
		this.socket.on("query_closed", (msg) => this.handleQueryClosed(msg));

		// 19. error - Error message
		this.socket.on("error", (msg) => this.handleError(msg));

		// 20. pong - Pong response
		this.socket.on("pong", (msg) => this.handlePong(msg));
	}

	/**
	 * 1. auth_ok - Authentication successful
	 */
	private handleAuthOk(msg: FeWebMessage): void {
		log.info("[FeWebAdapter] Authenticated to fe-web");
		// Wait for state_dump to emit init event
	}

	/**
	 * 2. message - IRC message (public/private)
	 */
	private handleMessage(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channelName = msg.channel!;
		let channel = this.findChannel(network, channelName);

		// Create query channel if private message and doesn't exist
		if (!channel && msg.level === 8) {
			channel = this.createQueryChannel(network, channelName);
		}

		if (!channel) {
			log.warn(`[FeWebAdapter] Channel ${channelName} not found`);
			return;
		}

		// Convert to The Lounge message format
		const loungeMsg = new Msg({
			type: MessageType.MESSAGE,
			time: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
			from: new User({nick: msg.nick!}),
			text: msg.text!,
			self: msg.is_own || false,
		});
		loungeMsg.id = this.messageIdCounter++;

		// Emit message event
		this.callbacks.onMessage(network.uuid, channel.id, loungeMsg);
	}

	/**
	 * 3. server_status - Server connection status
	 */
	private handleServerStatus(msg: FeWebMessage): void {
		log.info(`[FeWebAdapter] Server status: ${msg.server} = ${msg.text}`);
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		network.connected = msg.text === "connected";
		this.callbacks.onNetworkUpdate(network);
	}

	/**
	 * 4. channel_join - User joined channel
	 */
	private handleChannelJoin(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channelName = msg.channel!;
		const nick = msg.nick!;

		let channel = this.findChannel(network, channelName);
		if (!channel) {
			// Create channel - first join (our own)
			channel = this.createChannel(network, channelName);
			log.info(`[FeWebAdapter] Created channel ${channelName} on ${msg.server}`);
			this.callbacks.onChannelJoin(network.uuid, channel);
		} else {
			// Someone else joined
			if (nick && nick !== network.nick) {
				this.addUserToChannel(channel, nick);
				const joinMsg = new Msg({
					type: MessageType.JOIN,
					time: new Date(),
					from: new User({nick}),
					hostmask: msg.extra?.hostname || "",
					self: false,
				});
				joinMsg.id = this.messageIdCounter++;
				this.callbacks.onMessage(network.uuid, channel.id, joinMsg);
			}
		}
	}

	/**
	 * 5. channel_part - User left channel
	 */
	private handleChannelPart(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		const nick = msg.nick!;

		// Check if it's our own part
		if (nick === network.nick) {
			this.callbacks.onChannelPart(network.uuid, channel.id);
			// Remove channel from network
			network.channels = network.channels.filter((c) => c.id !== channel.id);
		} else {
			// Someone else parted
			this.removeUserFromChannel(channel, nick);
			const partMsg = new Msg({
				type: MessageType.PART,
				time: new Date(),
				from: new User({nick}),
				text: msg.text || "",
				self: false,
			});
			partMsg.id = this.messageIdCounter++;
			this.callbacks.onMessage(network.uuid, channel.id, partMsg);
		}
	}

	/**
	 * 6. channel_kick - User kicked from channel
	 */
	private handleChannelKick(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		const kickedNick = msg.nick!;
		const kickerNick = msg.extra?.kicker || "Server";

		// Check if we were kicked
		if (kickedNick === network.nick) {
			this.callbacks.onChannelPart(network.uuid, channel.id);
			network.channels = network.channels.filter((c) => c.id !== channel.id);
		} else {
			this.removeUserFromChannel(channel, kickedNick);
		}

		const kickMsg = new Msg({
			type: MessageType.KICK,
			time: new Date(),
			from: new User({nick: kickerNick}),
			target: new User({nick: kickedNick}),
			text: msg.text || "",
			self: false,
		});
		kickMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, channel.id, kickMsg);
	}

	/**
	 * 7. user_quit - User quit IRC
	 */
	private handleUserQuit(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const nick = msg.nick!;

		// Remove user from all channels
		for (const channel of network.channels) {
			if (this.removeUserFromChannel(channel, nick)) {
				const quitMsg = new Msg({
					type: MessageType.QUIT,
					time: new Date(),
					from: new User({nick}),
					text: msg.text || "",
					self: false,
				});
				quitMsg.id = this.messageIdCounter++;
				this.callbacks.onMessage(network.uuid, channel.id, quitMsg);
			}
		}
	}

	/**
	 * 8. topic - Channel topic
	 */
	private handleTopic(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		channel.topic = msg.text || "";
		this.callbacks.onTopicUpdate(network.uuid, channel.id, channel.topic);

		const topicMsg = new Msg({
			type: MessageType.TOPIC,
			time: new Date(),
			from: new User({nick: msg.nick || ""}),
			text: msg.text || "",
			self: false,
		});
		topicMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, channel.id, topicMsg);
	}

	/**
	 * 9. channel_mode - Channel mode change
	 */
	private handleChannelMode(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		const modeMsg = new Msg({
			type: MessageType.MODE_CHANNEL,
			time: new Date(),
			from: new User({nick: msg.nick || ""}),
			text: msg.text || "",
			self: false,
		});
		modeMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, channel.id, modeMsg);
	}

	/**
	 * 10. nicklist - Complete channel nicklist
	 * text field contains JSON array: [{"nick":"alice","prefix":"@"}, ...]
	 */
	private handleNicklist(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		try {
			const nicklist: Array<{nick: string; prefix: string}> = JSON.parse(msg.text || "[]");

			// Clear existing users
			channel.users = [];

			// Add all users with their modes
			nicklist.forEach((user) => {
				const mode = this.prefixToMode(user.prefix);
				channel.users.push(
					new User({
						nick: user.nick,
						mode: mode,
					})
				);
			});

			// Sort users by mode then nick
			this.sortChannelUsers(channel);

			// Emit nicklist update
			this.callbacks.onNicklistUpdate(network.uuid, channel.id, channel.users);
		} catch (error) {
			log.error(`[FeWebAdapter] Failed to parse nicklist: ${error}`);
		}
	}

	/**
	 * 11. nick_change - Nick change
	 * nick: old nick, text: new nick
	 */
	private handleNickChange(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const oldNick = msg.nick!;
		const newNick = msg.text!;

		// Check if it's our own nick
		const isSelf = network.nick === oldNick;
		if (isSelf) {
			network.nick = newNick;
		}

		// Update nick in all channels
		network.channels.forEach((channel) => {
			const user = channel.users.find((u) => u.nick === oldNick);
			if (user) {
				user.nick = newNick;

				const nickMsg = new Msg({
					type: MessageType.NICK,
					time: new Date(),
					from: new User({nick: oldNick}),
					new_nick: newNick,
					self: isSelf,
				});
				nickMsg.id = this.messageIdCounter++;
				this.callbacks.onMessage(network.uuid, channel.id, nickMsg);
			}
		});
	}

	/**
	 * 12. user_mode - User mode change
	 */
	private handleUserMode(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		// User mode changes are shown in lobby
		const lobby = network.channels.find((c) => c.type === "lobby");
		if (!lobby) return;

		const modeMsg = new Msg({
			type: MessageType.MODE,
			time: new Date(),
			from: new User({nick: network.nick}),
			text: msg.text || "",
			self: true,
		});
		modeMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, lobby.id, modeMsg);
	}

	/**
	 * 13. away - Away status change
	 */
	private handleAway(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const nick = msg.nick!;
		const awayMessage = msg.text || "";

		// Update away status in all channels
		network.channels.forEach((channel) => {
			const user = channel.users.find((u) => u.nick === nick);
			if (user) {
				user.away = awayMessage;
			}
		});
	}

	/**
	 * 14. whois - WHOIS response
	 */
	private handleWhois(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		// Show in lobby
		const lobby = network.channels.find((c) => c.type === "lobby");
		if (!lobby) return;

		const whoisMsg = new Msg({
			type: MessageType.WHOIS,
			time: new Date(),
			whois: {
				nick: msg.nick!,
				ident: msg.extra?.user || "",
				hostname: msg.extra?.host || "",
				real_name: msg.extra?.realname || "",
				channels: msg.extra?.channels || "",
				server: msg.extra?.server || "",
				account: msg.extra?.account || "",
			},
			self: false,
		});
		whoisMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, lobby.id, whoisMsg);
	}

	/**
	 * 15. channel_list - Channel list response
	 */
	private handleChannelList(msg: FeWebMessage): void {
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const channel = this.findChannel(network, msg.channel!);
		if (!channel) return;

		const listMsg = new Msg({
			type: MessageType.MODE_CHANNEL,
			time: new Date(),
			text: `${msg.extra?.list_type || ""} list: ${msg.extra?.entries || ""}`,
			self: false,
		});
		listMsg.id = this.messageIdCounter++;
		this.callbacks.onMessage(network.uuid, channel.id, listMsg);
	}

	/**
	 * 16. state_dump - Initial state dump
	 * Marker message, followed by channel_join, topic, nicklist
	 */
	private handleStateDump(msg: FeWebMessage): void {
		log.info(`[FeWebAdapter] State dump started for server: ${msg.server}`);

		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		// Clear existing channels (except lobby) to prepare for fresh state
		const lobby = network.channels.find((ch) => ch.type === "lobby");
		network.channels = lobby ? [lobby] : [];

		// Mark network as connected
		network.connected = true;

		log.info(`[FeWebAdapter] Network ${msg.server} status: connected=${network.connected}`);

		// Emit network status update
		this.callbacks.onNetworkUpdate(network);

		// After state_dump, we'll receive channel_join, topic, nicklist for each channel
		// Emit init after a short delay to ensure all state messages are processed
		setTimeout(() => {
			this.emitInit();
		}, 100);
	}

	/**
	 * Emit init event with all networks
	 */
	private emitInit(): void {
		if (this.initEmitted) return;
		this.initEmitted = true;

		const networks = Array.from(this.serverTagToNetworkMap.values());
		log.info(`[FeWebAdapter] Emitting init event with ${networks.length} networks`);
		this.callbacks.onInit(networks);
	}

	/**
	 * 17. query_opened - Query window opened
	 */
	private handleQueryOpened(msg: FeWebMessage): void {
		log.info(`[FeWebAdapter] Query opened: ${msg.nick} on ${msg.server}`);
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const nick = msg.nick!;

		// Check if query already exists
		let channel = this.findChannel(network, nick);
		if (channel) {
			log.debug(`[FeWebAdapter] Query ${nick} already exists`);
			return;
		}

		// Create query channel
		channel = this.createQueryChannel(network, nick);
		log.info(`[FeWebAdapter] Created query channel for ${nick} on ${msg.server}`);
		this.callbacks.onChannelJoin(network.uuid, channel);
	}

	/**
	 * 18. query_closed - Query window closed
	 */
	private handleQueryClosed(msg: FeWebMessage): void {
		log.info(`[FeWebAdapter] Query closed: ${msg.nick} on ${msg.server}`);
		const network = this.getOrCreateNetwork(msg.server!);
		if (!network) return;

		const nick = msg.nick!;

		// Find and remove query channel
		const channelIndex = network.channels.findIndex(
			(ch) => ch.type === "query" && ch.name.toLowerCase() === nick.toLowerCase()
		);

		if (channelIndex === -1) {
			log.debug(`[FeWebAdapter] Query ${nick} not found`);
			return;
		}

		const channel = network.channels[channelIndex];

		// Remove from network
		network.channels.splice(channelIndex, 1);

		// Emit part event
		this.callbacks.onChannelPart(network.uuid, channel.id);
	}

	/**
	 * 19. error - Error message
	 */
	private handleError(msg: FeWebMessage): void {
		log.error(`[FeWebAdapter] Error from fe-web: ${msg.text}`);
	}

	/**
	 * 20. pong - Pong response
	 */
	private handlePong(msg: FeWebMessage): void {
		log.debug("[FeWebAdapter] Received pong");
	}

	// Helper methods
	private getOrCreateNetwork(serverTag: string): NetworkData | null {
		let network = this.serverTagToNetworkMap.get(serverTag);

		if (!network) {
			// Create new network
			network = {
				uuid: this.generateUuid(),
				name: serverTag,
				nick: "", // Will be set from state_dump or nick_change
				serverTag: serverTag,
				channels: [],
				connected: false,
			};

			this.serverTagToNetworkMap.set(serverTag, network);
			log.info(`[FeWebAdapter] Created network for server tag: ${serverTag}`);
		}

		return network;
	}

	private findChannel(network: NetworkData, channelName: string): Chan | null {
		return network.channels.find((c) => c.name.toLowerCase() === channelName.toLowerCase()) || null;
	}

	private createChannel(network: NetworkData, channelName: string): Chan {
		const channel = new Chan({
			name: channelName,
			type: channelName.startsWith("#") ? "channel" : "query",
		});
		channel.id = this.channelIdCounter++;
		network.channels.push(channel);
		return channel;
	}

	private createQueryChannel(network: NetworkData, nick: string): Chan {
		const channel = new Chan({
			name: nick,
			type: "query",
		});
		channel.id = this.channelIdCounter++;
		network.channels.push(channel);
		return channel;
	}

	private addUserToChannel(channel: Chan, nick: string): void {
		// Check if user already exists
		const existingUser = channel.users.find((u) => u.nick === nick);
		if (!existingUser) {
			channel.users.push(new User({nick}));
		}
	}

	private removeUserFromChannel(channel: Chan, nick: string): boolean {
		const index = channel.users.findIndex((u) => u.nick === nick);
		if (index !== -1) {
			channel.users.splice(index, 1);
			return true;
		}
		return false;
	}

	private generateUuid(): string {
		return `network-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Convert IRC prefix to mode character
	 * @: op, +: voice, %: halfop, ~: owner, &: admin
	 */
	private prefixToMode(prefix: string): string {
		const prefixMap: {[key: string]: string} = {
			"@": "o", // op
			"+": "v", // voice
			"%": "h", // halfop
			"~": "q", // owner
			"&": "a", // admin
		};
		return prefixMap[prefix] || "";
	}

	/**
	 * Sort channel users by mode then nick
	 * Order: owner (~), admin (&), op (@), halfop (%), voice (+), normal
	 */
	private sortChannelUsers(channel: Chan): void {
		const modeOrder = ["q", "a", "o", "h", "v", ""];

		channel.users.sort((a, b) => {
			const aModeIndex = modeOrder.indexOf(a.mode);
			const bModeIndex = modeOrder.indexOf(b.mode);

			if (aModeIndex !== bModeIndex) {
				return aModeIndex - bModeIndex;
			}

			// Same mode - sort by nick (case insensitive)
			return a.nick.toLowerCase().localeCompare(b.nick.toLowerCase());
		});
	}
}

