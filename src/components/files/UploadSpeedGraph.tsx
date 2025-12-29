import { useMemo } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { formatSpeed, type SpeedDataPoint } from "@/lib/fileService";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface UploadSpeedGraphProps {
  speedHistory: SpeedDataPoint[];
  currentSpeed: number;
}

const UploadSpeedGraph = ({ speedHistory, currentSpeed }: UploadSpeedGraphProps) => {
  // Prepare chart data with relative timestamps
  const chartData = useMemo(() => {
    if (speedHistory.length === 0) return [];
    
    const startTime = speedHistory[0].timestamp;
    return speedHistory.map((point, index) => ({
      time: (point.timestamp - startTime) / 1000, // seconds from start
      speed: point.speed / (1024 * 1024), // Convert to MB/s for display
      index,
    }));
  }, [speedHistory]);

  // Calculate speed trend
  const trend = useMemo(() => {
    if (speedHistory.length < 5) return 'stable';
    
    const recentSamples = speedHistory.slice(-5);
    const olderSamples = speedHistory.slice(-10, -5);
    
    if (olderSamples.length === 0) return 'stable';
    
    const recentAvg = recentSamples.reduce((a, b) => a + b.speed, 0) / recentSamples.length;
    const olderAvg = olderSamples.reduce((a, b) => a + b.speed, 0) / olderSamples.length;
    
    const diff = (recentAvg - olderAvg) / olderAvg;
    
    if (diff > 0.15) return 'up';
    if (diff < -0.15) return 'down';
    return 'stable';
  }, [speedHistory]);

  // Get min/max for display
  const stats = useMemo(() => {
    if (speedHistory.length === 0) return { min: 0, max: 0, avg: 0 };
    
    const speeds = speedHistory.map(p => p.speed);
    return {
      min: Math.min(...speeds),
      max: Math.max(...speeds),
      avg: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    };
  }, [speedHistory]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-white/40';

  if (speedHistory.length < 3) {
    return (
      <div className="flex items-center justify-center h-12 text-xs text-white/30">
        <Activity className="w-3 h-3 mr-2 animate-pulse" />
        Collecting speed data...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2"
    >
      {/* Speed Stats Row */}
      <div className="flex items-center justify-between text-[10px] text-white/50 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" />
            Min: {formatSpeed(stats.min)}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Avg: {formatSpeed(stats.avg)}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Max: {formatSpeed(stats.max)}
          </span>
        </div>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="capitalize">{trend}</span>
        </div>
      </div>

      {/* Mini Graph */}
      <div className="relative h-16 rounded-lg bg-white/[0.02] border border-white/[0.05] overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
        
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={chartData} 
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.4} />
                <stop offset="50%" stopColor="hsl(var(--gold))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="speedStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={1} />
              </linearGradient>
            </defs>
            <YAxis 
              hide 
              domain={['dataMin - 0.1', 'dataMax + 0.1']} 
            />
            <Area
              type="monotone"
              dataKey="speed"
              stroke="url(#speedStroke)"
              strokeWidth={1.5}
              fill="url(#speedGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Current speed overlay */}
        <motion.div
          key={currentSpeed}
          initial={{ scale: 1.1, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-1 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10"
        >
          <Activity className="w-3 h-3 text-gold" />
          <span className="text-xs font-medium text-white tabular-nums">
            {formatSpeed(currentSpeed)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default UploadSpeedGraph;