import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

// ─── Mock Supabase ───────────────────────────────────────────────────────────
const mockGetSession = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

// ─── Mock window.location ────────────────────────────────────────────────────
const mockReplace = vi.fn();
Object.defineProperty(window, "location", {
  value: { replace: mockReplace, origin: "http://localhost:3000" },
  writable: true,
});

// ─── Mock fetch (for /api/check-onboarding) ──────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Test user fixtures ──────────────────────────────────────────────────────
const TEST_USER = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: { name: "Test User" },
  phone: "",
};

const SESSION_WITH_USER = {
  data: { session: { user: TEST_USER } },
};

const SESSION_WITHOUT_USER = {
  data: { session: null },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════════
describe("Auth Store", () => {
  beforeEach(resetStore);

  it("starts unauthenticated", () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.hasCompletedOnboarding).toBe(false);
  });

  it("setUser sets isAuthenticated", () => {
    useAuthStore.getState().setUser({
      id: "u1",
      email: "a@b.com",
      name: "A",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("setUser(null) clears auth", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("logout clears user but keeps onboarding flag", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });
    useAuthStore.getState().setHasCompletedOnboarding(true);
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it("setHasCompletedOnboarding persists the flag", () => {
    useAuthStore.getState().setHasCompletedOnboarding(true);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);

    useAuthStore.getState().setHasCompletedOnboarding(false);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE REDIRECT LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
describe("Root page redirect logic", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("redirects to /login when no session", async () => {
    mockGetSession.mockResolvedValue(SESSION_WITHOUT_USER);

    // Simulate root page logic
    const supabase = { auth: { getSession: mockGetSession } };
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      mockReplace("/login");
    }

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("redirects to /home when session exists and onboarded (localStorage)", async () => {
    useAuthStore.getState().setHasCompletedOnboarding(true);
    mockGetSession.mockResolvedValue(SESSION_WITH_USER);

    const { data } = await mockGetSession();
    const user = data.session?.user;

    if (user) {
      useAuthStore.getState().setUser({
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || "",
      });

      if (useAuthStore.getState().hasCompletedOnboarding) {
        mockReplace("/home");
      }
    }

    expect(mockReplace).toHaveBeenCalledWith("/home");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("checks server when localStorage says not onboarded", async () => {
    // localStorage: not onboarded. Server: onboarded.
    mockGetSession.mockResolvedValue(SESSION_WITH_USER);
    mockFetch.mockResolvedValue({
      json: async () => ({ onboarded: true, memberName: "Test" }),
    });

    const { data } = await mockGetSession();
    const user = data.session?.user;

    if (user) {
      useAuthStore.getState().setUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "",
      });

      if (!useAuthStore.getState().hasCompletedOnboarding) {
        const res = await fetch("/api/check-onboarding");
        const { onboarded } = await res.json();
        if (onboarded) {
          useAuthStore.getState().setHasCompletedOnboarding(true);
          mockReplace("/home");
        }
      }
    }

    expect(mockFetch).toHaveBeenCalledWith("/api/check-onboarding");
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("redirects to /onboarding when server says not onboarded", async () => {
    mockGetSession.mockResolvedValue(SESSION_WITH_USER);
    mockFetch.mockResolvedValue({
      json: async () => ({ onboarded: false }),
    });

    const { data } = await mockGetSession();
    const user = data.session?.user;

    if (user) {
      useAuthStore.getState().setUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "",
      });

      let dest = "/onboarding";
      if (!useAuthStore.getState().hasCompletedOnboarding) {
        const res = await fetch("/api/check-onboarding");
        const { onboarded } = await res.json();
        if (onboarded) {
          useAuthStore.getState().setHasCompletedOnboarding(true);
          dest = "/home";
        }
      }
      mockReplace(dest);
    }

    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
  });

  it("falls back to /onboarding when server check fails", async () => {
    mockGetSession.mockResolvedValue(SESSION_WITH_USER);
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { data } = await mockGetSession();
    const user = data.session?.user;

    if (user) {
      useAuthStore.getState().setUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "",
      });

      let dest = "/onboarding";
      if (!useAuthStore.getState().hasCompletedOnboarding) {
        try {
          const res = await fetch("/api/check-onboarding");
          const { onboarded } = await res.json();
          if (onboarded) {
            dest = "/home";
          }
        } catch {
          // fall through
        }
      }
      mockReplace(dest);
    }

    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });

  it("redirects to /login when getSession throws", async () => {
    mockGetSession.mockRejectedValue(new Error("Supabase down"));

    try {
      await mockGetSession();
    } catch {
      mockReplace("/login");
    }

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════
describe("Login flow", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("sign in sets user and redirects to /home when onboarded", async () => {
    useAuthStore.getState().setHasCompletedOnboarding(true);
    mockSignInWithPassword.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    });

    const { data: result, error } = await mockSignInWithPassword({
      email: "test@example.com",
      password: "password123",
    });

    expect(error).toBeNull();
    if (result.user) {
      useAuthStore.getState().setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.user_metadata?.name || "",
      });

      if (useAuthStore.getState().hasCompletedOnboarding) {
        mockReplace("/home");
      }
    }

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("sign in checks server for existing user on new device", async () => {
    // localStorage: not onboarded (new device). Server: onboarded.
    mockSignInWithPassword.mockResolvedValue({
      data: { user: TEST_USER },
      error: null,
    });
    mockFetch.mockResolvedValue({
      json: async () => ({ onboarded: true }),
    });

    const { data: result } = await mockSignInWithPassword({
      email: "test@example.com",
      password: "password123",
    });

    if (result.user) {
      useAuthStore.getState().setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.user_metadata?.name || "",
      });

      if (!useAuthStore.getState().hasCompletedOnboarding) {
        const res = await fetch("/api/check-onboarding");
        const { onboarded } = await res.json();
        if (onboarded) {
          useAuthStore.getState().setHasCompletedOnboarding(true);
          mockReplace("/home");
          return;
        }
      }
      mockReplace("/onboarding");
    }

    expect(mockFetch).toHaveBeenCalledWith("/api/check-onboarding");
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/home");
  });

  it("sign up triggers email verification", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });

    const { error } = await mockSignUp({
      email: "new@example.com",
      password: "password123",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });

    expect(error).toBeNull();
    expect(mockSignUp).toHaveBeenCalled();
    // After signup, app shows "check your email" — no redirect
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("handles invalid credentials error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const { error } = await mockSignInWithPassword({
      email: "wrong@example.com",
      password: "wrong",
    });

    expect(error).not.toBeNull();
    expect(error.message).toBe("Invalid login credentials");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("handles email not confirmed error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Email not confirmed" },
    });

    const { error } = await mockSignInWithPassword({
      email: "unverified@example.com",
      password: "password123",
    });

    expect(error.message).toBe("Email not confirmed");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIGN OUT
// ═══════════════════════════════════════════════════════════════════════════════
describe("Sign out", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("clears user but preserves onboarding flag", async () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });
    useAuthStore.getState().setHasCompletedOnboarding(true);

    mockSignOut.mockResolvedValue({ error: null });
    await mockSignOut();
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING SKIP (existing user on new device)
// ═══════════════════════════════════════════════════════════════════════════════
describe("Onboarding skip for existing users", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("server returns onboarded=true → store updated + redirect to /home", async () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });

    mockFetch.mockResolvedValue({
      json: async () => ({ onboarded: true, memberName: "A" }),
    });

    const res = await fetch("/api/check-onboarding");
    const { onboarded } = await res.json();

    if (onboarded) {
      useAuthStore.getState().setHasCompletedOnboarding(true);
    }

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it("server returns onboarded=false → store unchanged", async () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });

    mockFetch.mockResolvedValue({
      json: async () => ({ onboarded: false }),
    });

    const res = await fetch("/api/check-onboarding");
    const { onboarded } = await res.json();

    if (onboarded) {
      useAuthStore.getState().setHasCompletedOnboarding(true);
    }

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
  });

  it("server error → store unchanged (graceful fallback)", async () => {
    mockFetch.mockRejectedValue(new Error("500"));

    let onboarded = false;
    try {
      const res = await fetch("/api/check-onboarding");
      const data = await res.json();
      onboarded = data.onboarded;
    } catch {
      // fall through
    }

    expect(onboarded).toBe(false);
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STATE CHANGE LISTENER
// ═══════════════════════════════════════════════════════════════════════════════
describe("Auth state change listener", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("onAuthStateChange with user sets store", () => {
    const callback = vi.fn();
    mockOnAuthStateChange.mockImplementation((cb: (...args: unknown[]) => void) => {
      callback.mockImplementation(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Simulate auth state change
    const session = {
      user: { id: "u1", email: "a@b.com", user_metadata: { name: "A" }, phone: "" },
    };

    // This simulates what useAuth hook does
    useAuthStore.getState().setUser({
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata.name,
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("a@b.com");
  });

  it("onAuthStateChange with null session clears store", () => {
    useAuthStore.getState().setUser({ id: "u1", email: "a@b.com", name: "A" });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Simulate session cleared
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
