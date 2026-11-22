"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { formatMarks } from "@/lib/utils";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 10;
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  let step;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function truncateLabel(value, length = 12) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function Legend({ series }) {
  if (series.length <= 1 && series[0]?.name === "Value") return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {series.map((entry, index) => (
        <span key={entry.name} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
          />
          {entry.name}
        </span>
      ))}
    </div>
  );
}

function BarChart({ block }) {
  const width = 640;
  const height = 320;
  const padding = { top: 18, right: 18, bottom: 56, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...block.series.flatMap((series) => series.values.map((value) => Number(value) || 0)),
    1
  );
  const max = block.yMax || niceMax(maxValue);
  const groupWidth = plotWidth / Math.max(block.categories.length, 1);
  const barWidth = Math.max(
    4,
    Math.min(34, (groupWidth - 14) / Math.max(block.series.length, 1))
  );
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="presentation"
        aria-hidden="true"
      >
        {gridLines.map((fraction) => {
          const y = padding.top + plotHeight - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={fraction === 0 ? undefined : "3 4"}
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {formatMarks(max * fraction)}
              </text>
            </g>
          );
        })}

        {block.categories.map((category, categoryIndex) => {
          const groupCenter = padding.left + groupWidth * categoryIndex + groupWidth / 2;
          const groupStart =
            groupCenter -
            (barWidth * block.series.length + 4 * (block.series.length - 1)) / 2;
          return (
            <g key={`${category}-${categoryIndex}`}>
              {block.series.map((series, seriesIndex) => {
                const value = Number(series.values[categoryIndex]) || 0;
                const barHeight = Math.max(0, (value / max) * plotHeight);
                const x = groupStart + seriesIndex * (barWidth + 4);
                const y = padding.top + plotHeight - barHeight;
                return (
                  <g key={series.name}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                    >
                      <title>{`${category} · ${series.name}: ${value}${block.unit ? ` ${block.unit}` : ""}`}</title>
                    </rect>
                    {barHeight > 18 && block.series.length <= 2 && (
                      <text
                        x={x + barWidth / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize={9}
                        fill="var(--muted-foreground)"
                      >
                        {formatMarks(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={groupCenter}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {truncateLabel(category)}
                <title>{category}</title>
              </text>
            </g>
          );
        })}

        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={padding.top + plotHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {block.unit && (
          <text
            x={12}
            y={padding.top + plotHeight / 2}
            fontSize={10}
            fill="var(--muted-foreground)"
            transform={`rotate(-90 12 ${padding.top + plotHeight / 2})`}
            textAnchor="middle"
          >
            {block.unit}
          </text>
        )}
      </svg>
      <Legend series={block.series} />
    </div>
  );
}

function LineChart({ block }) {
  const width = 640;
  const height = 320;
  const padding = { top: 18, right: 18, bottom: 56, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...block.series.flatMap((series) => series.values.map((value) => Number(value) || 0)),
    1
  );
  const max = block.yMax || niceMax(maxValue);
  const stepX =
    block.categories.length > 1 ? plotWidth / (block.categories.length - 1) : plotWidth;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  function point(categoryIndex, value) {
    const x =
      block.categories.length > 1
        ? padding.left + stepX * categoryIndex
        : padding.left + plotWidth / 2;
    const y = padding.top + plotHeight - (Number(value) / max) * plotHeight;
    return [x, y];
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="presentation"
        aria-hidden="true"
      >
        {gridLines.map((fraction) => {
          const y = padding.top + plotHeight - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={fraction === 0 ? undefined : "3 4"}
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {formatMarks(max * fraction)}
              </text>
            </g>
          );
        })}

        {block.categories.map((category, index) => {
          const [x] = point(index, 0);
          return (
            <text
              key={`${category}-${index}`}
              x={x}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted-foreground)"
            >
              {truncateLabel(category, 10)}
              <title>{category}</title>
            </text>
          );
        })}

        {block.series.map((series, seriesIndex) => {
          const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
          const points = series.values.map((value, index) => point(index, value));
          return (
            <g key={series.name}>
              <polyline
                points={points.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map(([x, y], index) => (
                <circle key={index} cx={x} cy={y} r={3.5} fill={color}>
                  <title>{`${block.categories[index]} · ${series.name}: ${series.values[index]}${block.unit ? ` ${block.unit}` : ""}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={padding.top + plotHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {block.unit && (
          <text
            x={12}
            y={padding.top + plotHeight / 2}
            fontSize={10}
            fill="var(--muted-foreground)"
            transform={`rotate(-90 12 ${padding.top + plotHeight / 2})`}
            textAnchor="middle"
          >
            {block.unit}
          </text>
        )}
      </svg>
      <Legend series={block.series} />
    </div>
  );
}

function buildPieSlices(categories, values, total, cx, cy, radius) {
  const slices = [];
  let angle = 0;

  categories.forEach((category, index) => {
    const value = Number(values[index]) || 0;
    const start = angle;
    const sweep = (value / total) * 360;
    angle += sweep;
    const end = index === categories.length - 1 ? 359.999 : angle;
    const startRad = ((start - 90) * Math.PI) / 180;
    const endRad = ((end - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    slices.push({
      category,
      value,
      path,
      percent: (value / total) * 100,
      index,
    });
  });

  return slices;
}

function PieChart({ block }) {
  const width = 640;
  const height = 300;
  const cx = 190;
  const cy = 150;
  const radius = 112;
  const series = block.series[0] || { name: "Value", values: [] };
  const total = series.values.reduce((sum, value) => sum + (Number(value) || 0), 0) || 1;
  const slices = buildPieSlices(
    block.categories,
    series.values,
    total,
    cx,
    cy,
    radius
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="presentation"
        aria-hidden="true"
      >
        {slices.map((slice) => (
          <path
            key={slice.category}
            d={slice.path}
            fill={SERIES_COLORS[slice.index % SERIES_COLORS.length]}
            stroke="var(--card)"
            strokeWidth={2}
          >
            <title>{`${slice.category}: ${slice.value}${block.unit ? ` ${block.unit}` : ""} (${slice.percent.toFixed(1)}%)`}</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={52} fill="var(--card)" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          Total
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize={18}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {formatMarks(total)}
        </text>

        {slices.map((slice, index) => {
          const y = 62 + index * 38;
          return (
            <g key={`legend-${slice.category}`}>
              <rect
                x={352}
                y={y - 9}
                width={12}
                height={12}
                rx={3}
                fill={SERIES_COLORS[slice.index % SERIES_COLORS.length]}
              />
              <text x={372} y={y + 1} fontSize={12} fill="var(--foreground)">
                {truncateLabel(slice.category, 22)}
              </text>
              <text
                x={width - 18}
                y={y + 1}
                fontSize={12}
                textAnchor="end"
                fill="var(--muted-foreground)"
              >
                {formatMarks(slice.value)}
                {block.unit === "%" ? "%" : ""} · {slice.percent.toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ChartBlock({ block }) {
  const label =
    block.altText ||
    `${block.chartType} chart${block.title ? `: ${block.title}` : ""}`;

  return (
    <figure
      className="rounded-xl border border-border bg-card p-3"
      role="img"
      aria-label={label}
    >
      {block.title && (
        <figcaption className="mb-2 text-sm font-medium">{block.title}</figcaption>
      )}
      {block.chartType === "bar" && <BarChart block={block} />}
      {block.chartType === "line" && <LineChart block={block} />}
      {block.chartType === "pie" && <PieChart block={block} />}

      <details className="group mt-3 rounded-lg border border-border/70 bg-muted/30">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Table2 className="size-3.5" />
          Text Data (Visually Impaired / Reference)
          <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border/70 p-3">
          {block.altText && (
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              {block.altText}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="border border-border px-2 py-1.5 font-medium">Category</th>
                  {block.series.map((series) => (
                    <th
                      key={series.name}
                      className="border border-border px-2 py-1.5 text-right font-medium"
                    >
                      {series.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.categories.map((category, index) => (
                  <tr key={`${category}-${index}`}>
                    <td className="border border-border px-2 py-1.5">{category}</td>
                    {block.series.map((series) => (
                      <td
                        key={series.name}
                        className="border border-border px-2 py-1.5 text-right tabular-nums"
                      >
                        {formatMarks(series.values[index])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.unit && (
            <p className="mt-2 text-[11px] text-muted-foreground">Unit: {block.unit}</p>
          )}
        </div>
      </details>
    </figure>
  );
}
