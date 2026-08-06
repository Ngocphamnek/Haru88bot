import { useState } from "react";
import { useGetGiftCodes, useCreateGiftCode, useDeactivateGiftCode, getGetGiftCodesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Ban } from "lucide-react";
import { format } from "date-fns";

export default function GiftCodes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: codes, isLoading } = useGetGiftCodes();
  const createMutation = useCreateGiftCode();
  const deactivateMutation = useDeactivateGiftCode();

  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newUses, setNewUses] = useState("1");

  const handleCreate = () => {
    if (!newCode || !newAmount || !newUses) return;

    createMutation.mutate({
      data: {
        code: newCode.toUpperCase(),
        amount: newAmount,
        maxUses: Number(newUses)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Đã tạo mã quà tặng" });
        setOpen(false);
        setNewCode("");
        setNewAmount("");
        setNewUses("1");
        queryClient.invalidateQueries({ queryKey: getGetGiftCodesQueryKey() });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Lỗi", description: err.message });
      }
    });
  };

  const handleDeactivate = (id: number) => {
    deactivateMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Đã vô hiệu hoá mã quà tặng" });
        queryClient.invalidateQueries({ queryKey: getGetGiftCodesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Mã quà tặng</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Tạo mã
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo mã quà tặng</DialogTitle>
              <DialogDescription>
                Tạo mã khuyến mãi mới cho người dùng nhận thưởng.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Chuỗi mã</Label>
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="VD: WELCOME100" />
              </div>
              <div className="space-y-2">
                <Label>Số tiền thưởng (VND)</Label>
                <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="100000" />
              </div>
              <div className="space-y-2">
                <Label>Số lần sử dụng tối đa</Label>
                <Input type="number" value={newUses} onChange={(e) => setNewUses(e.target.value)} placeholder="100" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newCode || !newAmount}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Tạo mã
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Giá trị</TableHead>
                <TableHead>Lượt dùng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
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
              ) : codes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Chưa có mã quà tặng nào.
                  </TableCell>
                </TableRow>
              ) : (
                codes?.map((code: any) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-bold">{code.code}</TableCell>
                    <TableCell>{Number(code.amount).toLocaleString()} VND</TableCell>
                    <TableCell>{code.usedCount} / {code.maxUses}</TableCell>
                    <TableCell>
                      {code.isActive ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-transparent">Đang hoạt động</Badge>
                      ) : (
                        <Badge variant="secondary">Đã vô hiệu</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(code.createdAt), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      {code.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeactivate(code.id)}
                          disabled={deactivateMutation.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" /> Vô hiệu hoá
                        </Button>
                      )}
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
