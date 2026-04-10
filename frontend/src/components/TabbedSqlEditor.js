import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  Paper,
  ClickAwayListener,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  CloseOutlined as CloseIcon,
  AddOutlined as AddIcon,
  Code as CodeIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';

const StyledTab = styled(Tab)(() => ({
  color: '#858585',
  textTransform: 'none',
  minWidth: 'auto',
  maxWidth: 180,
  padding: '0 12px',
  minHeight: 35,
  fontSize: '0.8rem',
  fontWeight: 400,
  borderRight: '1px solid #3c3c3c',
  position: 'relative',
  '&.Mui-selected': {
    color: '#d4d4d4',
    backgroundColor: '#1e1e1e',
    borderTop: '1px solid #9c6fde',
  },
  '&:hover:not(.Mui-selected)': {
    color: '#cccccc',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  '&.Mui-focusVisible, &:focus': { boxShadow: 'none', outline: 'none' },
}));

const TabContainer = styled(Box)(() => ({
  borderBottom: '1px solid #3c3c3c',
  backgroundColor: '#252526',
  display: 'flex',
  alignItems: 'center',
  minHeight: 35,
  paddingLeft: 0,
  paddingRight: 4,
  overflow: 'hidden',
}));

const TabbedSqlEditor = ({ query, setQuery, onExecuteQuery, queryResult, loading, accpId }) => {
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

  // ── Query history ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(() => {
    const key = `squid_queries_${accpId || 'default'}`;
    try {
      setHistory(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch (_) { setHistory([]); }
  }, [accpId]);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // SQL editor theme - dark VSCode style
  const editorTheme = EditorView.theme({
    '&': { fontSize: '13px', height: '100%', backgroundColor: '#1e1e1e', flex: 1 },
    '&.cm-editor': { height: '100%' },
    '.cm-scroller': { overflow: 'auto', fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace' },
    '.cm-content': {
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      fontSize: '13px',
      lineHeight: '1.6',
      caretColor: '#aeafad',
      minHeight: '200px',
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#555',
      border: 'none',
      fontSize: '12px',
      minWidth: '48px',
    },
    '.cm-activeLineGutter': { backgroundColor: '#2a2d2e' },
    '.cm-activeLine':        { backgroundColor: '#2a2d2e' },
    '.cm-cursor':            { borderLeftColor: '#aeafad' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#264f78 !important' },
    '.cm-focused .cm-selectionBackground': { backgroundColor: '#264f78' },
  });

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#1e1e1e', position: 'relative' }}>
      {/* Tab Bar */}
      <TabContainer>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          TabIndicatorProps={{ style: { display: 'none' } }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flexGrow: 1, minHeight: 35,
            '& .MuiTabs-scrollButtons': { color: '#858585' },
            '& .MuiTabs-flexContainer': { height: 35 },
          }}
        >
          {tabs.map((tab, index) => (
            <StyledTab
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onContextMenu={(event) => handleContextMenuOpen(event, index)}
              sx={{
                opacity: draggedTab === index ? 0.4 : 1,
                backgroundColor: dragOverTab === index && draggedTab !== index
                  ? 'rgba(79,195,247,0.08)' : undefined,
              }}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CodeIcon sx={{ fontSize: 12, color: '#4fc3f7', flexShrink: 0 }} />
                  <Typography noWrap sx={{ maxWidth: 110, fontSize: 12, color: 'inherit' }}>
                    {tab.name}
                  </Typography>
                  {tab.isDirty && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#cccccc', flexShrink: 0 }} />
                  )}
                  {tabs.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={(e) => closeTab(index, e)}
                      sx={{ p: 0, ml: 0.25, color: 'inherit', '&:hover': { color: '#cccccc', bgcolor: 'rgba(255,255,255,0.12)' } }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        <Tooltip title="New Query Tab (Ctrl+T)">
          <IconButton size="small" onClick={createNewTab}
            sx={{ color: '#858585', ml: 0.5, '&:hover': { color: '#cccccc' } }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Query History">
          <IconButton size="small" onClick={() => setHistoryOpen(v => !v)}
            sx={{ color: historyOpen ? '#9c6fde' : '#858585', ml: 0.25, '&:hover': { color: '#9c6fde' } }}>
            <HistoryIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </TabContainer>

      {/* ── History dropdown ── */}
      {historyOpen && (
        <ClickAwayListener onClickAway={() => setHistoryOpen(false)}>
          <Paper elevation={8} sx={{
            position: 'absolute', zIndex: 1300, top: 35,
            right: 8, width: 440, maxHeight: 340, overflow: 'auto',
            bgcolor: '#252526', border: '1px solid #3c3c3c',
            boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
          }}>
            <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', borderBottom: '1px solid #3c3c3c' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#6e6e6e', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
                Query History{accpId ? ` — ACCP ${accpId}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#555', cursor: 'pointer', '&:hover': { color: '#d4d4d4' } }}
                onClick={() => {
                  localStorage.removeItem(`squid_queries_${accpId || 'default'}`);
                  setHistory([]);
                }}>
                Clear
              </Typography>
            </Box>
            {history.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography sx={{ fontSize: 12, color: '#6e6e6e' }}>No queries yet.</Typography>
              </Box>
            ) : (
              history.map((entry, i) => (
                <Box key={entry.id}
                  onClick={() => {
                    setTabs(prev => prev.map((tab, idx) => idx === activeTab ? { ...tab, content: entry.sql, isDirty: true } : tab));
                    if (setQuery) setQuery(entry.sql);
                    setHistoryOpen(false);
                  }}
                  sx={{
                    px: 1.5, py: 0.75, cursor: 'pointer', borderBottom: '1px solid #2a2a2a',
                    '&:hover': { bgcolor: '#37373d' },
                  }}>
                  <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    {entry.sql.length > 200 ? entry.sql.slice(0, 200) + '…' : entry.sql}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: '#555', mt: 0.25 }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              ))
            )}
          </Paper>
        </ClickAwayListener>
      )}

      {/* SQL Editor */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CodeMirror
          key={`editor-${tabs[activeTab]?.id}`}
          value={currentTab?.content || ''}
          onChange={handleEditorChange}
          extensions={[sql(), editorTheme]}
          theme="dark"
          style={{ flex: 1, height: '100%', overflow: 'auto' }}
          height="100%"
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
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        PaperProps={{ sx: { bgcolor: '#252526', border: '1px solid #3c3c3c', minWidth: 160 } }}
      >
        <MenuItem onClick={renameTab}    sx={{ fontSize: 13, color: '#cccccc' }}>Rename Tab</MenuItem>
        <MenuItem onClick={duplicateTab} sx={{ fontSize: 13, color: '#cccccc' }}>Duplicate Tab</MenuItem>
        {tabs.length > 1 && (
          <MenuItem onClick={() => { if (contextMenuTab !== null) closeTab(contextMenuTab); handleContextMenuClose(); }}
            sx={{ fontSize: 13, color: '#f48771' }}>
            Close Tab
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default TabbedSqlEditor;
