import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { UnifiedActionsFab } from "./components/UnifiedActionsFab";
import { FloatingVoiceTrainingButton } from "./components/voice-training/FloatingVoiceTrainingButton";
import { GovernmentFab } from "./components/government/GovernmentFab";
import { MerchantFab } from "./components/merchant/MerchantFab";
import { CartProvider } from "./hooks/useCart";
import { FarmProvider } from "./contexts/FarmContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SuperAdminRoute } from "./components/auth/SuperAdminRoute";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { syncQueue } from "./lib/syncService";
import { initNotifications } from "./lib/notificationService";
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Lazy load page components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const MerchantAuth = lazy(() => import("./pages/MerchantAuth"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const GovernmentAuth = lazy(() => import("./pages/GovernmentAuth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const GovernmentDashboard = lazy(() => import("./pages/GovernmentDashboard"));
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Checkout = lazy(() => import("./pages/Checkout"));
const DistributorFinder = lazy(() => import("./pages/DistributorFinder"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const AdminCreateUser = lazy(() => import("./pages/AdminCreateUser"));
const FarmhandDashboard = lazy(() => import("./pages/FarmhandDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VoiceTraining = lazy(() => import("./pages/VoiceTraining"));
const AdminViewFarm = lazy(() => import("./pages/AdminViewFarm"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Configure QueryClient with OFFLINE-FIRST strategy
// Prioritizes cache, syncs in background, minimal network dependency
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 5 minutes - reduces unnecessary refetches
      staleTime: 5 * 60 * 1000,
      // Keep cached data for 24 hours - essential for offline access
      gcTime: 24 * 60 * 60 * 1000,
      // Don't refetch on mount if data exists - cache-first behavior
      refetchOnMount: false,
      // Don't refetch when user returns to tab - saves bandwidth
      refetchOnWindowFocus: false,
      // DO refetch when back online - ensures data sync
      refetchOnReconnect: 'always',
      // Try cache before network - core offline-first principle
      networkMode: 'offlineFirst',
      // Only retry network errors, max 3 times
      retry: (failureCount, error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const isNetworkErr = message.includes('failed to fetch') || 
                            message.includes('network') || 
                            message.includes('timeout');
        return isNetworkErr && failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Component to handle sync and notifications
const SyncHandler = () => {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize notifications on mount
    initNotifications();

    // Setup notification click handler
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const data = notification.notification.extra;
        
        if (data?.failed) {
          navigate('/farmhand');
        } else if (data?.type === 'animal_form') {
          navigate('/');
        } else if (data?.type === 'voice_activity') {
          navigate('/farmhand');
        }
      });
    }
  }, [navigate]);

  useEffect(() => {
    // Trigger sync when coming back online
    if (isOnline) {
      console.log('Online detected, starting sync...');
      // Debounce to avoid rapid sync attempts
      const timer = setTimeout(() => {
        syncQueue();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useEffect(() => {
    // Periodic background sync every 5 minutes while online
    if (!isOnline) return;

    console.log('[BackgroundSync] Setting up periodic sync (every 5 minutes)');
    
    const interval = setInterval(() => {
      console.log('[BackgroundSync] Running periodic sync...');
      syncQueue();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      console.log('[BackgroundSync] Clearing periodic sync interval');
      clearInterval(interval);
    };
  }, [isOnline]);

  return null;
};

// Component to conditionally render floating components based on route
const ConditionalFloatingComponents = () => {
  const location = useLocation();
  
  // Routes where no FAB should appear at all
  const noFabRoutes = [
    '/auth',
    '/auth/merchant',
    '/auth/admin',
    '/auth/government',
    '/privacy',
    '/admin',
    '/marketplace',
    '/checkout',
    '/distributors',
    '/orders',
    '/messages',
    '/invite',
  ];
  
  const shouldHideFab = noFabRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );
  
  if (shouldHideFab) return null;
  
  // Government portal gets its own FAB
  if (location.pathname.startsWith('/government')) {
    return <GovernmentFab />;
  }
  
  // Merchant portal gets its own FAB
  if (location.pathname.startsWith('/merchant')) {
    return <MerchantFab />;
  }
  
  // Default farm FAB for all other routes
  return (
    <>
      <UnifiedActionsFab />
      <FloatingVoiceTrainingButton />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <FarmProvider>
          <PermissionsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <SyncHandler />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/merchant" element={<MerchantAuth />} />
                  <Route path="/auth/admin" element={<AdminAuth />} />
                  <Route path="/auth/government" element={<GovernmentAuth />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route 
                    path="/admin" 
                    element={
                      <SuperAdminRoute>
                        <AdminDashboard />
                      </SuperAdminRoute>
                    } 
                  />
                  <Route 
                    path="/admin/view-farm/:farmId" 
                    element={
                      <SuperAdminRoute>
                        <AdminViewFarm />
                      </SuperAdminRoute>
                    } 
                  />
                  <Route 
                    path="/government" 
                    element={
                      <ProtectedRoute requiredRoles={["government"]}>
                        <GovernmentDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/merchant" element={<MerchantDashboard />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/distributors" element={<DistributorFinder />} />
                  <Route path="/orders" element={<OrderHistory />} />
                  <Route path="/messages" element={<MessagingPage />} />
                  <Route path="/invite/accept/:token" element={<InviteAccept />} />
                  <Route path="/admin/create-user" element={<AdminCreateUser />} />
                  <Route path="/farmhand" element={<FarmhandDashboard />} />
                  <Route path="/voice-training" element={<VoiceTraining />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <ConditionalFloatingComponents />
            </BrowserRouter>
          </PermissionsProvider>
        </FarmProvider>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
