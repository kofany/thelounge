<template>
	<span class="content">
		<Username :user="message.from" />
		sets mode <b>{{ message.text }}</b>
	</span>
</template>

<script lang="ts">
import {defineComponent, PropType} from "vue";
import {ClientNetwork, ClientMessage} from "../../js/types";
import Username from "../Username.vue";

export default defineComponent({
	name: "MessageChannelMode",
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
});
</script>
