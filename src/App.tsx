import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { FloatingDocAga } from "./components/FloatingDocAga";
import { CartProvider } from "./hooks/useCart";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingDocAga />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
