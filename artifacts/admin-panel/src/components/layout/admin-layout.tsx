import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ArrowDownToLine,
  BarChart3,
  Gift,
  MessageSquare,
  Settings,
  ShieldAlert,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/users", label: "Người dùng", icon: Users },
  { href: "/transactions", label: "Giao dịch", icon: CreditCard },
  { href: "/withdrawals", label: "Rút tiền", icon: ArrowDownToLine },
  { href: "/analytics", label: "Phân tích", icon: BarChart3 },
  { href: "/gift-codes", label: "Mã quà tặng", icon: Gift },
  { href: "/support", label: "Hỗ trợ", icon: MessageSquare },
  { href: "/fraud", label: "Gian lận", icon: ShieldAlert },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = () => setMobileOpen((o) => !o);

  const NavItems = () => (
    <>
      {NAV_LINKS.map((link) => {
        const Icon = link.icon;
        const active = location === link.href;
        return (
          <Link key={link.href} href={link.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="w-5 h-5" />
              <span>{link.label}</span>
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="font-bold text-xl tracking-tight text-primary">HARU88</div>
        <Button variant="ghost" size="icon" onClick={toggleMobile}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="font-bold text-2xl tracking-tight text-primary">HARU88</div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavItems />
        </div>
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => { logout(); setLocation("/login"); }}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
