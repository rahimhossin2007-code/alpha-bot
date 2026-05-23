import { 
  useGetBotStatus, getGetBotStatusQueryKey, 
  useGetBotStats, getGetBotStatsQueryKey,
  useStartBot, useStopBot, useRestartBot,
  useGetLogs, getGetLogsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Power, PowerOff, RefreshCw, Activity, MessageSquare, Terminal, Users, ShieldAlert, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: status } = useGetBotStatus({ query: { queryKey: getGetBotStatusQueryKey(), refetchInterval: 5000 } });
  const { data: stats } = useGetBotStats({ query: { queryKey: getGetBotStatsQueryKey(), refetchInterval: 10000 } });
  const { data: recentLogs } = useGetLogs(
    { limit: 5 }, 
    { query: { queryKey: [...getGetLogsQueryKey(), 'recent'], refetchInterval: 5000 } }
  );
  
  const startBot = useStartBot({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() })
    }
  });
  
  const stopBot = useStopBot({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() })
    }
  });

  const restartBot = useRestartBot({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() })
    }
  });

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  const getLevelColor = (lvl: string) => {
    switch(lvl) {
      case 'INFO': return "text-blue-400";
      case 'WARN': return "text-yellow-400";
      case 'ERROR': return "text-red-400";
      case 'OK': return "text-green-400";
      default: return "text-muted-foreground";
    }
  };

  const isOnline = status?.status === "online";
  const statusColor = isOnline ? "bg-green-500" : status?.status === "connecting" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] uppercase">System Status</h2>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => startBot.mutate()}
            disabled={isOnline || startBot.isPending}
            className="border-green-500/50 text-green-400 hover:bg-green-500/10 hover:text-green-300"
          >
            <Power className="mr-2 h-4 w-4" /> Start
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => restartBot.mutate()}
            disabled={!isOnline || restartBot.isPending}
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Restart
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => stopBot.mutate()}
            disabled={!isOnline || stopBot.isPending}
            className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <PowerOff className="mr-2 h-4 w-4" /> Stop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.05)] backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bot Status</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColor}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColor}`}></span>
              </span>
              <div className="text-2xl font-bold uppercase">{status?.status || "UNKNOWN"}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uptime: {status ? formatUptime(status.uptimeSeconds) : "--"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.messagesHandled.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total processed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commands</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.commandsExecuted.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total executed</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">System Info</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Admins</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{stats?.adminCount || 0}</Badge>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Commands Loaded</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{stats?.commandCount || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Errors</span>
              <Badge variant="secondary" className={stats?.errorsCount ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"}>{stats?.errorsCount || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {status?.errorMessage && (
        <div className="bg-red-950/30 border border-red-500/30 text-red-400 p-4 rounded-md flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-red-300">Connection Error</h4>
            <p className="text-sm mt-1">{status.errorMessage}</p>
          </div>
        </div>
      )}

      <Card className="bg-black/60 border-border/50 shadow-inner">
        <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-border/50">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Recent Logs
          </CardTitle>
          <Link href="/logs" className="text-xs text-primary hover:underline">View All</Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="font-mono text-xs p-4 space-y-2">
            {recentLogs?.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">No recent logs</div>
            ) : (
              recentLogs?.map(log => (
                <div key={log.id} className="flex gap-3 text-gray-300">
                  <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`font-bold shrink-0 w-12 ${getLevelColor(log.level)}`}>{log.level}</span>
                  <span className="truncate">{log.tag && <span className="text-primary/70">[{log.tag}] </span>}{log.message}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}