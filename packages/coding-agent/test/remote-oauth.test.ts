import { describe, expect, it } from "vitest";
import { type RemoteOAuthRuntime, remoteOAuthForwardCommand } from "../src/utils/remote-oauth.ts";

const remoteLinux: RemoteOAuthRuntime = {
	platform: "linux",
	env: { SSH_CONNECTION: "192.0.2.10 50000 192.0.2.20 22" },
	hostname: "lim-builder",
	username: "leemoore",
};

function authUrl(redirectUri: string): string {
	const url = new URL("https://claude.ai/oauth/authorize");
	url.searchParams.set("client_id", "client");
	url.searchParams.set("redirect_uri", redirectUri);
	return url.toString();
}

describe("remoteOAuthForwardCommand", () => {
	it("builds an exact SSH forward for a headless remote loopback callback", () => {
		expect(remoteOAuthForwardCommand(authUrl("http://localhost:53692/callback"), remoteLinux)).toBe(
			"ssh -N -L 53692:127.0.0.1:53692 leemoore@lim-builder",
		);
	});

	it("supports SSH_CLIENT and a missing username", () => {
		expect(
			remoteOAuthForwardCommand(authUrl("http://127.0.0.1:9876/callback"), {
				...remoteLinux,
				env: { SSH_CLIENT: "192.0.2.10 50000 22" },
				username: undefined,
			}),
		).toBe("ssh -N -L 9876:127.0.0.1:9876 lim-builder");
	});

	it.each([
		["local Linux session", { ...remoteLinux, env: {} }],
		["remote session with X display", { ...remoteLinux, env: { ...remoteLinux.env, DISPLAY: ":0" } }],
		["remote session with Wayland", { ...remoteLinux, env: { ...remoteLinux.env, WAYLAND_DISPLAY: "wayland-0" } }],
		["macOS", { ...remoteLinux, platform: "darwin" as const }],
	])("does not offer a tunnel for %s", (_label, runtime) => {
		expect(remoteOAuthForwardCommand(authUrl("http://localhost:53692/callback"), runtime)).toBeUndefined();
	});

	it.each([
		["missing redirect", "https://example.com/authorize"],
		["non-loopback redirect", authUrl("https://example.com/callback")],
		["HTTPS loopback redirect", authUrl("https://localhost:53692/callback")],
		["loopback redirect without port", authUrl("http://localhost/callback")],
		["malformed authorization URL", "not a URL"],
	])("does not offer an unsafe or unusable tunnel for %s", (_label, url) => {
		expect(remoteOAuthForwardCommand(url, remoteLinux)).toBeUndefined();
	});
});
