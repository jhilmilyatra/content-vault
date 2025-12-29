import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Clock } from "lucide-react";
import { useMemo } from "react";

interface ChunkStatusGridProps {
  totalChunks: number;
  uploadedChunks: number[];
  currentChunk?: number;
}

const ChunkStatusGrid = ({ totalChunks, uploadedChunks, currentChunk }: ChunkStatusGridProps) => {
  const uploadedSet = useMemo(() => new Set(uploadedChunks), [uploadedChunks]);
  
  // Group chunks for compact visualization
  const gridSize = Math.min(totalChunks, 50); // Show max 50 cells, group if more
  const groupSize = totalChunks > 50 ? Math.ceil(totalChunks / 50) : 1;
  
  const cells = useMemo(() => {
    const result = [];
    for (let i = 0; i < gridSize; i++) {
      const startChunk = i * groupSize;
      const endChunk = Math.min((i + 1) * groupSize, totalChunks);
      
      // Check how many chunks in this group are uploaded
      let uploadedInGroup = 0;
      let isCurrentGroup = false;
      
      for (let j = startChunk; j < endChunk; j++) {
        if (uploadedSet.has(j)) uploadedInGroup++;
        if (currentChunk !== undefined && j === currentChunk) isCurrentGroup = true;
      }
      
      const groupTotal = endChunk - startChunk;
      const progress = uploadedInGroup / groupTotal;
      
      result.push({
        index: i,
        startChunk,
        endChunk,
        progress,
        isComplete: progress === 1,
        isPartial: progress > 0 && progress < 1,
        isPending: progress === 0,
        isCurrent: isCurrentGroup,
      });
    }
    return result;
  }, [gridSize, groupSize, totalChunks, uploadedSet, currentChunk]);

  const completedCount = uploadedChunks.length;
  const progressPercent = Math.round((completedCount / totalChunks) * 100);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/60">Chunk Status</span>
          <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
            {completedCount}/{totalChunks}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
            Uploaded
          </span>
          <span className="flex items-center gap-1 text-gold">
            <span className="w-2 h-2 rounded-sm bg-gold animate-pulse" />
            Active
          </span>
          <span className="flex items-center gap-1 text-white/30">
            <span className="w-2 h-2 rounded-sm bg-white/10" />
            Pending
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="relative">
        <div 
          className="grid gap-0.5"
          style={{ 
            gridTemplateColumns: `repeat(${Math.min(25, gridSize)}, 1fr)`,
          }}
        >
          {cells.map((cell) => (
            <motion.div
              key={cell.index}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
              }}
              transition={{ 
                delay: cell.index * 0.005,
                duration: 0.2,
              }}
              className={`
                relative aspect-square rounded-[2px] transition-all duration-300
                ${cell.isComplete 
                  ? 'bg-emerald-400' 
                  : cell.isPartial
                    ? 'bg-gradient-to-t from-emerald-400/60 to-white/10'
                    : cell.isCurrent
                      ? 'bg-gold'
                      : 'bg-white/10'
                }
                ${cell.isCurrent && !cell.isComplete ? 'ring-1 ring-gold ring-offset-1 ring-offset-black' : ''}
              `}
              title={groupSize > 1 
                ? `Chunks ${cell.startChunk + 1}-${cell.endChunk}: ${Math.round(cell.progress * 100)}%` 
                : `Chunk ${cell.startChunk + 1}: ${cell.isComplete ? 'Uploaded' : cell.isCurrent ? 'Uploading' : 'Pending'}`
              }
            >
              {/* Pulse animation for current chunk */}
              {cell.isCurrent && !cell.isComplete && (
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute inset-0 rounded-[2px] bg-gold"
                />
              )}
            </motion.div>
          ))}
        </div>
        
        {/* Progress overlay text */}
        {totalChunks > 50 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">
              <span className="text-sm font-bold text-white tabular-nums">
                {progressPercent}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>{completedCount} complete</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{totalChunks - completedCount} pending</span>
        </div>
      </div>
    </div>
  );
};

export default ChunkStatusGrid;
