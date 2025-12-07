import React, { useState, useRef } from "react";
import {
  Box,
  IconButton,
  Toolbar,
  Typography,
  CircularProgress,
  Button,
} from "@mui/material";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
// runtime flags that tell us whether ESAI / Test‑Connection is in flight
import { useTerminalState, useTerminalDispatch } from "./TerminalContext";
import ActionButtons from "./ActionButtons";

/**
 * Vertically‑resizable output panel with collapse toggle **and** status icons.
 *
 * ▸  Drag the toolbar (cursor: row‑resize) to resize.
 * ▸  Click the chevron to collapse/expand.
 * ▸  Shows a spinner while `isRunning` **or** `isTestingConnection` is true.
 * ▸  When the process finishes, the *reducer* should dispatch
 *    `SET_STATUS` with `'success'` or `'error'`. The icon is then shown
 *    automatically (or you can override via the `result` prop).
 */
export default function OutputPanel({
  children,
  initialHeight = 260,
  minHeight = 120,
  loading, // optional force‑flag, e.g. <OutputPanel loading />
  result = null, // 'success' | 'error' | null – parent override

  // ActionButtons props - only show when we have an active config
  activeTabConfig = null, // { sharedFormData, loadFormData, importFormData, configPath, currentConfigFolderId }
  onTestConnection,
  addAlert,
  refreshDb,
  validateConfig,
  selectedImportFolder,
  setCurrentPage,

  // Style props for overlay positioning
  sx = {},
}) {
  /* ───────── global run‑state flags ───────── */
  const {
    isRunning = false,
    isTestingConnection = false,
    status = null, // ← comes from TerminalContext reducer
    processInfo = null, // { name, actions, configName }
    elapsedTime = "0.00",
  } = useTerminalState();

  const dispatch = useTerminalDispatch();

  // Clear process info and output
  const clearOutput = () => {
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "CLEAR_PROCESS_INFO" });
  };

  /**
   *
   * Decide which indicator to show – priority:
   *   1. explicit `loading` prop
   *   2. running / testing flags from context
   *   3. `result` prop or `status` from context
   */
  const spinning =
    typeof loading === "boolean" ? loading : isRunning || isTestingConnection;
  const outcome = result || status; // 'success' | 'error' | undefined

  /* ───────── local (UI) state ───────── */
  const [height, setHeight] = useState(initialHeight);
  const [collapsed, setCollapsed] = useState(initialHeight === 0); // Start collapsed if initialHeight is 0
  const startYRef = useRef(null);
  const startHRef = useRef(null);

  /* ───────── drag handlers ───────── */
  const beginDrag = (e) => {
    if (e.target.closest("button")) return; // don’t start drag on buttons
    startYRef.current = e.clientY;
    startHRef.current = height;
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
  };

  const onDrag = (e) => {
    const delta = e.clientY - startYRef.current;
    const newHeight = startHRef.current - delta;

    // Calculate max height to prevent dragging under navbar
    // AppBar default height is 64px, add some padding
    const navbarHeight = 64 + 16; // 64px navbar + 16px padding
    const maxHeight = window.innerHeight - navbarHeight;

    setHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
  };

  const endDrag = () => {
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
  };

  /* ───────── render ───────── */
  return (
    <Box
      sx={{
        position: "relative",
        flexShrink: 0,
        boxSizing: "border-box",
        height: collapsed ? 48 : height,
        borderTop: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        overflow: "hidden", // avoid 1‑px scrollbar flash
        ...sx, // Apply custom styles (e.g., for overlay positioning)
      }}
    >
      {/* ───── toolbar (+ drag handle) ───── */}
      <Toolbar
        variant="dense"
        sx={{
          minHeight: 48,
          cursor: "row-resize",
          userSelect: "none",
          pl: 1,
          pr: 1,
          gap: 1,
        }}
        onMouseDown={beginDrag}
      >
        <IconButton
          size="small"
          onClick={() => {
            setCollapsed((c) => {
              if (c && height === 0) {
                // If expanding from 0 height, set a reasonable default
                setHeight(260);
              }
              return !c;
            });
          }}
          aria-label={collapsed ? "Expand output" : "Collapse output"}
        >
          {collapsed ? (
            <ExpandMoreIcon sx={{ color: "black" }} />
          ) : (
            <ExpandLessIcon sx={{ color: "black" }} />
          )}
        </IconButton>
        {/* ───── right‑hand status icon(s) ───── */}
        {spinning && (
          <CircularProgress
            size={20}
            thickness={6}
            color="primary"
            sx={{ ml: 1 }}
          />
        )}
        {!spinning && outcome === "success" && (
          <CheckCircleOutlineIcon
            fontSize="medium"
            color="success"
            sx={{ ml: 1 }}
          />
        )}
        {!spinning && outcome === "error" && (
          <ErrorOutlineIcon fontSize="medium" color="error" sx={{ ml: 1 }} />
        )}
        {/* left‑side title */}
        <Typography variant="subtitle2" sx={{ ml: 1, flexGrow: 1 }}>
          {processInfo ? (
            <Box component="span">
              <Box component="span" sx={{ fontWeight: "bold" }}>
                {processInfo.name}
              </Box>
              {processInfo.configName && (
                <Box component="span" sx={{ ml: 1, opacity: 0.7 }}>
                  ({processInfo.configName})
                </Box>
              )}
              {processInfo.actions && (
                <Box
                  component="span"
                  sx={{ ml: 1, fontSize: "0.85em", opacity: 0.8 }}
                >
                  [{processInfo.actions}]
                </Box>
              )}
              {/* Show elapsed time when running or completed */}
              {(isRunning || isTestingConnection || processInfo.status) && (
                <Box
                  component="span"
                  sx={{ ml: 1, fontSize: "0.8em", color: "#1976d2" }}
                >
                  {isRunning || isTestingConnection
                    ? elapsedTime
                    : processInfo.finalElapsedTime || elapsedTime}
                  s
                </Box>
              )}
              {processInfo.status && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    fontSize: "0.8em",
                    px: 1,
                    py: 0.2,
                    borderRadius: "4px",
                    bgcolor:
                      processInfo.status === "success"
                        ? "#e8f5e8"
                        : processInfo.status === "error"
                          ? "#ffebee"
                          : processInfo.status === "stopped"
                            ? "#fff8e1"
                            : "transparent",
                    color:
                      processInfo.status === "success"
                        ? "#2e7d32"
                        : processInfo.status === "error"
                          ? "#c62828"
                          : processInfo.status === "stopped"
                            ? "#f57c00"
                            : "inherit",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    border: `1px solid ${
                      processInfo.status === "success"
                        ? "#c8e6c9"
                        : processInfo.status === "error"
                          ? "#ffcdd2"
                          : processInfo.status === "stopped"
                            ? "#ffecb3"
                            : "transparent"
                    }`,
                  }}
                >
                  {processInfo.status}
                </Box>
              )}
              {processInfo.startTime && (
                <Box
                  component="span"
                  sx={{ ml: 1, fontSize: "0.75em", opacity: 0.6 }}
                >
                  Started: {processInfo.startTime}
                  {processInfo.endTime && ` | Ended: ${processInfo.endTime}`}
                </Box>
              )}
            </Box>
          ) : (
            "Output"
          )}
        </Typography>

        {/* Action buttons for the active config */}
        {activeTabConfig && (
          <ActionButtons
            sharedFormData={activeTabConfig.sharedFormData}
            loadFormData={activeTabConfig.loadFormData}
            importFormData={activeTabConfig.importFormData}
            configPath={activeTabConfig.configPath}
            currentConfigFolderId={activeTabConfig.currentConfigFolderId}
            onTestConnection={onTestConnection}
            addAlert={addAlert}
            refreshDb={refreshDb}
            validateConfig={validateConfig}
            hasActiveConfig={true}
            selectedImportFolder={selectedImportFolder}
            setCurrentPage={setCurrentPage}
          />
        )}

        {/* Clear button - show when there's process info */}
        {processInfo && (
          <Button
            size="small"
            onClick={clearOutput}
            sx={{
              ml: 1,
              minWidth: "auto",
              px: 1,
              py: 0.5,
              fontSize: "0.75rem",
              bgcolor: "rgba(0,0,0,0.05)",
              color: "text.secondary",
              "&:hover": {
                bgcolor: "rgba(0,0,0,0.1)",
              },
            }}
            disabled={isRunning || isTestingConnection}
          >
            Clear
          </Button>
        )}
      </Toolbar>

      {/* ───── content area ───── */}
      {!collapsed && (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>{children}</Box>
      )}
    </Box>
  );
}
