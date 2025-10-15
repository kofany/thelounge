<template>
	<div id="network-manager" class="window" role="tabpanel" aria-label="Network Manager">
		<div class="header">
			<SidebarToggle />
		</div>
		<div class="container">
			<h1 class="title">IRC Network Manager</h1>

			<!-- Saved Networks Section -->
			<section class="saved-networks">
				<h2>Saved Networks</h2>
				<div v-if="loading" class="loading">Loading networks...</div>
				<div v-else-if="networks.length === 0" class="empty-state">
					<p>No saved networks found in ~/.irssi/config</p>
					<p class="help-text">Add a new network below to get started</p>
				</div>
				<div v-else class="networks-list">
					<div
						v-for="network in networks"
						:key="network.name"
						class="network-item"
					>
						<div class="network-info">
							<h3 class="network-name">{{ network.name }}</h3>
							<div class="network-servers">
								<div
									v-for="(server, index) in network.servers"
									:key="index"
									class="server-info"
								>
									<span class="server-address">{{ server.address }}:{{ server.port }}</span>
									<span v-if="server.useTLS" class="server-tls" title="TLS enabled">🔒</span>
									<span v-if="server.autoConnect" class="server-auto" title="Auto-connect">⚡</span>
								</div>
							</div>
							<div v-if="network.nick" class="network-details">
								<span class="detail-label">Nick:</span> {{ network.nick }}
							</div>
						</div>
						<div class="network-actions">
							<button
								class="btn btn-small btn-connect"
								@click="connectToNetwork(network.name)"
								:disabled="actionInProgress"
							>
								Connect
							</button>
							<button
								class="btn btn-small btn-remove"
								@click="removeNetwork(network.name)"
								:disabled="actionInProgress"
							>
								Remove
							</button>
						</div>
					</div>
				</div>
			</section>

			<!-- Add New Network Section -->
			<section class="add-network">
				<h2>Add New Network</h2>
				<form @submit.prevent="addNewNetwork" class="network-form">
					<div class="form-row">
						<label for="network-name">Network Name</label>
						<input
							id="network-name"
							v-model.trim="newNetwork.name"
							class="input"
							type="text"
							placeholder="liberachat"
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
							placeholder="myname"
							maxlength="100"
						/>
					</div>

					<h3 class="servers-header">
						Servers
						<span class="help-text">(at least one required)</span>
					</h3>

					<div
						v-for="(server, index) in newNetwork.servers"
						:key="index"
						class="server-row"
					>
						<div class="server-fields">
							<div class="form-row server-address-row">
								<label :for="`server-address-${index}`">Server</label>
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
											v-model="server.autoConnect"
											type="checkbox"
										/>
										Auto-connect
									</label>
								</div>
							</div>
						</div>
						<button
							v-if="newNetwork.servers.length > 1"
							type="button"
							class="btn btn-small btn-remove-server"
							@click="removeServer(index)"
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
	margin-bottom: 30px;
}

section {
	margin-bottom: 40px;
}

section h2 {
	margin-bottom: 15px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--body-bg-color);
}

.loading,
.empty-state {
	padding: 20px;
	text-align: center;
	color: var(--body-color-muted);
}

.help-text {
	font-size: 0.9em;
	color: var(--body-color-muted);
}

.networks-list {
	display: flex;
	flex-direction: column;
	gap: 15px;
}

.network-item {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	padding: 15px;
	background: var(--window-bg-color);
	border: 1px solid var(--body-bg-color);
	border-radius: 5px;
}

.network-info {
	flex: 1;
}

.network-name {
	margin: 0 0 8px 0;
	font-size: 1.1em;
	font-weight: bold;
}

.network-servers {
	margin-bottom: 8px;
}

.server-info {
	display: inline-block;
	margin-right: 15px;
	padding: 4px 8px;
	background: var(--body-bg-color);
	border-radius: 3px;
	font-size: 0.9em;
	font-family: monospace;
}

.server-tls,
.server-auto {
	margin-left: 5px;
}

.network-details {
	font-size: 0.9em;
	color: var(--body-color-muted);
}

.detail-label {
	font-weight: bold;
}

.network-actions {
	display: flex;
	gap: 8px;
	margin-left: 15px;
}

.btn-small {
	padding: 6px 12px;
	font-size: 0.9em;
}

.btn-connect {
	background: var(--link-color);
	color: white;
}

.btn-connect:hover:not(:disabled) {
	background: var(--link-color-hover);
}

.btn-remove {
	background: #d9534f;
	color: white;
}

.btn-remove:hover:not(:disabled) {
	background: #c9302c;
}

.btn-secondary {
	background: var(--body-bg-color);
	color: var(--body-color);
}

.btn-secondary:hover:not(:disabled) {
	background: var(--highlight-bg-color);
}

.network-form {
	background: var(--window-bg-color);
	padding: 20px;
	border-radius: 5px;
}

.form-row {
	display: flex;
	margin-bottom: 15px;
}

.form-row label {
	flex: 0 0 150px;
	padding-top: 8px;
	font-weight: bold;
}

.form-row .input,
.form-row .input-wrap {
	flex: 1;
}

.input-wrap {
	display: flex;
	align-items: center;
	gap: 5px;
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
}

.checkbox-label input {
	margin-right: 5px;
}

.servers-header {
	margin: 20px 0 10px 0;
	font-size: 1em;
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
	margin-bottom: 0;
}

.btn-remove-server {
	margin-left: 10px;
	padding: 4px 10px;
	font-size: 1.2em;
	background: #d9534f;
	color: white;
}

.btn-add-server {
	margin-bottom: 20px;
}

.form-actions {
	display: flex;
	gap: 10px;
	margin-top: 20px;
	padding-top: 20px;
	border-top: 1px solid var(--body-bg-color);
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
	useTLS: boolean;
	tlsVerify?: boolean;
	autoConnect?: boolean;
	password?: string;
}

interface IrssiNetwork {
	name: string;
	type?: string;
	nick?: string;
	alternateNick?: string;
	username?: string;
	realname?: string;
	servers: IrssiServer[];
}

export default defineComponent({
	name: "NetworkManager",
	components: {
		SidebarToggle,
	},
	setup() {
		const networks = ref<IrssiNetwork[]>([]);
		const loading = ref(true);
		const actionInProgress = ref(false);

		const newNetwork = ref<IrssiNetwork>({
			name: "",
			nick: "",
			servers: [
				{
					address: "",
					port: 6697,
					useTLS: true,
					autoConnect: false,
				},
			],
		});

		const loadNetworks = () => {
			loading.value = true;
			socket.emit("network:list", (response: any) => {
				loading.value = false;
				if (response.success) {
					networks.value = response.networks;
				} else {
					console.error("Failed to load networks:", response.error);
				}
			});
		};

		const connectToNetwork = (networkName: string) => {
			actionInProgress.value = true;
			socket.emit("network:connect", {networkName}, (response: any) => {
				actionInProgress.value = false;
				if (response.success) {
					console.log(`Connected to ${networkName}`);
				} else {
					alert(`Failed to connect: ${response.error}`);
				}
			});
		};

		const removeNetwork = (networkName: string) => {
			if (!confirm(`Are you sure you want to remove network "${networkName}"?`)) {
				return;
			}

			actionInProgress.value = true;
			socket.emit("network:remove", {networkName}, (response: any) => {
				actionInProgress.value = false;
				if (response.success) {
					loadNetworks();
				} else {
					alert(`Failed to remove network: ${response.error}`);
				}
			});
		};

		const addNewNetwork = () => {
			if (!newNetwork.value.name || newNetwork.value.servers.length === 0) {
				alert("Network name and at least one server are required");
				return;
			}

			const networkData: IrssiNetwork = {
				name: newNetwork.value.name,
				nick: newNetwork.value.nick || undefined,
				servers: newNetwork.value.servers.map((s) => ({
					...s,
					chatnet: newNetwork.value.name,
				})),
			};

			actionInProgress.value = true;
			socket.emit("network:add", {network: networkData}, (response: any) => {
				actionInProgress.value = false;
				if (response.success) {
					resetForm();
					loadNetworks();
				} else {
					alert(`Failed to add network: ${response.error}`);
				}
			});
		};

		const addServer = () => {
			newNetwork.value.servers.push({
				address: "",
				port: 6697,
				useTLS: true,
				autoConnect: false,
			});
		};

		const removeServer = (index: number) => {
			newNetwork.value.servers.splice(index, 1);
		};

		const resetForm = () => {
			newNetwork.value = {
				name: "",
				nick: "",
				servers: [
					{
						address: "",
						port: 6697,
						useTLS: true,
						autoConnect: false,
					},
				],
			};
		};

		onMounted(() => {
			loadNetworks();
		});

		return {
			networks,
			loading,
			actionInProgress,
			newNetwork,
			loadNetworks,
			connectToNetwork,
			removeNetwork,
			addNewNetwork,
			addServer,
			removeServer,
			resetForm,
		};
	},
});
</script>
