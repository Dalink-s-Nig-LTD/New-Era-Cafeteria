import { describe, it, expect } from "vitest";
import type { ConvexOrderItem, ReportOrder, CustomCartItem, CartItem } from "@/types/cafeteria";

describe("CartContext type refactoring", () => {
  it("ConvexOrderItem has correct shape", () => {
    const item: ConvexOrderItem = {
      name: "Rice",
      price: 500,
      quantity: 2,
      category: "Food",
      isCustom: false,
    };
    expect(item.name).toBe("Rice");
    expect(item.price).toBe(500);
  });

  it("ConvexOrderItem allows optional menuItemId", () => {
    const item: ConvexOrderItem = {
      name: "Custom Drink",
      price: 300,
      quantity: 1,
      isCustom: true,
    };
    expect(item.menuItemId).toBeUndefined();
    expect(item.isCustom).toBe(true);
  });

  it("ReportOrder has correct shape", () => {
    const order: ReportOrder = {
      id: "ORD-123",
      items: [
        { id: "1", name: "Rice", price: 500, quantity: 1, category: "Food", isCustom: false },
      ],
      total: 500,
      timestamp: new Date(),
      paymentMethod: "cash",
      status: "completed",
      cashierCode: "C001",
    };
    expect(order.items[0].isCustom).toBe(false);
    expect(order.cashierCode).toBe("C001");
  });

  it("CustomCartItem extends CartItem with isCustom", () => {
    const item: CustomCartItem = {
      id: "custom-1",
      name: "Special",
      price: 1000,
      quantity: 1,
      category: "Food",
      available: true,
      isCustom: true,
    };
    expect(item.isCustom).toBe(true);
  });
});
