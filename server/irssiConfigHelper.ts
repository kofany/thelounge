/**
 * irssi Config Helper
 *
 * Helper functions for managing irssi user configuration:
 * - Encrypting/decrypting irssi password
 * - Creating initial user config
 * - Migrating from old config format
 */

import crypto from "crypto";
import {IrssiUserConfig, IrssiConnectionConfig} from "./irssiClient";

/**
 * Encrypt irssi password with user's The Lounge password
 *
 * Uses AES-256-GCM with PBKDF2(userPassword, "thelounge_irssi_temp_salt")
 * This MUST match the decryption in IrssiClient.login()
 *
 * @param irssiPassword - Plain irssi WebSocket password
 * @param userPassword - User's The Lounge password
 * @returns Base64-encoded encrypted password
 */
export async function encryptIrssiPassword(
	irssiPassword: string,
	userPassword: string
): Promise<string> {
	// IMPORTANT: Use same salt as in IrssiClient.login()
	const tempSalt = "thelounge_irssi_temp_salt";
	const tempKey = crypto.pbkdf2Sync(userPassword, tempSalt, 10000, 32, "sha256");

	// Generate random IV (12 bytes for GCM)
	const iv = crypto.randomBytes(12);

	// Encrypt with AES-256-GCM
	const cipher = crypto.createCipheriv("aes-256-gcm", tempKey, iv);
	const encrypted = Buffer.concat([cipher.update(irssiPassword, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();

	// Format: [IV (12 bytes)] [Ciphertext] [Tag (16 bytes)]
	const result = Buffer.concat([iv, encrypted, tag]);
	return result.toString("base64");
}

/**
 * Decrypt irssi password with user's The Lounge password
 *
 * Uses AES-256-GCM with PBKDF2(userPassword, "thelounge_irssi_temp_salt")
 * This MUST match the encryption in encryptIrssiPassword()
 *
 * @param encryptedPassword - Base64-encoded encrypted password
 * @param userPassword - User's The Lounge password
 * @returns Plain irssi WebSocket password
 */
export async function decryptIrssiPassword(
	encryptedPassword: string,
	userPassword: string
): Promise<string> {
	// IMPORTANT: Use same salt as in encryptIrssiPassword()
	const tempSalt = "thelounge_irssi_temp_salt";
	const tempKey = crypto.pbkdf2Sync(userPassword, tempSalt, 10000, 32, "sha256");

	const encryptedBuffer = Buffer.from(encryptedPassword, "base64");

	// Parse: [IV (12 bytes)] [Ciphertext] [Tag (16 bytes)]
	const iv = encryptedBuffer.slice(0, 12);
	const tag = encryptedBuffer.slice(-16);
	const ciphertext = encryptedBuffer.slice(12, -16);

	// Decrypt with AES-256-GCM
	const decipher = crypto.createDecipheriv("aes-256-gcm", tempKey, iv);
	decipher.setAuthTag(tag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString("utf8");
}

/**
 * Create initial irssi user config
 *
 * @param username - Username
 * @param passwordHash - bcrypt hash of user's password (for authentication)
 * @param userPassword - Plain user password (for encrypting irssi password)
 * @param irssiHost - irssi fe-web host
 * @param irssiPort - irssi fe-web port
 * @param irssiPassword - Plain irssi WebSocket password
 * @returns User config object
 */
export async function createIrssiUserConfig(
	username: string,
	passwordHash: string,
	userPassword: string,
	irssiHost: string,
	irssiPort: number,
	irssiPassword: string
): Promise<IrssiUserConfig> {
	// Encrypt irssi password
	const encryptedIrssiPassword = await encryptIrssiPassword(irssiPassword, userPassword);

	const config: IrssiUserConfig = {
		log: true,
		password: passwordHash, // bcrypt hash
		irssiConnection: {
			host: irssiHost,
			port: irssiPort,
			passwordEncrypted: encryptedIrssiPassword,
			encryption: true,
			useTLS: true, // fe-web v1.5 requires wss://
			rejectUnauthorized: false, // Accept self-signed certificates by default
		},
		sessions: {},
		clientSettings: {},
		browser: {},
	};

	return config;
}

/**
 * Update irssi password in user config
 *
 * Used when user changes their irssi password.
 *
 * @param config - Current user config
 * @param newIrssiPassword - New plain irssi WebSocket password
 * @param userPassword - User's The Lounge password
 * @returns Updated config
 */
export async function updateIrssiPassword(
	config: IrssiUserConfig,
	newIrssiPassword: string,
	userPassword: string
): Promise<IrssiUserConfig> {
	const encryptedIrssiPassword = await encryptIrssiPassword(newIrssiPassword, userPassword);

	return {
		...config,
		irssiConnection: {
			...config.irssiConnection,
			passwordEncrypted: encryptedIrssiPassword,
		},
	};
}

/**
 * Update irssi connection settings (host, port, password)
 *
 * @param config - Current user config
 * @param newHost - New irssi host
 * @param newPort - New irssi port
 * @param newIrssiPassword - New plain irssi WebSocket password
 * @param userPassword - User's The Lounge password
 * @returns Updated config
 */
export async function updateIrssiConnection(
	config: IrssiUserConfig,
	newHost: string,
	newPort: number,
	newIrssiPassword: string,
	userPassword: string
): Promise<IrssiUserConfig> {
	const encryptedIrssiPassword = await encryptIrssiPassword(newIrssiPassword, userPassword);

	return {
		...config,
		irssiConnection: {
			...config.irssiConnection,
			host: newHost,
			port: newPort,
			passwordEncrypted: encryptedIrssiPassword,
			useTLS: true, // fe-web v1.5 requires wss://
			rejectUnauthorized: false, // Accept self-signed certificates
		},
	};
}

/**
 * Validate irssi connection config
 *
 * @param config - irssi connection config
 * @returns true if valid, error message if invalid
 */
export function validateIrssiConnectionConfig(config: IrssiConnectionConfig): true | string {
	if (!config.host || config.host.trim().length === 0) {
		return "irssi host is required";
	}

	if (!config.port || config.port < 1 || config.port > 65535) {
		return "irssi port must be between 1 and 65535";
	}

	if (!config.passwordEncrypted || config.passwordEncrypted.trim().length === 0) {
		return "irssi password is required";
	}

	return true;
}

/**
 * Derive encryption key for message storage
 *
 * This is the same key derivation used in IrssiClient.login()
 *
 * @param userPassword - User's The Lounge password
 * @param irssiPassword - Plain irssi WebSocket password (salt)
 * @returns Encryption key (32 bytes)
 */
export function deriveEncryptionKey(userPassword: string, irssiPassword: string): Buffer {
	return crypto.pbkdf2Sync(userPassword, irssiPassword, 10000, 32, "sha256");
}

/**
 * Re-encrypt irssi password when user changes their The Lounge password
 *
 * @param config - Current user config
 * @param oldUserPassword - Old user password
 * @param newUserPassword - New user password
 * @returns Updated config with re-encrypted irssi password
 */
export async function reEncryptIrssiPassword(
	config: IrssiUserConfig,
	oldUserPassword: string,
	newUserPassword: string
): Promise<IrssiUserConfig> {
	// Decrypt with old password
	const irssiPassword = await decryptIrssiPassword(
		config.irssiConnection.passwordEncrypted,
		oldUserPassword
	);

	// Encrypt with new password
	const encryptedIrssiPassword = await encryptIrssiPassword(irssiPassword, newUserPassword);

	return {
		...config,
		irssiConnection: {
			...config.irssiConnection,
			passwordEncrypted: encryptedIrssiPassword,
		},
	};
}

export default {
	encryptIrssiPassword,
	decryptIrssiPassword,
	createIrssiUserConfig,
	updateIrssiPassword,
	updateIrssiConnection,
	validateIrssiConnectionConfig,
	deriveEncryptionKey,
	reEncryptIrssiPassword,
};
