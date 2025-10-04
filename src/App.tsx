import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import MerchantDashboard from "./pages/MerchantDashboard";
import Marketplace from "./pages/Marketplace";
import DistributorFinder from "./pages/DistributorFinder";
import OrderHistory from "./pages/OrderHistory";
import MessagingPage from "./pages/MessagingPage";
import NotFound from "./pages/NotFound";
import { FloatingDocAga } from "./components/FloatingDocAga";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/merchant" element={<MerchantDashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/distributors" element={<DistributorFinder />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/messages" element={<MessagingPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingDocAga />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
