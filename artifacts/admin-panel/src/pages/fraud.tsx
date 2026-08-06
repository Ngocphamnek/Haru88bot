import { useGetSuspiciousAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertOctagon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Fraud() {
  const { data: accounts, isLoading } = useGetSuspiciousAccounts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-destructive flex items-center">
          <ShieldAlert className="w-8 h-8 mr-3" /> Phát hiện gian lận
        </h2>
      </div>

      <Card className="border-destructive/20 shadow-[0_0_15px_rgba(255,0,0,0.05)]">
        <CardHeader className="bg-destructive/5 pb-4">
          <CardTitle className="text-destructive flex items-center">
            <AlertOctagon className="w-5 h-5 mr-2" /> Tài khoản bị gắn cờ nghi ngờ
          </CardTitle>
          <CardDescription>
            Thuật toán phát hiện hành vi bất thường trong cược, nạp tiền hoặc tỷ lệ thắng.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID người dùng</TableHead>
                <TableHead>Tên người dùng</TableHead>
                <TableHead>Điểm rủi ro</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : accounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Hiện không phát hiện tài khoản đáng ngờ.
                  </TableCell>
                </TableRow>
              ) : (
                accounts?.map((acc: any) => (
                  <TableRow key={acc.userId}>
                    <TableCell className="font-mono text-xs">{acc.userId}</TableCell>
                    <TableCell className="font-medium">{acc.username ? `@${acc.username}` : "Không rõ"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="bg-destructive/20 text-destructive border-transparent">
                        {acc.score}/100
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {acc.reason}
                      {acc.winRate && <div className="text-xs text-muted-foreground mt-1">Tỷ lệ thắng: {(acc.winRate * 100).toFixed(1)}%</div>}
                      {acc.depositCount24h && <div className="text-xs text-muted-foreground">Nạp tiền (24h): {acc.depositCount24h}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/users?search=${acc.userId}`}>
                        <Button variant="outline" size="sm">Điều tra</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
