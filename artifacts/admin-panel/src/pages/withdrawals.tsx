import { useState } from "react";
import { useGetWithdrawals, useApproveWithdrawal, useRejectWithdrawal, getGetWithdrawalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  pending: "Đang chờ",
  approved: "Đã duyệt",
  completed: "Hoàn thành",
  rejected: "Từ chối",
};

export default function Withdrawals() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetWithdrawals({
    page,
    limit: 20,
    status: statusFilter !== "all" ? statusFilter : undefined
  });

  const approveMutation = useApproveWithdrawal();
  const rejectMutation = useRejectWithdrawal();

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Đã duyệt yêu cầu rút tiền" });
        queryClient.invalidateQueries({ queryKey: getGetWithdrawalsQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Duyệt thất bại", description: err.message });
      }
    });
  };

  const handleReject = () => {
    if (!rejectingId) return;
    rejectMutation.mutate({
      id: rejectingId,
      data: { reason: rejectReason }
    }, {
      onSuccess: () => {
        toast({ title: "Đã từ chối yêu cầu rút tiền" });
        setRejectingId(null);
        setRejectReason("");
        queryClient.invalidateQueries({ queryKey: getGetWithdrawalsQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Từ chối thất bại", description: err.message });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "approved": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "pending": return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      case "rejected": return "bg-destructive/10 text-destructive hover:bg-destructive/20";
      default: return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Yêu cầu rút tiền</h2>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Đang chờ</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>Thông tin ngân hàng</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : data?.withdrawals?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Không có yêu cầu rút tiền.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.withdrawals?.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.id}</TableCell>
                      <TableCell>{format(new Date(w.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{w.userId}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{w.bankName}</div>
                        <div className="text-xs text-muted-foreground">{w.bankNumber} - {w.bankOwner}</div>
                      </TableCell>
                      <TableCell className="font-bold">
                        {Number(w.amount).toLocaleString()} VND
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${getStatusColor(w.status)}`}>
                          {STATUS_LABELS[w.status?.toLowerCase()] ?? w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {w.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              onClick={() => handleApprove(w.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" /> Duyệt
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectingId(w.id)}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-1" /> Từ chối
                            </Button>
                          </>
                        )}
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

      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối rút tiền</DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do từ chối yêu cầu rút tiền này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lý do từ chối</Label>
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="VD: Thông tin ngân hàng không hợp lệ" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>Huỷ</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
