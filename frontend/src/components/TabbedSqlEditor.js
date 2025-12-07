import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  CloseOutlined as CloseIcon,
  AddOutlined as AddIcon,
  Code as CodeIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';

const StyledTab = styled(Tab)(({ theme }) => ({
  color: '#000',
  textTransform: 'none',
  minWidth: 'auto',
  padding: '4px 12px',
  minHeight: 32,
  fontSize: '0.75rem',
  fontWeight: 500,
  position: 'relative',
  zIndex: 2,
  marginTop: 15,
  '&.Mui-selected': {
    color: '#000',
    backgroundColor: '#FFEB3B',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottom: '1px solid #FFEB3B',
  },
  '&:hover:not(.Mui-selected)': { textDecoration: 'underline' },
  '&.Mui-selected:hover': {
    backgroundColor: '#FFEB3B',
    textDecoration: 'none',
  },
  '&.Mui-focusVisible, &:focus': { boxShadow: 'none', outline: 'none' },
}));

const TabContainer = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  alignItems: 'center',
  minHeight: 48,
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
}));

const TabbedSqlEditor = ({ query, setQuery, onExecuteQuery, queryResult, loading }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [tabs, setTabs] = useState([
    {
      id: 1,
      name: 'Query 1',
      content: query || '',
      isDirty: false,
    },
  ]);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuTab, setContextMenuTab] = useState(null);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const nextTabIdRef = useRef(2);

  const currentTab = tabs[activeTab];

  // Sync external query changes to current tab
  React.useEffect(() => {
    if (query && query !== currentTab?.content) {
      setTabs((prev) =>
        prev.map((tab, index) =>
          index === activeTab ? { ...tab, content: query } : tab
        )
      );
    }
  }, [query, activeTab]);

  // Handle tab change
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
    if (setQuery) {
      setQuery(tabs[newValue].content);
    }
  }, [tabs, setQuery]);

  // Create new tab
  const createNewTab = useCallback(() => {
    const newTabId = nextTabIdRef.current++;
    const newTab = {
      id: newTabId,
      name: `Query ${newTabId}`,
      content: '',
      isDirty: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(tabs.length);
  }, [tabs.length]);

  // Close tab
  const closeTab = useCallback(
    (tabIndex, event) => {
      if (event) {
        event.stopPropagation();
      }

      if (tabs.length === 1) return; // Don't close last tab

      const newTabs = tabs.filter((_, index) => index !== tabIndex);
      setTabs(newTabs);

      let newActiveTab = activeTab;
      if (tabIndex === activeTab) {
        newActiveTab = Math.max(0, Math.min(tabIndex - 1, newTabs.length - 1));
      } else if (tabIndex < activeTab) {
        newActiveTab = activeTab - 1;
      }
      setActiveTab(newActiveTab);
      setQuery(newTabs[newActiveTab].content);
    },
    [tabs, activeTab, setQuery]
  );

  // Update current tab content
  const handleEditorChange = useCallback((value) => {
    setTabs((prev) =>
      prev.map((tab, index) =>
        index === activeTab ? { ...tab, content: value, isDirty: true } : tab
      )
    );
    if (setQuery) {
      setQuery(value);
    }
  }, [activeTab, setQuery]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Enter or Cmd+Enter to execute query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (currentTab?.content && onExecuteQuery) {
          onExecuteQuery(currentTab.content);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentTab, onExecuteQuery]);

  // Rename tab
  const renameTab = useCallback(() => {
    if (contextMenuTab === null) return;
    const newName = prompt('Enter new name:', tabs[contextMenuTab].name);
    if (newName && newName.trim()) {
      setTabs((prev) =>
        prev.map((tab, index) =>
          index === contextMenuTab ? { ...tab, name: newName.trim() } : tab
        )
      );
    }
    setContextMenu(null);
    setContextMenuTab(null);
  }, [contextMenuTab, tabs]);

  // Duplicate tab
  const duplicateTab = useCallback(() => {
    if (contextMenuTab === null) return;
    const tabToDuplicate = tabs[contextMenuTab];
    const newTabId = nextTabIdRef.current++;
    const newTab = {
      ...tabToDuplicate,
      id: newTabId,
      name: `${tabToDuplicate.name} (Copy)`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTab(tabs.length);
    setContextMenu(null);
    setContextMenuTab(null);
  }, [contextMenuTab, tabs]);

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

  // Drag and drop handlers for tab reordering
  const handleDragStart = (e, tabIndex) => {
    setDraggedTab(tabIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDragOver = (e, tabIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTab(tabIndex);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedTab === null || draggedTab === dropIndex) {
      return;
    }

    const newTabs = [...tabs];
    const draggedTabData = newTabs[draggedTab];

    newTabs.splice(draggedTab, 1);

    const insertIndex = draggedTab < dropIndex ? dropIndex - 1 : dropIndex;
    newTabs.splice(insertIndex, 0, draggedTabData);

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

  // SQL editor theme customization
  const editorTheme = EditorView.theme({
    '&': {
      fontSize: '14px',
      height: '100%',
    },
    '.cm-content': {
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
      fontSize: '14px',
      lineHeight: '1.6',
    },
    '.cm-gutters': {
      backgroundColor: '#f5f5f5',
      color: '#999',
      border: 'none',
      fontSize: '13px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#e8f2ff',
    },
    '.cm-activeLine': {
      backgroundColor: '#f0f7ff',
    },
    '.cm-line': {
      padding: '0 2px',
    },
  });

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Bar */}
      <TabContainer>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          TabIndicatorProps={{
            style: {
              display: 'none',
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
                backgroundColor:
                  dragOverTab === index && draggedTab !== index ? '#e3f2fd' : undefined,
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
              }}
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onContextMenu={(event) => handleContextMenuOpen(event, index)}
              label={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    width: '100%',
                  }}
                >
                  <DragIcon sx={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} />
                  <CodeIcon sx={{ fontSize: 14, color: '#336791' }} />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexGrow: 1,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        maxWidth: 120,
                        color: 'inherit',
                        fontWeight: 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {tab.name}
                    </Typography>
                    {tab.isDirty && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: 'currentColor',
                          ml: 0.5,
                          flexShrink: 0,
                          opacity: 0.8,
                        }}
                      />
                    )}
                  </Box>
                  {tabs.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={(e) => closeTab(index, e)}
                      sx={{
                        ml: 0.5,
                        color: 'inherit',
                        flexShrink: 0,
                        p: 0,
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        {/* New Tab Button */}
        <Tooltip title="New Query Tab">
          <IconButton size="small" onClick={createNewTab} sx={{ color: 'black', ml: 1 }}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </TabContainer>

      {/* SQL Editor */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: '300px' }}>
        <CodeMirror
          key={`editor-${tabs[activeTab]?.id}`}
          value={currentTab?.content || ''}
          onChange={handleEditorChange}
          extensions={[sql(), editorTheme]}
          theme="light"
          minHeight="300px"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
          }}
        />
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={renameTab}>Rename Tab</MenuItem>
        <MenuItem onClick={duplicateTab}>Duplicate Tab</MenuItem>
        {tabs.length > 1 && (
          <MenuItem
            onClick={() => {
              if (contextMenuTab !== null) closeTab(contextMenuTab);
              handleContextMenuClose();
            }}
          >
            Close Tab
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default TabbedSqlEditor;
