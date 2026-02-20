"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoreHistory } from "@/hooks/useScoreHistory";

interface ScoreHistoryChartProps {
  type: "wallet" | "token";
  subject: string | null;
  label: string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label: dateLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-sm">
      <p className="font-medium">{dateLabel}</p>
      <p>Score: {payload[0].value}</p>
    </div>
  );
}

export default function ScoreHistoryChart({
  type,
  subject,
  label,
  color = "#059669",
}: ScoreHistoryChartProps) {
  const { data, loading } = useScoreHistory({ type, subject });

  if (!subject) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score History</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score History</CardTitle>
          <CardDescription>
            No historical data yet. History will build as{" "}
            {label.toLowerCase()} is tracked over time.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score History</CardTitle>
        <CardDescription>
          {label} over the last 30 days.
          {data.length === 1 &&
            " Tracking just started — more data points will appear over time."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2}
              dot={data.length === 1}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
