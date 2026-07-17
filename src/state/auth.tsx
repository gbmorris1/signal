import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, hasSupabase } from '@/lib/supabase';
import { setAnalyticsUser } from '@/lib/analytics';
import type { Category, ExperienceLevel, UserPreferences, UserProfile } from '@/types';

const PROFILE_KEY = 'signal.profile.v1';

interface AuthState {
  loading: boolean;
  profile: UserProfile | null; // null when signed out
  demo: boolean; // browsing without an account
  isAuthed: boolean;
  needsOnboarding: boolean;
  signUp(email: string, password: string): Promise<{ error?: string; needsConfirmation?: boolean }>;
  signIn(email: string, password: string): Promise<{ error?: string }>;
  signOut(): Promise<void>;
  enterDemo(): void;
  saveOnboarding(prefs: Pick<UserPreferences, 'interests' | 'experience'>): Promise<void>;
  setPushToken(token: string): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function blankProfile(id: string, email: string | null): UserProfile {
  return {
    id,
    email,
    displayName: email?.split('@')[0] ?? null,
    interests: [],
    experience: 'beginner',
    onboarded: false,
    plan: 'free',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [demo, setDemo] = useState(false);

  // Keep analytics events attributed to the signed-in user.
  useEffect(() => {
    setAnalyticsUser(profile?.id ?? null);
  }, [profile?.id]);

  // Restore session on boot + react to auth changes (e.g. session appearing
  // after the user confirms their email, or a token refresh).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // Mock mode: restore locally-persisted profile.
      (async () => {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) setProfile(JSON.parse(raw) as UserProfile);
        setLoading(false);
      })();
      return;
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await loadProfile(data.session.user.id, data.session.user.email ?? null);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadProfile(session.user.id, session.user.email ?? null);
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLocal = useCallback(async (p: UserProfile | null) => {
    if (p) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(PROFILE_KEY);
  }, []);

  const loadProfile = useCallback(async (id: string, email: string | null) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (data) {
      setProfile({
        id: data.id,
        email: data.email ?? email,
        displayName: data.display_name,
        interests: data.interests ?? [],
        experience: data.experience ?? 'beginner',
        onboarded: data.onboarded ?? false,
        plan: data.plan ?? 'free',
      });
    } else {
      // First login: create a profile row (upsert, so a retry never dup-keys).
      const fresh = blankProfile(id, email);
      const { error } = await supabase.from('users').upsert({ id, email, onboarded: false });
      if (error) console.warn('profile create failed:', error.message);
      setProfile(fresh);
    }
  }, []);

  const signUp = useCallback<AuthState['signUp']>(async (email, password) => {
    setDemo(false);
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // Existing-account gate: to prevent email enumeration, Supabase returns a
      // fake "success" for emails that already have a confirmed account. The
      // tell is an empty identities array on the returned user.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return { error: 'An account with this email already exists. Sign in instead.' };
      }
      // When email confirmation is required, Supabase returns a user but no
      // session. Don't create the profile row yet (RLS needs an authed session);
      // the onAuthStateChange listener picks it up once they confirm + sign in.
      if (data.session && data.user) {
        await loadProfile(data.user.id, data.user.email ?? email);
        return {};
      }
      return { needsConfirmation: true };
    }
    // Mock: create a local account.
    const p = blankProfile(`mock-${Date.now()}`, email);
    setProfile(p);
    await persistLocal(p);
    return {};
  }, [loadProfile, persistLocal]);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    setDemo(false);
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user) await loadProfile(data.user.id, data.user.email ?? email);
      return {};
    }
    // Mock: reuse persisted profile or create one.
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    const p = raw ? (JSON.parse(raw) as UserProfile) : blankProfile(`mock-${Date.now()}`, email);
    p.email = email;
    setProfile(p);
    await persistLocal(p);
    return {};
  }, [loadProfile, persistLocal]);

  const signOut = useCallback<AuthState['signOut']>(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setDemo(false);
    await persistLocal(null);
  }, [persistLocal]);

  const enterDemo = useCallback(() => setDemo(true), []);

  const saveOnboarding = useCallback<AuthState['saveOnboarding']>(
    async ({ interests, experience }: { interests: Category[]; experience: ExperienceLevel }) => {
      // Compute next profile synchronously so we can AWAIT the DB write.
      // (This used to be fire-and-forget inside the state updater; when the
      // write failed, onboarded stayed false in the DB and the interests
      // screen came back on every sign-in.)
      const base = profile ?? blankProfile(`mock-${Date.now()}`, null);
      const next: UserProfile = { ...base, interests, experience, onboarded: true };
      setProfile(next);
      await persistLocal(next);

      const supabase = getSupabase();
      if (supabase && !next.id.startsWith('mock-')) {
        // Upsert so this succeeds even if the profile row was never created.
        const { error } = await supabase.from('users').upsert({
          id: next.id,
          email: next.email,
          interests,
          experience,
          onboarded: true,
        });
        if (error) console.warn('onboarding save failed:', error.message);
      }
    },
    [persistLocal, profile],
  );

  const setPushToken = useCallback<AuthState['setPushToken']>(async (token) => {
    const supabase = getSupabase();
    if (supabase && profile) {
      await supabase.from('users').update({ expo_push_token: token }).eq('id', profile.id);
    }
  }, [profile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      profile,
      demo,
      isAuthed: !!profile,
      needsOnboarding: !!profile && !profile.onboarded,
      signUp,
      signIn,
      signOut,
      enterDemo,
      saveOnboarding,
      setPushToken,
    }),
    [loading, profile, demo, signUp, signIn, signOut, enterDemo, saveOnboarding, setPushToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { hasSupabase };
