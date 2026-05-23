import { useState } from "react";
import { useListAdmins, getListAdminsQueryKey, useAddAdmin, useRemoveAdmin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Shield, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admins() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: admins, isLoading } = useListAdmins({ query: { queryKey: getListAdminsQueryKey() } });
  
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");

  const addAdmin = useAddAdmin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
        setUid("");
        setName("");
        toast({ title: "Admin added successfully" });
      },
      onError: (error) => {
        toast({ title: "Failed to add admin", variant: "destructive" });
      }
    }
  });

  const removeAdmin = useRemoveAdmin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
        toast({ title: "Admin removed" });
      },
      onError: () => {
        toast({ title: "Failed to remove admin", variant: "destructive" });
      }
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    addAdmin.mutate({ data: { uid, name: name || null } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-bold tracking-tight text-primary drop-shadow-[0_0_12px_rgba(0,255,255,0.3)] uppercase">Bot Admin System</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Add New Admin</CardTitle>
            <CardDescription>Grant userbot administrative privileges.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uid">Facebook UID <span className="text-red-500">*</span></Label>
                <Input 
                  id="uid" 
                  placeholder="1000..." 
                  value={uid} 
                  onChange={(e) => setUid(e.target.value)} 
                  className="bg-background/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name / Note (Optional)</Label>
                <Input 
                  id="name" 
                  placeholder="Admin Name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!uid || addAdmin.isPending}>
                {addAdmin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Admin
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Current Admins</CardTitle>
            <CardDescription>Users authorized to execute admin-only bot commands.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>UID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : admins?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No admins configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    admins?.map((admin) => (
                      <TableRow key={admin.uid}>
                        <TableCell className="font-mono text-sm">{admin.uid}</TableCell>
                        <TableCell>{admin.name || <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(admin.addedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeAdmin.mutate({ uid: admin.uid })}
                            disabled={removeAdmin.isPending}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}