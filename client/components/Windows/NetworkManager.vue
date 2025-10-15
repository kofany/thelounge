<template>
	<div id="network-manager" class="window" role="tabpanel" aria-label="Network Manager">
		<div class="header">
			<SidebarToggle />
		</div>
		<div class="container">
			<h1 class="title">IRC Network Manager</h1>
			<p class="info-text">
				<strong>Note:</strong> This feature is under development. Network/server management will be available once the backend implementation is complete.
			</p>

			<!-- Add New Network Section -->
			<section class="add-network">
				<h2>Add New Network</h2>
				<form @submit.prevent="addNewNetwork" class="network-form">
					<!-- Basic Network Settings -->
					<fieldset>
						<legend>Basic Settings</legend>

						<div class="form-row">
							<label for="network-name">Network Name *</label>
							<input
								id="network-name"
								v-model.trim="newNetwork.name"
								class="input"
								type="text"
								placeholder="Libera.Chat"
								required
								maxlength="100"
							/>
						</div>

						<div class="form-row">
							<label for="network-nick">Nickname</label>
							<input
								id="network-nick"
								v-model.trim="newNetwork.nick"
								class="input"
								type="text"
								placeholder="myuser"
								maxlength="100"
							/>
						</div>

						<div class="form-row">
							<label for="network-alt-nick">Alternate Nick</label>
							<input
								id="network-alt-nick"
								v-model.trim="newNetwork.alternateNick"
								class="input"
								type="text"
								placeholder="myuser_"
								maxlength="100"
							/>
						</div>

						<div class="form-row">
							<label for="network-username">Username (ident)</label>
							<input
								id="network-username"
								v-model.trim="newNetwork.username"
								class="input"
								type="text"
								placeholder="myuser"
								maxlength="100"
							/>
						</div>

						<div class="form-row">
							<label for="network-realname">Real Name</label>
							<input
								id="network-realname"
								v-model.trim="newNetwork.realname"
								class="input"
								type="text"
								placeholder="My Real Name"
								maxlength="255"
							/>
						</div>
					</fieldset>

					<!-- SASL Authentication -->
					<fieldset>
						<legend>SASL Authentication <span class="optional">(optional)</span></legend>

						<div class="form-row">
							<label for="sasl-mechanism">SASL Mechanism</label>
							<select
								id="sasl-mechanism"
								v-model="newNetwork.saslMechanism"
								class="input"
							>
								<option value="">None</option>
								<option value="PLAIN">PLAIN</option>
								<option value="EXTERNAL">EXTERNAL (client cert)</option>
								<option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
							</select>
						</div>

						<div v-if="newNetwork.saslMechanism && newNetwork.saslMechanism !== 'EXTERNAL'" class="form-row">
							<label for="sasl-username">SASL Username</label>
							<input
								id="sasl-username"
								v-model.trim="newNetwork.saslUsername"
								class="input"
								type="text"
								placeholder="myaccount"
								maxlength="100"
							/>
						</div>

						<div v-if="newNetwork.saslMechanism && newNetwork.saslMechanism !== 'EXTERNAL'" class="form-row">
							<label for="sasl-password">SASL Password</label>
							<input
								id="sasl-password"
								v-model="newNetwork.saslPassword"
								class="input"
								type="password"
								placeholder="secret"
								maxlength="255"
							/>
						</div>
					</fieldset>

					<!-- Advanced Network Settings -->
					<fieldset>
						<legend>Advanced Network Settings <span class="optional">(optional)</span></legend>

						<div class="form-row">
							<label for="network-usermode">User Mode</label>
							<input
								id="network-usermode"
								v-model.trim="newNetwork.usermode"
								class="input"
								type="text"
								placeholder="+iw"
								maxlength="50"
							/>
							<span class="help-inline">e.g., +iw for invisible and wallops</span>
						</div>

						<div class="form-row">
							<label for="network-autosendcmd">Commands After Connect</label>
							<textarea
								id="network-autosendcmd"
								v-model.trim="newNetwork.autosendcmd"
								class="input"
								rows="3"
								placeholder="/msg NickServ identify password"
								maxlength="500"
							/>
							<span class="help-inline">Commands to run after connecting (one per line or separated by ;)</span>
						</div>

						<div class="form-row">
							<label for="network-ownhost">Bind to Address</label>
							<input
								id="network-ownhost"
								v-model.trim="newNetwork.ownHost"
								class="input"
								type="text"
								placeholder="192.168.1.100 or example.com"
								maxlength="255"
							/>
							<span class="help-inline">Bind to specific local IP/hostname</span>
						</div>
					</fieldset>

					<!-- Servers -->
					<fieldset>
						<legend>Servers <span class="required">(at least one required)</span></legend>

						<div
							v-for="(server, index) in newNetwork.servers"
							:key="index"
							class="server-row"
						>
							<div class="server-fields">
								<!-- Basic Server Settings -->
								<div class="form-row server-address-row">
									<label :for="`server-address-${index}`">Server Address *</label>
									<div class="input-wrap">
										<input
											:id="`server-address-${index}`"
											v-model.trim="server.address"
											class="input"
											type="text"
											placeholder="irc.libera.chat"
											required
											maxlength="255"
										/>
										<span class="port-separator">:</span>
										<input
											:id="`server-port-${index}`"
											v-model.number="server.port"
											class="input port-input"
											type="number"
											min="1"
											max="65535"
											placeholder="6697"
											required
										/>
									</div>
								</div>

								<div class="form-row server-options-row">
									<label></label>
									<div class="input-wrap">
										<label class="checkbox-label">
											<input
												v-model="server.useTLS"
												type="checkbox"
											/>
											Use TLS
										</label>
										<label class="checkbox-label">
											<input
												v-model="server.tlsVerify"
												type="checkbox"
												:disabled="!server.useTLS"
											/>
											Verify TLS Certificate
										</label>
										<label class="checkbox-label">
											<input
												v-model="server.autoConnect"
												type="checkbox"
											/>
											Auto-connect
										</label>
									</div>
								</div>

								<!-- Server Password -->
								<div class="form-row">
									<label :for="`server-password-${index}`">Server Password</label>
									<input
										:id="`server-password-${index}`"
										v-model="server.password"
										class="input"
										type="password"
										placeholder="(optional)"
										maxlength="255"
									/>
								</div>

								<!-- TLS Client Certificates -->
								<details class="advanced-section">
									<summary>TLS Client Certificates (for SASL EXTERNAL)</summary>

									<div class="form-row">
										<label :for="`server-tls-cert-${index}`">Client Certificate Path</label>
										<input
											:id="`server-tls-cert-${index}`"
											v-model.trim="server.tlsCert"
											class="input"
											type="text"
											placeholder="/path/to/client.crt"
											maxlength="500"
										/>
									</div>

									<div class="form-row">
										<label :for="`server-tls-pkey-${index}`">Client Private Key Path</label>
										<input
											:id="`server-tls-pkey-${index}`"
											v-model.trim="server.tlsPkey"
											class="input"
											type="text"
											placeholder="/path/to/client.key"
											maxlength="500"
										/>
									</div>

									<div class="form-row">
										<label :for="`server-tls-pass-${index}`">Private Key Password</label>
										<input
											:id="`server-tls-pass-${index}`"
											v-model="server.tlsPass"
											class="input"
											type="password"
											placeholder="(if key is encrypted)"
											maxlength="255"
										/>
									</div>

									<div class="form-row">
										<label :for="`server-tls-cafile-${index}`">CA Certificate File</label>
										<input
											:id="`server-tls-cafile-${index}`"
											v-model.trim="server.tlsCafile"
											class="input"
											type="text"
											placeholder="/etc/ssl/certs/ca-certificates.crt"
											maxlength="500"
										/>
									</div>

									<div class="form-row">
										<label :for="`server-tls-capath-${index}`">CA Certificate Directory</label>
										<input
											:id="`server-tls-capath-${index}`"
											v-model.trim="server.tlsCapath"
											class="input"
											type="text"
											placeholder="/etc/ssl/certs"
											maxlength="500"
										/>
									</div>
								</details>

								<!-- Advanced Server Settings -->
								<details class="advanced-section">
									<summary>Advanced Server Settings</summary>

									<div class="form-row">
										<label :for="`server-ownhost-${index}`">Bind to Address</label>
										<input
											:id="`server-ownhost-${index}`"
											v-model.trim="server.ownHost"
											class="input"
											type="text"
											placeholder="192.168.1.100"
											maxlength="255"
										/>
									</div>

									<div class="form-row">
										<label :for="`server-family-${index}`">IP Protocol</label>
										<select
											:id="`server-family-${index}`"
											v-model.number="server.family"
											class="input"
										>
											<option :value="0">Auto (IPv4/IPv6)</option>
											<option :value="2">IPv4 only</option>
											<option :value="10">IPv6 only</option>
										</select>
									</div>

									<div class="form-row">
										<label></label>
										<div class="input-wrap">
											<label class="checkbox-label">
												<input
													v-model="server.noCap"
													type="checkbox"
												/>
												Disable CAP negotiation
											</label>
											<label class="checkbox-label">
												<input
													v-model="server.noProxy"
													type="checkbox"
												/>
												Don't use proxy
											</label>
										</div>
									</div>
								</details>
							</div>
							<button
								v-if="newNetwork.servers.length > 1"
								type="button"
								class="btn btn-small btn-remove-server"
								@click="removeServer(index)"
								title="Remove this server"
							>
								×
							</button>
						</div>

						<button
							type="button"
							class="btn btn-small btn-add-server"
							@click="addServer"
						>
							+ Add Server
						</button>
					</fieldset>

					<div class="form-actions">
						<button
							type="submit"
							class="btn"
							:disabled="actionInProgress"
						>
							Add Network
						</button>
						<button
							type="button"
							class="btn btn-secondary"
							@click="resetForm"
							:disabled="actionInProgress"
						>
							Clear
						</button>
					</div>
				</form>
			</section>
		</div>
	</div>
</template>

<style scoped>
#network-manager .container {
	padding: 20px;
	max-width: 900px;
	margin: 0 auto;
}

#network-manager .title {
	margin-bottom: 10px;
}

.info-text {
	padding: 15px;
	background: var(--highlight-bg-color);
	border-left: 4px solid var(--link-color);
	margin-bottom: 30px;
	border-radius: 3px;
}

section {
	margin-bottom: 40px;
}

section h2 {
	margin-bottom: 15px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--body-bg-color);
}

.network-form {
	background: var(--window-bg-color);
	padding: 20px;
	border-radius: 5px;
}

fieldset {
	border: 1px solid var(--body-bg-color);
	border-radius: 5px;
	padding: 20px;
	margin-bottom: 20px;
}

fieldset legend {
	font-weight: bold;
	padding: 0 10px;
	font-size: 1.1em;
}

.optional, .required {
	font-weight: normal;
	font-size: 0.9em;
	color: var(--body-color-muted);
}

.required {
	color: #d9534f;
}

.form-row {
	display: flex;
	margin-bottom: 15px;
	align-items: flex-start;
}

.form-row label {
	flex: 0 0 180px;
	padding-top: 8px;
	font-weight: bold;
}

.form-row .input,
.form-row .input-wrap,
.form-row select,
.form-row textarea {
	flex: 1;
}

.form-row textarea {
	resize: vertical;
	min-height: 60px;
}

.help-inline {
	display: block;
	font-size: 0.85em;
	color: var(--body-color-muted);
	margin-top: 5px;
	margin-left: 180px;
}

.input-wrap {
	display: flex;
	align-items: center;
	gap: 5px;
	flex-wrap: wrap;
}

.port-separator {
	padding: 0 5px;
}

.port-input {
	width: 80px;
}

.checkbox-label {
	display: inline-block;
	margin-right: 15px;
	font-weight: normal;
	white-space: nowrap;
}

.checkbox-label input {
	margin-right: 5px;
}

.server-row {
	display: flex;
	align-items: flex-start;
	margin-bottom: 15px;
	padding: 15px;
	background: var(--body-bg-color);
	border-radius: 5px;
}

.server-fields {
	flex: 1;
}

.server-address-row {
	margin-bottom: 10px;
}

.server-options-row {
	margin-bottom: 10px;
}

.btn-remove-server {
	margin-left: 10px;
	padding: 4px 10px;
	font-size: 1.2em;
	background: #d9534f;
	color: white;
	border: none;
	border-radius: 3px;
	cursor: pointer;
}

.btn-remove-server:hover {
	background: #c9302c;
}

.btn-add-server {
	margin-bottom: 20px;
}

.advanced-section {
	margin: 15px 0;
	padding: 10px;
	background: var(--window-bg-color);
	border: 1px solid var(--body-bg-color);
	border-radius: 3px;
}

.advanced-section summary {
	cursor: pointer;
	font-weight: bold;
	padding: 5px;
	user-select: none;
}

.advanced-section summary:hover {
	color: var(--link-color);
}

.advanced-section[open] {
	padding-bottom: 15px;
}

.advanced-section .form-row {
	margin-top: 10px;
}

.form-actions {
	display: flex;
	gap: 10px;
	margin-top: 20px;
	padding-top: 20px;
	border-top: 1px solid var(--body-bg-color);
}

.btn-secondary {
	background: var(--body-bg-color);
	color: var(--body-color);
}

.btn-secondary:hover:not(:disabled) {
	background: var(--highlight-bg-color);
}
</style>

<script lang="ts">
import {defineComponent, ref, onMounted} from "vue";
import socket from "../../js/socket";
import SidebarToggle from "../SidebarToggle.vue";

interface IrssiServer {
	address: string;
	port: number;
	chatnet?: string;
	password?: string;
	autoConnect: boolean;
	useTLS: boolean;
	tlsVerify: boolean;
	tlsCert?: string;
	tlsPkey?: string;
	tlsPass?: string;
	tlsCafile?: string;
	tlsCapath?: string;
	tlsCiphers?: string;
	tlsPinnedCert?: string;
	tlsPinnedPubkey?: string;
	ownHost?: string;
	family: number; // 0=auto, 2=IPv4, 10=IPv6
	maxCmdsAtOnce?: number;
	cmdQueueSpeed?: number;
	maxQueryChans?: number;
	starttls?: number;
	noCap: boolean;
	noProxy: boolean;
}

interface IrssiNetwork {
	name: string;
	chatType?: string;
	nick?: string;
	alternateNick?: string;
	username?: string;
	realname?: string;
	ownHost?: string;
	autosendcmd?: string;
	usermode?: string;
	saslMechanism?: string;
	saslUsername?: string;
	saslPassword?: string;
	maxKicks?: number;
	maxMsgs?: number;
	maxModes?: number;
	maxWhois?: number;
	maxCmdsAtOnce?: number;
	cmdQueueSpeed?: number;
	maxQueryChans?: number;
	servers: IrssiServer[];
}

export default defineComponent({
	name: "NetworkManager",
	components: {
		SidebarToggle,
	},
	setup() {
		const actionInProgress = ref(false);

		const newNetwork = ref<IrssiNetwork>({
			name: "",
			nick: "",
			alternateNick: "",
			username: "",
			realname: "",
			ownHost: "",
			autosendcmd: "",
			usermode: "",
			saslMechanism: "",
			saslUsername: "",
			saslPassword: "",
			servers: [
				{
					address: "",
					port: 6697,
					autoConnect: false,
					useTLS: true,
					tlsVerify: true,
					family: 0,
					noCap: false,
					noProxy: false,
				},
			],
		});

		const addNewNetwork = () => {
			if (!newNetwork.value.name || newNetwork.value.servers.length === 0) {
				alert("Network name and at least one server are required");
				return;
			}

			// TODO: Implement when backend is ready
			alert("Network management is not yet implemented in the backend. This feature will be available soon.");

			// Future implementation:
			// const networkData: IrssiNetwork = {
			//   ...newNetwork.value,
			//   servers: newNetwork.value.servers.map((s) => ({
			//     ...s,
			//     chatnet: newNetwork.value.name,
			//   })),
			// };
			// socket.emit("network:add", {network: networkData}, (response: any) => {
			//   if (response.success) {
			//     resetForm();
			//   } else {
			//     alert(`Failed to add network: ${response.error}`);
			//   }
			// });
		};

		const addServer = () => {
			newNetwork.value.servers.push({
				address: "",
				port: 6697,
				autoConnect: false,
				useTLS: true,
				tlsVerify: true,
				family: 0,
				noCap: false,
				noProxy: false,
			});
		};

		const removeServer = (index: number) => {
			newNetwork.value.servers.splice(index, 1);
		};

		const resetForm = () => {
			newNetwork.value = {
				name: "",
				nick: "",
				alternateNick: "",
				username: "",
				realname: "",
				ownHost: "",
				autosendcmd: "",
				usermode: "",
				saslMechanism: "",
				saslUsername: "",
				saslPassword: "",
				servers: [
					{
						address: "",
						port: 6697,
						autoConnect: false,
						useTLS: true,
						tlsVerify: true,
						family: 0,
						noCap: false,
						noProxy: false,
					},
				],
			};
		};

		onMounted(() => {
			// Network management will be implemented in Phase 7
		});

		return {
			actionInProgress,
			newNetwork,
			addNewNetwork,
			addServer,
			removeServer,
			resetForm,
		};
	},
});
</script>
