import React, { useState, useCallback, useRef, useEffect } from "react";

import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Typography,
  //Paper,
  FormControlLabel,
  Switch,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Card,
  CardContent,
  CardActions,
  Grid,
  Container,
 
} from "@mui/material";



import { styled } from "@mui/material/styles";
import ConfigForm from "./ConfigForm";
import ConfigCodeEditor from "./ConfigCodeEditor";
import TextFileTabEditor from "./TextFileTabEditor";
import { useScope } from "../contexts/ScopeContext";
import {
  CloseOutlined as CloseIcon,
  AddOutlined as AddIcon,
  SaveOutlined as SaveIcon,
  SaveAltOutlined as SaveAllIcon,
  FileCopyOutlined as FileCopyIcon,
  FolderOpenOutlined as FolderOpenIcon,
  UploadOutlined as UploadIcon,
  StorageOutlined as StorageIcon,
  DragIndicatorOutlined as DragIcon,
  Code as CodeIcon,

  DataObject as DataObjectIcon,
  GraphicEq as GraphqlIconCorrect,
  Article as ArticleIcon,

  InsertDriveFile as InsertFileOutlined,
} from "@mui/icons-material";

import { CircularProgress } from "@mui/material";




const StyledTab = styled(Tab)(({ theme }) => ({
  color: "#000",
  textTransform: "none",
  minWidth: "auto",

  /* slimmer sizing */
  padding: "4px 12px",
  minHeight: 32,

  /* typography */
  fontSize: "0.75rem",
  fontWeight: 500,

  /* stacking so the hair‑line appears beneath */
  position: "relative",
  zIndex: 2,
  marginTop: 15,

  /* ─── selected state ───────────────────────────────────────────────── */
  "&.Mui-selected": {
    color: "#000",
    backgroundColor: "#FFEB3B",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottom: "1px solid #FFEB3B", // hides the hair‑line under selected tab
  },

  /* ─── interaction states ───────────────────────────────────────────── */
  "&:hover:not(.Mui-selected)": { textDecoration: "underline" },
  "&.Mui-selected:hover": {
    backgroundColor: "#FFEB3B",
    textDecoration: "none",
  },
  "&.Mui-focusVisible, &:focus": { boxShadow: "none", outline: "none" },
}));

const TabContainer = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  display: "flex",
  alignItems: "center",
  minHeight: 48,
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
}));

const TabContent = styled(Box)({
  flexGrow: 1,
  overflow: "hidden",
  height: "100%",
  display: "flex",
  flexDirection: "column",
});

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`config-tabpanel-${index}`}
    aria-labelledby={`config-tab-${index}`}
    style={{ height: "100%", overflow: "auto" }}
    {...other}
  >
    {value === index && children}
  </div>
);

// Helper function to get file icon based on filename - matches ConfigDrawer
const getFileExtension = (filename) => {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
};

const getTabFileIcon = (filename, fileType) => {
  const ext = getFileExtension(filename);
  const iconProps = { sx: { fontSize: 14, mr: 0.5 } };
  
  // Use fileType if available, otherwise fall back to extension
  switch (fileType || ext) {
    case 'json':
    case '.json':
      return <DataObjectIcon {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#F7931E" }} />;
    case 'query':
    case 'graphql':
    case '.graphql':
    case '.gql':
      return <GraphqlIconCorrect {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#E535AB" }} />;
    case 'database':
    case 'sql':
    case '.sql':
      return <StorageIcon {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#336791" }} />;
    case 'markup':
    case 'xml':
    case 'yaml':
    case '.xml':
    case '.yaml':
    case '.yml':
      return <CodeIcon {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#FF6600" }} />;
    case 'document':
    case 'markdown':
    case 'text':
    case '.txt':
    case '.md':
      return <ArticleIcon {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#666" }} />;
    default:
      return <InsertFileOutlined {...iconProps} sx={{ fontSize: 14, mr: 0.5, color: "#666" }} />;
  }
};

export default function TabbedConfigEditor({
  // Original props from App.jsx
  selectedSection,
  setSelectedSection,
  handleSubmit,
  handleSourceTypeChange,
  sections,
  uiSchema,
  extraErrors,
  validateConfig,
  // Callback functions
  onSaveConfig,
  onLoadConfig,
  addAlert,
  // Initial config data (optional)
  initialConfigs = [],
  // Callback to notify parent of active tab config changes
  onActiveTabChange,
  // Text file handling props
  onSaveTextFile,
}) {
  const PERSISTENCE_KEY = "esai_tabbed_editor_state";
  const WELCOME_STATE_KEY = "shouldShowWelcome";

  // eslint-disable-next-line no-unused-vars
  const { currentScope } = useScope();
  
  const [activeTab, setActiveTab] = useState(0);
  const [codeMode, setCodeMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuTab, setContextMenuTab] = useState(null);
  const [savingTabs, setSavingTabs] = useState(new Set()); // Track which tabs are currently being saved
  const [loadingTabs, setLoadingTabs] = useState(new Set()); // Track which tabs are currently loading
  const [newTabDialog, setNewTabDialog] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);

  // Confirmation dialog for closing tabs with unsaved changes
  const [closeConfirmDialog, setCloseConfirmDialog] = useState({
    open: false,
    tabIndex: null,
    tabName: "",
  });
  const nextTabIdRef = useRef(1);

  // Set welcome screen flag
  const setShouldShowWelcome = useCallback((show) => {
    try {
      localStorage.setItem(WELCOME_STATE_KEY, show.toString());
    } catch (error) {
      console.warn("Failed to save welcome state:", error);
    }
  }, []);

  // Load tabs from localStorage or use initial configs
  const [tabs, setTabs] = useState(() => {
    // If we have initial configs, use them (takes precedence)
    if (initialConfigs.length > 0) {
      const newTabs = initialConfigs.map((config, index) => ({
        id: nextTabIdRef.current++,
        name: config.name || `Config ${nextTabIdRef.current}`,
        type: config.type || 'config', // 'config' or 'textfile'
        isDirty: false,
        // Config-specific data
        sharedFormData: config.SharedConfiguration || {},
        loadFormData: config.LoadConfiguration || {},
        importFormData: config.ImportConfiguration || {},
        filePath: config.filePath || null,
        folderId: config.folderId || null,
        // Text file-specific data
        content: config.content || '',
        fileType: config.fileType || null, // 'query', 'database', etc.
      }));

      // Try to load additional tabs from localStorage
      try {
        const saved = localStorage.getItem(PERSISTENCE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.tabs && parsed.tabs.length > 1) {
            // Add additional tabs from localStorage, but keep the first tab as the current config
            const additionalTabs = parsed.tabs.slice(1).map((tab) => ({
              ...tab,
              id: nextTabIdRef.current++,
            }));
            newTabs.push(...additionalTabs);
          }
          if (parsed.nextTabId) {
            nextTabIdRef.current = Math.max(
              nextTabIdRef.current,
              parsed.nextTabId,
            );
          }
        }
      } catch (error) {
        console.warn(
          "Failed to load additional tabs from localStorage:",
          error,
        );
      }

      // Clear welcome flag since we have configs to show
      try {
        localStorage.setItem(WELCOME_STATE_KEY, "false");
      } catch (error) {
        console.warn("Failed to clear welcome state:", error);
      }

      return newTabs;
    } else {
      // Try to load from localStorage if no initial configs
      try {
        const saved = localStorage.getItem(PERSISTENCE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.tabs && parsed.tabs.length > 0) {
            nextTabIdRef.current =
              Math.max(...parsed.tabs.map((t) => t.id)) + 1;
            
            // Clear welcome flag since we have saved tabs
            localStorage.setItem(WELCOME_STATE_KEY, "false");
            
            return parsed.tabs.map(tab => ({
              ...tab,
              isDirty: false, // Reset dirty state on load to prevent phantom dirty tabs
            }));
          }
        }
      } catch (error) {
        console.warn(
          "Failed to load tabbed editor state from localStorage:",
          error,
        );
      }

      // No initial configs and no saved tabs - show welcome screen
      try {
        localStorage.setItem(WELCOME_STATE_KEY, "true");
      } catch (error) {
        console.warn("Failed to set welcome state:", error);
      }
      
      // Start with no tabs if no initial configs and no saved state
      return [];
    }
  });

  // Track if we should show welcome screen - moved after tabs initialization
  // eslint-disable-next-line no-unused-vars
  const shouldShowWelcome = useCallback(() => {
    try {
      const welcomeFlag = localStorage.getItem(WELCOME_STATE_KEY);
      return welcomeFlag === "true" || tabs.length === 0;
    } catch {
      return tabs.length === 0;
    }
  }, [tabs.length]);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    try {
      const stateToSave = {
        tabs,
        activeTab,
        nextTabId: nextTabIdRef.current,
      };
      localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn(
        "Failed to save tabbed editor state to localStorage:",
        error,
      );
    }
  }, [tabs, activeTab, tabs.length]);

  // Load active tab from localStorage (only if no initial configs provided)
  useEffect(() => {
    if (initialConfigs.length === 0) {
      try {
        const saved = localStorage.getItem(PERSISTENCE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed.activeTab !== undefined &&
            parsed.activeTab < tabs.length
          ) {
            setActiveTab(parsed.activeTab);
          }
        }
      } catch (error) {
        console.warn("Failed to load active tab from localStorage:", error);
      }
    }
  }, [initialConfigs.length, tabs.length]);

  const currentTab = tabs[activeTab];

  // Safety check: ensure activeTab is always valid when tabs change
  useEffect(() => {
    if (tabs.length > 0 && (activeTab >= tabs.length || activeTab < 0)) {
      const safeActiveTab = Math.max(0, Math.min(activeTab, tabs.length - 1));
      console.warn("ActiveTab out of bounds, correcting:", { 
        oldActiveTab: activeTab, 
        newActiveTab: safeActiveTab, 
        tabsLength: tabs.length 
      });
      setActiveTab(safeActiveTab);
    }
  }, [tabs.length, activeTab]);

  // Notify parent when active tab changes
  useEffect(() => {
    if (onActiveTabChange && currentTab) {
      console.log("Active tab changed, notifying parent with:", {
        tabId: currentTab.id,
        tabName: currentTab.name,
        sharedFormData: currentTab.sharedFormData,
        loadFormData: currentTab.loadFormData,
        importFormData: currentTab.importFormData,
        configPath: currentTab.filePath,
        currentConfigFolderId: currentTab.folderId,
        hasSharedData: Object.keys(currentTab.sharedFormData || {}).length > 0,
        hasLoadData: Object.keys(currentTab.loadFormData || {}).length > 0,
        hasImportData: Object.keys(currentTab.importFormData || {}).length > 0,
      });
      onActiveTabChange({
        sharedFormData: currentTab.sharedFormData,
        loadFormData: currentTab.loadFormData,
        importFormData: currentTab.importFormData,
        configPath: currentTab.filePath,
        currentConfigFolderId: currentTab.folderId,
      });
    }
  }, [activeTab, currentTab, onActiveTabChange]);

  // Debug effect to log when config data is available
  useEffect(() => {
    if (currentTab) {
      const hasData =
        (currentTab.sharedFormData &&
          Object.keys(currentTab.sharedFormData).length > 0) ||
        (currentTab.loadFormData &&
          Object.keys(currentTab.loadFormData).length > 0) ||
        (currentTab.importFormData &&
          Object.keys(currentTab.importFormData).length > 0);

      console.log("Config data availability for tab", currentTab.id, ":", {
        hasData,
        sharedKeys: Object.keys(currentTab.sharedFormData || {}),
        loadKeys: Object.keys(currentTab.loadFormData || {}),
        importKeys: Object.keys(currentTab.importFormData || {}),
      });
    }
  }, [currentTab]);

  // Force reload current tab data (useful for debugging config loading issues)
  const forceReloadCurrentTab = useCallback(() => {
    if (currentTab && onActiveTabChange) {
      console.log("Force reloading current tab data:", currentTab);
      onActiveTabChange({
        sharedFormData: currentTab.sharedFormData,
        loadFormData: currentTab.loadFormData,
        importFormData: currentTab.importFormData,
        configPath: currentTab.filePath,
        currentConfigFolderId: currentTab.folderId,
      });
      if (addAlert) {
        addAlert({
          message: "Config data refreshed",
          severity: "info",
        });
      }
    }
  }, [currentTab, onActiveTabChange, addAlert]);

  // Handle tab change
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
  }, []);

  // Create new tab
  const createNewTab = useCallback(() => {
    setShouldShowWelcome(false); // Hide welcome screen when creating new tab
    setNewTabName("");
    setNewTabDialog(true);
  }, [setShouldShowWelcome]);

  // Handle new tab creation confirmation
  const handleNewTabConfirm = useCallback(() => {
    const configName =
      newTabName.trim() || `New Config ${nextTabIdRef.current}`;
    const newTabId = nextTabIdRef.current++;
    const newTab = {
      id: newTabId,
      name: configName,
      type: 'config',
      isDirty: false,
      sharedFormData: {},
      loadFormData: {},
      importFormData: {},
      filePath: null,
      folderId: null,
      // Text file fields (not used for config tabs)
      content: '',
      fileType: null,
    };

    // Mark this tab as loading to prevent dirty state during initial form setup
    setLoadingTabs((prev) => new Set([...prev, newTabId]));

    // Update tabs and active tab index in one operation to avoid timing issues
    setTabs((prev) => {
      const newTabs = [...prev, newTab];
      // Set active tab after tabs state is updated
      setTimeout(() => setActiveTab(newTabs.length - 1), 0);
      return newTabs;
    });
    setNewTabDialog(false);

    // Clear loading state after a brief delay to allow form to initialize
    setTimeout(() => {
      setLoadingTabs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(newTabId);
        return newSet;
      });
    }, 100);
    setNewTabName("");
    //eslint-disable-next-line
  }, [newTabName, setShouldShowWelcome]);

  // Method to open a text file in a new tab
  const openTextFileInTab = useCallback((file) => {
    console.log('=== OPEN TEXT FILE IN TAB CALLED ===');
    console.log('File object received:', file);
    
    // Check if a tab with the same file already exists
    const existingTabIndex = tabs.findIndex(tab => 
      tab.type === 'textfile' && 
      tab.filePath === (file.filePath || file.name) &&
      tab.folderId === (file.folderId || null)
    );
    
    if (existingTabIndex !== -1) {
      console.log('Tab already exists, switching to existing tab:', existingTabIndex);
      setActiveTab(existingTabIndex);
      return;
    }
    
    const newTabId = nextTabIdRef.current++;
    const newTab = {
      id: newTabId,
      name: file.name,
      fileName: file.name,
      type: 'textfile',
      isDirty: false,
      filePath: file.filePath || file.name,
      folderId: file.folderId || null,
      // Text file specific
      content: file.content || '',
      fileType: file.fileType || 'text',
      category: file.category || 'document',
      // Config fields (not used for text tabs)
      sharedFormData: {},
      loadFormData: {},
      importFormData: {},
    };

    console.log('Creating new tab:', newTab);

    setTabs((prev) => {
      const newTabs = [...prev, newTab];
      console.log('New tabs array:', newTabs);
      setTimeout(() => setActiveTab(newTabs.length - 1), 0);
      return newTabs;
    });
  }, [tabs]);

  // Handle new tab dialog cancel
  const handleNewTabCancel = useCallback(() => {
    setNewTabDialog(false);
    setNewTabName("");
  }, []);

  // Close tab
  const closeTab = useCallback(
    (tabIndex, event) => {
      if (event) {
        event.stopPropagation();
      }

      const tabToClose = tabs[tabIndex];

      // Check if the tab has unsaved changes
      if (tabToClose && tabToClose.isDirty) {
        // Show confirmation dialog
        setCloseConfirmDialog({
          open: true,
          tabIndex,
          tabName: tabToClose.name,
        });
        return; // Wait for user confirmation
      }

      // Close the tab immediately if no unsaved changes
      performTabClose(tabIndex);
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs],
  );

  // Helper function to actually close the tab
  const performTabClose = useCallback(
    (tabIndex) => {
      console.log("=== CLOSING TAB DEBUG ===");
      console.log("Closing tab at index:", tabIndex);
      console.log("Current activeTab:", activeTab);
      console.log("Total tabs before closing:", tabs.length);
      console.log("Tab being closed:", tabs[tabIndex]?.name);
      
      // Always allow closing tabs - when the last tab is closed, show welcome screen
      const newTabs = tabs.filter((_, index) => index !== tabIndex);
      console.log("New tabs length after closing:", newTabs.length);
      setTabs(newTabs);

      // Clear localStorage for closed tab if it has a filePath
      const tabToClose = tabs[tabIndex];
      if (tabToClose && tabToClose.filePath) {
        try {
          localStorage.removeItem(`esai_config_${tabToClose.filePath}`);
          console.log(
            "Cleared localStorage for closed tab:",
            tabToClose.filePath,
          );
        } catch (error) {
          console.warn("Failed to clear localStorage for closed tab:", error);
        }
      }

      // If no tabs left, we'll show the welcome screen (handled by the render logic)
      if (newTabs.length === 0) {
        setActiveTab(0);
        setShouldShowWelcome(true);
        // Save empty state to localStorage to prevent restoring closed tabs
        try {
          localStorage.setItem(
            PERSISTENCE_KEY,
            JSON.stringify({ tabs: [], activeTab: 0, nextTabId: nextTabIdRef.current })
          );
        } catch (error) {
          console.warn("Failed to save empty tab state to localStorage:", error);
        }
        return;
      }

      // We have tabs remaining, so hide welcome screen
      setShouldShowWelcome(false);

      // Adjust active tab if necessary - calculate based on the new tabs array length
      let newActiveTab = activeTab;
      if (tabIndex === activeTab) {
        // If we're closing the active tab, move to the previous tab (or first if we were at index 0)
        newActiveTab = Math.max(0, Math.min(tabIndex - 1, newTabs.length - 1));
        console.log("Closing active tab, new activeTab will be:", newActiveTab);
      } else if (tabIndex < activeTab) {
        // If we're closing a tab before the active tab, shift the active tab index down
        newActiveTab = activeTab - 1;
        console.log("Closing tab before active, shifting activeTab down to:", newActiveTab);
      }
      // If tabIndex > activeTab, activeTab stays the same

      // Ensure the new active tab is within bounds
      newActiveTab = Math.max(0, Math.min(newActiveTab, newTabs.length - 1));
      console.log("Final calculated activeTab:", newActiveTab);
      console.log("Will point to tab:", newTabs[newActiveTab]?.name || "undefined");
      
      setActiveTab(newActiveTab);

      // Save updated tabs and activeTab to localStorage immediately after closing
      try {
        localStorage.setItem(
          PERSISTENCE_KEY,
          JSON.stringify({ tabs: newTabs, activeTab: newActiveTab, nextTabId: nextTabIdRef.current })
        );
      } catch (error) {
        console.warn("Failed to save tab state to localStorage after close:", error);
      }
    },
    [tabs, activeTab, PERSISTENCE_KEY, nextTabIdRef, setShouldShowWelcome],
  );

  // Handle confirmation dialog response
  const handleCloseConfirm = useCallback(
    (confirmed) => {
      if (confirmed && closeConfirmDialog.tabIndex !== null) {
        performTabClose(closeConfirmDialog.tabIndex);
      }
      setCloseConfirmDialog({ open: false, tabIndex: null, tabName: "" });
    },
    [closeConfirmDialog.tabIndex, performTabClose],
  );

  // Update current tab data - this should mark the tab as dirty
  const updateCurrentTab = useCallback(
    (updates) => {
      console.log("Updating current tab with:", updates);
      setTabs((prev) =>
        prev.map((tab, index) =>
          index === activeTab ? { ...tab, ...updates, isDirty: true } : tab,
        ),
      );
    },
    [activeTab],
  );

  // Save current tab
  const saveCurrentTab = useCallback(async () => {
    if (!currentTab) {
      console.log("No current tab to save");
      return;
    }

    // Set saving state
    setSavingTabs((prev) => new Set([...prev, currentTab.id]));

    console.log("=== SAVE DEBUG START ===");
    console.log("Saving current tab:", currentTab.name);
    console.log("Current tab data:", currentTab);
    console.log("Current tab type:", currentTab.type);

    try {
      if (currentTab.type === 'textfile') {
        // Handle text file saving
        if (onSaveTextFile) {
          console.log("Saving text file...");
          const textFileData = {
            name: currentTab.name,
            content: currentTab.content,
            fileType: currentTab.fileType,
            folderId: currentTab.folderId,
            filePath: currentTab.filePath,
          };
          console.log("Text file data to save:", textFileData);
          
          await onSaveTextFile(textFileData);
          console.log("Text file save completed successfully");

          // Mark tab as saved (not dirty)
          setTabs((prev) =>
            prev.map((tab, index) =>
              index === activeTab ? { ...tab, isDirty: false } : tab,
            ),
          );

          if (addAlert) {
            addAlert({
              message: `Saved "${currentTab.name}"`,
              severity: "success",
            });
          }
        } else {
          console.warn("No onSaveTextFile handler provided");
          if (addAlert) {
            addAlert({
              message: "Text file save handler not available",
              severity: "error",
            });
          }
        }
      } else {
        // Handle config file saving (existing logic)
        console.log("onSaveConfig function exists:", !!onSaveConfig);
        console.log("onSaveConfig function:", onSaveConfig);

        const configData = {
          SharedConfiguration: currentTab.sharedFormData,
          LoadConfiguration: currentTab.loadFormData,
          ImportConfiguration: currentTab.importFormData,
        };

        console.log("Config data to save:", JSON.stringify(configData, null, 2));

        if (onSaveConfig) {
          console.log("Calling onSaveConfig with data and tab info...");
          console.log("Tab info being passed:", {
            id: currentTab.id,
            name: currentTab.name,
            filePath: currentTab.filePath,
            folderId: currentTab.folderId,
          });

          const result = await onSaveConfig(configData, currentTab);
          console.log("onSaveConfig returned:", result);
          console.log("onSaveConfig completed successfully");

          // If the save was successful and returned a result, update the tab
          if (result && result.id) {
            // Update tab with new information from the save result
            setTabs((prev) =>
              prev.map((tab, index) =>
              index === activeTab
                ? {
                    ...tab,
                    isDirty: false,
                    // Update name if it was a new config
                    name:
                      tab.name === "New Config" ||
                      tab.name.startsWith("New Config")
                        ? currentTab.filePath || `Config ${tab.id}`
                        : tab.name,
                    // Store the database ID if available
                    configId: result.id,
                  }
                : tab,
            ),
            );
          } else {
            // Mark tab as saved without additional updates
            setTabs((prev) =>
              prev.map((tab, index) =>
                index === activeTab
                  ? {
                      ...tab,
                      isDirty: false,
                      name:
                        tab.name === "New Config" ||
                        tab.name.startsWith("New Config")
                          ? currentTab.filePath
                            ? currentTab.filePath.split(/[\\/]/).pop()
                            : `Config ${tab.id}`
                          : tab.name,
                    }
                  : tab,
              ),
            );
          }
        } else {
          console.log("No onSaveConfig provided, using localStorage fallback");
          // Fallback: save to localStorage if no onSaveConfig provided
          const configData = {
            SharedConfiguration: currentTab.sharedFormData,
            LoadConfiguration: currentTab.loadFormData,
            ImportConfiguration: currentTab.importFormData,
          };
          
          const configKey = currentTab.filePath || `config_${currentTab.id}`;
          localStorage.setItem(
            `esai_config_${configKey}`,
            JSON.stringify(configData),
          );
          console.log(
            "Saved to localStorage with key:",
            `esai_config_${configKey}`,
          );

          // Mark tab as saved for localStorage fallback
          setTabs((prev) =>
            prev.map((tab, index) =>
              index === activeTab
                ? {
                    ...tab,
                    isDirty: false,
                    name:
                      tab.name === "New Config" ||
                      tab.name.startsWith("New Config")
                        ? currentTab.filePath
                          ? currentTab.filePath.split(/[\\/]/).pop()
                          : `Config ${tab.id}`
                        : tab.name,
                  }
                : tab,
            ),
          );
        }

        console.log("Tab marked as saved");

        if (addAlert) {
          addAlert({
            message: `Configuration "${currentTab.name}" saved successfully`,
            severity: "success",
          });
        }
      }
      console.log("=== SAVE DEBUG END ===");
    } catch (error) {
      console.error("=== SAVE ERROR ===");
      console.error("Save error:", error);
      console.error("Error stack:", error.stack);
      if (addAlert) {
        addAlert({
          message: `Failed to save "${currentTab.name}": ${error.message}`,
          severity: "error",
        });
      }
    } finally {
      // Clear saving state
      setSavingTabs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentTab.id);
        return newSet;
      });
    }
  }, [currentTab, activeTab, onSaveConfig,onSaveTextFile, addAlert]);

  // Save all dirty tabs
  const saveAllTabs = useCallback(async () => {
    const dirtyTabs = tabs.filter((tab) => tab.isDirty);
    if (dirtyTabs.length === 0) {
      if (addAlert) {
        addAlert({
          message: "No unsaved changes to save",
          severity: "info",
        });
      }
      return;
    }

    // Set saving state for all dirty tabs
    const dirtyTabIds = dirtyTabs.map((tab) => tab.id);
    setSavingTabs((prev) => new Set([...prev, ...dirtyTabIds]));

    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      if (!tab.isDirty) continue;

      const configData = {
        SharedConfiguration: tab.sharedFormData,
        LoadConfiguration: tab.loadFormData,
        ImportConfiguration: tab.importFormData,
      };

      try {
        if (onSaveConfig) {
          await onSaveConfig(configData, tab);
        } else {
          const configKey = tab.filePath || `config_${tab.id}`;
          localStorage.setItem(
            `esai_config_${configKey}`,
            JSON.stringify(configData),
          );
        }
        savedCount++;
      } catch (error) {
        console.error(`Failed to save tab ${tab.name}:`, error);
        errorCount++;
      }
    }

    // Mark all dirty tabs as saved if they were successful
    if (savedCount > 0) {
      setTabs((prev) =>
        prev.map((tab) => (tab.isDirty ? { ...tab, isDirty: false } : tab)),
      );
    }

    // Clear saving state for all tabs
    setSavingTabs((prev) => {
      const newSet = new Set(prev);
      dirtyTabIds.forEach((id) => newSet.delete(id));
      return newSet;
    });

    if (addAlert) {
      if (errorCount === 0) {
        addAlert({
          message: `Successfully saved ${savedCount} configuration${
            savedCount > 1 ? "s" : ""
          }`,
          severity: "success",
        });
      } else {
        addAlert({
          message: `Saved ${savedCount} configurations, ${errorCount} failed`,
          severity: "warning",
        });
      }
    }
  }, [tabs, onSaveConfig, addAlert]);

  // Load config into new tab or switch to existing tab
  const loadConfigIntoNewTab = useCallback(
    async (configData) => {
      // Check if a tab with this file path already exists
      const existingTabIndex = tabs.findIndex(
        (tab) =>
          tab.filePath &&
          configData.filePath &&
          tab.filePath === configData.filePath,
      );

      if (existingTabIndex !== -1) {
        // Switch to existing tab instead of creating duplicate
        setActiveTab(existingTabIndex);
        if (addAlert) {
          addAlert({
            message: `Switched to existing tab: ${tabs[existingTabIndex].name}`,
            severity: "info",
          });
        }
        return;
      }

      // If this config has a filePath/id, try to fetch fresh data from database
      let finalConfigData = configData;
      if (configData.id && onLoadConfig) {
        try {
          console.log(
            "Fetching fresh config data from database for:",
            configData.name,
          );
          const freshData = await onLoadConfig(configData.id);
          if (freshData) {
            finalConfigData = {
              ...configData,
              SharedConfiguration: freshData.SharedConfiguration || {},
              LoadConfiguration: freshData.LoadConfiguration || {},
              ImportConfiguration: freshData.ImportConfiguration || {},
            };
            if (addAlert) {
              addAlert({
                message: `Loaded fresh data for: ${configData.name}`,
                severity: "info",
              });
            }
          }
        } catch (error) {
          console.warn(
            "Failed to fetch fresh config data, using provided data:",
            error,
          );
          if (addAlert) {
            addAlert({
              message: `Warning: Could not fetch latest data for ${configData.name}`,
              severity: "warning",
            });
          }
        }
      }

      const newTabId = nextTabIdRef.current++;
      const newTab = {
        id: newTabId,
        name: finalConfigData.name || `Config ${newTabId}`,
        isDirty: false,
        sharedFormData: finalConfigData.SharedConfiguration || {},
        loadFormData: finalConfigData.LoadConfiguration || {},
        importFormData: finalConfigData.ImportConfiguration || {},
        filePath: finalConfigData.filePath || null,
        folderId: finalConfigData.folderId || null,
      };

      // Mark this tab as loading to prevent dirty state during initial form setup
      setLoadingTabs((prev) => new Set([...prev, newTabId]));

      // Hide welcome screen since we're adding a tab
      setShouldShowWelcome(false);

      setTabs((prev) => [...prev, newTab]);
      setActiveTab(tabs.length);

      // Clear loading state after a brief delay to allow form to initialize
      setTimeout(() => {
        setLoadingTabs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(newTabId);
          return newSet;
        });
      }, 100);
    },
    [tabs, addAlert, onLoadConfig, setShouldShowWelcome],
  );

  // Expose methods to App.jsx after functions are defined
  useEffect(() => {
    window.tabbedEditor = {
      ...window.tabbedEditor,
      openTextFile: openTextFileInTab,
      loadConfig: loadConfigIntoNewTab,
      saveCurrentConfig: saveCurrentTab,
      createNewTab,
      closeCurrentTab: () => closeTab(activeTab),
      forceReloadCurrentTab,
      getCurrentTabData: () => currentTab,
    };

    // Keyboard shortcuts
    const handleKeyDown = (event) => {
      // Ctrl+S or Cmd+S to save
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "s" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        saveCurrentTab();
      }
      // Ctrl+Shift+S or Cmd+Shift+S to save all
      else if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "S" &&
        event.shiftKey
      ) {
        event.preventDefault();
        saveAllTabs();
      }
      // Ctrl+T or Cmd+T to create new tab
      else if ((event.ctrlKey || event.metaKey) && event.key === "t") {
        event.preventDefault();
        createNewTab();
      }
      // Ctrl+W or Cmd+W to close current tab
      else if ((event.ctrlKey || event.metaKey) && event.key === "w") {
        event.preventDefault();
        closeTab(activeTab);
      }
      // Ctrl+Tab to switch to next tab
      else if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        const nextTab = (activeTab + 1) % tabs.length;
        setActiveTab(nextTab);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (window.tabbedEditor) {
        delete window.tabbedEditor.openTextFile;
        delete window.tabbedEditor;
      }
    };
  }, [openTextFileInTab, loadConfigIntoNewTab, saveCurrentTab, createNewTab, activeTab, closeTab, forceReloadCurrentTab, currentTab, saveAllTabs, tabs.length]);

  // Duplicate current tab
  const duplicateTab = useCallback(() => {
    if (!currentTab) return;

    const duplicatedTab = {
      ...currentTab,
      id: nextTabIdRef.current++,
      name: `${currentTab.name} (Copy)`,
      isDirty: true,
      filePath: null, // Clear file path for copy
      folderId: null,
    };

    setTabs((prev) => [...prev, duplicatedTab]);
    setActiveTab(tabs.length);
  }, [currentTab, tabs.length]);

  // Context menu handlers
  const handleContextMenuOpen = useCallback((event, tabIndex) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
    setContextMenuTab(tabIndex);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
    setContextMenuTab(null);
  }, []);

  // Form change handlers - these need to properly detect changes
  const handleAllDataChange = useCallback(
    (obj) => {
      console.log("All data changed:", obj);
      updateCurrentTab({
        sharedFormData: obj.SharedConfiguration || {},
        loadFormData: obj.LoadConfiguration || {},
        importFormData: obj.ImportConfiguration || {},
      });
    },
    [updateCurrentTab],
  );

  const handleSourceTypeChangeWrapper = useCallback(
    (data) => {
      console.log("Source type changed:", data);
      handleSourceTypeChange(data);
      setTabs((prev) =>
        prev.map((tab, index) => {
          if (index === activeTab) {
            // Only mark as dirty if the tab is not currently loading
            const isLoading = loadingTabs.has(tab.id);
            console.log(
              "Tab",
              tab.id,
              "is loading:",
              isLoading,
              "| Will mark dirty (source type change):",
              !isLoading,
            );
            return {
              ...tab,
              importFormData: data.formData,
              isDirty: !isLoading, // Only mark dirty if not loading
            };
          }
          return tab;
        }),
      );
    },
    [handleSourceTypeChange, activeTab, loadingTabs],
  );

  // Individual section handlers for ConfigForm - these must mark the ACTIVE tab as dirty
  // Update tab data handlers
  const handleSharedFormDataChange = useCallback(
    (data) => {
      console.log("Shared form data changed for tab", activeTab, ":", data);
      setTabs((prev) =>
        prev.map((tab, index) => {
          if (index === activeTab) {
            // Only mark as dirty if the tab is not currently loading
            const isLoading = loadingTabs.has(tab.id);
            console.log(
              "Tab",
              tab.id,
              "is loading:",
              isLoading,
              "| Will mark dirty:",
              !isLoading,
            );
            return {
              ...tab,
              sharedFormData: data,
              isDirty: !isLoading, // Only mark dirty if not loading
            };
          }
          return tab;
        }),
      );
    },
    [activeTab, loadingTabs],
  );

  const handleLoadFormDataChange = useCallback(
    (data) => {
      console.log("Load form data changed for tab", activeTab, ":", data);
      setTabs((prev) =>
        prev.map((tab, index) => {
          if (index === activeTab) {
            // Only mark as dirty if the tab is not currently loading
            const isLoading = loadingTabs.has(tab.id);
            console.log(
              "Tab",
              tab.id,
              "is loading:",
              isLoading,
              "| Will mark dirty:",
              !isLoading,
            );
            return {
              ...tab,
              loadFormData: data,
              isDirty: !isLoading, // Only mark dirty if not loading
            };
          }
          return tab;
        }),
      );
    },
    [activeTab, loadingTabs],
  );

  const handleImportFormDataChange = useCallback(
    (data) => {
      console.log("Import form data changed for tab", activeTab, ":", data);
      setTabs((prev) =>
        prev.map((tab, index) => {
          if (index === activeTab) {
            // Only mark as dirty if the tab is not currently loading
            const isLoading = loadingTabs.has(tab.id);
            console.log(
              "Tab",
              tab.id,
              "is loading:",
              isLoading,
              "| Will mark dirty:",
              !isLoading,
            );
            return {
              ...tab,
              importFormData: data,
              isDirty: !isLoading, // Only mark dirty if not loading
            };
          }
          return tab;
        }),
      );
    },
    [activeTab, loadingTabs],
  );

  // Drag and drop handlers for tab reordering
  const handleDragStart = (e, tabIndex) => {
    setDraggedTab(tabIndex);
    e.dataTransfer.effectAllowed = "move";
    // Add visual feedback
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDragOver = (e, tabIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTab(tabIndex);
  };

  const handleDragLeave = (e) => {
    // Only reset dragOverTab if we're leaving the entire tab area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverTab(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedTab === null || draggedTab === dropIndex) {
      return;
    }

    // Reorder tabs
    const newTabs = [...tabs];
    const draggedTabData = newTabs[draggedTab];
    
    // Remove dragged tab from its original position
    newTabs.splice(draggedTab, 1);
    
    // Insert at new position (adjust index if needed)
    const insertIndex = draggedTab < dropIndex ? dropIndex - 1 : dropIndex;
    newTabs.splice(insertIndex, 0, draggedTabData);
    
    // Update active tab index if necessary
    let newActiveTab = activeTab;
    if (activeTab === draggedTab) {
      newActiveTab = insertIndex;
    } else if (activeTab > draggedTab && activeTab <= insertIndex) {
      newActiveTab = activeTab - 1;
    } else if (activeTab < draggedTab && activeTab >= insertIndex) {
      newActiveTab = activeTab + 1;
    }
    
    setTabs(newTabs);
    setActiveTab(newActiveTab);
    setDraggedTab(null);
    setDragOverTab(null);
  };

  // Handle initial loading state for tabs created on mount
  useEffect(() => {
    if (tabs.length > 0) {
      // Mark all initial tabs as loading to prevent dirty state during setup
      const initialTabIds = tabs.map((tab) => tab.id);
      setLoadingTabs(new Set(initialTabIds));

      // Clear loading state after a longer delay to allow forms to initialize and validate
      const timer = setTimeout(() => {
        setLoadingTabs(new Set());
      }, 500); // Increased from 200ms to 500ms for better reliability

      return () => clearTimeout(timer);
    }
  }, [tabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Additional effect to handle loading state when active tab changes
  useEffect(() => {
    if (currentTab && loadingTabs.has(currentTab.id)) {
      // Extend loading state when switching to a still-loading tab
      const timer = setTimeout(() => {
        setLoadingTabs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(currentTab.id);
          return newSet;
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [activeTab, currentTab, loadingTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render main content based on whether tabs exist
  const renderMainContent = () => {
    if (tabs.length === 0) {
      // Show welcome screen when no tabs are open
      return (
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8f9fa",
            p: 3,
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography
                variant="h3"
                sx={{ mb: 2, fontWeight: "bold", color: "#2c3e50" }}
              >
                Welcome to Nexus Importer
              </Typography>
              <Typography variant="h6" sx={{ mb: 4, color: "#7f8c8d" }}>
                Get started with Nexus Importer by creating configurations,
                uploading files, or setting up connections
              </Typography>
            </Box>

            <Grid
              container
              spacing={3}
              justifyContent="center"
              alignItems="stretch"
            >
              <Grid item xs={12} sm={6} lg={3}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                    },
                  }}
                  onClick={() => {
                    // Open connections management modal like in ActionButtons
                    // Trigger the same action as the settings gear icon in the output panel
                    const event = new CustomEvent("openConnectionsModal");
                    window.dispatchEvent(event);

                    if (addAlert) {
                      addAlert({
                        message: "Opening connections manager...",
                        severity: "info",
                      });
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3, flexGrow: 1 }}>
                    <StorageIcon
                      sx={{ fontSize: 48, color: "#3862C6", mb: 2 }}
                    />
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                      Manage Connections
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Set up and configure connections to your data warehouse
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<StorageIcon />}
                      sx={{ bgcolor: "#3862C6", color: "white" }}
                    >
                      Manage Connections
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                    },
                  }}
                  onClick={() => {
                    // Use the same dialog-based creation as the plus button
                    createNewTab();
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3, flexGrow: 1 }}>
                    <AddIcon sx={{ fontSize: 48, color: "#3498db", mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                      Create New Config
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Start building a new data integration configuration from
                      scratch
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<AddIcon />}
                      sx={{ "&hover": { bgcolor: "#FFE923" } }}
                    >
                      New Config
                    </Button>
                  </CardActions>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} lg={3}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                    },
                  }}
                  onClick={() => {
                    // Trigger file upload for config
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json";
                    input.onchange = async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        try {
                          const text = await file.text();
                          const configData = JSON.parse(text);

                          // Create new tab directly without using loadConfigIntoNewTab to avoid duplicates
                          const newTabId = nextTabIdRef.current++;
                          const newTab = {
                            id: newTabId,
                            name: file.name.replace(".json", ""),
                            isDirty: false,
                            sharedFormData:
                              configData.SharedConfiguration || {},
                            loadFormData: configData.LoadConfiguration || {},
                            importFormData:
                              configData.ImportConfiguration || {},
                            filePath: null, // Local file upload, no server path
                            folderId: null,
                          };

                          // Mark this tab as loading to prevent dirty state during initial form setup
                          setLoadingTabs(
                            (prev) => new Set([...prev, newTabId]),
                          );

                          // Update tabs and active tab index in one operation to avoid timing issues
                          setTabs((prev) => {
                            const newTabs = [...prev, newTab];
                            // Set active tab after tabs state is updated
                            setTimeout(
                              () => setActiveTab(newTabs.length - 1),
                              0,
                            );
                            return newTabs;
                          });

                          // Clear loading state after a brief delay to allow form to initialize
                          setTimeout(() => {
                            setLoadingTabs((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(newTabId);
                              return newSet;
                            });
                          }, 100);

                          if (addAlert) {
                            addAlert({
                              message: `Config "${file.name}" loaded successfully`,
                              severity: "success",
                            });
                          }
                        } catch (error) {
                          console.error("Error loading config file:", error);
                          if (addAlert) {
                            addAlert({
                              message: `Failed to load config file: ${error.message}`,
                              severity: "error",
                            });
                          }
                        }
                      }
                    };
                    input.click();
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3, flexGrow: 1 }}>
                    <UploadIcon
                      sx={{ fontSize: 48, color: "#F73C58", mb: 2 }}
                    />
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                      Upload Existing
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Import an existing configuration file from your
                      computer
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<UploadIcon />}
                      sx={{ bgcolor: "#F73C58", color: "white" }}
                    >
                      Upload Config
                    </Button>
                  </CardActions>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} lg={3}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                    },
                  }}
                  onClick={() => {
                    // Switch to storage/files page to browse configs
                    if (window.setCurrentPage) {
                      window.setCurrentPage("storage");
                      if (addAlert) {
                        addAlert({
                          message:
                            "Switched to file browser. You can load configs from there.",
                          severity: "info",
                        });
                      }
                    } else if (addAlert) {
                      addAlert({
                        message:
                          "Use the navigation menu to access the file browser",
                        severity: "info",
                      });
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3, flexGrow: 1 }}>
                    <FolderOpenIcon
                      sx={{ fontSize: 48, color: "#EF7C1E", mb: 2 }}
                    />
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                      File Storage
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Upload data files or browse existing
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "center", pb: 3 }}>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<FolderOpenIcon />}
                      color="warning"
                    >
                      Upload Files
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Quick Tips:
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  • Set up data warehouse connections first
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Press <strong>Ctrl+S</strong> to save configurations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Use the code editor for advanced JSON editing
                </Typography>
              </Box>
            </Box>
          </Container>
        </Box>
      );
    }

    if (!currentTab && tabs.length > 0) {
      // Safety check: if we have tabs but no current tab, fix the active tab index
      const safeActiveTab = Math.max(0, Math.min(activeTab, tabs.length - 1));
      console.warn("Invalid activeTab index detected, fixing:", { activeTab, tabsLength: tabs.length, fixing: safeActiveTab });
      setActiveTab(safeActiveTab);
      return <div>Loading configuration...</div>;
    }

    if (!currentTab) {
      return <div>No configuration loaded</div>;
    }

    // Show tabbed interface when tabs exist
    return (
      <>
        {/* Tab Bar */}
        <TabContainer>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            TabIndicatorProps={{
              style: {
                display: "none",
              },
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flexGrow: 1 }}
          >
            {tabs.map((tab, index) => (
              <StyledTab
                sx={{
                  opacity: draggedTab === index ? 0.5 : 1,
                  backgroundColor: dragOverTab === index && draggedTab !== index ? "#e3f2fd" : undefined,
                  cursor: "grab",
                  "&:active": { cursor: "grabbing" },
                }}
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onContextMenu={(event) => handleContextMenuOpen(event, index)}
                label={
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      width: "100%",
                    }}
                  >
                    <DragIcon 
                      sx={{ 
                        fontSize: 14, 
                        color: "inherit", 
                        opacity: 0.7,
                        "&:hover": { opacity: 1 } 
                      }} 
                    />
                    {/* File type icon - matches ConfigDrawer icons */}
                    {getTabFileIcon(tab.name, tab.fileType || (tab.type === 'config' ? 'json' : tab.category))}
                    {savingTabs.has(tab.id) && (
                      <CircularProgress size={12} sx={{ color: "inherit" }} />
                    )}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flexGrow: 1,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          maxWidth: 120,
                          color: "inherit",
                          fontWeight: "normal",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tab.name}
                      </Typography>
                      {tab.isDirty && (
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: "currentColor",
                            ml: 0.5,
                            flexShrink: 0,
                            opacity: 0.8,
                          }}
                        />
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => closeTab(index, e)}
                      sx={{
                        ml: 0.5,
                        color: "inherit",
                        flexShrink: 0,
                        "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            ))}
          </Tabs>

          {/* Action buttons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1 }}>
            {tabs.filter((tab) => tab.isDirty).length > 0 && (
              <Typography
                variant="caption"
                sx={{ color: "warning.main", mr: 1 }}
              >
                {tabs.filter((tab) => tab.isDirty).length} unsaved
              </Typography>
            )}
            <Tooltip title="New Configuration (Ctrl+T)">
              <IconButton
                size="small"
                onClick={createNewTab}
                sx={{ color: "black" }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Save Current Configuration (Ctrl+S)">
              <IconButton
                size="small"
                onClick={saveCurrentTab}
                sx={{ color: "black" }}
                disabled={
                  !currentTab?.isDirty || savingTabs.has(currentTab?.id)
                }
              >
                <SaveIcon />
              </IconButton>
            </Tooltip>
            {tabs.filter((tab) => tab.isDirty).length > 1 && (
              <Tooltip title="Save All Configurations (Ctrl+Shift+S)">
                <IconButton
                  size="small"
                  onClick={saveAllTabs}
                  disabled={savingTabs.size > 0}
                >
                  <SaveAllIcon />
                </IconButton>
              </Tooltip>
            )}
            {/* Debug button for config loading issues */}
            <Tooltip title="Refresh Config Data (Debug)">
              <IconButton
                size="small"
                onClick={forceReloadCurrentTab}
                sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
                </svg>
              </IconButton>
            </Tooltip>
          </Box>
        </TabContainer>

        {/* Editor Mode Toggle */}
        <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
          <FormControlLabel
            control={
              <Switch
                checked={codeMode}
                onChange={() => setCodeMode((prev) => !prev)}
                color="primary"
              />
            }
            label="Code Editor"
          />
        </Box>

        {/* Tab Content */}
        <TabContent>
          {tabs.map((tab, index) => (
            <TabPanel key={tab.id} value={activeTab} index={index}>
              <Box sx={{ height: "100%", p: 2, overflow: "auto" }}>
                {tab.type === 'textfile' ? (
                  <TextFileTabEditor
                    content={tab.content}
                    fileName={tab.fileName}
                    filePath={tab.filePath}
                    fileType={tab.fileType}
                    category={tab.category || 'document'}
                    onSave={(savedContent) => {
                      // Handle save operation
                      console.log('Saving text file content:', savedContent);
                      // Reset dirty state after save
                      setTabs(prevTabs =>
                        prevTabs.map((t, i) =>
                          i === index ? { ...t, content: savedContent, isDirty: false } : t
                        )
                      );
                      // You can add actual save logic here
                    }}
                    onChange={(newContent) => {
                      setTabs(prevTabs =>
                        prevTabs.map((t, i) =>
                          i === index ? { ...t, content: newContent } : t
                        )
                      );
                    }}
                    onDirtyChange={(isDirty) => {
                      setTabs(prevTabs =>
                        prevTabs.map((t, i) =>
                          i === index ? { ...t, isDirty } : t
                        )
                      );
                    }}
                  />
                ) : codeMode ? (
                  <ConfigCodeEditor
                    sharedFormData={tab.sharedFormData}
                    loadFormData={tab.loadFormData}
                    importFormData={tab.importFormData}
                    onChangeAll={handleAllDataChange}
                  />
                ) : (
                  <ConfigForm
                    selectedSection={selectedSection}
                    sharedFormData={tab.sharedFormData}
                    loadFormData={tab.loadFormData}
                    importFormData={tab.importFormData}
                    handleSubmit={handleSubmit}
                    handleSourceTypeChange={handleSourceTypeChangeWrapper}
                    sections={sections}
                    uiSchema={uiSchema}
                    extraErrors={extraErrors}
                    setSelectedSection={setSelectedSection}
                    setLoadFormData={handleLoadFormDataChange}
                    setImportFormData={handleImportFormDataChange}
                    setSharedFormData={handleSharedFormDataChange}
                    validate={validateConfig}
                  />
                )}
              </Box>
            </TabPanel>
          ))}
        </TabContent>

        {/* Context Menu */}
        <Menu
          open={contextMenu !== null}
          onClose={handleContextMenuClose}
          anchorReference="anchors"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          <MenuItem
            onClick={() => {
              duplicateTab();
              handleContextMenuClose();
            }}
          >
            <FileCopyIcon sx={{ mr: 1 }} />
            Duplicate Tab
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (contextMenuTab !== null) closeTab(contextMenuTab);
              handleContextMenuClose();
            }}
          >
            <CloseIcon sx={{ mr: 1 }} />
            Close Tab
          </MenuItem>
        </Menu>
      </>
    );
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {renderMainContent()}

      {/* New Tab Dialog - Always render */}
      <Dialog
        open={newTabDialog}
        onClose={handleNewTabCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Configuration</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Configuration Name"
            fullWidth
            variant="outlined"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleNewTabConfirm();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleNewTabCancel();
              }
            }}
            placeholder="Enter a name for your new configuration..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNewTabCancel}>Cancel</Button>
          <Button onClick={handleNewTabConfirm} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Tab Confirmation Dialog */}
      <Dialog
        open={closeConfirmDialog.open}
        onClose={() => handleCloseConfirm(false)}
        aria-labelledby="close-tab-dialog-title"
        aria-describedby="close-tab-dialog-description"
      >
        <DialogTitle id="close-tab-dialog-title">Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography id="close-tab-dialog-description">
            Tab "{closeConfirmDialog.tabName}" has unsaved changes. Are you sure
            you want to close it?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleCloseConfirm(false)}
            sx={{
              bgcolor: "#fff",
              color: "#000",
              border: "2px solid #000",
              boxShadow: "none",
              "&:hover": { bgcolor: "#F5F5F5", boxShadow: "none" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleCloseConfirm(true)}
            color="error"
            variant="contained"
          >
            Close Without Saving
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
