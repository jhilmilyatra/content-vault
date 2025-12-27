import { Check, CheckCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

interface ReadReceiptProps {
  isRead: boolean;
  readAt?: string | null;
  isSent?: boolean;
  size?: "sm" | "md";
}

const ReadReceipt = ({ isRead, readAt, isSent = true, size = "sm" }: ReadReceiptProps) => {
  if (!isSent) return null;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center ml-1">
          {isRead ? (
            <CheckCheck className={`${iconSize} text-blue-400`} />
          ) : (
            <Check className={`${iconSize} opacity-60`} />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {isRead ? (
          readAt ? (
            <span>Read {format(new Date(readAt), "MMM d, h:mm a")}</span>
          ) : (
            <span>Read</span>
          )
        ) : (
          <span>Delivered</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default ReadReceipt;
