"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client. Defaults to the app's own origin → /api/auth. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
