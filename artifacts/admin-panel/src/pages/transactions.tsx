import { useState } from "react";
import { useGetAdminTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  deposit: "Nạp tiền",
  withdraw: "Rút tiền",
  bet: "Đặt cược",
  win: "Thắng",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Hoàn thành",
  success: "Thành công",
  pending: "Đang chờ",
  failed: "Thất bại",
  rejected: "Từ chối",
};

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useGetAdminTransactions({
    page,
    limit: 20,
    userId: userIdFilter || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUserIdFilter(searchInput);
    setPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "pending": return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      case "failed":
      case "rejected": return "bg-destructive/10 text-destructive hover:bg-destructive/20";
      default: return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Giao dịch</h2>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Lọc theo ID người dùng..."
                  className="pl-8"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">Lọc</Button>
            </form>
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tất cả loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="deposit">Nạp tiền</SelectItem>
                <SelectItem value="withdraw">Rút tiền</SelectItem>
                <SelectItem value="bet">Đặt cược</SelectItem>
                <SelectItem value="win">Thắng</SelectItem>
              </SelectContent>
            </Select>
            {(userIdFilter || typeFilter !== "all") && (
              <Button type="button" variant="ghost" onClick={() => { setUserIdFilter(""); setSearchInput(""); setTypeFilter("all"); setPage(1); }}>
                Xóa
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>ID người dùng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : data?.transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Không tìm thấy giao dịch.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions?.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                      <TableCell>{format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.userId}</TableCell>
                      <TableCell>{TYPE_LABELS[tx.type] ?? tx.type}</TableCell>
                      <TableCell className="font-medium">
                        {Number(tx.amount).toLocaleString()} VND
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${getStatusColor(tx.status)}`}>
                          {STATUS_LABELS[tx.status?.toLowerCase()] ?? tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data?.total && data.total > 20 && (
            <div className="flex items-center justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Trước
              </Button>
              <div className="text-sm text-muted-foreground">
                Trang {page} / {Math.ceil(data.total / 20)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(data.total / 20)}
              >
                Sau
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
