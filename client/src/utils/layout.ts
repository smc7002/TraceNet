//  client/src/utils/layout.ts

import dagre from 'dagre';
import type { Edge, Node } from 'react-flow-renderer';
import { Position } from 'react-flow-renderer';

/**
 * TraceNet Layout Engine
 *
 * Layout manager for visualizing network infrastructure in manufacturing environments.
 *
 * Key capabilities:
 * - Radial, cluster-style placement for Server–Switch–PC topology
 * - Hierarchical (Dagre) layout support (currently paused)
 * - Dynamic ring radius to control node density
 * - Automatic handle positioning to minimize edge crossings
 *
 * Typical use cases:
 * - Managing networks of ~200–300 devices
 * - Quickly identifying the affected switch cluster when a “Zone A PC issue” occurs
 * - Visual verification of physical cable paths during trace
 */

// ==========================================
// Configuration & enums
// ==========================================

/**
 * Layout modes
 *
 * Dagre: hierarchical structure (good for untangling complex relations)
 * Radial: simple radial (currently unused)
 * NewRadial: switch-cluster radial (recommended, used as the main layout)
 */
export enum LayoutMode {
  Dagre = 'dagre',
  Radial = 'radial',
  NewRadial = 'new-radial', // main layout
}

// ==========================================
// Utility functions
// ==========================================

/**
 * Compute optimal handle positions for an edge according to the angle.
 *
 * Goal: split the circle into 8 sectors so parallel edges prefer different handles
 * and avoid overlaps.
 *
 * How it works:
 * 1) Normalize the input angle to 0–360°
 * 2) Divide into 8 sectors of 45° each
 * 3) Return the best source/target handle for the sector
 *
 * Example: 45° → down-right → source: Top, target: Bottom
 *
 * @param angleInDegrees Node angle in degrees
 * @returns Optimal source/target handle positions
 */
function getHandlePositionsByAngle(angleInDegrees: number): {
  source: Position;
  target: Position;
} {
  // Normalize negatives and angles ≥ 360° to the 0–360° range
  const normalizedAngle = ((angleInDegrees % 360) + 360) % 360;

  // Mapping for 8 directional sectors (45° each)

  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    // 3 o'clock (0°): horizontal rightwards
    return { source: Position.Left, target: Position.Right };
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    // 1–2 o'clock (45°): down-right diagonal
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    // 6 o'clock (90°): vertical downward
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    // 7–8 o'clock (135°): down-left diagonal
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    // 9 o'clock (180°): horizontal leftwards
    return { source: Position.Right, target: Position.Left };
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    // 10–11 o'clock (225°): up-left diagonal
    return { source: Position.Bottom, target: Position.Top };
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    // 12 o'clock (270°): vertical upward
    return { source: Position.Bottom, target: Position.Top };
  } else {
    // 1–2 o'clock (315°): up-right diagonal
    return { source: Position.Bottom, target: Position.Top };
  }
}

/**
 * Dynamic radius configuration
 *
 * Meaning of each value:
 * - base: base radius when there are few nodes
 * - targetSpacing: target arc length between adjacent nodes
 * - min/max: lower/upper bounds for the radius
 * - growth: linear growth per additional node
 * - pad: additional padding
 */
type RingConfig = {
  base?: number;            // base radius
  targetSpacing?: number;   // desired spacing between nodes
  min?: number;             // minimum radius
  max?: number;             // maximum radius
  growth?: number;          // linear growth factor
  pad?: number;             // padding
};

/**
 * Calculate an appropriate ring radius for a given node count.
 *
 * Algorithm:
 * 1) Spacing-based radius: ensure the target spacing between nodes
 * 2) Linear growth radius: scale with node count
 * 3) Take the larger of the two, then clamp to [min, max]
 *
 * Example: 15 switches → radius around ~900px
 *
 * @param count Number of nodes to place
 * @param cfg   Optional ring configuration
 * @returns     Computed optimal radius in pixels
 */
function ringRadius(count: number, cfg: RingConfig = {}): number {
  const k = Math.max(1, count);
  const base = cfg.base ?? 600;
  const spacing = cfg.targetSpacing ?? 160;
  const min = cfg.min ?? 420;
  const max = cfg.max ?? 1400;
  const growth = cfg.growth ?? 6;
  const pad = cfg.pad ?? 0;

  // Method 1: spacing-based radius
  // Formula: radius = (targetSpacing × n) / (2π) + pad
  const rBySpacing = (spacing * k) / (2 * Math.PI) + pad;

  // Method 2: linear growth radius
  // Keeps reasonable room if nodes cluster on one side
  const rByLinear = base + growth * (k - 1);

  // Use the larger value, then clamp
  const r = Math.max(min, Math.max(rBySpacing, rByLinear));
  return Math.min(max, Math.round(r));
}

// ==========================================
// Dagre hierarchical layout (currently paused)
// ==========================================

/**
 * Hierarchical layout based on the Dagre algorithm.
 *
 * When to use: organizing complex networks where relationships need structuring.
 *
 * Characteristics:
 * - Left-to-right layered placement
 * - Ordered Server → Switch → PC
 * - Minimizes edge crossings
 *
 * Settings:
 * - rankdir: "LR" (left to right)
 * - nodesep: 80px (spacing between nodes in the same rank)
 * - ranksep: 100px (distance between ranks)
 * - Node size: 180×60px (fixed)
 *
 * @param nodes Nodes to place
 * @param edges Edges representing connections
 * @returns Nodes and edges placed hierarchically
 */
export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  // Initialize Dagre graph
  const dagreGraph = new dagre.graphlib.Graph();

  // Set default edge label (perf)
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Layout parameters
  dagreGraph.setGraph({
    rankdir: 'LR', // left-to-right
    nodesep: 80,   // same-rank spacing
    ranksep: 100,  // rank spacing
  });

  // Register all nodes with a fixed size
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 180, // width tuned for name + status
      height: 60, // height tuned for icon + text
    });
  });

  // Register connections
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run Dagre layout
  dagre.layout(dagreGraph);

  // Convert to React Flow format
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        // Dagre uses center coordinates → convert to top-left
        x: nodeWithPosition.x - 90, // half width
        y: nodeWithPosition.y - 30, // half height
      },
      sourcePosition: Position.Right, // outgoing on the right
      targetPosition: Position.Left,  // incoming on the left
      data: { ...node.data, mode: 'dagre' },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ==========================================
// Radial cluster layout (main)
// ==========================================

/**
 * Radial cluster layout — the core layout used by TraceNet.
 *
 * Design:
 * 1) Place the server at the center (800, 500)
 * 2) Arrange switches on a circle around the server (radius auto-computed)
 * 3) Place PCs around each switch as a local cluster
 *
 * Practical usage:
 * - “3F Zone-A internet issue” → quickly identify PCs in the affected switch cluster
 * - Visualize physical cable routing during trace
 * - Group by switch for maintainability
 *
 * Core algorithms:
 * - Dynamic radius: auto-adjust with node count
 * - Clustering: group PCs per switch
 * - Handle optimization: reduce edge crossings
 *
 * @param inputNodes Nodes to layout
 * @param inputEdges Edges to layout
 * @returns Nodes and edges placed in a radial cluster
 */
export function getNewRadialLayoutedElements(
  inputNodes: Node[],
  inputEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  // ============ Base settings ============
  const center = { x: 800, y: 500 }; // canvas center
  const NODE_WIDTH = 180;  // standard node width
  const NODE_HEIGHT = 60;  // standard node height

  // ============ Classify by type ============
  const server = inputNodes.find((n) => n.data?.type === 'server');
  const switches = inputNodes.filter((n) => n.data?.type === 'switch');
  const pcs = inputNodes.filter((n) => n.data?.type === 'pc');

  // If there is no server, return as-is
  if (!server) {
    console.warn('서버 노드가 없어 방사형 레이아웃을 적용할 수 없습니다.');
    return { nodes: inputNodes, edges: inputEdges };
  }

  // Storage for computed positions
  const positionedNodesMap = new Map<string, Node>();

  // ============ Step 1: place server at center ============
  positionedNodesMap.set(server.id, {
    ...server,
    position: {
      x: center.x - NODE_WIDTH / 2,  // centered
      y: center.y - NODE_HEIGHT / 2, // centered
    },
    sourcePosition: Position.Bottom, // outgoing to switches
    targetPosition: Position.Top,    // incoming from top
    data: {
      ...server.data,
      mode: 'radial',
      angleInDegrees: 0, // 0° for the center
      centerAligned: true, // mark as centered
    },
  });

  // ============ Step 2: place switches on a circle ============

  // Compute radius according to number of switches
  const switchRadius = ringRadius(switches.length, {
    base: 820,          // base radius when few switches
    targetSpacing: 220, // target spacing between switches
    min: 600,           // minimum radius
    max: 1800,          // maximum radius
    growth: 12,         // growth per switch
    pad: 120,           // extra padding
  });

  // Angular step in radians
  const switchAngleStep = (2 * Math.PI) / Math.max(switches.length, 1);

  switches.forEach((sw, index) => {
    // Polar → Cartesian
    const angle = index * switchAngleStep;
    const x = center.x + Math.cos(angle) * switchRadius;
    const y = center.y + Math.sin(angle) * switchRadius;
    const angleInDegrees = (angle * 180) / Math.PI;

    // Pick optimal handle positions for this angle
    const handlePositions = getHandlePositionsByAngle(angleInDegrees);

    positionedNodesMap.set(sw.id, {
      ...sw,
      position: {
        x: x - NODE_WIDTH / 2, // center → top-left
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: handlePositions.source, // optimized source handle
      targetPosition: handlePositions.target, // optimized target handle
      data: {
        ...sw.data,
        mode: 'radial',
        angle: angle,                  // radians (calculations)
        angleInDegrees: angleInDegrees // degrees (debug)
      },
    });
  });

  // ============ Step 3: place PC clusters around each switch ============

  const pcSet = new Set<string>(); // track already placed PCs

  switches.forEach((sw) => {
    // PCs connected to the current switch
    const connectedPCs = inputEdges
      .filter((e) => {
        // check either direction
        const isSourceSwitch = e.source === sw.id;
        const isTargetSwitch = e.target === sw.id;
        const connectedId = isSourceSwitch ? e.target : isTargetSwitch ? e.source : null;

        if (!connectedId) return false;

        // ensure it's a PC and not already placed
        const connectedPC = pcs.find((p) => p.id === connectedId);
        return connectedPC && !pcSet.has(connectedId);
      })
      .map((e) => {
        const pcId = e.source === sw.id ? e.target : e.source;
        return pcs.find((p) => p.id === pcId);
      })
      .filter((pc): pc is Node => pc !== undefined);

    // Switch position
    const switchNode = positionedNodesMap.get(sw.id);
    if (!switchNode || !switchNode.position) return;

    // Compute PC cluster layout
    const switchPos = switchNode.position;
    const switchAngle = switchNode.data?.angle || 0;
    const pcRadius = 150 + connectedPCs.length * 5; // dynamic radius by cluster size
    const pcAngleStep = (2 * Math.PI) / Math.max(connectedPCs.length, 1);
    const startAngle = switchAngle - Math.PI / 2; // rotate 90°

    // Place each PC on a small ring around its switch
    connectedPCs.forEach((pc, idx) => {
      const angle = startAngle + idx * pcAngleStep;

      // Switch center
      const switchCenterX = switchPos.x + NODE_WIDTH / 2;
      const switchCenterY = switchPos.y + NODE_HEIGHT / 2;

      // PC position
      const px = switchCenterX + Math.cos(angle) * pcRadius;
      const py = switchCenterY + Math.sin(angle) * pcRadius;
      const pcAngleInDegrees = (angle * 180) / Math.PI;

      // Optimize PC handles
      const handlePositions = getHandlePositionsByAngle(pcAngleInDegrees);

      positionedNodesMap.set(pc.id, {
        ...pc,
        position: {
          x: px - NODE_WIDTH / 2,
          y: py - NODE_HEIGHT / 2,
        },
        sourcePosition: handlePositions.source,
        targetPosition: handlePositions.target,
        data: {
          ...pc.data,
          mode: 'radial',
          angle: angle,
          angleInDegrees: pcAngleInDegrees,
        },
      });

      // mark as placed
      pcSet.add(pc.id);
    });
  });

  // ============ Step 4: handle orphan nodes ============

  // Place nodes with no computed position at default locations
  inputNodes.forEach((node) => {
    if (!positionedNodesMap.has(node.id)) {
      console.warn(`disconnected node: ${node.id} (${node.data?.label}) - defaulting position`);

      // Type-specific fallbacks
      let defaultX = 100;
      let defaultY = 100;

      if (node.data?.type === 'pc') {
        // PCs: left-top in a vertical stack
        defaultX = 100;
        defaultY = 100 + (positionedNodesMap.size % 5) * 80;
      } else if (node.data?.type === 'switch') {
        // Switches: right-center
        defaultX = center.x + 600;
        defaultY = center.y;
      }

      positionedNodesMap.set(node.id, {
        ...node,
        position: { x: defaultX, y: defaultY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          ...node.data,
          mode: 'radial',
          angleInDegrees: 0,
        },
      });
    }
  });

  // ============ Step 5: final validation & return ============

  // Validate computed positions
  const finalNodes = Array.from(positionedNodesMap.values()).filter((n) => {
    const valid =
      n.position &&
      typeof n.position.x === 'number' &&
      typeof n.position.y === 'number' &&
      !Number.isNaN(n.position.x) &&
      !Number.isNaN(n.position.y) &&
      Number.isFinite(n.position.x) &&
      Number.isFinite(n.position.y);

    if (!valid) {
      console.error(`unavailabe node position: ${n.id}`, n.position);
    }

    return valid;
  });

  // Add custom renderer & metadata to edges
  const finalEdges = inputEdges.map((e) => ({
    ...e,
    type: 'custom', // use custom edge renderer
    data: {
      ...e.data,
      mode: 'radial', // layout mode metadata
    },
  }));

  // Completion logs (dev only)
  // if (window.location.hostname === "localhost") {
  //   console.log(`Radial layout complete: ${finalNodes.length} nodes, ${finalEdges.length} edges`);
  //   console.log(`Counts — server: 1, switches: ${switches.length}, PCs: ${pcSet.size}`);
  // }

  return { nodes: finalNodes, edges: finalEdges };
}

// ==========================================
// Layout tuning guide
// ==========================================

/**
 * Layout tuning guide
 *
 * 1) Spacing between switches:
 *    - Change the `base` value of `switchRadius` (current: 820)
 *    - Adjust `targetSpacing` (current: 220)
 *
 * 2) PC cluster size:
 *    - Modify 150 (base) in the `pcRadius` formula
 *    - Tweak `connectedPCs.length * 5` (growth)
 *
 * 3) Overall layout scale:
 *    - Change `center` (current: {x: 800, y: 500})
 *    - Adjust `NODE_WIDTH` / `NODE_HEIGHT`
 *
 * 4) Adding a new layout mode:
 *    - Add a value to `LayoutMode`
 *    - Implement `get[ModeName]LayoutedElements`
 *    - Handle the new case in the main component
 *
 * Notes:
 * - Update canvas size if you change `center`
 * - Ensure nodes don’t go off-screen when changing radii
 * - Verify edge rendering if handle positions are changed
 */
