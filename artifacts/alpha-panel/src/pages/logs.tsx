import { useState, useRef, useEffect } from "react";
import { useGetLogs, getGetLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";

export default function Logs() {
  const [level, setLevel] = useState<string>("ALL");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: logs, isLoading } = useGetLogs(
    { limit: 200, level: level !== "ALL" ? level : undefined }, 
    { query: { queryKey: [...getGetLogsQueryKey(), level], refetchInterval: 3000 } }
  );

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
    setAutoScroll(isAtBottom);
  };

  const getLevelColor = (lvl: string) => {
    switch(lvl) {
      case 'INFO': return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case 'WARN': return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case 'ERROR': return "bg-red-500/10 text-red-400 border-red-500/20";
      case 'OK': return "bg-green-500/10 text-green-400 border-green-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] uppercase">Console Logs</h2>
        </div>
        
        <div className="w-[180px]">
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="bg-card/40 border-border/50">
              <SelectValue placeholder="Filter by level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-black border-border/50 flex-1 flex flex-col overflow-hidden relative shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        <CardContent className="p-0 flex-1 overflow-hidden relative z-10">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto p-4 font-mono text-sm leading-relaxed"
          >
            {isLoading && !logs ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center h-full">No logs found.</div>
            ) : (
              <div className="space-y-1">
                {logs?.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 px-2 py-1 -mx-2 rounded transition-colors group">
                    <span className="text-muted-foreground/60 shrink-0 w-20 text-xs mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <Badge variant="outline" className={`w-[60px] justify-center shrink-0 text-[10px] h-5 ${getLevelColor(log.level)}`}>
                      {log.level}
                    </Badge>
                    <div className="break-all min-w-0 flex-1">
                      {log.tag && <span className="text-primary/70 font-bold mr-2">[{log.tag}]</span>}
                      <span className="text-gray-300 group-hover:text-white transition-colors">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}