<template>
	<span class="content">
		<Username :user="message.from" />
		<template v-if="store.state.settings.nexusStyleMessages"> has evolved into </template>
		<template v-else> is now known as </template>
		<Username :user="{nick: message.new_nick, mode: message.from.mode}" />
	</span>
</template>

<script lang="ts">
import {defineComponent, PropType} from "vue";
import {ClientNetwork, ClientMessage} from "../../js/types";
import Username from "../Username.vue";
import {useStore} from "../../js/store";

export default defineComponent({
	name: "MessageTypeNick",
	components: {
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
