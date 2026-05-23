import { useState } from "react";
import { useGetCookie, getGetCookieQueryKey, useUpdateCookie } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Cookie as CookieIcon, Save, Key, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Cookie() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: cookieInfo, isLoading } = useGetCookie({ query: { queryKey: getGetCookieQueryKey() } });
  
  const [cookieValue, setCookieValue] = useState("");

  const updateCookie = useUpdateCookie({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCookieQueryKey() });
        setCookieValue("");
        toast({ title: "Cookie updated", description: "Hot-reconnect triggered." });
      },
      onError: (error) => {
        toast({ title: "Failed to update cookie", variant: "destructive" });
      }
    }
  });

  const handleUpdate = () => {
    if (!cookieValue.trim()) return;
    updateCookie.mutate({ data: { cookie: cookieValue } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CookieIcon className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] uppercase">Cookie Management</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
            <CardDescription>Active Facebook session cookie details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2"><Key className="h-4 w-4"/> Status</span>
                  {cookieInfo?.hasCookie ? (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20">Missing</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-mono text-sm">{cookieInfo?.format || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Bot UID</span>
                  <span className="font-mono text-sm">{cookieInfo?.uid || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-sm">{cookieInfo?.lastUpdated ? new Date(cookieInfo.lastUpdated).toLocaleString() : "Never"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Update Cookie</CardTitle>
            <CardDescription>Paste new c3c JSON format cookie array to hot-reconnect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md flex items-start gap-3 text-yellow-500/90 text-sm mb-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>Warning: Updating the cookie will trigger an immediate hot-reconnect. Active requests may be dropped.</p>
            </div>
            <Textarea 
              placeholder='[{"domain": ".facebook.com", "name": "c_user", "value": "..."}]'
              className="font-mono text-xs min-h-[200px] bg-background/50 resize-y"
              value={cookieValue}
              onChange={(e) => setCookieValue(e.target.value)}
            />
            <Button 
              className="w-full" 
              onClick={handleUpdate}
              disabled={!cookieValue.trim() || updateCookie.isPending}
            >
              {updateCookie.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save & Reconnect
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}