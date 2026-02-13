import { mutation, query } from "./_generated/server";

export const findDuplicateOrders = query({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    // Sort by createdAt so we process in chronological order
    allOrders.sort((a, b) => a.createdAt - b.createdAt);
    
    // Group orders that match on total + cashierCode + items count
    // AND are within 60 seconds of each other (likely duplicates from sync bug)
    const TIME_WINDOW = 60_000; // 60 seconds
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
        
        // Match: same total, same cashierCode, same item count, within time window
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

export const removeDuplicateOrders = mutation({
  args: {},
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("orders").collect();
    
    // Sort chronologically
    allOrders.sort((a, b) => a.createdAt - b.createdAt);
    
    const TIME_WINDOW = 60_000; // 60 seconds
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
        // Keep the oldest (_creationTime), delete the rest
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
      message: `Removed ${deletedCount} duplicate orders`,
    };
  },
});
