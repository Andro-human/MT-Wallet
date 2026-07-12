import { useEffect, useLayoutEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import InsightsPage from "./pages/InsightsPage";
import SettingsPage from "./pages/SettingsPage";
import SyncHistoryPage from "./pages/SyncHistoryPage";
import SyncRunDetailPage from "./pages/SyncRunDetailPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import CategoriesPage from "./pages/CategoriesPage";
import GroupsPage from "./pages/GroupsPage";
import MerchantRulesPage from "./pages/MerchantRulesPage";
import RemindersPage from "./pages/RemindersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// PUSH/REPLACE (new page) → top. POP (back/forward) → restore the scroll position
// saved for that history entry. Native SPA restoration doesn't work here: list pages
// remount and hydrate from cache a frame or two later, so we retry until the position
// sticks (content is tall enough) or the user takes over.
const scrollPositions = new Map<string, number>();

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = location.key;

  useEffect(() => {
    const onScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);

  useLayoutEffect(() => {
    const saved = scrollPositions.get(key);
    if (navigationType === "POP" && saved != null && saved > 0) {
      let frame = 0;
      let cancelled = false;
      const cancel = () => {
        cancelled = true;
      };
      window.addEventListener("wheel", cancel, { passive: true, once: true });
      window.addEventListener("touchstart", cancel, { passive: true, once: true });
      const restore = () => {
        if (cancelled) return;
        window.scrollTo(0, saved);
        frame++;
        if (Math.abs(window.scrollY - saved) > 2 && frame < 40) {
          requestAnimationFrame(restore);
        } else {
          window.removeEventListener("wheel", cancel);
          window.removeEventListener("touchstart", cancel);
        }
      };
      requestAnimationFrame(restore);
      return;
    }
    window.scrollTo(0, 0);
  }, [key, navigationType]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollManager />
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } />
            
            <Route path="/transactions" element={
              <ProtectedRoute>
                <TransactionsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/transactions/:id" element={
              <ProtectedRoute>
                <TransactionDetailPage />
              </ProtectedRoute>
            } />
            
            <Route path="/insights" element={
              <ProtectedRoute>
                <InsightsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />

            <Route path="/settings/rules" element={
              <ProtectedRoute>
                <MerchantRulesPage />
              </ProtectedRoute>
            } />

            <Route path="/reminders" element={
              <ProtectedRoute>
                <RemindersPage />
              </ProtectedRoute>
            } />
            
            <Route path="/sync" element={
              <ProtectedRoute>
                <SyncHistoryPage />
              </ProtectedRoute>
            } />
            
            <Route path="/sync/:id" element={
              <ProtectedRoute>
                <SyncRunDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/bank-accounts" element={
              <ProtectedRoute>
                <BankAccountsPage />
              </ProtectedRoute>
            } />

            <Route path="/categories" element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            } />

            <Route path="/settings/groups" element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
