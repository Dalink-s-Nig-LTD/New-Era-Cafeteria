import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UtensilsCrossed } from "lucide-react";
import { api, useQuery } from "@/lib/convexApi";
import { useCart } from "@/contexts/CartContext";
import { MenuItem } from "@/types/cafeteria";
import { QuantityPrompt } from "./QuantityPrompt";

export function MenuGrid() {
  const [selectedMenuType, setSelectedMenuType] = useState<
    "food" | "drinks" | "special"
  >("food");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { addItem } = useCart();
  const items = useQuery(api.menuItems.getAllMenuItems);
  const categories = useQuery(api.menuItems.getCategories);

  // Map categories to menu types
  const foodCategories = ["Rice", "Protein", "Swallow", "Soup", "Snacks"];
  const drinkCategories = ["Drinks"];
  const specialCategories = ["Special Orders"];

  // Filter items by menu type (food or drinks or special)
  const itemsByType =
    items?.filter((item) => {
      if (selectedMenuType === "food") {
        return foodCategories.includes(item.category);
      } else if (selectedMenuType === "drinks") {
        return drinkCategories.includes(item.category);
      } else {
        return specialCategories.includes(item.category);
      }
    }) || [];

  // Further filter by selected category
  const filteredItems =
    selectedCategory === "All"
      ? itemsByType
      : itemsByType.filter((item) => item.category === selectedCategory);

  // Get categories for the selected menu type
  const relevantCategories =
    categories?.filter((cat) => {
      if (cat === "All") return true;
      if (selectedMenuType === "food") {
        return foodCategories.includes(cat);
      } else if (selectedMenuType === "drinks") {
        return drinkCategories.includes(cat);
      } else {
        return specialCategories.includes(cat);
      }
    }) || [];

  const [pendingSpecialItem, setPendingSpecialItem] = useState<MenuItem | null>(null);

  const handleAddItem = (item: MenuItem) => {
    if (!item.available) return;
    // If it's a special order item, show quantity prompt
    if (item.category === "Special Orders") {
      setPendingSpecialItem(item);
      return;
    }
    addItem(item);
  };

  const handleQuantityConfirm = (item: MenuItem, qty: number) => {
    addItem(item, qty);
  };

  if (!items || !categories) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <span className="text-muted-foreground">Loading menu...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Menu Type Switch */}
      <div className="flex gap-2 mb-2">
        <Button
          variant={selectedMenuType === "food" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectedMenuType("food");
            setSelectedCategory("All");
          }}
        >
          Food Menu
        </Button>
        <Button
          variant={selectedMenuType === "drinks" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectedMenuType("drinks");
            setSelectedCategory("All");
          }}
        >
          Drinks Menu
        </Button>
        <Button
          variant={selectedMenuType === "special" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectedMenuType("special");
            setSelectedCategory("All");
          }}
        >
          Special Orders
        </Button>
      </div>
      {/* Category Filter */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {relevantCategories.map((category: string) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={`
              rounded-full font-medium shrink-0 min-h-[44px] px-4
              ${
                selectedCategory === category
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card hover:bg-secondary border-border"
              }
            `}
          >
            {category}
          </Button>
        ))}
      </div>
      {/* Menu Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 overflow-y-auto pb-4 scrollbar-hide">
        {filteredItems.map((item) => (
          <Card
            key={item._id}
            onClick={() =>
              handleAddItem({
                id: String(item._id),
                name: item.name,
                price: item.price,
                category: item.category,
                image: item.image,
                available: item.available,
              })
            }
            className={`
              group relative overflow-hidden cursor-pointer transition-all duration-200
              border border-border hover:border-primary/30
              ${
                item.available
                  ? "hover:shadow-card hover:-translate-y-1 active:scale-95"
                  : "opacity-50 cursor-not-allowed"
              }
            `}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center mb-2 sm:mb-3">
                <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              </div>

              <h3 className="font-semibold text-xs sm:text-sm text-foreground mb-1 line-clamp-2">
                {item.name}
              </h3>

              <div className="flex items-center justify-between">
                <span className="text-primary font-bold text-sm sm:text-base">
                  ₦{item.price.toLocaleString()}
                </span>

                {!item.available && (
                  <Badge variant="secondary" className="text-xs">
                    Out
                  </Badge>
                )}
              </div>

              {item.available && (
                <div className="absolute bottom-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                  <Plus className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <QuantityPrompt
        item={pendingSpecialItem}
        isOpen={!!pendingSpecialItem}
        onClose={() => setPendingSpecialItem(null)}
        onConfirm={handleQuantityConfirm}
      />
    </div>
  );
}
