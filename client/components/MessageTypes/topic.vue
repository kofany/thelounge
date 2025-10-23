<template>
	<span class="content">
		<template v-if="message.from && message.from.nick">
			<template v-if="store.state.settings.nexusStyleMessages">
				Topic modified by <Username :user="message.from" />:
			</template>
			<template v-else>
				<Username :user="message.from" /> has changed the topic to:
			</template>
		</template>
		<template v-else>
			<template v-if="store.state.settings.nexusStyleMessages">Topic: </template>
			<template v-else>The topic is: </template>
		</template>
		<span v-if="message.text" class="new-topic"
			><ParsedMessage :network="network" :message="message"
		/></span>
	</span>
</template>

<script lang="ts">
import {defineComponent, PropType} from "vue";
import type {ClientMessage, ClientNetwork} from "../../js/types";
import ParsedMessage from "../ParsedMessage.vue";
import Username from "../Username.vue";
import {useStore} from "../../js/store";

export default defineComponent({
	name: "MessageTypeTopic",
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
