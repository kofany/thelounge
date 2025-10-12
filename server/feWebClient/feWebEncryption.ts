/**
 * fe-web Encryption Helper (Server-side)
 * 
 * Implements AES-256-GCM encryption for fe-web WebSocket messages.
 * Uses password-based key derivation (PBKDF2) with irssi WebSocket password as salt.
 * 
 * This is a server-side port of client/js/feWebEncryption.ts using Node.js crypto API.
 */

import crypto from "crypto";

/**
 * Encryption helper for fe-web messages
 * 
 * Algorithm: AES-256-GCM (Galois/Counter Mode)
 * - Key size: 256 bits (32 bytes)
 * - IV size: 96 bits (12 bytes) - random per message
 * - Tag size: 128 bits (16 bytes) - authentication tag
 * 
 * Key Derivation: PBKDF2-HMAC-SHA256
 * - Input: User's The Lounge password
 * - Salt: irssi WebSocket password (unique per user)
 * - Iterations: 10,000
 * - Output: 256-bit key
 * 
 * Message Format:
 * [IV (12 bytes)] [Ciphertext (variable)] [Auth Tag (16 bytes)]
 */
export class FeWebEncryption {
	private password: string;
	private salt: string;
	private key: Buffer | null = null;
	private enabled: boolean;

	/**
	 * @param password - User's The Lounge password (for encryption key derivation)
	 * @param salt - irssi WebSocket password (used as salt)
	 * @param enabled - Enable/disable encryption
	 */
	constructor(password: string, salt: string, enabled: boolean = true) {
		this.password = password;
		this.salt = salt;
		this.enabled = enabled;
	}

	/**
	 * Derive encryption key from password using PBKDF2
	 */
	async deriveKey(): Promise<void> {
		if (!this.enabled || !this.password) {
			console.log("[FeWebEncryption] Encryption disabled or no password");
			return;
		}

		return new Promise((resolve, reject) => {
			crypto.pbkdf2(
				this.password,
				this.salt,
				10000, // iterations
				32, // key length (256 bits)
				"sha256",
				(err, derivedKey) => {
					if (err) {
						reject(err);
						return;
					}

					this.key = derivedKey;
					console.log("[FeWebEncryption] Encryption key derived successfully");
					resolve();
				}
			);
		});
	}

	/**
	 * Encrypt a JSON message
	 * 
	 * @param plaintext - JSON string to encrypt
	 * @returns Binary data: IV (12 bytes) + Ciphertext + Tag (16 bytes)
	 */
	async encrypt(plaintext: string): Promise<Buffer> {
		if (!this.enabled || !this.key) {
			// If encryption disabled, return plaintext as UTF-8 bytes
			return Buffer.from(plaintext, "utf8");
		}

		// Generate random IV (12 bytes for GCM)
		const iv = crypto.randomBytes(12);

		// Create cipher
		const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

		// Encrypt plaintext
		const encrypted = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);

		// Get authentication tag
		const tag = cipher.getAuthTag();

		// Build message: IV + ciphertext + tag
		const message = Buffer.concat([iv, encrypted, tag]);

		return message;
	}

	/**
	 * Decrypt a binary message
	 * 
	 * @param data - Binary data: IV (12 bytes) + Ciphertext + Tag (16 bytes)
	 * @returns Decrypted JSON string
	 */
	async decrypt(data: Buffer): Promise<string> {
		if (!this.enabled || !this.key) {
			// If encryption disabled, data is plain text
			return data.toString("utf8");
		}

		// Extract IV, ciphertext, and tag
		const iv = data.slice(0, 12);
		const tag = data.slice(-16);
		const ciphertext = data.slice(12, -16);

		try {
			// Create decipher
			const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
			decipher.setAuthTag(tag);

			// Decrypt and verify auth tag
			const plaintext = Buffer.concat([
				decipher.update(ciphertext),
				decipher.final(),
			]);

			// Decode to string
			return plaintext.toString("utf8");
		} catch (error) {
			console.error("[FeWebEncryption] Decryption failed:", error);
			throw new Error("Decryption failed - invalid key or corrupted data");
		}
	}

	/**
	 * Check if encryption is enabled and key is derived
	 */
	get isReady(): boolean {
		return !this.enabled || this.key !== null;
	}

	/**
	 * Check if encryption is enabled
	 */
	get isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Update encryption key (used when password changes)
	 */
	async updateKey(newPassword: string): Promise<void> {
		this.password = newPassword;
		this.key = null;
		await this.deriveKey();
	}
}

