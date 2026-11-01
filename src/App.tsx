// Update: 18:25 - Limpeza e ajuste de design
import { useState, useEffect } from "react";
import { cn } from "./lib/utils";
import { Sidebar, type ViewType } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { Views } from "./components/Views";
import { LoginView } from "./components/LoginView";
import { supabase } from "./lib/supabase";
import { clearLocalDataIfNotAdmin } from "./lib/clearLocalData";
import { getFcmToken, onFcmMessage } from "./lib/firebase";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from 'sonner';
import { Menu } from './components/MenuIcon';

// (Removed global error handler - hooks must be inside component)


function App() {
  console.log('App rendered');
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem('velora_fake_session');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      // Ensure the parsed object has a user property
      return (parsed && parsed.user) ? parsed : null;
    } catch {
      localStorage.removeItem('velora_fake_session');
      return null;
    }
  });

  // Skip loading screen if we already restored a session from localStorage
  const [sessionChecked, setSessionChecked] = useState(() => {
    return !!localStorage.getItem('velora_fake_session');
  });

  const [activeView, setActiveView] = useState<ViewType>(() => {
    // Usa localStorage para persistir a aba activa mesmo após F5/refresh.
    // O timeout de 30min de inatividade só se aplica quando o utilizador fecha o browser.
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
    const saved = localStorage.getItem('velora_active_view');
    const lastActive = localStorage.getItem('velora_last_active');

    if (saved && lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      // Apenas reseta se passou mais de 30 minutos desde a última actividade
      if (elapsed < INACTIVITY_TIMEOUT_MS) {
        const validViews = ["ThankYou", "Dashboard", "Vendas", "Produtos", "Afiliados", "Mercado", "Pagamentos", "Levantamentos", "Premiações", "Integrações", "Configurações", "Documentação", "Análise"];
        if (validViews.includes(saved)) return saved as ViewType;
      }
    }
    return "Dashboard";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isThankYou = params.get('thankyou') === 'true' || window.location.pathname === '/obrigado';
    if (isThankYou) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveView('ThankYou' as ViewType);
      localStorage.setItem('velora_active_view', 'ThankYou');
    }
  }, []);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Lê do localStorage — a classe 'dark' já foi aplicada ao HTML pelo script no index.html
    try {
      return localStorage.getItem('velora_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Persiste a aba activa e o timestamp no localStorage → sobrevive a F5/refresh
    localStorage.setItem('velora_active_view', activeView);
    localStorage.setItem('velora_last_active', Date.now().toString());
  }, [activeView]);

  // Atualiza o timestamp de atividade ao focar a janela (para detetar inatividade longa)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
        const lastActive = localStorage.getItem('velora_last_active');
        if (lastActive) {
          const elapsed = Date.now() - parseInt(lastActive, 10);
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            // Mais de 30 minutos inativo → volta ao Dashboard
            setActiveView('Dashboard');
            localStorage.setItem('velora_active_view', 'Dashboard');
          }
        }
        localStorage.setItem('velora_last_active', Date.now().toString());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Close sidebar on view change on mobile
    if (window.innerWidth < 1024) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarOpen(false);
    }
  }, [activeView]);

  // Check current session
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (currentSession) {
          setSession(currentSession);
        } else {
          const fake = localStorage.getItem('velora_fake_session');
          if (!fake) {
            setSession(null);
          }
        }
      })
      .catch((err: Error) => {
        console.error('Erro ao verificar sessão:', err);
        setSession(null);
      })
      .finally(() => {
        // Ensure the loading flag is cleared regardless of success or failure
        setSessionChecked(true);
      });

    // Listen for auth changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session) {
        setSession(session);
      }
    });

    // Listen for profile updates from ConfiguracoesView
    const handleProfileUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSession((prev: any) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          user: {
            ...prev.user,
            user_metadata: {
              ...prev.user?.user_metadata,
              ...detail,
            }
          }
        };
        // Update fake session in localStorage if present
        const fake = localStorage.getItem('velora_fake_session');
        if (fake) {
          localStorage.setItem('velora_fake_session', JSON.stringify(updated));
        }
        return updated;
      });
    };
    const handleViewChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveView(detail as ViewType);
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);
    window.addEventListener('change-view', handleViewChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
      window.removeEventListener('change-view', handleViewChange);
    };
  }, []);

  // Auto-login using stored fake session if present and no real session
  useEffect(() => {
    if (sessionChecked && !session) {
      const fake = localStorage.getItem('velora_fake_session');
      if (fake) {
        try {
          const parsed = JSON.parse(fake);
          // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any
          setSession(parsed as any);
        // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  }, [sessionChecked, session]);

  // Clear local data for non-admin accounts on app start
  useEffect(() => {
    if (session) {
      clearLocalDataIfNotAdmin();
    }
  }, [session]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    // Persiste no localStorage para sobreviver ao refresh
    // eslint-disable-next-line no-empty
    try { localStorage.setItem('velora_dark_mode', String(next)); } catch {}
  };


  useEffect(() => {
    const setupPush = async (userEmail?: string) => {
      // Tenta obter o email da sessão activa se não for passado
      let email = userEmail;
      if (!email) {
        try {
          const sb = supabase;
          const { data: sess } = await sb.auth.getSession();
          email = sess?.session?.user?.email;
        // eslint-disable-next-line no-empty
        } catch {}
      }
      if (!email) return;

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          const token = await getFcmToken(registration);
          if (token) {
            const sb = supabase;
            await sb
              .from('push_subscriptions')
              .upsert({ user_email: email, token }, { onConflict: 'user_email' });
            console.log('✅ FCM token renovado no Supabase para:', email);
          }
        } catch (e) {
          console.error('Erro ao configurar push notifications:', e);
        }
      }
    };

    // Corre ao login
    if (session) setupPush(session.user?.email);

    // Corre sempre que o utilizador volta à aba (ecrã desbloqueado, app voltou ao 1º plano)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setupPush(session?.user?.email);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session]);

  // Foreground push notification listener
  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = onFcmMessage((payload: any) => {
      const title = payload?.notification?.title || 'VELORA — Nova Venda! 🎉';
      const body = payload?.notification?.body || '';
      // Show browser notification even when app is in foreground
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/logo.png',
          image: '/logo.png',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [session]);

  // Meta Ads Pixel Injection
  useEffect(() => {
    const pixelId = localStorage.getItem('velora_facebook_pixel_id');
    if (!pixelId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.fbq) return;

    w.fbq = function (...args: unknown[]) {
      if (w.fbq.callMethod) {
        w.fbq.callMethod(...args);
      } else {
        w.fbq.queue.push(args);
      }
    };
    if (!w._fbq) w._fbq = w.fbq;
    w.fbq.push = w.fbq;
    w.fbq.loaded = true;
    w.fbq.version = '2.0';
    w.fbq.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);

    w.fbq('init', pixelId);
    w.fbq('track', 'PageView');
  }, []);

  // TikTok Pixel Injection
  useEffect(() => {
    const pixelId = localStorage.getItem('velora_tiktok_pixel_id');
    if (!pixelId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.ttq) return;

    w.ttq = w.ttq || [];
    w.ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    w.ttq.setAndDefer = function (t: any, e: string) {
      t[e] = function (...innerArgs: unknown[]) {
        t.push([e].concat(innerArgs));
      };
    };
    for (let i = 0; i < w.ttq.methods.length; i++) w.ttq.setAndDefer(w.ttq, w.ttq.methods[i]);
    w.ttq.instance = function (t: string) {
      const arr = w.ttq._i[t] || [];
      for (let n = 0; n < w.ttq.methods.length; n++) w.ttq.setAndDefer(arr, w.ttq.methods[n]);
      return arr;
    };
    w.ttq.load = function (e: string, n: unknown) {
      const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
      w.ttq._i = w.ttq._i || {};
      w.ttq._i[e] = [];
      w.ttq._i[e]._u = src;
      w.ttq._t = w.ttq._t || {};
      w.ttq._t[e] = +new Date();
      w.ttq._o = w.ttq._o || {};
      w.ttq._o[e] = n || {};
      const o = document.createElement("script");
      o.type = "text/javascript";
      o.async = true;
      o.src = src + "?sdkid=" + e + "&lib=ttq";
      const a = document.getElementsByTagName("script")[0];
      a.parentNode?.insertBefore(o, a);
    };

    w.ttq.load(pixelId);
    w.ttq.page();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('velora_fake_session');
    // Ao fazer logout, limpa a aba guardada → próximo login começa sempre no Dashboard
    localStorage.removeItem('velora_active_view');
    localStorage.removeItem('velora_last_active');
    setActiveView('Dashboard');
    setSession(null);
  };

  // Show login screen if not authenticated and session check completed
  if (!sessionChecked) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafbff] dark:bg-[#0c1220]">
        <span className="text-xl font-medium text-gray-700 dark:text-gray-200">Carregando...</span>
      </div>
    );
  }
  if (!session) {
    return <LoginView onLogin={(fallbackUser?: Record<string, unknown>) => {
      if (fallbackUser) {
        const fakeSession = { user: fallbackUser };
        localStorage.setItem('velora_fake_session', JSON.stringify(fakeSession));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSession(fakeSession as any);
        return;
      }

      supabase.auth.getSession().then(({ data: { session: newSession } }) => {
        if (newSession) {
          setSession(newSession);
        } else {
          // Final fallback
          const fakeSession = {
            user: {
              email: import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com',
              user_metadata: { full_name: 'Administrador' }
            }
          };
          localStorage.setItem('velora_fake_session', JSON.stringify(fakeSession));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setSession(fakeSession as any);
        }
      });
    }} />;
  }

  return (
    <div className="flex bg-[#fafbff] dark:bg-[#0c1220] min-h-screen font-sans transition-colors duration-500 overflow-x-hidden relative">
      {/* Premium Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-fuchsia-500/5 dark:bg-fuchsia-600/5 rounded-full blur-[100px] animate-float" />
        <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] bg-blue-500/5 dark:bg-blue-600/5 rounded-full blur-[130px] animate-pulse-slow" />
      </div>

      <Sidebar
        activeView={activeView}
        setView={setActiveView}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Global Mobile Menu Trigger - Scrolls with page */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden absolute top-4 left-4 z-[60] h-12 w-12 flex items-center justify-center rounded-2xl bg-white dark:bg-brand-900 border border-emerald-100 dark:border-white/5 text-slate-600 dark:text-brand-100 shadow-xl active:scale-95 transition-all"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 min-w-0 min-h-screen transition-all duration-300 relative z-10",
        "lg:ml-64",
        sidebarOpen ? "ml-64 opacity-50 blur-sm pointer-events-none lg:opacity-100 lg:blur-0 lg:pointer-events-auto" : "ml-0"
      )}>
        <div key={activeView} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Thank You page */}
          {activeView === "ThankYou" && (
            <Views.ThankYou />
          )}
          {/* Dashboard */}
          {activeView === "Dashboard" && (
            <Dashboard
              onLogout={handleLogout}
              setView={(v) => setActiveView(v as ViewType)}
              user={session.user}
              toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
          )}
          {activeView === "Vendas" && <Views.Vendas user={session.user} />}
          {activeView === "Produtos" && <Views.Produtos />}
          {activeView === "Afiliados" && <Views.Afiliados />}
          {activeView === "Mercado" && <Views.Mercado />}
          {activeView === "Pagamentos" && <Views.Pagamentos />}
          {activeView === "Levantamentos" && <Views.Levantamentos />}
          {activeView === "Premiações" && <Views.Premiações />}
          {activeView === "Integrações" && <Views.Ferramentas />}
          {activeView === "Análise" && <Views.Análise />}
          {activeView === "Configurações" && <Views.Configuracoes onLogout={handleLogout} />}
          {activeView === "Documentação" && <Views.Documentacao />}
        </div>
      </main>

      <Toaster richColors position="top-right" expand={false} />
    </div>
  );
}

export default App;
