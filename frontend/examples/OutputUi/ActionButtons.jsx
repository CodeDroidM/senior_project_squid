import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
 // Chip,
  Paper,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
//import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
//import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";

import { useTerminalState, useTerminalDispatch } from "./TerminalContext";
import { useAuth } from "../auth/AuthProvider";
import { useScope } from "../contexts/ScopeContext";
//import { isElectronApp } from "../utils/environment";
import axiosInstance from "../auth/AxiosInstance";
import ConnectionsView from "../CoreUi/ConnectionsView";
import ConnectionForm from "../CoreUi/ConnectionForm";

import { saveConfig } from "../api/configs";

const StopButton = styled(Button)(() => ({
  backgroundColor: "#c4401a",
  color: "#fff",
  "&:hover": { backgroundColor: "#9a0007" },
}));

const POSSIBLE_ACTIONS = [
  "import",
  "update",
  "stage",
  "migrate",
  "test_connection",
  "import_folder",
  "delta_create_table",
  "delta_import",
  "delta_stage",
];

export default function ActionButtons({
  // Config data for the current active tab
  sharedFormData,
  loadFormData,
  importFormData,
  configPath,
  currentConfigFolderId,

  // Handlers
  onTestConnection,
  addAlert,
  refreshDb,

  // Validation
  validateConfig,

  // Show/hide based on whether we have an active config
  hasActiveConfig = true,

  // Import folder functionality
  selectedImportFolder,
  setCurrentPage,
}) {
  //eslint-disable-next-line no-unused-vars
  const { user } = useAuth();

  const {
    currentScope,
    toggleScope,
    isOrganizationScope,
    loading: scopeLoading,
  } = useScope();

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { isRunning } = useTerminalState();
  const dispatch = useTerminalDispatch();

  const [selectedActions, setSelectedActions] = useState([
    "import",
    "update",
    "stage",
  ]);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);

  // Connection management state
  const [connections, setConnections] = useState([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  // Track if modal is open to trigger reload
  //eslint-disable-next-line no-unused-vars
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [isConnectionFormOpen, setIsConnectionFormOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);

  // Save dialog state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  //eslint-disable-next-line no-unused-vars
  const [dbName, setDbName] = useState(null);

  // Action selection modal
  const [isActionSelectionModalOpen, setIsActionSelectionModalOpen] =
    useState(false);
  const [LoadFolder, setLoadFolder] = useState(false);

  // Job tracking
  const [currentJob, setCurrentJob] = useState({ jobId: null, taskId: null });

  // Refs for tracking state
  const didLoadServerSettings = useRef(false);
  const pollingIntervals = useRef({});
  const seenMessages = useRef(new Set());
  const pollingErrorCount = useRef({});

  // Load user settings and connections (initial and when modal opens)
  const loadConnectionsFromServer = async () => {
    setConnectionsLoading(true);
    try {
      const { data } = await axiosInstance.get("/user/settings");
      const s = data.settings || {};
      const connectionsList =
        Array.isArray(s.connections) && s.connections.length > 0
          ? s.connections
          : [
              { id: "1", name: "Production", type: "mssql", env: "" },
              { id: "2", name: "Development", type: "postgres", env: "" },
            ];
      setConnections(connectionsList);
      const connId =
        s.selectedConnectionId ||
        (connectionsList.length > 0 ? connectionsList[0].id : "");
      setSelectedConnectionId(connId);
      setTimeout(() => {
        didLoadServerSettings.current = true;
      }, 100);
    } catch (err) {
      console.error("Failed to load user settings:", err);
      const defaultConnections = [
        { id: "1", name: "Production", type: "mssql", env: "" },
        { id: "2", name: "Development", type: "postgres", env: "" },
      ];
      setConnections(defaultConnections);
      setSelectedConnectionId(defaultConnections[0].id);
      setTimeout(() => {
        didLoadServerSettings.current = true;
      }, 100);
    } finally {
      setConnectionsLoading(false);
    }
  };

  useEffect(() => {
    loadConnectionsFromServer();
  }, []);

  // Reload connections from server every time modal is opened
  useEffect(() => {
    if (isConnectionsModalOpen) {
      loadConnectionsFromServer();
    }
  }, [isConnectionsModalOpen]);

  useEffect(() => {
    setDbName(configPath || null);
  }, [configPath]);

  // Save user settings when connections change
  useEffect(() => {
    // Skip saving if settings are not loaded or no connection is selected
    if (!didLoadServerSettings.current || !selectedConnectionId) return;

    // Save the settings to the server
    axiosInstance
      .post("/user/settings", {
        settings: { connections, selectedConnectionId },
      })
      .catch((err) => {
        console.error("Failed to save user settings:", err);
      });
  }, [connections, selectedConnectionId]);

  //const handleSaveClick = () => {
  //  if (dbName) {
  //    doSaveToDb(dbName);
  //  } else {
  //    setSaveName("");
  //    setSaveModalOpen(true);
  //  }
  //};

  const doSaveToDb = async (name, folderId = null) => {
    const targetFolderId = folderId !== null ? folderId : currentConfigFolderId;

    try {
      await saveConfig({
        name,
        content: {
          SharedConfiguration: sharedFormData || {},
          LoadConfiguration: loadFormData || {},
          ImportConfiguration: importFormData || {},
        },
        folder_id: targetFolderId,
        sharing_scope: currentScope || "user",
      });

      addAlert({
        message: `Config "${name}" saved successfully`,
        severity: "success",
      });
    } catch (error) {
      console.error("Save failed:", error);
      addAlert({
        message: `Failed to save config: ${error.message}`,
        severity: "error",
      });
    }
  };

  const confirmSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    await doSaveToDb(name);
    setSaveModalOpen(false);
  };

  const runTestConnection = async () => {
    const configData = {
      SharedConfiguration: sharedFormData || {},
      LoadConfiguration: loadFormData || {},
      ImportConfiguration: importFormData || {},
    };

    const { errors } = validateConfig(configData);
    if (errors.length > 0) {
      addAlert({
        message: `Config validation failed: ${errors
          .map((e) => e.message)
          .join(", ")}`,
        severity: "error",
      });
      return;
    }

    setIsTestingConnection(true);
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "RESET_TIMER" });
    dispatch({ type: "SET_STATUS", payload: null });
    dispatch({
      type: "SET_PROCESS_INFO",
      payload: {
        name: "Test Connection",
        actions: "test_connection",
        configName: configPath || "Untitled",
      },
    });
    seenMessages.current.clear();

    try {
      const selectedConnection = connections.find(
        (conn) => conn.id === selectedConnectionId,
      );

      // Match the exact payload format from working NavBar
      const apiPayload = {
        actions: "test_connection",
        config_data: {
          SharedConfiguration: sharedFormData || {},
          LoadConfiguration: loadFormData || {},
          ImportConfiguration: importFormData || {},
          configPath: configPath || "",
        },
        env: selectedConnection?.env || "",
      };

      const { data } = await axiosInstance.post("/test-connection", apiPayload);
      const { jobId, taskId } = data; // Returns both jobId and taskId

      if (!jobId || !taskId) {
        throw new Error("Server did not return jobId/taskId");
      }

      setCurrentJob({ jobId, taskId });

      dispatch({
        type: "ADD_OUTPUT",
        payload: `Test Connection job started – Job ID: ${jobId}\n`,
      });

      // Start polling for job results
      pollJob(jobId, taskId);
    } catch (error) {
      console.error("Test connection failed:", error);
      const errorMessage = error.response?.data?.error || error.message;
      dispatch({ type: "ADD_OUTPUT", payload: `Error: ${errorMessage}\n` });
      addAlert({
        message: `Connection test failed: ${errorMessage}`,
        severity: "error",
      });
      dispatch({ type: "SET_STATUS", payload: "error" });
      dispatch({
        type: "UPDATE_PROCESS_STATUS",
        payload: { status: "error" },
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const runEsai = async () => {
    const configData = {
      SharedConfiguration: sharedFormData || {},
      LoadConfiguration: loadFormData || {},
      ImportConfiguration: importFormData || {},
    };

    const { errors } = validateConfig(configData);
    if (errors.length > 0) {
      addAlert({
        message: `Config validation failed: ${errors
          .map((e) => e.message)
          .join(", ")}`,
        severity: "error",
      });
      return;
    }

    dispatch({ type: "SET_RUNNING", payload: true });
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "RESET_TIMER" });
    dispatch({ type: "SET_STATUS", payload: null });
    dispatch({
      type: "SET_PROCESS_INFO",
      payload: {
        name: "Run",
        actions: selectedActions.join(","),
        configName: configPath || "Untitled",
      },
    });
    seenMessages.current.clear();

    try {
      const selectedConnection = connections.find(
        (conn) => conn.id === selectedConnectionId,
      );

      const config = {
        SharedConfiguration: sharedFormData || {},
        LoadConfiguration: loadFormData || {},
        ImportConfiguration: importFormData || {},
        configPath: configPath || "",
      };

      const response = await axiosInstance.post("/run-esai-inline", {
        actions: selectedActions.join(","),
        config_data: config,
        env: selectedConnection?.env || "",
      });

      if (response.data.jobId && response.data.taskId) {
        setCurrentJob({
          jobId: response.data.jobId,
          taskId: response.data.taskId,
        });

        dispatch({
          type: "ADD_OUTPUT",
          payload: `Started job ${response.data.jobId} with task ${response.data.taskId}\n`,
        });

        // Poll for job status
        pollJob(response.data.jobId, response.data.taskId);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      dispatch({ type: "ADD_OUTPUT", payload: `${errorMessage}\n` });
      addAlert({
        message: `Run failed: ${errorMessage}`,
        severity: "error",
      });
      dispatch({ type: "SET_STATUS", payload: "error" });
      dispatch({
        type: "UPDATE_PROCESS_STATUS",
        payload: { status: "error" },
      });
      dispatch({ type: "SET_RUNNING", payload: false });
    }
  };

  const pollJob = (jobId, taskId) => {
    if (!jobId) return;

    pollingErrorCount.current[jobId] = 0;

    /** index of the next log line to request */
    let nextIndex = 0;

    const pollStatus = async () => {
      try {
        const { data } = await axiosInstance.get(`/status?taskId=${taskId}`);

        // When the worker finishes, stop polling
        if (data.state === "SUCCESS" || data.state === "FAILURE") {
          let ok = false;
          if (data.info === null) {
            // Celery OK: look into the result payload for our own "error" key
            ok = !(
              data.info &&
              typeof data.info === "object" &&
              data.info.error
            );
          } else if (data.info && typeof data.info === "object") {
            // Check if there's an error field with a value
            if (data.info.error) {
              // If error exists and is not "Return code 0", it's an error
              ok = data.info.error === "Return code 0";
            } else {
              // No error field means success
              ok = true;
            }
          } else {
            // Default to error if we can't determine the state
            ok = false;
          }
          dispatch({
            type: "SET_STATUS",
            payload: ok ? "success" : "error",
          });
          dispatch({
            type: "UPDATE_PROCESS_STATUS",
            payload: { status: ok ? "success" : "error" },
          });
          clearInterval(pollingIntervals.current[jobId]);
          delete pollingIntervals.current[jobId];
          delete pollingErrorCount.current[jobId];
          seenMessages.current.clear();
          dispatch({ type: "SET_RUNNING", payload: false });
          setCurrentJob({ jobId: null, taskId: null });
        }
      } catch (err) {
        console.error(`Error polling status for job ${jobId}:`, err);
        pollingErrorCount.current[jobId] += 1;
        if (pollingErrorCount.current[jobId] >= 3) {
          clearInterval(pollingIntervals.current[jobId]);
          delete pollingIntervals.current[jobId];
          seenMessages.current.clear();
          dispatch({ type: "SET_RUNNING", payload: false });
          setCurrentJob({ jobId: null, taskId: null });
        }
      }
    };

    const pollLogs = async () => {
      try {
        // Ask only for lines we haven't seen yet
        const { data } = await axiosInstance.get(
          `/logs?jobId=${jobId}&start=${nextIndex}&limit=1000`,
        );

        const freshLines = (data.lines || []).filter(
          (line) => line && !seenMessages.current.has(line),
        );

        freshLines.forEach((line) => {
          seenMessages.current.add(line);
          dispatch({ type: "ADD_OUTPUT", payload: `${line}\n` });

          // If the worker itself printed JSON status messages,
          // surface them as toasts
          try {
            const obj = JSON.parse(line);
            if (obj.status === "success") {
              addAlert({
                message: obj.data || "Job finished",
                severity: "success",
              });
            } else if (obj.status === "failed") {
              addAlert({
                message: obj.error || "Job failed",
                severity: "error",
              });
            }
          } catch (_) {
            /* line was not JSON – ignore */
          }
        });

        if (typeof data.next === "number") nextIndex = data.next;
      } catch (err) {
        console.error(`Error fetching logs for job ${jobId}:`, err);
        dispatch({
          type: "ADD_OUTPUT",
          payload: `Error fetching logs: ${err.message}\n`,
        });
      }
    };

    pollLogs();
    pollStatus();
    pollingIntervals.current[jobId] = setInterval(() => {
      pollLogs();
      pollStatus();
    }, 2000);
  };

  const stopProcess = async () => {
    if (currentJob.jobId && currentJob.taskId) {
      try {
        await axiosInstance.post("/stop-job", {
          jobId: currentJob.jobId,
          taskId: currentJob.taskId,
        });
        dispatch({
          type: "ADD_OUTPUT",
          payload: `Job ${currentJob.jobId} stopped by user.\n`,
        });
        addAlert({
          message: "Process stopped successfully",
          severity: "info",
        });
      } catch (error) {
        console.error("Error stopping process:", error);
        dispatch({
          type: "ADD_OUTPUT",
          payload: `Error stopping job: ${error.message}\n`,
        });
        addAlert({
          message: "Failed to stop process",
          severity: "error",
        });
      }

      // Clear polling interval for this job
      if (pollingIntervals.current[currentJob.jobId]) {
        clearInterval(pollingIntervals.current[currentJob.jobId]);
        delete pollingIntervals.current[currentJob.jobId];
        delete pollingErrorCount.current[currentJob.jobId];
      }
    }

    // Clear seen messages for clean state
    seenMessages.current.clear();
    dispatch({ type: "SET_RUNNING", payload: false });
    dispatch({
      type: "UPDATE_PROCESS_STATUS",
      payload: { status: "stopped" },
    });
    setIsTestingConnection(false);
    setCurrentJob({ jobId: null, taskId: null });
  };

  // Run folder import functionality
  const runDbFolder = async (folderId) => {
    if (!folderId) {
      addAlert({ message: "No folder selected for import", severity: "error" });
      return;
    }

    // Get the selected connection's env string
    const selectedConn = connections.find(
      (conn) => conn.id === selectedConnectionId,
    );

    // Clear the output terminal
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "RESET_TIMER" });
    dispatch({ type: "SET_STATUS", payload: null });
    dispatch({
      type: "SET_PROCESS_INFO",
      payload: {
        name: "Database Folder Import",
        actions: selectedActions.join(","),
        configName: selectedImportFolder.name,
      },
    });
    seenMessages.current.clear();
    if (setCurrentPage) {
      setCurrentPage("config"); // Switch to the output view
    }
    dispatch({ type: "SET_RUNNING", payload: true });

    try {
      // Call the API endpoint to run the folder sequentially
      const { data } = await axiosInstance.post("/run-folder", {
        folder_id: folderId,
        actions: selectedActions.join(","),
        env: selectedConn?.env || "",
      });

      const { jobId, taskId } = data;

      if (jobId) {
        setCurrentJob({ jobId, taskId });
        dispatch({
          type: "ADD_OUTPUT",
          payload: `Database folder import started - Job ID: ${jobId}\nProcessing configs in folder sequentially...\n`,
        });

        // Start polling for job status
        pollJob(jobId, taskId);

        addAlert({
          message: `Started import of folder (Job ID: ${jobId})`,
          severity: "success",
        });
      } else {
        throw new Error("No jobId returned from API.");
      }
    } catch (error) {
      console.error("Error running database folder import:", error);
      dispatch({
        type: "ADD_OUTPUT",
        payload: `Error: ${error.message || "Unknown error occurred"}\n`,
      });
      addAlert({
        message: `Failed to start folder import: ${error.message}`,
        severity: "error",
      });
      dispatch({ type: "SET_RUNNING", payload: false });
      dispatch({
        type: "UPDATE_PROCESS_STATUS",
        payload: { status: "error" },
      });
    }
  };

  // Settings menu handlers
  const handleSettingsMenuOpen = (event) => {
    setSettingsAnchorEl(event.currentTarget);
    setIsSettingsMenuOpen(true);
  };

  const handleSettingsMenuClose = () => {
    setSettingsAnchorEl(null);
    setIsSettingsMenuOpen(false);
  };

  const openSelectActionsModal = () => {
    setIsActionSelectionModalOpen(true);
  };

  const handleToggleMigrations = () => {
    setLoadFolder(!LoadFolder);
  };

  // Connection management
  const handleConnectionSelect = (id) => {
    setSelectedConnectionId(id);
    console.log(`Selected connection: ${id}`);
  };

  const handleConnectionEdit = (connection) => {
    setEditingConnection(connection);
    setIsConnectionFormOpen(true);
  };

  const handleAddConnection = () => {
    setEditingConnection(null);
    setIsConnectionFormOpen(true);
  };


  // Helper to save connections to server
  const saveConnectionsToServer = (conns, selectedId) => {
    axiosInstance
      .post("/user/settings", {
        settings: {
          connections: conns,
          selectedConnectionId: selectedId,
        },
      })
      .catch((err) => {
        console.error("Failed to save user settings (connections):", err);
      });
  };

  const handleConnectionDelete = async (id) => {
    const next = connections.filter((c) => c.id !== id);
    let newSelectedId = selectedConnectionId;
    if (id === selectedConnectionId && next.length) {
      newSelectedId = next[0].id;
    } else if (id === selectedConnectionId) {
      newSelectedId = "";
    }
    try {
      await axiosInstance.post("/user/settings", {
        settings: { connections: next, selectedConnectionId: newSelectedId },
      });
      await loadConnectionsFromServer();
    } catch (err) {
      console.error("Failed to delete connection:", err);
    }
  };

  const handleConnectionFormSave = async (connection) => {
    // Save to backend immediately
    let newConnections;
    const i = connections.findIndex((c) => c.id === connection.id);
    if (i > -1) {
      newConnections = [...connections];
      newConnections[i] = connection;
    } else {
      newConnections = [...connections, connection];
    }
    try {
      await axiosInstance.post("/user/settings", {
        settings: { connections: newConnections, selectedConnectionId: connection.id },
      });
      await loadConnectionsFromServer();
      setSelectedConnectionId(connection.id);
      setIsConnectionFormOpen(false);
    } catch (err) {
      console.error("Failed to save connection:", err);
    }
  };

  // Always sync connections to server when changed
  useEffect(() => {
    if (!didLoadServerSettings.current) return;
    if (!selectedConnectionId) return;
    saveConnectionsToServer(connections, selectedConnectionId);
  }, [connections, selectedConnectionId]);

  const handleConnectionFormCancel = () => setIsConnectionFormOpen(false);

  // Listen for custom events to open connections modal (e.g., from welcome screen)
  useEffect(() => {
    const handleOpenConnectionsModal = () => {
      setIsConnectionsModalOpen(true);
    };

    window.addEventListener("openConnectionsModal", handleOpenConnectionsModal);

    return () => {
      window.removeEventListener(
        "openConnectionsModal",
        handleOpenConnectionsModal,
      );
    };
  }, []);

  if (!hasActiveConfig) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1 }}>
      <Button
        variant="contained"
        size="small"
        sx={{
          bgcolor: isTestingConnection ? "#67696a" : "#ffe923",
          color: "black",
          "&.Mui-disabled": {
            backgroundColor: "#fff", // white for disabled
            color: "#b0bac1", // gray text
            border: "1px solid #cfd8dc", // gray border
            boxShadow: "none",
          },
        }}
        startIcon={
          isTestingConnection ? (
            <CircularProgress size={18} thickness={9} color="primary" />
          ) : (
            <RocketLaunchOutlinedIcon />
          )
        }
        onClick={runTestConnection}
        disabled={isTestingConnection || isRunning}
      >
        Test
      </Button>

      {selectedImportFolder ? (
        /* === folder banner copied from NavBar === */
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: "4px 8px",
            bgcolor: "rgba(17, 123, 66, 0.15)",
            border: "1px solid rgba(17, 123, 66, 0.5)",
            borderRadius: 1,
          }}
        >
          <FolderOpenOutlinedIcon fontSize="small" sx={{ color: "black" }} />
          <Typography variant="body2" sx={{ color: "black" }}>
            Import Folder:&nbsp;{selectedImportFolder.name}
          </Typography>
          <Button
            variant="contained"
            size="small"
            sx={{
              ml: 1,
              bgcolor: "#117b42",
              color: "#fff",
              "&:hover": { bgcolor: "#0e6838" },
              p: "2px 8px",
              minWidth: "auto",
            }}
            startIcon={
              isRunning ? (
                <CircularProgress size={18} thickness={9} color="primary" />
              ) : (
                <PlayArrowIcon />
              )
            }
            onClick={() => runDbFolder(selectedImportFolder.id)}
            disabled={isRunning || isTestingConnection}
          >
            Run
          </Button>
        </Paper>
      ) : (
        <Button
          variant="contained"
          size="small"
          sx={{
            bgcolor: isRunning ? "#67696a" : "#117b42",
            color: "#fff",
            "&:hover": { bgcolor: isRunning ? "#67696a" : "#0e6838" },
            "&.Mui-disabled": {
              backgroundColor: "#fff", // white for disabled
              color: "#b0bac1", // gray text
              border: "1px solid #cfd8dc", // gray border
              boxShadow: "none",
            },
          }}
          startIcon={
            isRunning ? (
              <CircularProgress size={18} thickness={9} color="primary" />
            ) : (
              <PlayArrowIcon />
            )
          }
          onClick={runEsai}
          disabled={isRunning || isTestingConnection}
        >
          Run
        </Button>
      )}

      {(isRunning || isTestingConnection) && (
        <StopButton
          variant="contained"
          size="small"
          sx={{ ml: 1, px: 1.5, py: 0.5 }}
          onClick={stopProcess}
        >
          <StopOutlinedIcon fontSize="small" /> Stop
        </StopButton>
      )}

      <IconButton onClick={handleSettingsMenuOpen} size="small">
        <SettingsIcon sx={{ color: "black" }} />
      </IconButton>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchorEl}
        open={isSettingsMenuOpen}
        onClose={handleSettingsMenuClose}
        keepMounted
      >
        <MenuItem
          onClick={() => {
            handleSettingsMenuClose();
            setIsConnectionsModalOpen(true);
          }}
        >
          Manage Connections
        </MenuItem>
        <MenuItem
          onClick={async () => {
            handleSettingsMenuClose();
            try {
              await toggleScope();
              addAlert({
                message: `Switched to ${
                  isOrganizationScope ? "user" : "organization"
                } scope`,
                severity: "success",
              });
              if (refreshDb) {
                refreshDb();
              }
            } catch (error) {
              addAlert({
                message: `Failed to change scope: ${error.message}`,
                severity: "error",
              });
            }
          }}
          disabled={scopeLoading}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
            }}
          >
            {isOrganizationScope ? (
              <PersonOutlinedIcon fontSize="small" />
            ) : (
              <BusinessOutlinedIcon fontSize="small" />
            )}
            <Typography>
              Switch to {isOrganizationScope ? "User" : "Organization"} Scope
            </Typography>
            {scopeLoading && <CircularProgress size={16} />}
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleSettingsMenuClose();
            handleToggleMigrations();
          }}
        >
          Import Loaded Folder
          <Checkbox checked={LoadFolder} sx={{ ml: 1 }} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleSettingsMenuClose();
            openSelectActionsModal();
          }}
        >
          Select Actions
        </MenuItem>
      </Menu>

      {/* Save Modal */}
      <Dialog open={saveModalOpen} onClose={() => setSaveModalOpen(false)}>
        <DialogTitle>Save Configuration</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Configuration Name"
            fullWidth
            variant="outlined"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                confirmSave();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveModalOpen(false)}>Cancel</Button>
          <Button onClick={confirmSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connections Modal */}
      <Dialog
        open={isConnectionsModalOpen}
        onClose={() => setIsConnectionsModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Manage Connections</DialogTitle>
        <DialogContent>
          <ConnectionsView
            connections={connections}
            selectedConnectionId={selectedConnectionId}
            onSelect={handleConnectionSelect}
            onEdit={handleConnectionEdit}
            onAdd={handleAddConnection}
            onDelete={handleConnectionDelete}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIsConnectionsModalOpen(false)}
            variant="contained"
            sx={{
              backgroundColor: "#ffe923",
              color: "black",
              "&:hover": { backgroundColor: "#e6d020" },
              "&.Mui-disabled": {
                backgroundColor: "#fff", // white for disabled
                color: "#b0bac1", // gray text
                border: "1px solid #cfd8dc", // gray border
                boxShadow: "none",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Form Modal */}
      <Dialog
        open={isConnectionFormOpen}
        onClose={handleConnectionFormCancel}
        maxWidth="md"
        fullWidth
      >
        <ConnectionForm
          open={isConnectionFormOpen}
          initialConnection={editingConnection}
          onSave={handleConnectionFormSave}
          onCancel={handleConnectionFormCancel}
        />
      </Dialog>

      {/* Action Selection Modal */}
      <Dialog
        open={isActionSelectionModalOpen}
        onClose={() => setIsActionSelectionModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Actions</DialogTitle>
        <DialogContent>
          {POSSIBLE_ACTIONS.map((action) => (
            <Box key={action} sx={{ display: "flex", alignItems: "center" }}>
              <Checkbox
                checked={selectedActions.includes(action)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedActions([...selectedActions, action]);
                  } else {
                    setSelectedActions(
                      selectedActions.filter((a) => a !== action),
                    );
                  }
                }}
              />
              <Typography>{action}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsActionSelectionModalOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
