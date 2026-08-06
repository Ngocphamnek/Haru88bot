import { useGetSupportRequests, useConnectSupportUser, useDisconnectSupportUser, useRejectSupportUser, getGetSupportRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, PhoneOff, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default function Support() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requests, isLoading } = useGetSupportRequests({ query: { refetchInterval: 10000 } as any });

  const connectMutation = useConnectSupportUser();
  const disconnectMutation = useDisconnectSupportUser();
  const rejectMutation = useRejectSupportUser();

  const handleConnect = (userId: string) => {
    connectMutation.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "Đã kết nối với người dùng" });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestsQueryKey() });
      }
    });
  };

  const handleDisconnect = (userId: string) => {
    disconnectMutation.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "Đã ngắt kết nối với người dùng" });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestsQueryKey() });
      }
    });
  };

  const handleReject = (userId: string) => {
    rejectMutation.mutate({ userId }, {
      onSuccess: () => {
        toast({ title: "Đã từ chối yêu cầu hỗ trợ" });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Vận hành hỗ trợ</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
            Không có yêu cầu hỗ trợ nào đang hoạt động.
          </div>
        ) : (
          requests?.map((req: any) => (
            <Card key={req.userId} className={`border-2 ${req.isConnected ? 'border-primary' : 'border-border'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{req.username ? `@${req.username}` : req.firstName}</CardTitle>
                  {req.isConnected ? (
                    <Badge variant="default" className="bg-primary">Đã kết nối</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-transparent">Đang chờ</Badge>
                  )}
                </div>
                <CardDescription className="font-mono text-xs">ID: {req.userId}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md text-sm mb-4 h-24 overflow-y-auto">
                  {req.content || "Không có tin nhắn ban đầu"}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  Yêu cầu {formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true, locale: vi })}
                </div>
                <div className="flex gap-2">
                  {!req.isConnected ? (
                    <>
                      <Button className="flex-1" onClick={() => handleConnect(req.userId)} disabled={connectMutation.isPending}>
                        <MessageSquare className="w-4 h-4 mr-2" /> Chấp nhận
                      </Button>
                      <Button variant="outline" className="flex-none px-3 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleReject(req.userId)} disabled={rejectMutation.isPending}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="destructive" className="flex-1" onClick={() => handleDisconnect(req.userId)} disabled={disconnectMutation.isPending}>
                      <PhoneOff className="w-4 h-4 mr-2" /> Kết thúc phiên
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
