import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import { Key, Copy, Plus, Ban, Check, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccessCodeGeneratorProps {
  isSuperadmin?: boolean;
}

export function AccessCodeGenerator({
  isSuperadmin = false,
}: AccessCodeGeneratorProps) {
  const codes = useQuery(api.accessCodes.listAccessCodes) || [];
  const generateCode = useMutation(api.accessCodes.generateAccessCode);
  const deactivateCode = useMutation(api.accessCodes.deactivateCode);
  const deleteCode = useMutation(api.accessCodes.deleteCode);
  const updateShift = useMutation(api.accessCodes.updateCodeShift);

  const [showGenerate, setShowGenerate] = useState(false);
  const [shift, setShift] = useState<"morning" | "afternoon" | "evening">("morning");
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      // Always generate cashier code (default behavior)
      const codeObj = await generateCode({
        expiresInDays:
          expiresInDays === "never" ? undefined : parseInt(expiresInDays),
        role: "cashier",
        shift,
      });
      setGeneratedCode(codeObj.code);
      toast({
        title: "Success!",
        description: "Access code generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate access code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Access code copied to clipboard",
    });
  };

  const handleDeactivateCode = async (codeId: Id<"accessCodes">) => {
    try {
      await deactivateCode({ codeId });
      toast({
        title: "Code Deactivated",
        description: "The access code has been deactivated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate code",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCode = async (codeId: Id<"accessCodes">) => {
    try {
      await deleteCode({ codeId });
      toast({
        title: "Code Deleted",
        description: "The access code has been deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete code",
        variant: "destructive",
      });
    }
  };

  const handleUpdateShift = async (codeId: Id<"accessCodes">, newShift: "morning" | "afternoon" | "evening") => {
    try {
      await updateShift({ codeId, shift: newShift });
      toast({
        title: "Shift Updated",
        description: `Access code shift changed to ${newShift}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  interface AccessCode {
    _id: string;
    code: string;
    shift?: "morning" | "afternoon" | "evening";
    isActive: boolean;
    expiresAt?: number;
    usedCount: number;
    usageCount?: number;
  }

  const getStatusBadge = (code: AccessCode) => {
    if (!code.isActive) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="w-3 h-3" /> Inactive
        </Badge>
      );
    }
    if ((code.usageCount ?? code.usedCount) > 0) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Check className="w-3 h-3" /> Used (
          {code.usageCount ?? code.usedCount})
        </Badge>
      );
    }
    if (code.expiresAt && code.expiresAt < Date.now()) {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" /> Expired
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-success">
        <Check className="w-3 h-3" /> Active
      </Badge>
    );
  };

  const activeCodes = codes.filter(
    (c) => c.isActive && (!c.expiresAt || c.expiresAt > Date.now()),
  );

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Codes</p>
          <p className="text-2xl font-bold">{codes.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-success">
            {activeCodes.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Used</p>
          <p className="text-2xl font-bold">
            {codes.filter((c) => c.usedCount > 0).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="text-2xl font-bold text-destructive">
            {codes.filter((c) => !c.isActive).length}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <Key className="w-5 h-5 text-primary" />
              Access Codes
            </CardTitle>
            <Button
              onClick={() => {
                setShowGenerate(true);
                setGeneratedCode(null);
              }}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Generate Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-lg font-bold tracking-wider">
                          {code.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyCode(code.code)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSuperadmin ? (
                        <Select
                          value={code.shift || "morning"}
                          onValueChange={(v) => handleUpdateShift(code._id as Id<"accessCodes">, v as "morning" | "afternoon" | "evening")}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant={
                            code.shift === "morning" ? "default" : "secondary"
                          }
                        >
                          {code.shift
                            ? code.shift.charAt(0).toUpperCase() +
                              code.shift.slice(1)
                            : "Any"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell>
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>{code.usedCount} times</TableCell>
                    <TableCell className="text-right">
                      {code.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeactivateCode(code._id)}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {codes.map((code) => (
              <Card key={code._id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-lg font-bold tracking-wider">
                      {code.code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyCode(code.code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {getStatusBadge(code)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Shift</p>
                    {isSuperadmin ? (
                      <Select
                        value={code.shift || "morning"}
                        onValueChange={(v) => handleUpdateShift(code._id as Id<"accessCodes">, v as "morning" | "afternoon" | "evening")}
                      >
                        <SelectTrigger className="w-[130px] h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={
                          code.shift === "morning" ? "default" : "secondary"
                        }
                      >
                        {code.shift
                          ? code.shift.charAt(0).toUpperCase() +
                            code.shift.slice(1)
                          : "Any"}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p>
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Usage</p>
                    <p>{code.usedCount} times</p>
                  </div>
                </div>
                {code.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4 text-destructive"
                    onClick={() => handleDeactivateCode(code._id)}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Deactivate Code
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate Code Dialog */}
      <AlertDialog open={showGenerate} onOpenChange={setShowGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {generatedCode ? "Code Generated!" : "Generate Access Code"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {generatedCode
                ? "Share this code with the user. They can use it to log in."
                : "Create a new access code for a user to join the system."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {generatedCode ? (
            <div className="py-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <code className="font-mono text-3xl font-bold tracking-[0.5em] bg-secondary px-6 py-4 rounded-lg">
                  {generatedCode}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Share this 4-digit code with the cashier to log in
              </p>
              <Button
                variant="outline"
                onClick={() => handleCopyCode(generatedCode)}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Code
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Shift</label>
                <Select
                  value={shift}
                  onValueChange={(v) => setShift(v as "morning" | "afternoon" | "evening")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning Shift (7AM-12PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon Shift (12PM-5PM)</SelectItem>
                    <SelectItem value="evening">Evening Shift (5PM-10PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expires In</label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This will generate a 4-digit access code for cashiers to log in
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGeneratedCode(null)}>
              {generatedCode ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!generatedCode && (
              <AlertDialogAction
                onClick={handleGenerateCode}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Code"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
