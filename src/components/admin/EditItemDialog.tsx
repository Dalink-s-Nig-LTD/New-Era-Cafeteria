import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MenuItem } from '@/types/cafeteria';
import { categories } from '@/data/menuItems';

interface EditItemDialogProps {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: MenuItem) => void;
}

export function EditItemDialog({ item, open, onOpenChange, onSave }: EditItemDialogProps) {
  const [editData, setEditData] = useState({
    name: '',
    price: '',
    category: '',
  });

  useEffect(() => {
    if (item) {
      setEditData({
        name: item.name,
        price: item.price.toString(),
        category: item.category,
      });
    }
  }, [item]);

  const handleSave = () => {
    if (!item || !editData.name || !editData.price || !editData.category) return;

    onSave({
      ...item,
      name: editData.name,
      price: parseInt(editData.price),
      category: editData.category,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Menu Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Item Name</Label>
            <Input
              placeholder="e.g., Jollof Rice"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Price (₦)</Label>
            <Input
              type="number"
              placeholder="e.g., 800"
              value={editData.price}
              onChange={(e) => setEditData({ ...editData, price: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={editData.category}
              onValueChange={(value) => setEditData({ ...editData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c !== 'All').map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
