/**
 * irssi Network Manager
 *
 * Manages IRC networks and servers via irssi commands.
 * Provides functionality to:
 * - List configured networks from ~/.irssi/config
 * - Add new networks and servers
 * - Connect/disconnect from networks
 * - Remove networks from configuration
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * IRC Server configuration
 */
export interface IrssiServer {
	/** Server address (e.g., irc.libera.chat) */
	address: string;

	/** Server port (e.g., 6667, 6697) */
	port: number;

	/** Network name (chatnet) this server belongs to */
	chatnet: string;

	/** Whether to use TLS/SSL */
	useTLS: boolean;

	/** Whether to verify TLS certificate */
	tlsVerify?: boolean;

	/** Whether to auto-connect on startup */
	autoConnect?: boolean;

	/** Server password (if required) */
	password?: string;
}

/**
 * IRC Network configuration
 */
export interface IrssiNetwork {
	/** Network name (e.g., liberachat, EFNet) */
	name: string;

	/** Network type (usually "IRC") */
	type?: string;

	/** Primary nickname */
	nick?: string;

	/** Alternate nickname */
	alternateNick?: string;

	/** Username (ident) */
	username?: string;

	/** Real name (GECOS) */
	realname?: string;

	/** User modes to set on connect */
	usermode?: string;

	/** Commands to execute after connecting */
	autoSendCmd?: string;

	/** SASL authentication mechanism */
	saslMechanism?: string;

	/** SASL username */
	saslUsername?: string;

	/** SASL password */
	saslPassword?: string;

	/** List of servers in this network */
	servers: IrssiServer[];

	/** Rate limiting: max kicks at once */
	maxKicks?: number;

	/** Rate limiting: max messages at once */
	maxMsgs?: number;

	/** Rate limiting: max WHOIS queries at once */
	maxWhois?: number;
}

/**
 * Parsed irssi configuration
 */
export interface IrssiConfig {
	/** List of configured servers */
	servers: IrssiServer[];

	/** List of configured networks (chatnets) */
	networks: Map<string, IrssiNetwork>;
}

/**
 * irssi Network Manager
 *
 * Manages IRC networks and servers via irssi native commands
 */
export class IrssiNetworkManager {
	private configPath: string;

	constructor(configPath?: string) {
		this.configPath = configPath || path.join(os.homedir(), ".irssi", "config");
	}

	/**
	 * Parse irssi config file and return structured data
	 *
	 * @returns Parsed irssi configuration
	 */
	async parseIrssiConfig(): Promise<IrssiConfig> {
		try {
			const configContent = await fs.readFile(this.configPath, "utf-8");
			return this.parseConfigContent(configContent);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return {servers: [], networks: new Map()};
			}
			throw error;
		}
	}

	/**
	 * Parse irssi config content
	 *
	 * @param content - Raw config file content
	 * @returns Parsed configuration
	 */
	private parseConfigContent(content: string): IrssiConfig {
		const servers: IrssiServer[] = [];
		const networks = new Map<string, IrssiNetwork>();

		const serversMatch = content.match(/servers\s*=\s*\(([\s\S]*?)\);/);
		if (serversMatch) {
			const serversBlock = serversMatch[1];
			const serverEntries = this.extractConfigEntries(serversBlock);

			for (const entry of serverEntries) {
				const server = this.parseServerEntry(entry);
				if (server) {
					servers.push(server);
				}
			}
		}

		const chatnetsMatch = content.match(/chatnets\s*=\s*\{([\s\S]*?)\};/);
		if (chatnetsMatch) {
			const chatnetsBlock = chatnetsMatch[1];
			const networkEntries = this.extractNetworkEntries(chatnetsBlock);

			for (const [name, entry] of networkEntries) {
				const network = this.parseNetworkEntry(name, entry);
				if (network) {
					network.servers = servers.filter((s) => s.chatnet === name);
					networks.set(name, network);
				}
			}
		}

		return {servers, networks};
	}

	/**
	 * Extract server entries from servers block
	 *
	 * @param block - Servers block content
	 * @returns Array of server entry strings
	 */
	private extractConfigEntries(block: string): string[] {
		const entries: string[] = [];
		let depth = 0;
		let currentEntry = "";

		for (let i = 0; i < block.length; i++) {
			const char = block[i];

			if (char === "{") {
				depth++;
				currentEntry += char;
			} else if (char === "}") {
				depth--;
				currentEntry += char;

				if (depth === 0 && currentEntry.trim()) {
					entries.push(currentEntry.trim());
					currentEntry = "";
				}
			} else if (depth > 0) {
				currentEntry += char;
			}
		}

		return entries;
	}

	/**
	 * Extract network entries from chatnets block
	 *
	 * @param block - Chatnets block content
	 * @returns Map of network name to entry string
	 */
	private extractNetworkEntries(block: string): Map<string, string> {
		const entries = new Map<string, string>();
		const regex = /(\w+)\s*=\s*\{([^}]+)\};/g;
		let match;

		while ((match = regex.exec(block)) !== null) {
			const networkName = match[1];
			const networkContent = match[2];
			entries.set(networkName, networkContent);
		}

		return entries;
	}

	/**
	 * Parse single server entry
	 *
	 * @param entry - Server entry string
	 * @returns Parsed server or null
	 */
	private parseServerEntry(entry: string): IrssiServer | null {
		const addressMatch = entry.match(/address\s*=\s*"([^"]+)"/);
		const portMatch = entry.match(/port\s*=\s*"(\d+)"/);
		const chatnetMatch = entry.match(/chatnet\s*=\s*"([^"]+)"/);
		const useTLSMatch = entry.match(/use_tls\s*=\s*"(yes|no)"/);
		const tlsVerifyMatch = entry.match(/tls_verify\s*=\s*"(yes|no)"/);
		const autoconnectMatch = entry.match(/autoconnect\s*=\s*"(yes|no)"/);
		const passwordMatch = entry.match(/password\s*=\s*"([^"]+)"/);

		if (!addressMatch || !portMatch) {
			return null;
		}

		return {
			address: addressMatch[1],
			port: parseInt(portMatch[1], 10),
			chatnet: chatnetMatch ? chatnetMatch[1] : "",
			useTLS: useTLSMatch ? useTLSMatch[1] === "yes" : false,
			tlsVerify: tlsVerifyMatch ? tlsVerifyMatch[1] === "yes" : undefined,
			autoConnect: autoconnectMatch ? autoconnectMatch[1] === "yes" : undefined,
			password: passwordMatch ? passwordMatch[1] : undefined,
		};
	}

	/**
	 * Parse single network entry
	 *
	 * @param name - Network name
	 * @param entry - Network entry string
	 * @returns Parsed network or null
	 */
	private parseNetworkEntry(name: string, entry: string): IrssiNetwork | null {
		const typeMatch = entry.match(/type\s*=\s*"([^"]+)"/);
		const maxKicksMatch = entry.match(/max_kicks\s*=\s*"(\d+)"/);
		const maxMsgsMatch = entry.match(/max_msgs\s*=\s*"(\d+)"/);
		const maxWhoisMatch = entry.match(/max_whois\s*=\s*"(\d+)"/);

		return {
			name,
			type: typeMatch ? typeMatch[1] : "IRC",
			maxKicks: maxKicksMatch ? parseInt(maxKicksMatch[1], 10) : undefined,
			maxMsgs: maxMsgsMatch ? parseInt(maxMsgsMatch[1], 10) : undefined,
			maxWhois: maxWhoisMatch ? parseInt(maxWhoisMatch[1], 10) : undefined,
			servers: [],
		};
	}

	/**
	 * Get list of configured networks from irssi config
	 *
	 * @returns List of networks with their servers
	 */
	async listNetworks(): Promise<IrssiNetwork[]> {
		const config = await this.parseIrssiConfig();
		return Array.from(config.networks.values());
	}

	/**
	 * Add new network to irssi via /NETWORK ADD command
	 *
	 * @param network - Network configuration
	 * @param executeCommand - Function to execute irssi command
	 */
	async addNetwork(
		network: IrssiNetwork,
		executeCommand: (cmd: string) => Promise<void>
	): Promise<void> {
		if (!network.name || network.name.trim().length === 0) {
			throw new Error("Network name is required");
		}

		if (network.servers.length === 0) {
			throw new Error("At least one server is required");
		}

		const existingNetworks = await this.listNetworks();
		const exists = existingNetworks.some((n) => n.name === network.name);

		if (exists) {
			throw new Error(`Network ${network.name} already exists`);
		}

		await executeCommand(`/NETWORK ADD ${this.escapeIrssiArg(network.name)}`);

		if (network.nick) {
			await executeCommand(
				`/NETWORK MODIFY -nick ${this.escapeIrssiArg(network.nick)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		if (network.alternateNick) {
			await executeCommand(
				`/NETWORK MODIFY -alternate_nick ${this.escapeIrssiArg(network.alternateNick)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		if (network.username) {
			await executeCommand(
				`/NETWORK MODIFY -user ${this.escapeIrssiArg(network.username)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		if (network.realname) {
			await executeCommand(
				`/NETWORK MODIFY -realname ${this.escapeIrssiArg(network.realname)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		if (network.usermode) {
			await executeCommand(
				`/NETWORK MODIFY -usermode ${this.escapeIrssiArg(network.usermode)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		if (network.autoSendCmd) {
			await executeCommand(
				`/NETWORK MODIFY -autosendcmd ${this.escapeIrssiArg(network.autoSendCmd)} ${this.escapeIrssiArg(network.name)}`
			);
		}

		for (const server of network.servers) {
			await this.addServerToNetwork(server, executeCommand);
		}

		await executeCommand("/SAVE");
	}

	/**
	 * Add server to network via /SERVER ADD command
	 *
	 * @param server - Server configuration
	 * @param executeCommand - Function to execute irssi command
	 */
	async addServerToNetwork(
		server: IrssiServer,
		executeCommand: (cmd: string) => Promise<void>
	): Promise<void> {
		if (!server.address || server.address.trim().length === 0) {
			throw new Error("Server address is required");
		}

		if (!server.port || server.port < 1 || server.port > 65535) {
			throw new Error("Server port must be between 1 and 65535");
		}

		if (!server.chatnet || server.chatnet.trim().length === 0) {
			throw new Error("Server chatnet (network) is required");
		}

		const flags: string[] = [];

		if (server.useTLS) {
			flags.push("-tls");
		} else {
			flags.push("-notls");
		}

		if (server.tlsVerify !== undefined) {
			flags.push(server.tlsVerify ? "-tls_verify" : "-notls_verify");
		}

		if (server.autoConnect) {
			flags.push("-auto");
		} else {
			flags.push("-noauto");
		}

		flags.push(`-network ${this.escapeIrssiArg(server.chatnet)}`);

		if (server.password) {
			flags.push(`-password ${this.escapeIrssiArg(server.password)}`);
		}

		const flagsStr = flags.join(" ");
		const cmd = `/SERVER ADD ${flagsStr} ${this.escapeIrssiArg(server.address)} ${server.port}`;

		await executeCommand(cmd);
	}

	/**
	 * Connect to network via /CONNECT command
	 *
	 * @param networkName - Name of network to connect to
	 * @param executeCommand - Function to execute irssi command
	 */
	async connectToNetwork(
		networkName: string,
		executeCommand: (cmd: string) => Promise<void>
	): Promise<void> {
		if (!networkName || networkName.trim().length === 0) {
			throw new Error("Network name is required");
		}

		const networks = await this.listNetworks();
		const network = networks.find((n) => n.name === networkName);

		if (!network) {
			throw new Error(`Network ${networkName} not found`);
		}

		await executeCommand(`/CONNECT ${this.escapeIrssiArg(networkName)}`);
	}

	/**
	 * Disconnect from network via /DISCONNECT command
	 *
	 * @param networkTag - Server tag to disconnect
	 * @param executeCommand - Function to execute irssi command
	 */
	async disconnectFromNetwork(
		networkTag: string,
		executeCommand: (cmd: string) => Promise<void>
	): Promise<void> {
		if (!networkTag || networkTag.trim().length === 0) {
			throw new Error("Network tag is required");
		}

		await executeCommand(`/DISCONNECT ${this.escapeIrssiArg(networkTag)}`);
	}

	/**
	 * Remove network from configuration
	 *
	 * @param networkName - Name of network to remove
	 * @param executeCommand - Function to execute irssi command
	 */
	async removeNetwork(
		networkName: string,
		executeCommand: (cmd: string) => Promise<void>
	): Promise<void> {
		if (!networkName || networkName.trim().length === 0) {
			throw new Error("Network name is required");
		}

		const networks = await this.listNetworks();
		const network = networks.find((n) => n.name === networkName);

		if (!network) {
			throw new Error(`Network ${networkName} not found`);
		}

		for (const server of network.servers) {
			await executeCommand(`/SERVER REMOVE ${this.escapeIrssiArg(server.address)}`);
		}

		await executeCommand(`/NETWORK REMOVE ${this.escapeIrssiArg(networkName)}`);
		await executeCommand("/SAVE");
	}

	/**
	 * Escape argument for irssi command
	 * Prevents command injection by escaping special characters
	 *
	 * @param arg - Argument to escape
	 * @returns Escaped argument
	 */
	private escapeIrssiArg(arg: string): string {
		return arg.replace(/[;|&$`\\"\n\r]/g, "\\$&");
	}
}

export default IrssiConfig;
