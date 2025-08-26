// src/pages/MainPage.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import ControlBar from "../components/ControlBar";
import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import CustomNode from "../components/CustomNode";
import CustomEdge from "../components/CustomEdge";
import { useMainPageModel } from "../hooks/useMainPageModel";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export default function MainPage() {
  const model = useMainPageModel();
  const s = model.state;

  if (s.loading) return <LoadingSpinner />;
  if (s.error) return <ErrorState message={s.error} onRetry={model.handleRefresh} />;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top ControlBar */}
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={model.handleRefresh}
          onToggleProblemOnly={() => model.updateState("showProblemOnly", !s.showProblemOnly)}
          showProblemOnly={s.showProblemOnly}
          searchQuery={s.searchQuery}
          onSearchChange={(value) => model.updateMultipleStates({ searchQuery: value, searchError: undefined })}
          onSearchSubmit={model.handleSearchSubmit}
          statusCounts={model.deviceStatusCounts}
          onPingAll={model.handlePingAll}
          isPinging={s.isPinging}
          keyboardNavEnabled={s.keyboardNavEnabled}
          onToggleKeyboardNav={() => model.updateState("keyboardNavEnabled", !s.keyboardNavEnabled)}
          searchError={s.searchError}
          onBulkSetStatus={model.handleBulkSetStatus}
          problemCount={model.problemCount}
        />
      </div>

      {/* banners */}
      {s.pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm"><strong>Ping 오류:</strong> {s.pingError}</div>
        </div>
      )}
      {s.searchError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mx-6 mt-2">
          <div className="text-amber-800 text-sm"><strong>알림:</strong> {s.searchError}</div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Diagram */}
        <div className="flex-1 relative bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={s.renderKey}
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

          {/* DEV-only FPS */}
          {model.showDebug && (
            <div className="absolute left-3 top-16 z-50 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
              FPS: {model.fps}
            </div>
          )}

          {s.showProblemOnly && model.finalNodes.length === 0 && (
            <div className="mt-2 mx-2 text-sm bg-white/60 text-rose-700 border border-rose-300 rounded px-3 py-2">
              현재 표시할 <strong>문제 장비</strong>가 없습니다. (Online 외 상태 없음)
            </div>
          )}
          {s.devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        {/* Side Panel */}
        <SidePanel
          selectedDevice={s.selectedDevice}
          selectedCable={s.selectedCable}
          traceResult={s.traceResult}
          traceError={s.traceError}
          setSelectedDevice={(device) => model.updateState("selectedDevice", device)}
          setSelectedCable={(cable) => model.updateState("selectedCable", cable)}
          filteredCables={model.filteredCables}
          refetchDevices={model.refetchDevices}
          refetchCables={model.refetchCables}
          devices={s.devices}
        />
      </div>
    </div>
  );
}
