<template>
	<span class="content">
		<template v-if="store.state.settings.nexusStyleMessages">
			<Username :user="message.target" />
			dropped by
			<Username :user="message.from" />
		</template>
		<template v-else>
			<Username :user="message.from" />
			has kicked
			<Username :user="message.target" />
		</template>
		<i v-if="message.text" class="part-reason"
			>&#32;(<ParsedMessage :network="network" :message="message" />)</i
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
	name: "MessageTypeKick",
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
