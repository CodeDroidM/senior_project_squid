// src/OutputUi/Terminal.jsx

import React, { useEffect, useRef } from "react";
import LinearProgress from "@mui/material/LinearProgress";
import { Box, Divider } from "@mui/material";
import { useTerminalState, useTerminalDispatch } from "./TerminalContext";

// 1) Import isElectronApp
import { isElectronApp } from "../utils/environment";

const Terminal = ({ configPath }) => {
  //eslint-disable-next-line no-unused-vars
  const { output, isRunning, isTestingConnection } = useTerminalState();
  const dispatch = useTerminalDispatch();
  const seenMessages = useRef(new Set());

  useEffect(() => {
    if (!isElectronApp) {
      // Browser alternative: Handle output differently or ignore
      return;
    }

    const handleOutput = (event, { type, data }) => {
      const message = `${data}\n`;
      if (!seenMessages.current.has(message)) {
        seenMessages.current.add(message);
        dispatch({ type: "ADD_OUTPUT", payload: message });
      }
    };

    const handleRunningStatus = (event, status) => {
      dispatch({ type: "SET_RUNNING", payload: status });
      if (status) {
        dispatch({ type: "RESET_TIMER" });
      }
    };

    const handleClearOutput = () => {
      dispatch({ type: "CLEAR_OUTPUT" });
      seenMessages.current.clear();
    };

    window.electron.ipcRenderer.removeAllListeners("esai-output");
    window.electron.ipcRenderer.removeAllListeners("esai-running");
    window.electron.ipcRenderer.removeAllListeners("esai-clear-output");

    window.electron.ipcRenderer.on("esai-output", handleOutput);
    window.electron.ipcRenderer.on("esai-running", handleRunningStatus);
    window.electron.ipcRenderer.on("esai-clear-output", handleClearOutput);

    return () => {
      window.electron.ipcRenderer.off("esai-output", handleOutput);
      window.electron.ipcRenderer.off("esai-running", handleRunningStatus);
      window.electron.ipcRenderer.off("esai-clear-output", handleClearOutput);
    };
  }, [dispatch]);

  // Browser alternative: Mock output updates

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {isRunning && <LinearProgress color="primary" />}
      <Box
        sx={{
          flexGrow: 1,
          p: 1,
          backgroundColor: "#363535",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {configPath && (
          <Box sx={{ marginBottom: "10px" }}>
            <strong>Loaded Config Path:</strong> {configPath}
          </Box>
        )}
        <Divider sx={{ backgroundColor: "gray" }} />
        <pre
          style={{
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            flexGrow: 1,
            fontSize: "12px",
            overflowY: "auto",
            overflowX: "auto", // horizontal scrolling
            maxHeight: "100%",
          }}
        >
          {output}
        </pre>
      </Box>
    </Box>
  );
};

export default Terminal;
