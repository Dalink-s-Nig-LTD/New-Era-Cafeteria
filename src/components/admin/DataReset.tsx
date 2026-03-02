import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Trash2, AlertTriangle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DataReset() {
  const { toast } = useToast();
  const [isResettingOrders, setIsResettingOrders] = useState(false);
  const [isResettingCodes, setIsResettingCodes] = useState(false);

  const resetOrders = useMutation(api.orders.resetAllOrders);
  const resetAccessCodes = useMutation(api.accessCodes.resetAllAccessCodes);

  const handleResetOrders = async () => {
    setIsResettingOrders(true);
    try {
      const result = await resetOrders();
      toast({
        title: "Orders Reset Successfully",
        description: `Deleted ${result.deletedCount} order(s) from the system.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset orders. Please try again.",
        variant: "destructive",
      });
      console.error("Reset orders error:", error);
    } finally {
      setIsResettingOrders(false);
    }
  };

  const handleResetAccessCodes = async () => {
    setIsResettingCodes(true);
    try {
      const result = await resetAccessCodes();
      toast({
        title: "Access Codes Reset Successfully",
        description: `Deleted ${result.deletedCodes} access code(s) and ${result.deletedSessions} session(s) from the system.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset access codes. Please try again.",
        variant: "destructive",
      });
      console.error("Reset access codes error:", error);
    } finally {
      setIsResettingCodes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Data Management
        </h2>
        <p className="text-muted-foreground">
          Reset system data. These actions are irreversible and should be used
          with caution.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> These actions permanently delete data from
          the system and cannot be undone. Only use these functions when
          necessary (e.g., system maintenance, testing, or end of period
          cleanup).
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Reset Orders Card */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-destructive" />
              <CardTitle className="text-lg">Reset All Orders</CardTitle>
            </div>
            <CardDescription>
              Permanently delete all orders from the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">This will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Delete all order records</li>
                  <li>Clear sales history</li>
                  <li>Reset revenue statistics</li>
                  <li>Remove order data from reports</li>
                </ul>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={isResettingOrders}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isResettingOrders ? "Resetting..." : "Reset All Orders"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This action cannot be undone. This will permanently
                        delete
                        <strong> all orders</strong> from the database.
                      </p>
                      <p className="text-destructive font-semibold">
                        All sales history, revenue data, and order records will
                        be lost forever.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetOrders}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, Delete All Orders
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Reset Access Codes Card */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-destructive" />
              <CardTitle className="text-lg">Reset All Access Codes</CardTitle>
            </div>
            <CardDescription>
              Permanently delete all access codes and sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">This will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Delete all access codes</li>
                  <li>Remove all active sessions</li>
                  <li>Log out all cashiers</li>
                  <li>Require new code generation</li>
                </ul>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={isResettingCodes}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isResettingCodes
                      ? "Resetting..."
                      : "Reset All Access Codes"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        This action cannot be undone. This will permanently
                        delete
                        <strong>
                          {" "}
                          all access codes and active sessions
                        </strong>{" "}
                        from the database.
                      </p>
                      <p className="text-destructive font-semibold">
                        All cashiers will be logged out and new access codes
                        will need to be generated.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetAccessCodes}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, Delete All Access Codes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                Export reports before resetting orders to preserve historical
                data
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                Notify all staff before resetting access codes as they will need
                new codes
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                Consider resetting data during off-hours to minimize disruption
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>
                Use these functions periodically for system maintenance (e.g.,
                start of new semester)
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
