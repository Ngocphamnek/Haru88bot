import { useGetAdminStats, useGetSystemStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, CreditCard, ArrowDownToLine, Gamepad2, Server, HardDrive, Bot, LifeBuoy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
}

function StatCard({ title, value, icon: Icon, isLoading }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { refetchInterval: 30000 } as any });
  const { data: system, isLoading: sysLoading } = useGetSystemStats({ query: { refetchInterval: 30000 } as any });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Tổng quan</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Tổng người dùng"
          value={stats?.totalUsers?.toLocaleString() || "0"}
          icon={Users}
          isLoading={statsLoading}
        />
        <StatCard
          title="Hoạt động hôm nay"
          value={stats?.activeToday?.toLocaleString() || "0"}
          icon={Activity}
          isLoading={statsLoading}
        />
        <StatCard
          title="Tổng nạp tiền"
          value={stats ? formatCurrency(stats.totalDeposits) : "0"}
          icon={CreditCard}
          isLoading={statsLoading}
        />
        <StatCard
          title="Tổng rút tiền"
          value={stats ? formatCurrency(stats.totalWithdrawals) : "0"}
          icon={ArrowDownToLine}
          isLoading={statsLoading}
        />
        <StatCard
          title="Tổng lượt cược"
          value={stats?.totalBets?.toLocaleString() || "0"}
          icon={Gamepad2}
          isLoading={statsLoading}
        />
      </div>

      <h3 className="text-xl font-bold tracking-tight mt-8 mb-4">Trạng thái hệ thống</h3>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thời gian hoạt động</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {sysLoading ? <Skeleton className="h-6 w-20" /> : <div className="text-lg font-bold">{system?.uptime ? (system.uptime / 3600).toFixed(1) + " giờ" : "Không rõ"}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dịch vụ Bot</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm mt-2">
            {sysLoading ? <Skeleton className="h-12 w-full" /> : (
              <>
                <div className="flex items-center justify-between">
                  <span>Bot chính</span>
                  <span className={system?.botMainRunning ? "text-green-500 font-medium" : "text-destructive font-medium"}>{system?.botMainRunning ? "Đang chạy" : "Offline"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bot 2</span>
                  <span className={system?.bot2Running ? "text-green-500 font-medium" : "text-destructive font-medium"}>{system?.bot2Running ? "Đang chạy" : "Offline"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Bot hỗ trợ</span>
                  <span className={system?.supportBotRunning ? "text-green-500 font-medium" : "text-destructive font-medium"}>{system?.supportBotRunning ? "Đang chạy" : "Offline"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hạ tầng</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm mt-2">
            {sysLoading ? <Skeleton className="h-12 w-full" /> : (
              <>
                <div className="flex items-center justify-between">
                  <span>Redis DB</span>
                  <span className={system?.redisConnected ? "text-green-500 font-medium" : "text-destructive font-medium"}>{system?.redisConnected ? "Đã kết nối" : "Mất kết nối"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>API Ngân hàng</span>
                  <span className={system?.bankConnected ? "text-green-500 font-medium" : "text-destructive font-medium"}>{system?.bankConnected ? "Đã kết nối" : "Mất kết nối"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ xử lý</CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm mt-2">
            {sysLoading ? <Skeleton className="h-12 w-full" /> : (
              <>
                <div className="flex items-center justify-between">
                  <span>Rút tiền</span>
                  <span className="font-bold">{system?.pendingWithdrawals || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Yêu cầu hỗ trợ</span>
                  <span className="font-bold">{system?.pendingSupport || 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
