import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Button,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TerminalIcon from '@mui/icons-material/Terminal';
import TableChartIcon from '@mui/icons-material/TableChart';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const minHeight = 120;
const maxHeight = 600;
const initialHeight = 260;

const OutputPanel = ({
  logs = [],
  queryResult = null,
  onExport,
  onRunQuery,
  loading = false,
  initialHeight: initialHeightProp,
  minHeight: minHeightProp,
  maxHeight: maxHeightProp,
  result,
  children,
}) => {
  const minH = minHeightProp || minHeight;
  const maxH = maxHeightProp || maxHeight;
  const initH = initialHeightProp || initialHeight;
  
  const [height, setHeight] = useState(initH);
  const [collapsed, setCollapsed] = useState(false);
  const [activeView, setActiveView] = useState(0); // 0 = Terminal, 1 = Table
  const startYRef = useRef(null);
  const startHRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  // Drag handlers for resizing
  const beginDrag = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('.MuiTabs-root')) return;
    startYRef.current = e.clientY;
    startHRef.current = height;
    setIsResizing(true);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
  }, [height]);

  const onDrag = useCallback((e) => {
    if (!startYRef.current) return;
    const delta = e.clientY - startYRef.current;
    const newHeight = startHRef.current - delta;
    setHeight(Math.max(minH, Math.min(maxH, newHeight)));
  }, [minH, maxH]);

  const endDrag = useCallback(() => {
    setIsResizing(false);
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', endDrag);
  }, [onDrag]);

  const handleTabChange = (event, newValue) => {
    setActiveView(newValue);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        boxSizing: 'border-box',
        height: collapsed ? 48 : height,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <Toolbar
        variant="dense"
        sx={{
          minHeight: 48,
          cursor: isResizing ? 'row-resize' : 'row-resize',
          userSelect: 'none',
          pl: 1,
          pr: 1,
          gap: 1,
          bgcolor: '#f5f5f5',
        }}
        onMouseDown={beginDrag}
      >
        <IconButton
          size="small"
          onClick={() => {
            setCollapsed((c) => {
              if (c && height === 0) {
                setHeight(260);
              }
              return !c;
            });
          }}
          aria-label={collapsed ? 'Expand output' : 'Collapse output'}
        >
          {collapsed ? (
            <ExpandMoreIcon sx={{ color: 'black' }} />
          ) : (
            <ExpandLessIcon sx={{ color: 'black' }} />
          )}
        </IconButton>

        {/* Status Icons */}
        {loading && (
          <CircularProgress size={20} thickness={6} color="primary" sx={{ ml: 1 }} />
        )}
        {!loading && result === 'success' && (
          <CheckCircleOutlineIcon fontSize="medium" color="success" sx={{ ml: 1 }} />
        )}
        {!loading && result === 'error' && (
          <ErrorOutlineIcon fontSize="medium" color="error" sx={{ ml: 1 }} />
        )}

        {/* Title */}
        <Typography variant="subtitle2" sx={{ ml: 1, flexGrow: 1 }}>
          Output
        </Typography>

        {/* Run Query Button */}
        {!collapsed && (
          <Button
            size="small"
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={onRunQuery}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              mr: 1,
            }}
          >
            Run Query (Ctrl+Enter)
          </Button>
        )}

        {/* View Tabs */}
        {!collapsed && (
          <Tabs
            value={activeView}
            onChange={handleTabChange}
            sx={{
              minHeight: 32,
              '& .MuiTab-root': {
                minHeight: 32,
                py: 0.5,
                px: 2,
                fontSize: '0.75rem',
              },
            }}
          >
            <Tab icon={<TerminalIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Console" />
            <Tab icon={<TableChartIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Results" />
          </Tabs>
        )}

        {/* Export Buttons (when showing results table) */}
        {!collapsed && activeView === 1 && queryResult && onExport && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onExport('excel')}
              sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
            >
              Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onExport('json')}
              sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
            >
              JSON
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onExport('xml')}
              sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
            >
              XML
            </Button>
          </Box>
        )}
      </Toolbar>

      {/* Content Area */}
      {!collapsed && (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {React.Children.map(children, (child, index) => (
            <Box
              sx={{
                display: activeView === index ? 'block' : 'none',
                height: '100%',
                overflow: 'auto',
              }}
            >
              {child}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default OutputPanel;
