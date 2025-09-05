/**
 * @fileoverview Network Infrastructure Visualization Main Component
 *
 * High-performance network visualization system based on React Flow.
 *
 * Key features:
 * - Real-time zoom/pan control and viewport tracking
 * - Keyboard navigation (arrow keys, Ctrl+Home, etc.)
 * - Overview via MiniMap
 * - Server-centric auto-centering and UX-focused defaults
 * - Dev-only performance helper panel
 *
 * Performance notes:
 * - Prevent unnecessary re-renders with React.memo
 * - Smooth animations with requestAnimationFrame
 * - Virtualization: render only elements inside the viewport
 * - Proper resource cleanup to prevent memory leaks
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from 'react-flow-renderer';

import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import type { Device } from '../types/device';

// ==========================================
// Type definitions
// ==========================================

/**
 * Viewport information used by MainPage's "smart PC reveal" algorithm.
 */
type ViewportInfo = {
  /** React Flow transform X */
  x: number;
  /** React Flow transform Y */
  y: number;
  /** Current zoom level (0.3 ~ 2.0) */
  zoom: number;
  /** Container pixel width */
  width: number;
  /** Container pixel height */
  height: number;
  /** Screen center X in Flow coordinates */
  centerX: number;
  /** Screen center Y in Flow coordinates */
  centerY: number;
};

/**
 * Props for NetworkDiagram component
 */
interface NetworkDiagramProps {
  /** Nodes to render */
  nodes: Node[];
  /** Edges to render */
  edges: Edge[];
  /** Selected device (for highlight) */
  selectedDevice: Device | null;
  /** Node click handler */
  onDeviceClick: (device: Device) => void;
  /** Canvas empty-space click handler */
  onCanvasClick: () => void;
  /** Edge click handler */
  onEdgeClick: (event: unknown, edge: Edge) => void;
  /** Full device list (for node-id mapping) */
  devices: Device[];
  /** Custom node types */
  nodeTypes?: NodeTypes;
  /** Custom edge types */
  edgeTypes?: EdgeTypes;
  /** Render mode */
  viewMode?: 'full' | 'smart' | 'minimal';
  /** Show only problematic devices */
  showOnlyProblems?: boolean;
  /** Current zoom level (for dev panel) */
  zoomLevel?: number;
  /** Enable keyboard navigation */
  keyboardNavigationEnabled?: boolean;
  /** Ping in progress (UI disable) */
  isPinging?: boolean;
  /** Zoom change callback */
  onZoomChange?: (zoomLevel: number) => void;
  /** Viewport change callback (smart reveal) */
  onViewportChange?: (info: ViewportInfo) => void;
}

// ==========================================
/* Constants & configuration */
// ==========================================

/** Dev mode detection - enable verbose logs on localhost */
const isLocalDev =
  typeof window !== 'undefined' && import.meta.env?.DEV && window.location.hostname === 'localhost';

/** Initial zoom level so the server area is visible by default */
const INITIAL_ZOOM = 0.6;

// ==========================================
// Main component
// ==========================================

/**
 * Network diagram visualization component.
 *
 * Built on React Flow to monitor 200+ devices in real time and provide an intuitive UI
 * used in manufacturing IT environments.
 *
 * Highlights:
 * - Server-centric initial positioning for instant overview
 * - Dev-only performance panel
 * - Fast keyboard navigation
 * - Memory-safe resource management
 */
const NetworkDiagram = React.memo(function NetworkDiagram({
  nodes,
  edges,
  onDeviceClick,
  onCanvasClick,
  onEdgeClick,
  devices,
  nodeTypes,
  edgeTypes,
  viewMode = 'full',
  zoomLevel = 1.0,
  keyboardNavigationEnabled = true,
  isPinging = false,
  onZoomChange,
  onViewportChange,
}: NetworkDiagramProps) {
  // ==========================================
  // Refs & state management
  // ==========================================

  /** React Flow container DOM ref */
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  /** React Flow instance ref (zoom & pan control) */
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  /** Flag to ensure we run initial fit only once */
  const didFitOnce = useRef(false);

  /** ResizeObserver for container size changes */
  const resizeObserver = useRef<ResizeObserver | null>(null);

  /** Animation frame id for layout actions */
  const animationFrame = useRef<number | null>(null);

  /** Animation frame id for throttling zoom events */
  const zoomRaf = useRef<number | null>(null);

  /** Last zoom level to avoid duplicate events */
  const lastZoom = useRef<number | null>(null);

  // ==========================================
  // Keyboard navigation
  // ==========================================

  /** Initialize keyboard navigation hook */
  const keyboardControls = useKeyboardNavigation({
    stepSize: 100, // px per arrow key step
    enabled: keyboardNavigationEnabled && !isPinging, // disabled while pinging
    zoomStep: 1.2, // 20% per zoom step
    animationDuration: 300, // ms
  });

  // Dev-only: log keyboard control state
  useEffect(() => {
    if (isLocalDev) console.log('Keyboard controls enabled:', keyboardControls);
  }, [keyboardControls]);

  // ==========================================
  // Memory management & cleanup
  // ==========================================

  /**
   * Cleanup on unmount to prevent memory leaks.
   */
  useEffect(() => {
    return () => {
      // Disconnect ResizeObserver
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }

      // Cancel pending animation frames
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }

      if (zoomRaf.current) {
        cancelAnimationFrame(zoomRaf.current);
        zoomRaf.current = null;
      }

      // Legacy: clear global reference if set
      if (typeof window !== 'undefined' && (window as any).reactFlowInstance) {
        delete (window as any).reactFlowInstance;
      }

      if (isLocalDev) console.log('NetworkDiagram: cleanup complete');
    };
  }, []);

  // ==========================================
  // Server-centric centering logic
  // ==========================================

  /**
   * Find the server node from multiple hints:
   * - node.data.type equals "server" or "Server"
   * - devices[] entry for that node has type "server"
   */
  const findServerNode = useCallback(
    (nodeList: Node[]): Node | null => {
      return (
        nodeList.find(
          (node) =>
            node.data?.type === 'server' ||
            node.data?.type === 'Server' ||
            devices.find((d) => d.deviceId.toString() === node.id)?.type.toLowerCase() === 'server',
        ) || null
      );
    },
    [devices],
  );

  /**
   * Center the viewport on the server node;
   * if not found, fall back to geometric center of all nodes.
   */
  const centerOnServer = useCallback(
    (nodeList: Node[], zoom: number = INITIAL_ZOOM) => {
      const instance = reactFlowInstance.current;
      if (!instance) return;

      const serverNode = findServerNode(nodeList);

      if (serverNode) {
        // Smoothly center on the server node
        if (typeof instance.setCenter === 'function') {
          instance.setCenter(serverNode.position.x, serverNode.position.y, {
            zoom,
            duration: 500, // 0.5s
          });
          if (isLocalDev) {
            console.log(
              `[CENTER] Move to server: (${serverNode.position.x}, ${serverNode.position.y}), zoom: ${zoom}`,
            );
          }
        }
      } else {
        // Fall back: center of mass of all nodes
        if (nodeList.length > 0) {
          const centerX =
            nodeList.reduce((sum, node) => sum + node.position.x, 0) / nodeList.length;
          const centerY =
            nodeList.reduce((sum, node) => sum + node.position.y, 0) / nodeList.length;

          if (typeof instance.setCenter === 'function') {
            instance.setCenter(centerX, centerY, { zoom, duration: 500 });
            if (isLocalDev) {
              console.log(
                `[CENTER] Move to network center: (${centerX}, ${centerY}), zoom: ${zoom}`,
              );
            }
          }
        }
      }

      // Notify parent about zoom changes
      onZoomChange?.(zoom);
    },
    [findServerNode, onZoomChange, isLocalDev],
  );

  // ==========================================
  // Event handlers
  // ==========================================

  /**
   * Node click → find device by node.id and notify parent.
   */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick],
  );

  /**
   * Pane (empty space) click → clear selection and notify parent.
   */
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (isLocalDev) console.log('Mouse click at:', event.clientX, event.clientY);
      onCanvasClick();
    },
    [onCanvasClick],
  );

  /**
   * React Flow init callback → save instance and perform initial centering.
   */
  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      if (isLocalDev) console.log('React Flow initialized');

      // Keep instance
      reactFlowInstance.current = instance;

      // Optional: legacy global reference
      if (typeof window !== 'undefined') (window as any).reactFlowInstance = instance;

      // Center on next frame after DOM is ready
      requestAnimationFrame(() => {
        centerOnServer(nodes, INITIAL_ZOOM);
      });
    },
    [centerOnServer, nodes],
  );

  /**
   * Decide MiniMap node color.
   * Priority: device.status → node.data.type (fallback).
   */
  const miniMapNodeColor = useCallback(
    (node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);

      if (device) {
        switch (device.status) {
          case 'Online':
            return '#00ff00'; // green
          case 'Offline':
            return '#ff0000'; // red
          case 'Unstable':
            return '#ffff00'; // yellow
          default:
            return '#cccccc'; // gray
        }
      }

      switch (node.data?.type) {
        case 'server':
          return '#ffcc00'; // gold
        case 'switch':
          return '#00ccff'; // sky
        case 'pc':
          return '#66ff66'; // light green
        default:
          return '#cccccc'; // gray
      }
    },
    [devices],
  );

  /**
   * Viewport move/zoom handler:
   * - Notify parent about zoom changes
   * - Provide center (in Flow coordinates) to smart-reveal algorithm
   * Uses rAF to throttle events.
   */
  const handleMove = useCallback(
    (_evt: unknown, viewport: { x: number; y: number; zoom: number }) => {
      const inst = reactFlowInstance.current;
      const container = reactFlowWrapper.current;
      if (!inst || !container) return;

      // Measure container
      const { width, height } = container.getBoundingClientRect();

      // Convert screen center to Flow coordinates
      const centerInScreen = { x: width / 2, y: height / 2 };
      const centerInFlow = inst.project(centerInScreen);

      // Throttle with rAF
      if (typeof viewport?.zoom === 'number') {
        if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current);
        zoomRaf.current = requestAnimationFrame(() => {
          // Only notify when zoom actually changes
          if (lastZoom.current !== viewport.zoom) {
            lastZoom.current = viewport.zoom;
            onZoomChange?.(viewport.zoom);
          }

          // Provide viewport info to parent
          onViewportChange?.({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
            width,
            height,
            centerX: centerInFlow.x,
            centerY: centerInFlow.y,
          });

          zoomRaf.current = null;
        });
      }
    },
    [onZoomChange, onViewportChange],
  );

  // ==========================================
  // React Flow props
  // ==========================================

  /**
   * Default props for React Flow tuned for performance & UX.
   */
  const reactFlowProps = useMemo(
    () => ({
      // Node interactions
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: true,
      selectNodesOnDrag: false,

      // View control
      fitView: false,
      defaultZoom: INITIAL_ZOOM,
      defaultPosition: [0, 0] as [number, number],

      // Zoom & pan boundaries
      minZoom: 0.3,
      maxZoom: 2,
      translateExtent: [
        [-3000, -3000],
        [3000, 3000],
      ] as [[number, number], [number, number]],

      // Performance
      onlyRenderVisibleElements: true,
    }),
    [],
  );

  // ==========================================
  // Initialization & lifecycle effects
  // ==========================================

  /**
   * Initial centering after data is ready.
   * Conditions:
   *  - Not done yet
   *  - Instance is ready
   *  - Nodes exist
   *  - All edges reference valid nodes (race-safety)
   */
  useEffect(() => {
    if (didFitOnce.current) return;
    if (!reactFlowInstance.current) return;
    if (nodes.length === 0) return;

    // Validate that every edge source/target exists
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edgesValid = edges.every(
      (e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string),
    );
    if (!edgesValid) return;

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      centerOnServer(nodes, INITIAL_ZOOM);
      didFitOnce.current = true;
      animationFrame.current = null;

      if (isLocalDev) console.log('[INIT] Initial server-centric layout complete');
    });

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [nodes, edges, centerOnServer]);

  /**
   * Observe container size changes.
   * We only detect changes but keep the user-configured viewport as-is.
   */
  useEffect(() => {
    const container = reactFlowWrapper.current;
    if (!container || !reactFlowInstance.current) return;
    if (typeof ResizeObserver === 'undefined') return;

    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
    }

    resizeObserver.current = new ResizeObserver(() => {
      // Detect only; do not auto-fit to preserve the user's viewport
      if (isLocalDev) console.log('[RESIZE] Container size changed');
    });

    resizeObserver.current.observe(container);

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }
    };
  }, []);

  /**
   * Keyboard shortcuts
   * - Ctrl + Home: center on server
   */
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Home') {
        event.preventDefault();
        centerOnServer(nodes, INITIAL_ZOOM);
        if (isLocalDev) console.log('[MANUAL] User requested server centering');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [nodes, centerOnServer]);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        onMove={handleMove}
        onMoveEnd={handleMove}
        {...reactFlowProps}
      >
        {/* MiniMap — render only when there are more than 5 nodes */}
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{ display: nodes.length > 5 ? 'block' : 'none' }}
        />
      </ReactFlow>

      {/* Keyboard shortcuts helper (conditional) */}
      {keyboardNavigationEnabled && !isPinging && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 11,
            pointerEvents: 'none',
            fontFamily: 'monospace',
            lineHeight: 1.3,
            zIndex: 1000,
          }}
        >
          <div>Arrows: pan</div>
          <div>Ctrl + +/-: zoom</div>
          {/* <div>Ctrl + 0: fit view</div> */}
          <div>Ctrl + Home: center on server</div>
        </div>
      )}

      {/* Dev-only performance panel */}
      {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 10,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: 5,
            fontSize: 12,
            pointerEvents: 'none',
            fontFamily: 'monospace',
            lineHeight: 1.4,
          }}
        >
          <div>
            Nodes: {nodes.length} | Edges: {edges.length}
          </div>
          <div>Zoom: {zoomLevel.toFixed(2)}x</div>
          <div>Keyboard: {keyboardNavigationEnabled && !isPinging ? 'ON' : 'OFF'}</div>
          <div>Mode: {viewMode}</div>
          <div>Initialized: {didFitOnce.current ? 'done' : 'pending'}</div>
          <div>Server detected: {findServerNode(nodes) ? 'yes' : 'no'}</div>
        </div>
      )}
    </div>
  );
});

NetworkDiagram.displayName = 'NetworkDiagram';
export default NetworkDiagram;

/**
 * Modification guide
 *
 * 1) Performance tuning:
 *    - Adjust INITIAL_ZOOM for initial view size
 *    - Use minZoom/maxZoom in reactFlowProps to restrict zoom range
 *    - Enable virtualization via onlyRenderVisibleElements
 *
 * 2) Add more keyboard shortcuts:
 *    - Extend the handleKeydown function
 *    - Expand defaults in useKeyboardNavigation hook
 *
 * 3) MiniMap customization:
 *    - Change color mapping in miniMapNodeColor
 *    - Adjust the visibility condition (currently: nodes > 5)
 *
 * 4) Initial layout logic:
 *    - Update server detection in findServerNode
 *    - Modify centering algorithm in centerOnServer
 *
 * 5) Dev performance panel:
 *    - Add more metrics
 *    - Use React DevTools Profiler to optimize re-renders
 *
 * 6) Known limitations:
 *    - Possible initial render delay with 1000+ nodes
 *    - Text readability decreases at very deep zoom levels
 */
