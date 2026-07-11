import { formatIDR } from '../../lib/utils';

export default function CashFlowChart({ data, cashFlowMode, maxFlowValue, periodType, showBalances }) {
  return (
    <div className="overflow-x-auto pb-4 scrollbar-thin">
      <div className="min-w-[600px] flex-none flex items-end justify-between gap-1 px-1 h-[200px] mt-2 border-b border-slate-100 pb-0 relative">
        <div className="absolute left-0 bottom-0 w-full border-t border-dashed border-slate-200 z-0"></div>

        {data.map((item, i) => {
          const value = cashFlowMode === 'income' ? item.income : item.expense;
          const validMax = maxFlowValue > 0 ? maxFlowValue : 1;
          const heightPercent = (value / validMax) * 100;
          const visualHeight = Math.max(heightPercent, 4);

          return (
            <div key={i} className="flex-1 max-w-[64px] h-full flex flex-col justify-end relative z-10 group cursor-pointer px-1">
              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                <span className="block text-[10px] text-slate-400 font-normal mb-0.5">
                  {item.label} {periodType !== 'tahun' && item.year}
                </span>
                {showBalances ? formatIDR(value) : 'Rp •••••••••'}
              </div>

              <div
                className={`w-full rounded-t-lg transition-all duration-700 ease-out ${
                  cashFlowMode === 'income' ? 'bg-emerald-100 group-hover:bg-emerald-500' : 'bg-red-100 group-hover:bg-red-500'
                }`}
                style={{ height: `${visualHeight}%` }}
              ></div>
            </div>
          );
        })}
      </div>

      <div className="min-w-[600px] flex justify-between px-1 mt-2 text-[10px] sm:text-xs font-bold text-slate-400">
        {data.map((item, i) => (
          <span key={i} className="flex-1 max-w-[64px] text-center truncate px-1">{item.label}</span>
        ))}
      </div>
    </div>
  );
}