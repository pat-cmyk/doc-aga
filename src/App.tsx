import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MerchantAuth from "./pages/MerchantAuth";
import AdminAuth from "./pages/AdminAuth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import MerchantDashboard from "./pages/MerchantDashboard";
import Marketplace from "./pages/Marketplace";
import Checkout from "./pages/Checkout";
import DistributorFinder from "./pages/DistributorFinder";
import OrderHistory from "./pages/OrderHistory";
import MessagingPage from "./pages/MessagingPage";
import InviteAccept from "./pages/InviteAccept";
import AdminCreateUser from "./pages/AdminCreateUser";
import FarmhandDashboard from "./pages/FarmhandDashboard";
import NotFound from "./pages/NotFound";
import VoiceTraining from "./pages/VoiceTraining";
import { FloatingDocAga } from "./components/FloatingDocAga";
import { FloatingVoiceTrainingButton } from "./components/voice-training/FloatingVoiceTrainingButton";
import { CartProvider } from "./hooks/useCart";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { syncQueue } from "./lib/syncService";
import { initNotifications } from "./lib/notificationService";
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SyncHandler />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/merchant" element={<MerchantAuth />} />
            <Route path="/auth/admin" element={<AdminAuth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminDashboard />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingDocAga />
          <FloatingVoiceTrainingButton />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
