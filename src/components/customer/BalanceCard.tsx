import type { CustomerRecord } from "@/types/cafeteria";

interface BalanceCardProps {
  customer: CustomerRecord;
}

export function BalanceCard({ customer }: BalanceCardProps) {
  return (
    <div className="relative w-full">
      {/* Shadow card with faded yellow color */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 opacity-50 transform rotate-2 translate-y-2 translate-x-2"
        style={{ zIndex: 0 }}
      />

      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ transform: "rotate(-2deg)", zIndex: 10 }}
      >
        <div className="bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 p-6 text-white relative">
          {/* Shiny gloss overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, transparent 60%, rgba(255,255,255,0.1) 100%)",
            }}
          />
          <div
            className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="absolute top-2 right-4 text-[9px] font-semibold uppercase tracking-widest opacity-70">
                New Era
              </span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest opacity-80">
              Debit Card
            </span>

            <p className="text-3xl font-extrabold tracking-tight mt-6 mb-4">
              ₦
              {customer.balance.toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-sm font-semibold">
              {customer.firstName} {customer.lastName}
            </p>
          </div>

          {/* Reduced size shiny electronic card effect */}
          <div
            className="absolute bottom-6 right-6 w-14 h-10 rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 40%, transparent 100%)",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
