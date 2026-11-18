import "server-only";

import type { AuthProvider, Identity, Role } from "./types";

const PEOPLE: Record<Role, Identity> = {
  user: { userId: "usr_demo_adam", name: "Adam Soffer", email: "adam@example.test", role: "user" },
  operator: { userId: "usr_demo_sam", name: "Sam Whitfield", email: "sam@example.test", role: "operator" },
};

/**
 * Development and mock-only sign-in. There is no outside provider to visit: whichever method is
 * picked, the flow comes straight back signed in as a test user (or the test operator).
 */
export const mockProvider: AuthProvider = {
  id: "mock",
  async authorizationUrl({ redirectUri, state, method }) {
    const url = new URL(redirectUri);
    url.searchParams.set("code", method === "operator" ? "operator" : "user");
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchange({ code }) {
    const identity = code === "operator" ? PEOPLE.operator : PEOPLE.user;
    return { ...identity };
  },
};
