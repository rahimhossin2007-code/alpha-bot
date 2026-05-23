import { useListCommands, getListCommandsQueryKey, useReloadCommands } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, RefreshCw, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Commands() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: commands, isLoading } = useListCommands({ query: { queryKey: getListCommandsQueryKey() } });

  const reloadCommands = useReloadCommands({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        toast({ title: "Commands reloaded successfully" });
      },
      onError: () => {
        toast({ title: "Failed to reload commands", variant: "destructive" });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Terminal className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] uppercase">Commands Registry</h2>
        </div>
        <Button 
          variant="outline" 
          onClick={() => reloadCommands.mutate()}
          disabled={reloadCommands.isPending}
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          {reloadCommands.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reload Commands
        </Button>
      </div>

      <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Loaded Modules</CardTitle>
          <CardDescription>Available bot commands and their configurations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[150px]">Command</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Aliases</TableHead>
                  <TableHead className="w-[120px]">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : commands?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No commands loaded.
                    </TableCell>
                  </TableRow>
                ) : (
                  commands?.map((cmd) => (
                    <TableRow key={cmd.name}>
                      <TableCell className="font-bold text-primary font-mono">{cmd.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cmd.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {cmd.aliases?.map(alias => (
                            <Badge key={alias} variant="secondary" className="font-mono text-[10px] bg-background/50 border-border">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cmd.adminOnly ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                            Public
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}