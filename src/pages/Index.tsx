import React from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { Landing } from "./Landing";
import { CashierDashboard } from "./CashierDashboard";
import { AdminDashboard } from "./AdminDashboard";

function AppContent() {
  const { role, userName, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  if (!role) {
    return <Landing onLogin={() => {}} />;
  }

  // Cashier must enter name before accessing dashboard
  if (role === "cashier" && !userName) {
    return <Landing onLogin={() => {}} />;
  }

  // Cashier dashboard for cashier role
  if (role === "cashier") {
    return (
      <CartProvider>
        <CashierDashboard onLogout={handleLogout} />
      </CartProvider>
    );
  }

  // Admin dashboard for admin roles (superadmin, manager, vc, supervisor)
  if (
    role === "superadmin" ||
    role === "manager" ||
    role === "vc" ||
    role === "supervisor"
  ) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  // Fallback to landing if role is unrecognized
  return <Landing onLogin={() => {}} />;
}

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
