import React, { useState } from "react";
import { useQuery, useMutation } from "@/lib/convexApi";
import { api } from "@/lib/convexApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Wallet,
  Printer,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  Eye,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CustomerRecord } from "@/types/cafeteria";
import { CustomerIDCard } from "./CustomerIDCard";
import { FundTopUp } from "./FundTopUp";

export function CustomerManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);
  const [idCardDialogOpen, setIdCardDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRecord | null>(null);

  // Form state
  const [form, setForm] = useState({
    customerId: "",
    firstName: "",
    lastName: "",
    department: "",
    classLevel: "",
    photo: "",
    expiryDate: "",
  });

  const customers = useQuery(api.customers.getAllCustomers, {
    search: search || undefined,
  });
  const transactions = useQuery(
    api.customerFunds.getTransactionHistory,
    selectedCustomer ? { customerId: selectedCustomer._id } : "skip",
  );
  const createCustomer = useMutation(api.customers.createCustomer);
  const updateCustomer = useMutation(api.customers.updateCustomer);
  const toggleActive = useMutation(api.customers.toggleCustomerActive);
  const deleteCustomer = useMutation(api.customers.deleteCustomer);

  const resetForm = () => {
    setForm({
      customerId: "",
      firstName: "",
      lastName: "",
      department: "",
      classLevel: "",
      photo: "",
      expiryDate: "",
    });
  };

  const handleCreate = async () => {
    try {
      await createCustomer({
        customerId: form.customerId,
        firstName: form.firstName,
        lastName: form.lastName,
        department: form.department,
        classLevel: form.classLevel,
        photo: form.photo || undefined,
        expiryDate: form.expiryDate
          ? new Date(form.expiryDate).getTime()
          : undefined,
      });
      toast({ title: "Customer created successfully" });
      setAddDialogOpen(false);
      resetForm();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!selectedCustomer) return;
    try {
      await updateCustomer({
        id: selectedCustomer._id,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        department: form.department || undefined,
        classLevel: form.classLevel || undefined,
        photo: form.photo || undefined,
        expiryDate: form.expiryDate
          ? new Date(form.expiryDate).getTime()
          : undefined,
      });
      toast({ title: "Customer updated successfully" });
      setEditDialogOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: Id<"customers">) => {
    try {
      const result = await toggleActive({ id });
      toast({
        title: result.isActive ? "Customer activated" : "Customer deactivated",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: Id<"customers">) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteCustomer({ id });
      toast({ title: "Customer deleted" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEdit = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setForm({
      customerId: cust.customerId,
      firstName: cust.firstName,
      lastName: cust.lastName,
      department: cust.department,
      classLevel: cust.classLevel,
      photo: cust.photo || "",
      expiryDate: cust.expiryDate
        ? new Date(cust.expiryDate).toISOString().split("T")[0]
        : "",
    });
    setEditDialogOpen(true);
  };

  const openView = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setViewDialogOpen(true);
  };

  const openFund = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setFundDialogOpen(true);
  };

  const openIdCard = (cust: CustomerRecord) => {
    setSelectedCustomer(cust);
    setIdCardDialogOpen(true);
  };

  const formFields = (
    <div className="grid gap-4 py-4">
      <Input
        placeholder="Customer ID (e.g. RUN/2024/001)"
        value={form.customerId}
        onChange={(e) => setForm({ ...form, customerId: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="First Name"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
        <Input
          placeholder="Last Name"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
      </div>
      <Input
        placeholder="Department"
        value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      />
      <Input
        placeholder="Class Level (e.g. 100 Level)"
        value={form.classLevel}
        onChange={(e) => setForm({ ...form, classLevel: e.target.value })}
      />
      <Input
        placeholder="Photo URL (optional)"
        value={form.photo}
        onChange={(e) => setForm({ ...form, photo: e.target.value })}
      />
      <Input
        type="date"
        placeholder="Expiry Date"
        value={form.expiryDate}
        onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">
          Customer Management
        </h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="w-4 h-4" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Register New Customer</DialogTitle>
            </DialogHeader>
            {formFields}
            <DialogFooter>
              <Button onClick={handleCreate}>Create Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold text-foreground">
              {customers?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-primary">
              {customers?.filter((s) => s.isActive).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Balance</p>
            <p className="text-2xl font-bold text-foreground">
              ₦
              {(
                customers?.reduce((s, c) => s + c.balance, 0) || 0
              ).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-destructive">
              {customers?.filter((s) => !s.isActive).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.map((cust) => (
                  <TableRow key={cust._id}>
                    <TableCell className="font-mono text-sm">
                      {cust.customerId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {cust.firstName} {cust.lastName}
                    </TableCell>
                    <TableCell>{cust.department}</TableCell>
                    <TableCell>{cust.classLevel}</TableCell>
                    <TableCell className="font-bold">
                      ₦{cust.balance.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cust.isActive ? "default" : "destructive"}
                      >
                        {cust.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {cust.barcodeData}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openView(cust as CustomerRecord)}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(cust as CustomerRecord)}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openFund(cust as CustomerRecord)}
                          title="Add Funds"
                        >
                          <Wallet className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openIdCard(cust as CustomerRecord)}
                          title="Print ID"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(cust._id)}
                          title="Toggle Active"
                        >
                          {cust.isActive ? (
                            <ToggleRight className="w-4 h-4 text-primary" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cust._id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {customers?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No customers found. Click "Add Customer" to register one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">ID:</span>{" "}
                  {selectedCustomer.customerId}
                </div>
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  {selectedCustomer.department}
                </div>
                <div>
                  <span className="text-muted-foreground">Level:</span>{" "}
                  {selectedCustomer.classLevel}
                </div>
                <div>
                  <span className="text-muted-foreground">Barcode:</span>{" "}
                  <span className="font-mono">
                    {selectedCustomer.barcodeData}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Balance:</span>{" "}
                  <span className="font-bold">
                    ₦{selectedCustomer.balance.toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">
                  Recent Transactions
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {transactions?.map((tx) => (
                    <div
                      key={tx._id}
                      className="flex justify-between text-sm p-2 rounded bg-muted/50"
                    >
                      <div>
                        <span
                          className={
                            tx.type === "credit"
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {tx.type === "credit" ? "+" : "-"}₦
                          {tx.amount.toLocaleString()}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {tx.description}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {(!transactions || transactions.length === 0) && (
                    <p className="text-muted-foreground text-sm">
                      No transactions yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fund Top-Up Dialog */}
      {selectedCustomer && (
        <FundTopUp
          customer={selectedCustomer}
          open={fundDialogOpen}
          onOpenChange={setFundDialogOpen}
        />
      )}

      {/* ID Card Dialog */}
      {selectedCustomer && (
        <Dialog open={idCardDialogOpen} onOpenChange={setIdCardDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Customer ID Card</DialogTitle>
            </DialogHeader>
            <CustomerIDCard student={selectedCustomer} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
