import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Snackbar,
  Alert,
  CssBaseline,
  Toolbar,
  List,
  ListItem,
  Collapse,
  ListItemText,
} from "@mui/material";
import "./App.css";
import NavBar from "./CoreUi/NavBar";

//import ConfigForm from "./ConfigEditor/ConfigForm";
import TabbedConfigEditor from "./ConfigEditor/TabbedConfigEditor";
import ConfigDrawer from "./CoreUi/ConfigDrawer";
import Output from "./OutputUi/Output";
import {
  sharedSchema,
  loadSchema,
  importSchema,
  getSourceInfoSchema,
} from "./ConfigEditor/schemas";

import { TerminalProvider } from "./OutputUi/TerminalContext";
import { OptimisticProvider } from "./contexts/OptimisticContext";
import { styled, useTheme } from "@mui/material/styles";
import Ajv from "ajv";
import { v4 as uuidv4 } from "uuid";

import CustomArrayFieldTemplate from "./ConfigEditor/ArrayFieldTemplate";
import CustomEnumField from "./ConfigEditor/CustomEnumField";

import SchedulerComponent from "./Scheduler/Scheduler";
import { SchedulerProvider } from "./Scheduler/SchedulerContext";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import RunHistory from "./History/RunHistory";
import { useAuth } from "./auth/AuthProvider";
//import { Switch, FormControlLabel } from "@mui/material";
//import ConfigCodeEditor from "./ConfigEditor/ConfigCodeEditor";
import OutputPanel from "./OutputUi/OutputPanel";
import { isElectronApp } from "./utils/environment";
import { useScope } from "./contexts/ScopeContext";

import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";



import WikiPage from "./Wiki/WikiPage";
import FilesPage from "./FilesPage/FilesPage";
import TextFileEditor from "./CoreUi/TextFileEditor";

// ---------- Helpers / MUI styles ----------
const convertStringBooleans = (obj) => {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertStringBooleans);
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    if (value === "true") {
      acc[key] = true;
    } else if (value === "false") {
      acc[key] = false;
    } else if (typeof value === "object") {
      acc[key] = convertStringBooleans(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const drawerWidth = 240;

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: open ? `${drawerWidth}px` : 0,
  }),
);

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  minHeight: 48,
  justifyContent: "flex-end",
}));

const CustomAlert = styled(Alert)(({ severity }) => {
  const severityStyles = {
    success: {
      backgroundColor: "#117b42",
      color: "#fff",
      "& .MuiAlert-icon": { color: "#fff" },
    },
    error: {
      backgroundColor: "#c4401a",
      color: "#fff",
      "& .MuiAlert-icon": { color: "#fff" },
    },
    info: {
      backgroundColor: "#67696a",
      color: "#fff",
      "& .MuiAlert-icon": { color: "#fff" },
    },
    warning: {
      backgroundColor: "#efb71f",
      color: "#fff",
      "& .MuiAlert-icon": { color: "#fff" },
    },
  };
  return severityStyles[severity] || severityStyles.success;
});

const SnackbarContainer = styled("div")({
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  zIndex: 1300,
  gap: "10px",
});

// ---------- MAIN APP COMPONENT ----------
function App() {
  // ---------- State and Hooks ----------
  //eslint-disable-next-line
  const theme = useTheme();
  const { currentScope, organizationId } = useScope();
  const [sharedFormData, setSharedFormData] = useState({});
  const [loadFormData, setLoadFormData] = useState({});
  const [importFormData, setImportFormData] = useState({});
  const [selectedSection, setSelectedSection] = useState("SharedConfiguration");
  const [currentPage, setCurrentPage] = useState("config");
  const [configPath, setConfigPath] = useState("");
  const [folderStructure, setFolderStructure] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [extraErrors, setExtraErrors] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  //eslint-disable-next-line
  const [open, setOpen] = useState(false);
  const [errorReported, setErrorReported] = useState(false);
  const [currentConfigFolderId, setCurrentConfigFolderId] = useState(null); // Track folder context

  // Track the active tab's config for the action buttons
  const [activeTabConfig, setActiveTabConfig] = useState(null);

  const [openFolders, setOpenFolders] = useState({});
  const [selectedImportFolder, setSelectedImportFolder] = useState(null);
  
  // Text file editor state
  const [textFileEditorOpen, setTextFileEditorOpen] = useState(false);
  const [currentTextFile, setCurrentTextFile] = useState(null);
  const { isLoading, isAuthenticated, loginWithRedirect } = useAuth();

  // Create ref for ConfigDrawer to access its refresh function
  const configDrawerRef = useRef();

  const handleSetImportFolder = useCallback((folder) => {
    setSelectedImportFolder(folder);
  }, []);
  // ---------- Ref to store latest config data for Electron events ----------
  const configDataRef = useRef({
    shared: sharedFormData,
    load: loadFormData,
    import: importFormData,
  });
  useEffect(() => {
    configDataRef.current = {
      shared: sharedFormData,
      load: loadFormData,
      import: importFormData,
    };
  }, [sharedFormData, loadFormData, importFormData]);

  // Expose navigation function to welcome screen
  useEffect(() => {
    window.setCurrentPage = setCurrentPage;

    return () => {
      delete window.setCurrentPage;
    };
  }, []);

  // ---------- Ref to prevent reentrant saving ----------
  const savingRef = useRef(false);

  const ipcListenersRegistered = useRef(false);

  // ---------- Callbacks ----------
  const addAlert = useCallback((alert) => {
    setAlerts((prev) => [...prev, { ...alert, key: uuidv4() }]);
  }, []);

  const removeAlert = useCallback((key) => {
    setAlerts((prev) => prev.filter((alert) => alert.key !== key));
  }, []);

  const handleTestConnection = useCallback(
    (success, error) => {
      if (success) {
        addAlert({
          message: "Connection test successful!",
          severity: "success",
        });
        setErrorReported(false);
      } else if (!errorReported && error && !error.includes("INFO")) {
        addAlert({
          message: "Connection test failed: Check terminal output",
          severity: "error",
        });
      }
    },
    [addAlert, errorReported],
  );

  const removeEmptyKeys = useCallback((obj) => {
    const newObj = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === "object") {
        const nested = removeEmptyKeys(obj[key]);
        if (Object.keys(nested).length > 0) newObj[key] = nested;
      } else if (
        obj[key] !== "" &&
        obj[key] !== null &&
        obj[key] !== undefined
      ) {
        newObj[key] = obj[key];
      }
    });
    return newObj;
  }, []);

  const customizeErrorMessage = useCallback((error, section) => {
    let message = error.message || "Invalid value";
    const instancePath = error.instancePath || "";
    if (error.keyword === "required") {
      const missingProperty = error.params.missingProperty;
      message = `Field '${missingProperty}' is required in '${section}'`;
    } else if (error.keyword === "type") {
      message = `Field '${instancePath.replace(/\./g, " -> ")}' should be of type '${error.params.type}' in section '${section}'`;
    } else if (error.keyword === "enum") {
      message = `Field '${instancePath.replace(/\./g, " -> ")}' should be one of ${error.params.allowedValues.join(", ")} in section '${section}'`;
    }
    return message;
  }, []);

  const validateConfig = useCallback(
    (data) => {
      const ajv = new Ajv({ allErrors: true, messages: false });
      const errors = [];
      const errorDetails = {};

      const validateSchema = (schema, formData, section) => {
        const validate = ajv.compile(schema);
        const valid = validate(formData);
        if (!valid) {
          validate.errors.forEach((error) => {
            const path = error.instancePath
              ? error.instancePath.slice(1).replaceAll("/", ".")
              : "";
            const message = customizeErrorMessage(error, section);
            errors.push({ section, instancePath: path, message });
            if (!errorDetails[path]) {
              errorDetails[path] = { __errors: [] };
            }
            errorDetails[path].__errors.push(message);
          });
        }
      };

      validateSchema(
        data.SharedConfiguration ? sharedSchema : {},
        data.SharedConfiguration,
        "Shared Configuration",
      );
      validateSchema(
        data.LoadConfiguration ? loadSchema : {},
        data.LoadConfiguration,
        "Load Configuration",
      );
      validateSchema(
        data.ImportConfiguration ? importSchema : {},
        data.ImportConfiguration,
        "Import Configuration",
      );

      return { errors, errorDetails };
    },
    [customizeErrorMessage],
  );

  // Save config function for tabbed editor
  const handleSaveConfigFromTab = useCallback(
    async (configData, tabInfo) => {
      console.log("=== APP.JSX SAVE DEBUG START ===");
      console.log("handleSaveConfigFromTab called with:", {
        configData,
        tabInfo,
      });

      const cleanFormData = removeEmptyKeys(configData);
      console.log("Clean form data:", cleanFormData);

      const { errors, errorDetails } = validateConfig(cleanFormData);
      console.log("Validation result:", { errors, errorDetails });

      if (errors.length > 0) {
        const errorMessage = `Validation failed: ${errors.map((e) => e.message).join(", ")}`;
        console.error("Validation errors:", errorMessage);
        addAlert({
          message: errorMessage,
          severity: "error",
        });
        setExtraErrors(errorDetails);
        throw new Error(errorMessage);
      }

      setExtraErrors({});
      console.log("isElectronApp:", isElectronApp);

      if (isElectronApp) {
        console.log("Saving via Electron...");
        return new Promise((resolve, reject) => {
          window.electron.ipcRenderer
            .invoke(
              "save-config",
              JSON.stringify(cleanFormData, null, 2),
              tabInfo.filePath,
            )
            .then(() => {
              console.log("Electron save successful");
              addAlert({
                message: "Config saved successfully",
                severity: "success",
              });
              resolve();
            })
            .catch((error) => {
              console.error("Electron save failed:", error);
              addAlert({
                message: `Failed to save config: ${error.message}`,
                severity: "error",
              });
              reject(new Error(error.message || "Failed to save config"));
            });
        });
      } else {
        console.log("Saving to database via API...");
        try {
          // Import the saveConfig API function
          const { saveConfig } = await import("./api/configs.jsx");

          // Determine the config name
          let configName = tabInfo.name;
          if (
            !configName ||
            configName === "New Config" ||
            configName.startsWith("New Config")
          ) {
            configName = `config_${Date.now()}.json`;
          }
          // Note: Do not automatically add .json extension to user-provided names


          const requestPayload = {
            name: configName,
            content: cleanFormData,
            folder_id: tabInfo.folderId,
            sharing_scope: currentScope || "user", // Always include scope, default to "user"
            ...(currentScope === "organization" && organizationId ? { organization_id: organizationId } : {}),
          };

          console.log("Calling saveConfig API with payload:", requestPayload);

          // Track timing
          const startTime = performance.now();
          const result = await saveConfig(requestPayload);
          const endTime = performance.now();

          console.log(`Database save completed in ${endTime - startTime}ms`);
          console.log("Database save result:", result);

          // Verify the save by fetching the config list
          try {
            console.log("Verifying save by fetching updated config list...");
            const { listConfigs } = await import("./api/configs.jsx");
            const allConfigs = await listConfigs();

            const savedConfig = allConfigs.find((c) => c.name === configName);
            if (savedConfig) {
              console.log("✅ Save verified - config found:", {
                id: savedConfig.id,
                name: savedConfig.name,
                updated_at: savedConfig.updated_at,
                folder_id: savedConfig.folder_id,
              });

              // Also verify the content
              try {
                const { getConfig } = await import("./api/configs.jsx");
                const configDetails = await getConfig(savedConfig.id);
                console.log("✅ Config content verified:", {
                  hasContent: !!configDetails.content,
                  contentKeys: configDetails.content
                    ? Object.keys(configDetails.content)
                    : [],
                });
              } catch (contentError) {
                console.warn(
                  "Could not verify config content:",
                  contentError.message,
                );
              }
            } else {
              console.error(
                "❌ Save verification failed - config not found in list!",
              );
              console.log(
                "Available configs:",
                allConfigs.map((c) => ({ id: c.id, name: c.name })),
              );
            }
          } catch (verifyError) {
            console.warn(
              "Could not verify save (list fetch failed):",
              verifyError.message,
            );
          }

          addAlert({
            message: `Config "${configName}" saved successfully to database`,
            severity: "success",
          });

          // Refresh ConfigDrawer to show updated configs
          if (configDrawerRef.current) {
            console.log("Refreshing ConfigDrawer after successful save...");
            // Invalidate cache for the specific config that was just saved
            configDrawerRef.current.invalidateConfigCache(configName, tabInfo.folderId);
            // Also refresh all data for good measure
            configDrawerRef.current.refreshAllDb();
          }

          console.log("=== APP.JSX SAVE DEBUG END ===");
          return result;
        } catch (error) {
          console.error("=== DATABASE SAVE ERROR ===");
          console.error("Error type:", error.constructor.name);
          console.error("Error message:", error.message);
          console.error("Error response status:", error.response?.status);
          console.error("Error response data:", error.response?.data);
          console.error("Full error object:", error);

          const errorMessage =
            error.response?.data?.detail || error.message || "Unknown error";
          addAlert({
            message: `Failed to save config to database: ${errorMessage}`,
            severity: "error",
          });

          // Fallback to localStorage if API fails
          console.log("Falling back to localStorage...");
          try {
            const configKey = tabInfo.filePath || `config_${tabInfo.id}`;
            const storageKey = `esai_config_${configKey}`;
            console.log("Storage key:", storageKey);

            localStorage.setItem(storageKey, JSON.stringify(cleanFormData));
            console.log("✅ Saved to localStorage successfully");

            addAlert({
              message: "Config saved to local storage as fallback",
              severity: "warning",
            });
          } catch (localStorageError) {
            console.error(
              "❌ localStorage fallback also failed:",
              localStorageError,
            );
            addAlert({
              message: "Failed to save config anywhere",
              severity: "error",
            });
          }

          console.log("=== APP.JSX SAVE DEBUG END ===");
          throw error; // Re-throw the original error
        }
      }
    },
    [removeEmptyKeys, validateConfig, addAlert, currentScope, organizationId],
  );

  // Handle active tab changes - this provides config data to the OutputPanel
  const handleActiveTabChange = useCallback((tabConfig) => {
    console.log("Active tab changed:", tabConfig);
    setActiveTabConfig(tabConfig);
  }, []);

  // When saving via Electron, use a saving lock to prevent duplicate calls.
  const handleSave = useCallback(() => {
    if (savingRef.current) return;
    savingRef.current = true;

    const combinedData = {
      SharedConfiguration: configDataRef.current.shared || {},
      LoadConfiguration: configDataRef.current.load || {},
      ImportConfiguration: configDataRef.current.import || {},
    };

    const cleanFormData = removeEmptyKeys(combinedData);
    const { errors, errorDetails } = validateConfig(cleanFormData);
    if (errors.length > 0) {
      errors.forEach((error) => {
        addAlert({
          message: `Validation failed: ${error.message}`,
          severity: "error",
        });
      });
      setExtraErrors(errorDetails);
      savingRef.current = false;
      return;
    }

    setExtraErrors({});
    if (isElectronApp) {
      const jsonData = JSON.stringify(cleanFormData, null, 2);
      window.electron.ipcRenderer
        .invoke("save-config", jsonData)
        .then(() => {
          addAlert({
            message: "Config saved successfully",
            severity: "success",
          });
          savingRef.current = false;
        })
        .catch(() => {
          addAlert({
            message: "An error occurred while saving config",
            severity: "error",
          });
          savingRef.current = false;
        });
    }
  }, [removeEmptyKeys, validateConfig, addAlert]);

  const handleSaveAs = useCallback(() => {
    const combinedData = {
      SharedConfiguration: sharedFormData,
      LoadConfiguration: loadFormData,
      ImportConfiguration: importFormData,
    };
    const cleanFormData = removeEmptyKeys(combinedData);
    const { errors, errorDetails } = validateConfig(cleanFormData);
    if (errors.length > 0) {
      errors.forEach((error) => {
        addAlert({
          message: `Validation failed: ${error.message}`,
          severity: "error",
        });
      });
      setExtraErrors(errorDetails);
      return;
    }
    setExtraErrors({});
    if (isElectronApp) {
      window.electron.ipcRenderer
        .invoke("save-as-config", JSON.stringify(cleanFormData, null, 2))
        .then((filePath) => {
          if (filePath) {
            setConfigPath(filePath);
            addAlert({
              message: "Config saved successfully",
              severity: "success",
            });
          }
        })
        .catch(() =>
          addAlert({
            message: "An error occurred while saving config",
            severity: "error",
          }),
        );
    } else {
      try {
        const blob = new Blob([JSON.stringify(cleanFormData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "config.json";
        a.click();
        URL.revokeObjectURL(url);
        addAlert({
          message: "Config saved successfully (Browser)",
          severity: "success",
        });
      } catch (error) {
        addAlert({
          message: "An error occurred while saving config (Browser)",
          severity: "error",
        });
      }
    }
  }, [
    sharedFormData,
    loadFormData,
    importFormData,
    removeEmptyKeys,
    validateConfig,
    addAlert,
  ]);

  const handleRunningStatus = useCallback((event, status) => {
    setIsRunning(status);
  }, []);

  const handleSaveConfig = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleSaveAsConfig = useCallback(() => {
    handleSaveAs();
  }, [handleSaveAs]);

  // Handle saving text files (GraphQL, SQL, etc.)
  const handleTextFileSave = useCallback(async (file) => {
    try {
      if (!file) {
        console.error('No file provided to save');
        return;
      }

      const { saveConfig } = await import("./api/configs.jsx");
      
      // Update the config with new raw content
      const content = {
        raw_content: file.content,
        file_type: file.name?.split('.').pop()?.toLowerCase() || 'txt',
        category: file.fileType || 'text',
        metadata: {
          lastModified: new Date().getTime(),
          size: file.content?.length || 0
        }
      };

      await saveConfig({
        name: file.name || 'untitled.txt',
        content,
        folder_id: file.folderId || null,
        sharing_scope: currentScope || "user",
      });

      addAlert({
        message: `Saved "${file.name || 'file'}"`,
        severity: "success",
      });

      // Refresh the config drawer to show updated content
      if (configDrawerRef.current) {
        configDrawerRef.current.refreshAllDb();
      }

      setTextFileEditorOpen(false);
      setCurrentTextFile(null);
    } catch (error) {
      console.error("Failed to save text file:", error);
      addAlert({
        message: `Failed to save "${file?.name || 'file'}"`,
        severity: "error",
      });
    }
  }, [addAlert, currentScope]);

  // ---------- Additional Helpers ----------

  const updateSchema = useCallback(
    (sourceType) => {
      const newSchema = { ...importSchema };
      if (sourceType) {
        newSchema.properties.SourceInfo = getSourceInfoSchema(sourceType);
      }

      sections.ImportConfiguration.schema = newSchema;
    },
    //eslint-disable-next-line
    [],
  );

  const handleSourceTypeChange = useCallback(
    ({ formData }) => {
      const sourceType = formData?.SourceType;
      if (sourceType) {
        updateSchema(sourceType);
      }
      setImportFormData(formData);
    },
    [updateSchema],
  );

  const handleSubmit = useCallback(
    ({ formData }) => {
      switch (selectedSection) {
        case "SharedConfiguration":
          setSharedFormData(formData);
          break;
        case "LoadConfiguration":
          setLoadFormData(formData);
          break;
        case "ImportConfiguration":
          setImportFormData(formData);
          break;
        default:
          break;
      }
    },
    [selectedSection],
  );

  const handleLoad = useCallback(() => {
    if (isElectronApp) {
      window.electron.ipcRenderer
        .invoke("load-config")
        .then((result) => {
          if (result) {
            const { data, filePath } = result;
            let parsedData = JSON.parse(data);
            parsedData = convertStringBooleans(parsedData);
            setSharedFormData(parsedData.SharedConfiguration || {});
            setLoadFormData(parsedData.LoadConfiguration || {});
            setImportFormData(parsedData.ImportConfiguration || {});
            setConfigPath(filePath);
            if (parsedData.ImportConfiguration?.SourceType) {
              updateSchema(parsedData.ImportConfiguration.SourceType);
            }
            setIsRunning(false);
            addAlert({
              message: "Config loaded successfully",
              severity: "success",
            });
          } else {
            addAlert({ message: "Failed to load config", severity: "error" });
          }
        })
        .catch(() =>
          addAlert({
            message: "An error occurred while loading config",
            severity: "error",
          }),
        );
    } else {
      try {
        const data = localStorage.getItem("config");
        if (data) {
          let parsedData = JSON.parse(data);
          parsedData = convertStringBooleans(parsedData);
          setSharedFormData(parsedData.SharedConfiguration || {});
          setLoadFormData(parsedData.LoadConfiguration || {});
          setImportFormData(parsedData.ImportConfiguration || {});
          setConfigPath("Local Storage");
          if (parsedData.ImportConfiguration?.SourceType) {
            updateSchema(parsedData.ImportConfiguration.SourceType);
          }
          setIsRunning(false);
          addAlert({
            message: "Config loaded successfully (Browser)",
            severity: "success",
          });
        } else {
          addAlert({
            message: "No config found in localStorage",
            severity: "error",
          });
        }
      } catch (error) {
        addAlert({
          message: "An error occurred while loading config (Browser)",
          severity: "error",
        });
      }
    }
  }, [updateSchema, addAlert]);

  const handleLoadFolder = useCallback(() => {
    if (isElectronApp) {
      window.electron.ipcRenderer.invoke("load-folder").catch(() => {
        addAlert({
          message: "An error occurred while loading the folder",
          severity: "error",
        });
      });
    } else {
      addAlert({
        message: "Folder loading is not supported in the browser",
        severity: "info",
      });
    }
  }, [addAlert]);

  const handleSelectFile = useCallback(
    (file) => {
      console.log('=== HANDLE SELECT FILE CALLED ===');
      console.log('Full file object:', file);
      
      /******************************************************************
       * 1. BROWSER – file arrived from ConfigDrawer / folder tree / DB
       ******************************************************************/
      if (!isElectronApp && file && file.content !== undefined) {
        console.log('Browser environment, processing file...');
        
        // Check if this is a text file that should be opened in the text editor
        if (file.isTextFile && file.fileType) {
          console.log('Text file detected:', {
            name: file.name,
            fileType: file.fileType,
            category: file.category,
            isTextFile: file.isTextFile,
            windowTabbedEditor: !!window.tabbedEditor,
            openTextFileMethod: !!(window.tabbedEditor && window.tabbedEditor.openTextFile)
          });
          
          // Open all text-based files (GraphQL, SQL, YAML, etc.) in text editor tabs
          if (window.tabbedEditor && window.tabbedEditor.openTextFile) {
            console.log('Opening text file in tabbed editor...');
            window.tabbedEditor.openTextFile({
              name: file.name || file.filePath || "Text File",
              content: file.content, // Raw text content
              filePath: file.filePath,
              folderId: file.folderId,
              folderPath: file.folderPath,
              fileType: file.fileType, // 'graphql', 'sql', 'yaml', 'xml', 'markdown', 'text'
              category: file.category, // 'query', 'database', 'markup', 'document'
            });
          } else {
            console.log('Tabbed editor not available, using fallback...');
            // Fallback to separate dialog if tabbed editor not available
            setCurrentTextFile(file);
            setTextFileEditorOpen(true);
          }
          return;
        } else {
          console.log('Not a text file, processing as JSON config...');
        }
        
        try {
          // ➊ Turn the payload into an object; content may be a string or a JS object
          let parsedData =
            typeof file.content === "string"
              ? JSON.parse(file.content) // folder click → raw JSON string
              : file.content; // DB click    → already a JS object

          // ➋ Normalise "true" / "false" strings that live inside the JSON
          parsedData = convertStringBooleans(parsedData);

          // ➌ Always use tabbed editor to load configs
          if (window.tabbedEditor) {
            window.tabbedEditor.loadConfig({
              name: file.name || file.filePath || "Loaded Config",
              SharedConfiguration: parsedData.SharedConfiguration || {},
              LoadConfiguration: parsedData.LoadConfiguration || {},
              ImportConfiguration: parsedData.ImportConfiguration || {},
              filePath: file.filePath,
              folderId: file.folderId,
            });
          } else {
            // Fallback to updating main state (shouldn't happen since tabbed editor is default)
            setSharedFormData(parsedData.SharedConfiguration || {});
            setLoadFormData(parsedData.LoadConfiguration || {});
            setImportFormData(parsedData.ImportConfiguration || {});

            setCurrentConfigFolderId(file.folderId || null);
            setConfigPath(
              file.filePath || // Electron‐style path when present
                file.name || // folder upload file object
                "Loaded from folder", // fallback
            );
          }

          setIsRunning(false);
          addAlert({
            message: "Config loaded successfully",
            severity: "success",
          });
        } catch (err) {
          console.error(err);
          addAlert({
            message: "Failed to parse the selected config",
            severity: "error",
          });
        }
        return;
      }

      /******************************************************************
       * 2. ELECTRON – user clicked a node, we ask main process to read it
       ******************************************************************/
      if (isElectronApp) {
        // Clear folder context for Electron-loaded files
        setCurrentConfigFolderId(null);

        window.electron.ipcRenderer
          .invoke("load-file", file)
          .then((result) => {
            if (!result) return;
            const { data, filePath } = result;

            let parsedData = JSON.parse(data);
            parsedData = convertStringBooleans(parsedData);

            setSharedFormData(parsedData.SharedConfiguration || {});
            setLoadFormData(parsedData.LoadConfiguration || {});
            setImportFormData(parsedData.ImportConfiguration || {});
            setConfigPath(filePath);
            setIsRunning(false);
            addAlert({
              message: `Config ${filePath} loaded successfully`,
              severity: "success",
            });
          })
          .catch(() =>
            addAlert({
              message: "An error occurred while loading the file",
              severity: "error",
            }),
          );
        return;
      }

      /******************************************************************
       * 3. BROWSER – manual "Load file" button (fallback)
       ******************************************************************/
      // Clear folder context for manually loaded files
      setCurrentConfigFolderId(null);

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            let parsedData = JSON.parse(event.target.result);
            parsedData = convertStringBooleans(parsedData);

            setSharedFormData(parsedData.SharedConfiguration || {});
            setLoadFormData(parsedData.LoadConfiguration || {});
            setImportFormData(parsedData.ImportConfiguration || {});
            setConfigPath(selectedFile.name);
            setIsRunning(false);
            addAlert({
              message: `Config ${selectedFile.name} loaded successfully (Browser)`,
              severity: "success",
            });
          } catch (err) {
            console.error(err);
            addAlert({
              message: "Failed to parse the selected file",
              severity: "error",
            });
          }
        };
        reader.readAsText(selectedFile);
      };
      input.click();
    },
    [addAlert], // make sure addAlert is in deps; other setters are stable from React
  );

  const uiSchema = {
    "ui:field:showError": true,
    "ui:submitButtonOptions": { norender: true },
    "ui:field:CustomenumField": CustomEnumField,
    "ui:ArrayFieldTemplate": CustomArrayFieldTemplate,
    Columns: { "ui:field": "EditableTable" },
    SourceInfo: {
      "ui:order": ["RequestTester", "Url", "AuthenticationMethod", "*"],
      RequestTester: { "ui:field": "RequestTesterField" },
    },
  };

  const sections = {
    SharedConfiguration: {
      title: "Shared Configuration",
      schema: sharedSchema,
    },
    LoadConfiguration: {
      title: "Load Configuration",
      schema: loadSchema,
    },
    ImportConfiguration: {
      title: "Import Configuration",
      schema: importSchema,
    },
  };

  const config = { ...sharedFormData, ...loadFormData, ...importFormData };

  // ---------- Electron IPC Listeners (Register Once) ----------
  useEffect(() => {
    if (!isElectronApp || ipcListenersRegistered.current) return;
    const { ipcRenderer } = window.electron;

    const onEsaiRunning = handleRunningStatus;
    const onSaveConfig = handleSaveConfig;
    const onSaveAsConfig = handleSaveAsConfig;
    const onLoadConfig = async () => {
      const result = await ipcRenderer.invoke("load-config");
      if (result) {
        const { data, filePath } = result;
        let parsedData = JSON.parse(data);
        parsedData = convertStringBooleans(parsedData);

        // Use the tabbed editor to load the config if available
        if (window.tabbedEditor && window.tabbedEditor.loadConfig) {
          window.tabbedEditor.loadConfig({
            name: filePath
              ? filePath.split(/[\\/]/).pop().replace(".json", "")
              : "Loaded Config",
            SharedConfiguration: parsedData.SharedConfiguration || {},
            LoadConfiguration: parsedData.LoadConfiguration || {},
            ImportConfiguration: parsedData.ImportConfiguration || {},
            filePath: filePath,
          });
        } else {
          // Fallback to old single-config state for backward compatibility
          setSharedFormData(parsedData.SharedConfiguration || {});
          setLoadFormData(parsedData.LoadConfiguration || {});
          setImportFormData(parsedData.ImportConfiguration || {});
          setConfigPath(filePath);
        }

        if (parsedData.ImportConfiguration?.SourceType) {
          updateSchema(parsedData.ImportConfiguration.SourceType);
        }
        setIsRunning(false);
        addAlert({
          message: "Config loaded successfully",
          severity: "success",
        });
      } else {
        addAlert({ message: "Failed to load config", severity: "error" });
      }
    };
    const onLoadFolder = async () => {
      const folderStructure = await ipcRenderer.invoke("load-folder");
      if (folderStructure) {
        setFolderStructure(folderStructure);
        addAlert({
          message: "Folder loaded successfully",
          severity: "success",
        });
      } else {
        addAlert({ message: "Failed to load folder", severity: "error" });
      }
    };
    const onNewConfigEditor = () => {
      setSharedFormData({});
      setLoadFormData({});
      setImportFormData({});
      setConfigPath("");
      addAlert({ message: "New config editor loaded", severity: "success" });
    };

    ipcRenderer.on("esai-running", onEsaiRunning);
    ipcRenderer.on("save-config", onSaveConfig);
    ipcRenderer.on("save-as-config", onSaveAsConfig);
    ipcRenderer.on("load-config", onLoadConfig);
    ipcRenderer.on("load-folder", onLoadFolder);
    ipcRenderer.on("new-config-editor", onNewConfigEditor);

    ipcListenersRegistered.current = true;

    return () => {
      if (!ipcListenersRegistered.current) return;

      ipcRenderer.removeListener("esai-running", onEsaiRunning);
      ipcRenderer.removeListener("save-config", onSaveConfig);
      ipcRenderer.removeListener("save-as-config", onSaveAsConfig);
      ipcRenderer.removeListener("load-config", onLoadConfig);
      ipcRenderer.removeListener("load-folder", onLoadFolder);
      ipcRenderer.removeListener("new-config-editor", onNewConfigEditor);

      ipcListenersRegistered.current = false;
    };
  }, [
    handleRunningStatus,
    handleSaveConfig,
    handleSaveAsConfig,
    updateSchema,
    setFolderStructure,
    setSharedFormData,
    setLoadFormData,
    setImportFormData,
    setConfigPath,
    setIsRunning,
    addAlert,
  ]);

  // ------------------- Folder Tree Rendering -------------------
  function renderFolderTree(structure, parentPath = "") {
    return Object.keys(structure).map((key) => {
      const value = structure[key];
      const fullPath = parentPath ? `${parentPath}/${key}` : key;
      const isFolder = typeof value === "object" && !("content" in value);
      const isOpen = openFolders[fullPath];
      
      return (
        <div key={fullPath}>
          <ListItem
            button
            onClick={() => {
              if (isFolder) {
                setOpenFolders((prev) => ({
                  ...prev,
                  [fullPath]: !prev[fullPath],
                }));
              } else {
                if (!isElectronApp && !value.content) return;
                
                // Detect if this is a text file based on extension
                const extension = key.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
                const isGraphQL = ['.graphql', '.gql'].includes(extension);
                const isSQL = ['.sql'].includes(extension);
                const isTextFile = isGraphQL || isSQL || ['.txt', '.md', '.yaml', '.yml', '.xml'].includes(extension);
                
                // Enhanced file object with text file detection
                const enhancedFile = {
                  ...value,
                  name: key,
                  filePath: fullPath,
                  isTextFile: isTextFile,
                  fileType: isGraphQL ? 'query' : isSQL ? 'database' : 'text',
                };
                
                handleSelectFile(enhancedFile);
              }
            }}
            sx={{ pl: parentPath ? 4 : 2 }}
          >
            {isFolder ? (
              isOpen ? (
                <ExpandMore sx={{ mr: 1 }} />
              ) : (
                <ChevronRight sx={{ mr: 1 }} />
              )
            ) : null}
            {isFolder ? (
              <FolderOpenOutlinedIcon sx={{ mr: 2 }} />
            ) : (
              <InsertDriveFileOutlinedIcon sx={{ mr: 2 }} />
            )}
            <ListItemText primary={key} />
          </ListItem>
          {isFolder && (
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderFolderTree(value, fullPath)}
              </List>
            </Collapse>
          )}
        </div>
      );
    });
  }

  // LOAD SINGLE FILE & DOWNLOAD CONFIG...
  const handleLoadSingleFile = () => {
    if (isElectronApp) {
      window.electron.ipcRenderer
        .invoke("load-file")
        .then((result) => {
          if (result) {
            const { data, filePath } = result;
            try {
              handleSelectFile({ content: data, filePath });
            } catch (error) {
              console.error("Error parsing file:", error);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load file:", err);
        });
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              handleSelectFile({
                content: event.target.result,
                filePath: file.name,
              });
            } catch (error) {
              console.error("Failed to load file:", error);
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    }
  };

  const handleDownloadConfig = () => {
    const pickedName = (() => {
      if (configPath && configPath.trim()) {
        const base = configPath.split(/[\\/]/).pop();

        return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
      }
      return "current-config.json";
    })();

    // create & trigger the download
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = pickedName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Conditional Rendering ----------
  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading authentication...</div>;
  }
  if (!isAuthenticated) {
    loginWithRedirect();
    return <div>Redirecting to Auth0...</div>;
  }

  // ---------- Render Main UI ----------
  return (
    <DndProvider backend={HTML5Backend}>
      <OptimisticProvider>
        <TerminalProvider>
          <CssBaseline />
        <NavBar
          handleLoad={handleLoad}
          handleSave={handleSave}
          handleSaveAs={handleSave}
          handleLoadFolder={handleLoadFolder}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          config={config}
          sharedFormData={sharedFormData}
          loadFormData={loadFormData}
          importFormData={importFormData}
          configPath={configPath}
          currentConfigFolderId={currentConfigFolderId}
          isRunning={isRunning}
          folderStructure={folderStructure}
          onSelectFile={handleSelectFile}
          setFolderStructure={setFolderStructure}
          onTestConnection={handleTestConnection}
          addAlert={addAlert}
          removeAlert={removeAlert}
          validateConfig={validateConfig}
          selectedImportFolder={selectedImportFolder}
          refreshDb={() => configDrawerRef.current?.refreshAllDb()}
        />
        <Toolbar />

        <Box sx={{ display: "flex", height: "95vh", overflow: "hidden" }}>
          <ConfigDrawer
            ref={configDrawerRef}
            variant="permanent"
            anchor="left"
            open
            sx={{ "& .MuiDrawer-paper": { width: 240 } }}
            folderStructure={folderStructure}
            renderFolderTree={renderFolderTree}
            onSelectConfigFromDb={handleSelectFile}
            onSelectFile={handleSelectFile}
            addAlert={addAlert}
            setFolderStructure={setFolderStructure}
            currentConfig={activeTabConfig ? {
              SharedConfiguration: activeTabConfig.sharedFormData || {},
              LoadConfiguration: activeTabConfig.loadFormData || {},
              ImportConfiguration: activeTabConfig.importFormData || {},
            } : {
              SharedConfiguration: sharedFormData,
              LoadConfiguration: loadFormData,
              ImportConfiguration: importFormData,
            }}
            onBrowseFolder={isElectronApp ? handleLoadFolder : undefined}
            onLoadFile={handleLoadSingleFile}
            onDownloadCurrent={handleDownloadConfig}
            onSetImportFolder={handleSetImportFolder}
            selectedImportFolder={selectedImportFolder}
          />
          <Main
            open={open}
            sx={{
              padding: 0,
              overflow: "hidden",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <DrawerHeader />
            <Box
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                overflow: "auto",
                position: "relative", // Enable absolute positioning for OutputPanel
              }}
            >
              {currentPage === "config" && (
                <Box
                  sx={{
                    flexGrow: 1,
                    overflow: "auto",
                    height: "100%",
                    position: "relative",
                  }}
                >
                  <TabbedConfigEditor
                    selectedSection={selectedSection}
                    setSelectedSection={setSelectedSection}
                    handleSubmit={handleSubmit}
                    handleSourceTypeChange={handleSourceTypeChange}
                    sections={sections}
                    uiSchema={uiSchema}
                    extraErrors={extraErrors}
                    validateConfig={validateConfig}
                    onSaveConfig={handleSaveConfigFromTab}
                    onActiveTabChange={handleActiveTabChange}
                    onSaveTextFile={handleTextFileSave}
                    addAlert={addAlert}
                    initialConfigs={
                      // Only pass initial config if there's actual data
                      (sharedFormData &&
                        Object.keys(sharedFormData).length > 0) ||
                      (loadFormData &&
                        Object.keys(loadFormData).length > 0) ||
                      (importFormData &&
                        Object.keys(importFormData).length > 0) ||
                      configPath
                        ? [
                            {
                              name: configPath
                                ? configPath
                                    .split(/[\\/]/)
                                    .pop()
                                    .replace(".json", "")
                                : "Current Config",
                              SharedConfiguration: sharedFormData,
                              LoadConfiguration: loadFormData,
                              ImportConfiguration: importFormData,
                              filePath: configPath,
                              folderId: currentConfigFolderId,
                            },
                          ]
                        : [] // Start with empty tabs if no config data
                    }
                  />

                  {/* OutputPanel overlays on config page */}
                  <OutputPanel
                    initialHeight={0} // Start closed
                    activeTabConfig={activeTabConfig}
                    onTestConnection={handleTestConnection}
                    addAlert={addAlert}
                    refreshDb={() => configDrawerRef.current?.refreshAllDb()}
                    validateConfig={validateConfig}
                    selectedImportFolder={selectedImportFolder}
                    setCurrentPage={setCurrentPage}
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      boxShadow: "0 -2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    <Output configPath={configPath} />
                  </OutputPanel>
                </Box>
              )}

              {currentPage === "scheduler" && (
                <SchedulerProvider>
                  <SchedulerComponent
                    sharedFormData={sharedFormData}
                    loadFormData={loadFormData}
                    importFormData={importFormData}
                  />
                </SchedulerProvider>
              )}

              {currentPage === "history" && <RunHistory />}

              {currentPage === "storage" && <FilesPage addAlert={addAlert} />}

              {currentPage === "wiki" && <WikiPage />}
            </Box>
          </Main>
        </Box>

        {/* Text File Editor Dialog */}
        <TextFileEditor
          open={textFileEditorOpen}
          onClose={() => setTextFileEditorOpen(false)}
          onSave={handleTextFileSave}
          file={currentTextFile}
        />
        
        <SnackbarContainer>
          {alerts.map((alert, index) => (
            <Snackbar
              key={alert.key}
              open
              autoHideDuration={4000}
              onClose={() => removeAlert(alert.key)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              style={{ bottom: `${index * 60}px` }}
            >
              <CustomAlert
                onClose={() => removeAlert(alert.key)}
                severity={alert.severity}
                sx={{ width: "100%" }}
              >
                {alert.message}
              </CustomAlert>
            </Snackbar>
          ))}
        </SnackbarContainer>
        </TerminalProvider>
      </OptimisticProvider>
    </DndProvider>
  );
}

export default App;
