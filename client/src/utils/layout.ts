// 📁 src/utils/layout.ts

import dagre from "dagre";
import { Position } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";


const nodeWidth = 180;
const nodeHeight = 60;

export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
  rankdir: "LR",        // 좌 → 우 정렬
  nodesep: 80,          // ✅ 노드 간 수평 거리 (기본: 50)
  ranksep: 120,         // ✅ 계층 간 수직 거리 (기본: 50)
});

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  return { nodes: layoutedNodes, edges };
}
