import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { menuItems } from "@/data/menuItems";

const foodImages = [
  {
    name: "Pounded Yam",
    category: "Swallow",
    image:
      "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800&q=80",
    price: 800,
  },
  {
    name: "Grilled Chicken",
    category: "Protein",
    image:
      "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80",
    price: 1200,
  },
  {
    name: "Fried Rice",
    category: "Rice",
    image:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80",
    price: 900,
  },
  {
    name: "Pasta",
    category: "Snacks",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80",
    price: 400,
  },
  {
    name: "Fresh Drinks",
    category: "Drinks",
    image:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80",
    price: 500,
  },
];

export function FoodSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % foodImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const goToPrevious = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + foodImages.length) % foodImages.length,
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % foodImages.length);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="overflow-hidden rounded-2xl shadow-xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {foodImages.map((food, index) => (
            <div key={index} className="min-w-full relative">
              <div className="aspect-[16/9] relative overflow-hidden">
                <img
                  src={food.image}
                  alt={food.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <Badge className="mb-2 bg-accent text-accent-foreground">
                    {food.category}
                  </Badge>
                  <h3 className="font-display text-2xl md:text-3xl font-bold mb-1">
                    {food.name}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <Button
        variant="outline"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={goToPrevious}
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={goToNext}
      >
        <ChevronRight className="w-5 h-5" />
      </Button>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {foodImages.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
