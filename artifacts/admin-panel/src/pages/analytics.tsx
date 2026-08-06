import { useState } from "react";
import { useGetRevenueAnalytics, useGetGameAnalytics, useGetTopPlayers, useGetReconciliation, GetRevenueAnalyticsPeriod, GetTopPlayersBy } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
}

export default function Analytics() {
  const [revenuePeriod, setRevenuePeriod] = useState<GetRevenueAnalyticsPeriod>("daily");
  const [topPlayersBy, setTopPlayersBy] = useState<GetTopPlayersBy>("deposit");

  const { data: revenueData, isLoading: revenueLoading } = useGetRevenueAnalytics({ period: revenuePeriod });
  const { data: gameData, isLoading: gameLoading } = useGetGameAnalytics();
  const { data: topPlayers, isLoading: playersLoading } = useGetTopPlayers({ by: topPlayersBy, limit: 10 });
  const { data: reconData, isLoading: reconLoading } = useGetReconciliation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Phân tích & Báo cáo</h2>
        <Select value={revenuePeriod} onValueChange={(val: any) => setRevenuePeriod(val)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Theo ngày</SelectItem>
            <SelectItem value="weekly">Theo tuần</SelectItem>
            <SelectItem value="monthly">Theo tháng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reconData?.hasAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cảnh báo đối soát</AlertTitle>
          <AlertDescription>
            {reconData.alertMessage}
            (Chênh lệch: {formatCurrency(reconData.discrepancy || 0)})
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Doanh thu thuần</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              <div className={`text-2xl font-bold ${(revenueData?.netRevenue || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {formatCurrency(revenueData?.netRevenue || 0)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nạp tiền</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              <div className="text-2xl font-bold">{formatCurrency(revenueData?.totalDeposit || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng rút tiền</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
              <div className="text-2xl font-bold">{formatCurrency(revenueData?.totalWithdrawal || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hiệu suất trò chơi</CardTitle>
            </div>
            <CardDescription>Thống kê theo từng loại game</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trò chơi</TableHead>
                  <TableHead className="text-right">Tổng cược</TableHead>
                  <TableHead className="text-right">Lợi nhuận nhà</TableHead>
                  <TableHead className="text-right">Tỷ lệ thắng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : (
                  gameData?.games?.map((game: any) => (
                    <TableRow key={game.gameType}>
                      <TableCell className="font-medium capitalize">{game.gameType}</TableCell>
                      <TableCell className="text-right">{formatCurrency(game.totalWagered)}</TableCell>
                      <TableCell className={`text-right font-bold ${game.houseProfit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {formatCurrency(game.houseProfit)}
                      </TableCell>
                      <TableCell className="text-right">{game.winRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Người chơi hàng đầu</CardTitle>
              <Select value={topPlayersBy} onValueChange={(val: any) => setTopPlayersBy(val)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Theo nạp tiền</SelectItem>
                  <SelectItem value="wagering">Theo cược</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CardDescription>Người dùng giá trị cao nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playersLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : (
                  topPlayers?.map((player: any) => (
                    <TableRow key={player.userId}>
                      <TableCell>
                        <div className="font-medium">{player.username ? `@${player.username}` : player.firstName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{player.userId}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(player.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
