import { hostname as getHostname } from "node:os";

export interface RemoteOAuthRuntime {
	platform: NodeJS.Platform;
	env: NodeJS.ProcessEnv;
	hostname: string;
	username?: string;
}

function defaultRuntime(): RemoteOAuthRuntime {
	return {
		platform: process.platform,
		env: process.env,
		hostname: getHostname(),
		username: process.env.USER || process.env.LOGNAME,
	};
}

/**
 * Return a ready-to-run SSH command when OAuth is running in a remote,
 * headless Linux session and the provider redirects to a loopback callback.
 *
 * The command is guidance only: pi cannot create a port forward on the user's
 * local machine. Undefined means the normal local-browser flow applies, or the
 * authorization URL does not expose a supported loopback callback.
 */
export function remoteOAuthForwardCommand(
	authorizationUrl: string,
	runtime: RemoteOAuthRuntime = defaultRuntime(),
): string | undefined {
	if (runtime.platform !== "linux") return undefined;
	if (!runtime.env.SSH_CONNECTION && !runtime.env.SSH_CLIENT) return undefined;
	if (runtime.env.DISPLAY || runtime.env.WAYLAND_DISPLAY) return undefined;

	let redirect: URL;
	try {
		const authorization = new URL(authorizationUrl);
		const redirectUri = authorization.searchParams.get("redirect_uri");
		if (!redirectUri) return undefined;
		redirect = new URL(redirectUri);
	} catch {
		return undefined;
	}

	if (redirect.protocol !== "http:") return undefined;
	if (redirect.hostname !== "localhost" && redirect.hostname !== "127.0.0.1" && redirect.hostname !== "::1") {
		return undefined;
	}
	const port = redirect.port;
	if (!port || !/^\d+$/.test(port)) return undefined;

	const destination = runtime.username ? `${runtime.username}@${runtime.hostname}` : runtime.hostname;
	return `ssh -N -L ${port}:127.0.0.1:${port} ${destination}`;
}
