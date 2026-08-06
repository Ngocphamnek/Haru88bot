import { useState } from "react";
import { useGetAdminUsers, useBanUser, useAdjustUserBalance, getGetAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Edit, Ban, CheckCircle, Plus, Minus } from "lucide-react";

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useGetAdminUsers({
    page,
    limit: 20,
    search: search || undefined
  });

  const banMutation = useBanUser();
  const balanceMutation = useAdjustUserBalance();

  const [adjustingUser, setAdjustingUser] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState("add");
  const [adjustNote, setAdjustNote] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleBan = (userId: string, currentBanned: boolean) => {
    banMutation.mutate({
      userId,
      data: { banned: !currentBanned }
    }, {
      onSuccess: () => {
        toast({ title: !currentBanned ? "Đã khóa người dùng" : "Đã mở khóa người dùng" });
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      }
    });
  };

  const handleAdjustBalance = () => {
    if (!adjustingUser || !adjustAmount) return;

    balanceMutation.mutate({
      userId: adjustingUser.id,
      data: {
        amount: Number(adjustAmount),
        type: adjustType,
        note: adjustNote || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Đã cập nhật số dư thành công" });
        setAdjustingUser(null);
        setAdjustAmount("");
        setAdjustNote("");
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Lỗi", description: err.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Người dùng</h2>
      </div>

      <Card>
        <CardHeader className="py-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo ID hoặc tên..."
                className="pl-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Tìm kiếm</Button>
            {(search) && (
              <Button type="button" variant="ghost" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}>
                Xóa
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID người dùng</TableHead>
                  <TableHead>Tên người dùng</TableHead>
                  <TableHead>Số dư</TableHead>
                  <TableHead>Tổng cược</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : data?.users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Không tìm thấy người dùng.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users?.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-xs">{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {user.username ? `@${user.username}` : user.firstName}
                      </TableCell>
                      <TableCell>{Number(user.balance).toLocaleString()} VND</TableCell>
                      <TableCell>{Number(user.totalWagered).toLocaleString()}</TableCell>
                      <TableCell>
                        {user.isBanned ? (
                          <Badge variant="destructive">Đã khóa</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-transparent">Hoạt động</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setAdjustingUser(user)}>
                          <Edit className="h-4 w-4 mr-1" /> Số dư
                        </Button>
                        <Button
                          variant={user.isBanned ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => toggleBan(user.id, user.isBanned)}
                          disabled={banMutation.isPending}
                        >
                          {user.isBanned ? <CheckCircle className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                          {user.isBanned ? "Mở khóa" : "Khóa"}
                        </Button>
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

      <Dialog open={!!adjustingUser} onOpenChange={(open) => !open && setAdjustingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điều chỉnh số dư</DialogTitle>
            <DialogDescription>
              Thay đổi số dư ví của {adjustingUser?.username ? `@${adjustingUser.username}` : adjustingUser?.id}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Số dư hiện tại</Label>
              <div className="text-lg font-bold">{Number(adjustingUser?.balance || 0).toLocaleString()} VND</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hành động</Label>
                <Select value={adjustType} onValueChange={setAdjustType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add"><div className="flex items-center"><Plus className="w-4 h-4 mr-2" /> Cộng</div></SelectItem>
                    <SelectItem value="subtract"><div className="flex items-center"><Minus className="w-4 h-4 mr-2" /> Trừ</div></SelectItem>
                    <SelectItem value="set">Đặt chính xác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Số tiền (VND)</Label>
                <Input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lý do / Ghi chú (tuỳ chọn)</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="VD: Hoàn tiền do lỗi game" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingUser(null)}>Huỷ</Button>
            <Button onClick={handleAdjustBalance} disabled={!adjustAmount || balanceMutation.isPending}>
              {balanceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
