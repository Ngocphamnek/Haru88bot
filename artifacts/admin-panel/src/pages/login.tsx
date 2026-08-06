import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAdminLogin } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const adminLoginMutation = useAdminLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    adminLoginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => {
          if (data.success && data.token) {
            login(data.token);
            toast({
              title: "Login Successful",
              description: "Welcome back to the operations control center.",
            });
            setLocation("/");
          } else {
            toast({
              variant: "destructive",
              title: "Login Failed",
              description: data.error || "Invalid credentials",
            });
          }
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: err?.message || "Failed to communicate with server.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Haru88 Operator</h1>
          <p className="text-muted-foreground mt-2">Secure access required</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Enter your operator credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="operator_id"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-6"
                disabled={adminLoginMutation.isPending || !username || !password}
              >
                {adminLoginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
