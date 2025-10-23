<template>
	<span class="content">
		<Username :user="message.from" />
		<i v-if="store.state.settings.nexusStyleMessages" class="hostmask">
			❮❮<ParsedMessage :network="network" :text="message.hostmask" />❯❯</i
		>
		<i v-else class="hostmask">
			(<ParsedMessage :network="network" :text="message.hostmask" />)</i
		>
		<template v-if="store.state.settings.nexusStyleMessages">
			has withdrawn from the channel
		</template>
		<template v-else> has left the channel </template>
		<i v-if="message.text" class="part-reason"
			>(<ParsedMessage :network="network" :message="message" />)</i
		>
	</span>
</template>

<script lang="ts">
import {defineComponent, PropType} from "vue";
import {ClientNetwork, ClientMessage} from "../../js/types";
import ParsedMessage from "../ParsedMessage.vue";
import Username from "../Username.vue";
import {useStore} from "../../js/store";

export default defineComponent({
	name: "MessageTypePart",
	components: {
		ParsedMessage,
		Username,
	},
	props: {
		network: {
			type: Object as PropType<ClientNetwork>,
			required: true,
		},
		message: {
			type: Object as PropType<ClientMessage>,
			required: true,
		},
	},
	setup() {
		const store = useStore();
		return {
			store,
		};
	},
});
</script>
