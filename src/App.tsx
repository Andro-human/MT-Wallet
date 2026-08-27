import { useEffect, useLayoutEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import InsightsPage from "./pages/InsightsPage";
import DebtPage from "./pages/DebtPage";
import SettingsPage from "./pages/SettingsPage";
import SyncHistoryPage from "./pages/SyncHistoryPage";
import SyncRunDetailPage from "./pages/SyncRunDetailPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import CategoriesPage from "./pages/CategoriesPage";
import BudgetsPage from "./pages/BudgetsPage";
import GroupsPage from "./pages/GroupsPage";
import MerchantRulesPage from "./pages/MerchantRulesPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import SubscriptionDetailPage from "./pages/SubscriptionDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// PUSH/REPLACE (new page) → top. POP (back/forward) → restore the scroll position
// saved for that path. Keyed by pathname, NOT location.key: the history key on the
// returning POP visit differs from the key of the visit that saved, so a key-based
// lookup misses. suppressSave stops our own scrollTo() from overwriting a saved value.
// The restore retries across frames because list pages rehydrate from cache a frame or
// two after mount, so the page isn't tall enough to hold the scroll on the first tick.
const scrollPositions = new Map<string, number>();
let suppressSave = false;

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const path = location.pathname;

  useEffect(() => {
    const onScroll = () => {
      if (suppressSave) return;
      scrollPositions.set(path, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);

  useLayoutEffect(() => {
    const saved = scrollPositions.get(path);
    suppressSave = true;
    const release = () => {
      suppressSave = false;
    };

    if (navigationType === "POP" && saved != null && saved > 0) {
      // Heavy lists (Activity) re-render after mount as data/finance state resolves,
      // briefly collapsing height and clamping scroll to 0. A one-shot restore lands
      // correctly then gets thrown to top. So HOLD the position: re-assert whenever it
      // drifts, for ~1.5s or until the user scrolls (their intent wins).
      let cancelled = false;
      const start = performance.now();
      const onUser = () => {
        cancelled = true;
        cleanup();
      };
      const cleanup = () => {
        suppressSave = false;
        window.removeEventListener("wheel", onUser);
        window.removeEventListener("touchstart", onUser);
      };
      window.addEventListener("wheel", onUser, { passive: true });
      window.addEventListener("touchstart", onUser, { passive: true });
      const hold = () => {
        if (cancelled) return;
        if (Math.abs(window.scrollY - saved) > 2) window.scrollTo(0, saved);
        if (performance.now() - start < 1500) {
          requestAnimationFrame(hold);
        } else {
          cleanup();
        }
      };
      requestAnimationFrame(hold);
      return;
    }

    window.scrollTo(0, 0);
    requestAnimationFrame(release);
  }, [path, navigationType]);

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

            <Route path="/debt" element={
              <ProtectedRoute>
                <DebtPage />
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

            <Route path="/subscriptions" element={
              <ProtectedRoute>
                <SubscriptionsPage />
              </ProtectedRoute>
            } />

            <Route path="/subscriptions/:id" element={
              <ProtectedRoute>
                <SubscriptionDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/reminders" element={<Navigate to="/subscriptions" replace />} />
            
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

            <Route path="/settings/budgets" element={
              <ProtectedRoute>
                <BudgetsPage />
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
