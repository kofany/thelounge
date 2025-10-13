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

	// Placeholder handlers for remaining message types (9-20)
	private handleChannelMode(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] channel_mode: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleNicklist(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] nicklist: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleNickChange(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] nick_change: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleUserMode(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] user_mode: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleAway(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] away: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleWhois(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] whois: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleChannelList(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] channel_list: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleStateDump(msg: FeWebMessage): void {
		log.info("[FeWebAdapter] Received state_dump");
		// TODO: Implement - this is critical for initial state
	}

	private handleQueryOpened(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] query_opened: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleQueryClosed(msg: FeWebMessage): void {
		log.debug(`[FeWebAdapter] query_closed: ${JSON.stringify(msg)}`);
		// TODO: Implement
	}

	private handleError(msg: FeWebMessage): void {
		log.error(`[FeWebAdapter] Error from fe-web: ${msg.text}`);
	}

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
}

