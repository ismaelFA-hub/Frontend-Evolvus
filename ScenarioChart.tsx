import React from "react";
import { View, Dimensions, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";

interface Scenario {
  id: number;
  path: number[];
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  title: string;
}

interface Props {
  data: Scenario[];
  days: number;
}

const COLORS = [
  "#00d4ff",
  "#ff6b6b",
  "#ffd700",
  "#00ff88",
  "#ff00ff",
  "#ff8c00",
  "#00bfff",
  "#ff69b4",
  "#adff2f",
  "#dc143c",
];

const RISK_COLORS: Record<string, string> = {
  low: "#00ff88",
  medium: "#ffd700",
  high: "#ff6b6b",
};

export const ScenarioChart: React.FC<Props> = ({ data, days }) => {
  if (!data || data.length === 0) return null;
  const screenWidth = Dimensions.get("window").width - 40;
  const height = 200;
  const padLeft = 60;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const chartW = screenWidth - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allValues = data.flatMap((s) => s.path);
  const minVal = Math.min(...allValues) * 0.995;
  const maxVal = Math.max(...allValues) * 1.005;
  const range = maxVal - minVal || 1;

  const toX = (idx: number) => padLeft + (idx / days) * chartW;
  const toY = (val: number) => padTop + chartH - ((val - minVal) / range) * chartH;

  const formatK = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <View style={styles.container}>
      <Svg width={screenWidth} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = minVal + ratio * range;
          const y = toY(val);
          return (
            <React.Fragment key={ratio}>
              <Line x1={padLeft} y1={y} x2={screenWidth - padRight} y2={y} stroke="#333" strokeWidth={0.5} strokeDasharray="4,4" />
              <SvgText x={padLeft - 4} y={y + 4} fontSize={8} fill="#666" textAnchor="end">
                {formatK(val)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {Array.from({ length: days + 1 }, (_, i) => i).map((i) => (
          <React.Fragment key={i}>
            <Line x1={toX(i)} y1={padTop} x2={toX(i)} y2={padTop + chartH} stroke="#222" strokeWidth={0.5} strokeDasharray="3,3" />
            <SvgText x={toX(i)} y={height - 4} fontSize={8} fill="#666" textAnchor="middle">
              D{i}
            </SvgText>
          </React.Fragment>
        ))}
        {data.map((scenario, idx) => {
          const color = RISK_COLORS[scenario.riskLevel] ?? COLORS[idx % COLORS.length];
          const points = scenario.path.map((val, i) => `${toX(i)},${toY(val)}`).join(" ");
          const lastX = toX(days);
          const lastY = toY(scenario.path[scenario.path.length - 1]);
          return (
            <React.Fragment key={scenario.id}>
              <Polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={0.85}
              />
              <Circle cx={lastX} cy={lastY} r={3} fill={color} />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        {data.slice(0, 5).map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: RISK_COLORS[s.riskLevel] }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {s.title} ({(s.confidence * 100).toFixed(0)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    padding: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#1a1a2e",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    color: "#888",
    fontSize: 10,
  },
});
