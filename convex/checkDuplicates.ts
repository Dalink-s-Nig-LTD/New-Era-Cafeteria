import { mutation, query } from "./_generated/server";

// Strict duplicate detection: groups orders by identical clientOrderId
// This is deterministic and safe — only true duplicates from retry/sync bugs
export const findStrictDuplicates = query({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    // Group by clientOrderId
    const byClientId = new Map<string, typeof allOrders>();
    for (const order of allOrders) {
      const key = order.clientOrderId;
      if (!key) continue; // skip orders without clientOrderId
      if (!byClientId.has(key)) byClientId.set(key, []);
      byClientId.get(key)!.push(order);
    }
    
    const duplicates = Array.from(byClientId.entries())
      .filter(([, group]) => group.length > 1)
      .map(([clientOrderId, group]) => ({
        clientOrderId,
        count: group.length,
        orders: group.map(o => ({
          _id: o._id,
          createdAt: o.createdAt,
          total: o.total,
          cashierCode: o.cashierCode,
          _creationTime: o._creationTime,
        })),
      }));
    
    return {
      totalOrders: allOrders.length,
      strictDuplicateGroups: duplicates.length,
      duplicates,
    };
  },
});

// Heuristic duplicate detection: for manual review only (NOT auto-delete)
// Groups orders with same total + cashierCode + item count within 60s window
export const findDuplicateOrders = query({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    allOrders.sort((a, b) => a.createdAt - b.createdAt);
    
    const TIME_WINDOW = 60_000;
    const duplicates: { key: string; count: number; orders: any[] }[] = [];
    const visited = new Set<string>();
    
    for (let i = 0; i < allOrders.length; i++) {
      if (visited.has(allOrders[i]._id)) continue;
      const group = [allOrders[i]];
      visited.add(allOrders[i]._id);
      
      for (let j = i + 1; j < allOrders.length; j++) {
        if (visited.has(allOrders[j]._id)) continue;
        const a = allOrders[i];
        const b = allOrders[j];
        
        if (
          a.total === b.total &&
          a.cashierCode === b.cashierCode &&
          a.items.length === b.items.length &&
          Math.abs(a.createdAt - b.createdAt) <= TIME_WINDOW
        ) {
          group.push(b);
          visited.add(b._id);
        }
      }
      
      if (group.length > 1) {
        duplicates.push({
          key: `${allOrders[i].total}-${allOrders[i].cashierCode}`,
          count: group.length,
          orders: group.map(o => ({
            _id: o._id,
            createdAt: o.createdAt,
            total: o.total,
            cashierCode: o.cashierCode,
            clientOrderId: o.clientOrderId,
            items: o.items.length,
          })),
        });
      }
    }
    
    return {
      totalOrders: allOrders.length,
      duplicateGroups: duplicates.length,
      duplicates,
    };
  },
});

// Safe removal: only removes strict duplicates (same clientOrderId), keeps oldest
export const removeStrictDuplicates = mutation({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    const byClientId = new Map<string, typeof allOrders>();
    for (const order of allOrders) {
      const key = order.clientOrderId;
      if (!key) continue;
      if (!byClientId.has(key)) byClientId.set(key, []);
      byClientId.get(key)!.push(order);
    }
    
    let deletedCount = 0;
    for (const [, group] of byClientId) {
      if (group.length <= 1) continue;
      // Keep the oldest by _creationTime, delete the rest
      group.sort((a, b) => a._creationTime - b._creationTime);
      for (let i = 1; i < group.length; i++) {
        await ctx.db.delete(group[i]._id);
        deletedCount++;
      }
    }
    
    return {
      success: true,
      duplicatesRemoved: deletedCount,
      message: `Removed ${deletedCount} strict duplicate orders (by clientOrderId)`,
    };
  },
});

// Legacy heuristic removal — kept for backward compat but NOT recommended
export const removeDuplicateOrders = mutation({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    allOrders.sort((a, b) => a.createdAt - b.createdAt);
    
    const TIME_WINDOW = 60_000;
    const visited = new Set<string>();
    let deletedCount = 0;
    
    for (let i = 0; i < allOrders.length; i++) {
      if (visited.has(allOrders[i]._id)) continue;
      const group = [allOrders[i]];
      visited.add(allOrders[i]._id);
      
      for (let j = i + 1; j < allOrders.length; j++) {
        if (visited.has(allOrders[j]._id)) continue;
        const a = allOrders[i];
        const b = allOrders[j];
        
        if (
          a.total === b.total &&
          a.cashierCode === b.cashierCode &&
          a.items.length === b.items.length &&
          Math.abs(a.createdAt - b.createdAt) <= TIME_WINDOW
        ) {
          group.push(b);
          visited.add(b._id);
        }
      }
      
      if (group.length > 1) {
        group.sort((a, b) => a._creationTime - b._creationTime);
        for (let k = 1; k < group.length; k++) {
          await ctx.db.delete(group[k]._id);
          deletedCount++;
        }
      }
    }
    
    return {
      success: true,
      duplicatesRemoved: deletedCount,
      message: `Removed ${deletedCount} duplicate orders (heuristic)`,
    };
  },
});
