
import React, { useEffect, useState } from 'react';
import { Router, Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';

// Auth pages
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import EmailVerification from '@/pages/auth/EmailVerification';
import PasswordReset from '@/pages/auth/PasswordReset';
import SetPassword from '@/pages/auth/SetPassword';

// Main pages
import Chat from '@/pages/Chat';
import NotFound from '@/pages/not-found';

// UI components
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  console.log('[PROTECTED ROUTE DEBUG]', {
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    emailVerified: user?.email_verified,
    loading,
    timestamp: new Date().toISOString()
  });

  if (loading) {
    console.log('[PROTECTED ROUTE DEBUG] Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !user.email_verified) {
    console.log('[PROTECTED ROUTE DEBUG] No authenticated user or unverified, redirecting to login');
    window.location.href = '/login';
    return null;
  }

  console.log('[PROTECTED ROUTE DEBUG] User authenticated and verified, rendering children');
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  console.log('[PUBLIC ROUTE DEBUG]', {
    hasUser: !!user,
    loading,
    emailVerified: user?.email_verified,
    userId: user?.id,
    timestamp: new Date().toISOString()
  });

  if (loading) {
    console.log('[PUBLIC ROUTE DEBUG] Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user && user.email_verified) {
    console.log('[PUBLIC ROUTE DEBUG] User is authenticated and verified, redirecting to chat');
    window.location.href = '/';
    return null;
  }

  console.log('[PUBLIC ROUTE DEBUG] No authenticated user or unverified, rendering children');
  return <>{children}</>;
}

function RootRoute() {
  const { user, loading } = useAuth();

  console.log('[ROOT ROUTE DEBUG]', {
    hasUser: !!user,
    loading,
    emailVerified: user?.email_verified,
    userId: user?.id,
    timestamp: new Date().toISOString()
  });

  if (loading) {
    console.log('[ROOT ROUTE DEBUG] Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !user.email_verified) {
    console.log('[ROOT ROUTE DEBUG] No authenticated user or unverified, redirecting to login');
    window.location.href = '/login';
    return null;
  }

  console.log('[ROOT ROUTE DEBUG] User authenticated, redirecting to chat');
  window.location.href = '/chat';
  return null;
}

function AppContent() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  useEffect(() => {
    // Debug environment info
    const envDebug = {
      nodeEnv: import.meta.env.MODE,
      isDev: import.meta.env.DEV,
      supabaseUrl: import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
      timestamp: new Date().toISOString()
    };
    
    console.log('[APP DEBUG] Environment info:', envDebug);
    setDebugInfo(envDebug);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Router>
        <Switch>
          <Route path="/" component={RootRoute} />
          <Route path="/chat">
            <ProtectedRoute>
              <ChatProvider>
                <Chat />
              </ChatProvider>
            </ProtectedRoute>
          </Route>
          <Route path="/login">
            <PublicRoute>
              <Login />
            </PublicRoute>
          </Route>
          <Route path="/signup">
            <PublicRoute>
              <Signup />
            </PublicRoute>
          </Route>
          <Route path="/verify-email">
            <PublicRoute>
              <EmailVerification />
            </PublicRoute>
          </Route>
          <Route path="/password-reset">
            <PublicRoute>
              <PasswordReset />
            </PublicRoute>
          </Route>
          <Route path="/set-password">
            <PublicRoute>
              <SetPassword />
            </PublicRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Router>
    </div>
  );
}

function App() {
  console.log('[APP DEBUG] App component rendered at:', new Date().toISOString());
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
