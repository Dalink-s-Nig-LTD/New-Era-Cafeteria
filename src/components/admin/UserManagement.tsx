import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UserPlus,
  Shield,
  Trash2,
  Edit,
  Crown,
  Users as UsersIcon,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export function UserManagement() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<Id<"adminUsers"> | null>(
    null,
  );

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<
    "superadmin" | "manager" | "vc" | "supervisor"
  >("manager");
  const [editRole, setEditRole] = useState<
    "superadmin" | "manager" | "vc" | "supervisor"
  >("manager");

  // Fetch all admin users
  const users = useQuery(api.adminAuth.getAllAdmins);

  // Mutations
  const createAdmin = useMutation(api.adminAuth.createAdmin);
  const updateRole = useMutation(api.adminAuth.updateAdminRole);
  const deleteAdmin = useMutation(api.adminAuth.deleteAdmin);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session expired. Please login again.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createAdmin({
        email,
        password,
        name,
        role,
        sessionId: sessionId as Id<"sessions">,
      });

      toast({
        title: "Success",
        description: `Admin user created successfully.`,
      });

      setCreateDialogOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("manager");
    } catch (error) {
      let errorMsg = "Failed to create admin. Please try again.";
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("[convex") || msg.includes("server error")) {
          errorMsg = "Unable to save. Please check your connection.";
        } else if (msg.includes("email already")) {
          errorMsg = "This email is already registered";
        } else if (msg.includes("invalid email")) {
          errorMsg = "Please enter a valid email address";
        } else if (msg.includes("password must")) {
          errorMsg = error.message;
        } else if (!msg.includes("[convex")) {
          errorMsg = error.message;
        }
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUserId) return;

    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session expired. Please login again.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateRole({
        adminId: selectedUserId,
        role: editRole,
        sessionId: sessionId as Id<"sessions">,
      });

      toast({
        title: "Success",
        description: "Role updated successfully.",
      });

      setEditDialogOpen(false);
      setSelectedUserId(null);
    } catch (error) {
      let errorMsg = "Failed to update role. Please try again.";
      if (
        error instanceof Error &&
        !error.message.toLowerCase().includes("[convex") &&
        !error.message.toLowerCase().includes("server error")
      ) {
        errorMsg = error.message;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdmin = async (adminId: Id<"adminUsers">) => {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      toast({
        title: "Error",
        description: "Session expired. Please login again.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteAdmin({
        adminId,
        sessionId: sessionId as Id<"sessions">,
      });

      toast({
        title: "Success",
        description: "Admin user deleted successfully.",
      });
    } catch (error) {
      let errorMsg = "Failed to delete admin. Please try again.";
      if (
        error instanceof Error &&
        !error.message.toLowerCase().includes("[convex") &&
        !error.message.toLowerCase().includes("server error")
      ) {
        errorMsg = error.message;
      }
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case "superadmin":
        return <Crown className="w-3 h-3" />;
      case "manager":
        return <Shield className="w-3 h-3" />;
      case "vc":
        return <Eye className="w-3 h-3" />;
      case "supervisor":
        return <Eye className="w-3 h-3" />;
      default:
        return <UsersIcon className="w-3 h-3" />;
    }
  };

  const getRoleBadgeVariant = (userRole: string) => {
    switch (userRole) {
      case "superadmin":
        return "destructive";
      case "manager":
        return "default";
      case "vc":
        return "secondary";
      case "supervisor":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display">
          <Shield className="w-5 h-5 text-primary" />
          Admin User Management
        </CardTitle>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Admin User</DialogTitle>
              <DialogDescription>
                Add a new admin user with specific role permissions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAdmin}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setPassword(generatePassword())}
                      title="Generate Password"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the refresh icon to generate a random 8-character
                    password
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={role}
                    onValueChange={(val) =>
                      setRole(
                        val as "superadmin" | "manager" | "vc" | "supervisor",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4" />
                          <span>Superadmin - Full Access</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          <span>Manager - Edit Menu & Reports</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="vc">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          <span>VC - View Only & Reports</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="supervisor">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          <span>Supervisor - View Only & Reports</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Admin</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {users === undefined ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={getRoleBadgeVariant(user.role)}
                        className="gap-1"
                      >
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(user._id);
                            setEditRole(user.role);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Role
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Admin User
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {user.name}?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteAdmin(user._id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit Role Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update User Role</DialogTitle>
              <DialogDescription>
                Change the role and permissions for this admin user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={editRole}
                  onValueChange={(val) =>
                    setEditRole(
                      val as "superadmin" | "manager" | "vc" | "supervisor",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        <span>Superadmin - Full Access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Manager - Edit Menu & Reports</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="vc">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>VC - View Only & Reports</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>Supervisor - View Only & Reports</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateRole}>Update Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
