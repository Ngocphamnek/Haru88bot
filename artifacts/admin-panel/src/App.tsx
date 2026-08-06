import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/lib/auth";

// Pages
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Transactions from "@/pages/transactions";
import Withdrawals from "@/pages/withdrawals";
import Analytics from "@/pages/analytics";
import GiftCodes from "@/pages/gift-codes";
import Support from "@/pages/support";
import Settings from "@/pages/settings";
import Fraud from "@/pages/fraud";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.status || error?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

function Router() {
  const { isAuthenticated, ready } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {ready && isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>

      <Route path="/">
        <Protected>
          <Dashboard />
        </Protected>
      </Route>
      <Route path="/users">
        <Protected>
          <Users />
        </Protected>
      </Route>
      <Route path="/transactions">
        <Protected>
          <Transactions />
        </Protected>
      </Route>
      <Route path="/withdrawals">
        <Protected>
          <Withdrawals />
        </Protected>
      </Route>
      <Route path="/analytics">
        <Protected>
          <Analytics />
        </Protected>
      </Route>
      <Route path="/gift-codes">
        <Protected>
          <GiftCodes />
        </Protected>
      </Route>
      <Route path="/support">
        <Protected>
          <Support />
        </Protected>
      </Route>
      <Route path="/settings">
        <Protected>
          <Settings />
        </Protected>
      </Route>
      <Route path="/fraud">
        <Protected>
          <Fraud />
        </Protected>
      </Route>
      <Route>
        <Protected>
          <NotFound />
        </Protected>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
