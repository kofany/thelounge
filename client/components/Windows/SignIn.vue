<template>
	<div id="sign-in" class="window" role="tabpanel" aria-label="Sign-in">
		<form class="container" method="post" action="" @submit="onSubmit">
			<pre class="ascii-logo">
     b.             8 8 8888888888   `8.`8888.      ,8' 8 8888      88    d888888o.
     888o.          8 8 8888          `8.`8888.    ,8'  8 8888      88  .`8888:' `88.
     Y88888o.       8 8 8888           `8.`8888.  ,8'   8 8888      88  8.`8888.   Y8
     .`Y888888o.    8 8 8888            `8.`8888.,8'    8 8888      88  `8.`8888.
     8o. `Y888888o. 8 8 888888888888     `8.`88888'     8 8888      88   `8.`8888.
     8`Y8o. `Y88888o8 8 8888             .88.`8888.     8 8888      88    `8.`8888.
     8   `Y8o. `Y8888 8 8888            .8'`8.`8888.    8 8888      88     `8.`8888.
     8      `Y8o. `Y8 8 8888           .8'  `8.`8888.   ` 8888     ,8P 8b   `8.`8888.
     8         `Y8o.` 8 8888          .8'    `8.`8888.    8888   ,d8P  `8b.  ;8.`8888
     8            `Yo 8 888888888888 .8'      `8.`8888.    `Y88888P'    `Y8888P ,88P'

8 8888         ,o888888o.     8 8888      88 b.             8     ,o888888o.    8 8888888888
8 8888      . 8888     `88.   8 8888      88 888o.          8    8888     `88.  8 8888
8 8888     ,8 8888       `8b  8 8888      88 Y88888o.       8 ,8 8888       `8. 8 8888
8 8888     88 8888        `8b 8 8888      88 .`Y888888o.    8 88 8888           8 8888
8 8888     88 8888         88 8 8888      88 8o. `Y888888o. 8 88 8888           8 888888888888
8 8888     88 8888         88 8 8888      88 8`Y8o. `Y88888o8 88 8888           8 8888
8 8888     88 8888        ,8P 8 8888      88 8   `Y8o. `Y8888 88 8888   8888888 8 8888
8 8888     `8 8888       ,8P  ` 8888     ,8P 8      `Y8o. `Y8 `8 8888       .8' 8 8888
8 8888      ` 8888     ,88'     8888   ,d8P  8         `Y8o.`    8888     ,88'  8 8888
8 888888888888 `8888888P'        `Y88888P'   8            `Yo     `8888888P'    8 888888888888</pre
			>

			<label for="signin-username">Username</label>
			<input
				id="signin-username"
				v-model.trim="username"
				class="input"
				type="text"
				name="username"
				autocapitalize="none"
				autocorrect="off"
				autocomplete="username"
				required
				autofocus
			/>

			<div class="password-container">
				<label for="signin-password">Password</label>
				<RevealPassword v-slot:default="slotProps">
					<input
						id="signin-password"
						v-model="password"
						:type="slotProps.isVisible ? 'text' : 'password'"
						class="input"
						autocapitalize="none"
						autocorrect="off"
						autocomplete="current-password"
						required
					/>
				</RevealPassword>
			</div>

			<div v-if="errorShown" class="error">Authentication failed.</div>

			<button :disabled="inFlight" type="submit" class="btn">Sign in</button>
		</form>
	</div>
</template>

<script lang="ts">
import storage from "../../js/localStorage";
import socket from "../../js/socket";
import RevealPassword from "../RevealPassword.vue";
import {defineComponent, onBeforeUnmount, onMounted, ref} from "vue";

export default defineComponent({
	name: "SignIn",
	components: {
		RevealPassword,
	},
	setup() {
		const inFlight = ref(false);
		const errorShown = ref(false);

		const username = ref(storage.get("user") || "");
		const password = ref("");

		const onAuthFailed = () => {
			inFlight.value = false;
			errorShown.value = true;
		};

		const onSubmit = (event: Event) => {
			event.preventDefault();

			if (!username.value || !password.value) {
				return;
			}

			inFlight.value = true;
			errorShown.value = false;

			const values = {
				user: username.value,
				password: password.value,
			};

			storage.set("user", values.user);

			socket.emit("auth:perform", values);
		};

		onMounted(() => {
			socket.on("auth:failed", onAuthFailed);
		});

		onBeforeUnmount(() => {
			socket.off("auth:failed", onAuthFailed);
		});

		return {
			inFlight,
			errorShown,
			username,
			password,
			onSubmit,
		};
	},
});
</script>
