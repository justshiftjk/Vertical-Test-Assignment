import { createCookieSessionStorage } from "react-router";

type SessionData = {
    user?: any;  // Add other session data as needed
    access_token?: string;
    refresh_token?: string;
};

type SessionFlashData = {
    error?: string;  // Add other flash data as needed
    info?: string;
};



const { getSession, commitSession, destroySession } = createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
        name: "__session",
        httpOnly: true,
        maxAge: 60 * 60, // 1 hour
        path: "/",
        sameSite: "lax",
        secrets: [process.env.SESSION_SECRET || "ec7fc6e43a2d9f979fd2cb1cd7d473"],
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
    }
});

export { getSession, commitSession, destroySession };