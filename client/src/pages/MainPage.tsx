// src/pages/MainPage.tsx
// Main page composes the app shell (ControlBar + NetworkDiagram + SidePanel).
// State comes from useMainPageModel; this component stays presentation-first.

import ControlBar from '../components/ControlBar';
import CustomEdge from '../components/CustomEdge';
import CustomNode from '../components/CustomNode';
import ErrorState from '../components/ErrorState';
import LoadingSpinner from '../components/LoadingSpinner';
import NetworkDiagram from '../components/NetworkDiagram';
import SidePanel from '../components/SidePanel';
import { useMainPageModel } from '../hooks/useMainPageModel';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export default function MainPage() {
  const model = useMainPageModel();
  const s = model.state;

  if (s.loading) return <LoadingSpinner />;
  if (s.error) return <ErrorState message={s.error} onRetry={model.handleRefresh} />;

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top ControlBar */}
      <div className="shrink-0 border-b border-slate-200">
        <ControlBar
          onRefresh={model.handleRefresh}
          onToggleProblemOnly={() => model.updateState('showProblemOnly', !s.showProblemOnly)}
          showProblemOnly={s.showProblemOnly}
          searchQuery={s.searchQuery}
          onSearchChange={(value) =>
            model.updateMultipleStates({ searchQuery: value, searchError: undefined })
          }
          onSearchSubmit={model.handleSearchSubmit}
          statusCounts={model.deviceStatusCounts}
          onPingAll={model.handlePingAll}
          isPinging={s.isPinging}
          keyboardNavEnabled={s.keyboardNavEnabled}
          onToggleKeyboardNav={() => model.updateState('keyboardNavEnabled', !s.keyboardNavEnabled)}
          searchError={s.searchError}
          onBulkSetStatus={model.handleBulkSetStatus}
          problemCount={model.problemCount}
        />
      </div>

      {/* Banners */}
      {s.pingError && (
        <div className="mx-6 mt-2 border-l-4 border-red-400 bg-red-50 p-3">
          <div className="text-sm text-red-700">
            <strong>Ping error:</strong> {s.pingError}
          </div>
        </div>
      )}
      {s.searchError && (
        <div className="mx-6 mt-2 border-l-4 border-amber-500 bg-amber-50 p-3">
          <div className="text-sm text-amber-800">
            <strong>Notice:</strong> {s.searchError}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Diagram */}
        <div className="relative flex-1 overflow-auto bg-gradient-to-br from-indigo-400 to-purple-500 p-1">
          <NetworkDiagram
            key={s.renderKey} // force remount on layout/data resets
            nodes={model.finalNodes}
            edges={model.finalEdges}
            selectedDevice={s.selectedDevice}
            onDeviceClick={model.handleDeviceClick}
            onCanvasClick={model.resetAllSelections}
            devices={s.devices}
            onEdgeClick={model.handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            keyboardNavigationEnabled={s.keyboardNavEnabled}
            isPinging={s.isPinging}
            viewMode="full"
            showOnlyProblems={s.showProblemOnly}
            zoomLevel={s.currentZoomLevel}
            onZoomChange={model.handleZoomChange}
            onViewportChange={model.handleViewportChange}
          />

          {/* DEV-only FPS badge */}
          {model.showDebug && (
            <div className="pointer-events-none absolute left-3 top-16 z-50 rounded bg-black/60 px-2 py-1 text-xs text-white">
              FPS: {model.fps}
            </div>
          )}

          {/* Empty states */}
          {s.showProblemOnly && model.finalNodes.length === 0 && (
            <div className="mx-2 mt-2 rounded border border-rose-300 bg-white/60 px-3 py-2 text-sm text-rose-700">
              There are no <strong>problem devices</strong> to display. (All devices are Online)
            </div>
          )}
          {s.devices.length === 0 && (
            <div className="mt-6 rounded bg-black/30 p-2 text-center text-sm text-white">
              No devices found. Please upload a JSON file.
            </div>
          )}
        </div>

        {/* Side Panel */}
        <SidePanel
          selectedDevice={s.selectedDevice}
          selectedCable={s.selectedCable}
          traceResult={s.traceResult}
          traceError={s.traceError}
          setSelectedDevice={(device) => model.updateState('selectedDevice', device)}
          setSelectedCable={(cable) => model.updateState('selectedCable', cable)}
          filteredCables={model.filteredCables}
          refetchDevices={model.refetchDevices}
          refetchCables={model.refetchCables}
          devices={s.devices}
        />
      </div>
    </div>
  );
}
