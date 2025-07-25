// 📁 src/utils/layout.ts

import dagre from "dagre";
import { Position } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import { getPolarPosition, groupDevicesBySwitch } from "./radialMath";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export enum LayoutMode {
  Dagre = "dagre",
  Radial = "radial",
}

/**
 * ✅ 기존 계층형 DAGRE 레이아웃
 */
export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 50,
    ranksep: 100,
    ranker: "tight-tree",
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * 🌐 서버 중심 마인드맵 Radial 레이아웃
 */
export function getRadialLayoutedElements(nodes: Node[], edges: Edge[]) {
  const center = { x: 800, y: 500 };
  const serverNode = nodes.find(
    (n) => n.data?.type?.toLowerCase() === "server"
  );
  if (!serverNode) {
    console.warn("⚠️ 서버 노드가 없어 마인드맵 레이아웃을 적용할 수 없습니다.");

    const fallback = nodes.map((n, i) => ({
      ...n,
      position: {
        x: 100 + (i % 5) * (NODE_WIDTH + 40),
        y: 100 + Math.floor(i / 5) * (NODE_HEIGHT + 40),
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));

    return { nodes: fallback, edges };
  }

  const swNodes = nodes.filter((n) => n.data?.type?.toLowerCase() === "switch");
  const pcNodes = nodes.filter((n) => n.data?.type?.toLowerCase() === "pc");

  console.log("🌀 serverNode =", serverNode);
  console.log(
    "🌀 swNodes =",
    swNodes.map((n) => n.data?.name)
  );
  console.log(
    "🌀 pcNodes =",
    pcNodes.map((n) => n.data?.name)
  );

  // 서버는 중앙 고정
  serverNode.position = {
    x: center.x - NODE_WIDTH / 2,
    y: center.y - NODE_HEIGHT / 2,
  };
  serverNode.sourcePosition = Position.Bottom;
  serverNode.targetPosition = Position.Top;

  const angleStep = 360 / swNodes.length;
  const radius = 300;

  swNodes.forEach((sw, index) => {
    const angle = index * angleStep;
    const swPos = getPolarPosition(center, radius, angle);
    sw.position = {
      x: swPos.x - NODE_WIDTH / 2,
      y: swPos.y - NODE_HEIGHT / 2,
    };
    sw.sourcePosition = Position.Bottom;
    sw.targetPosition = Position.Top;
  });

  // SW → PC 그룹핑
  const switchToPCs = groupDevicesBySwitch(
    nodes.map((n) => n.data),
    edges.map((e) => e.data)
  );

  swNodes.forEach((sw) => {
    const pcs = switchToPCs[sw.data.name] || [];
    pcs.forEach((pcData, i) => {
      const pcNode = pcNodes.find((p) => p.data.name === pcData.name);
      if (pcNode) {
        pcNode.position = {
          x: sw.position.x,
          y: sw.position.y + 100 + i * (NODE_HEIGHT + 20),
        };
        pcNode.sourcePosition = Position.Bottom;
        pcNode.targetPosition = Position.Top;
      }
    });
  });

  return { nodes, edges };
}
