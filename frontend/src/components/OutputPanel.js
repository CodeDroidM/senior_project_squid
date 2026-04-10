import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
  const [activeView, setActiveView] = useState(0);
  const [exportDialog, setExportDialog] = useState(null); // { fmt: 'excel'|'json'|'xml' } or null
  const startYRef = useRef(null);
  const startHRef = useRef(null);
  const isResizingRef = useRef(false);

  // Drag handlers for resizing
  const onDrag = useCallback((e) => {
    if (!startYRef.current) return;
    const delta = e.clientY - startYRef.current;
    const newHeight = startHRef.current - delta;
    const navbarHeight = 64 + 16;
    const viewportMax = window.innerHeight - navbarHeight;
    const effectiveMax = Math.min(maxH, viewportMax);
    setHeight(Math.max(minH, Math.min(effectiveMax, newHeight)));
  }, [minH, maxH]);

  const endDrag = useCallback(() => {
    isResizingRef.current = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', endDrag);
  }, [onDrag]);

  const beginDrag = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('.MuiTabs-root')) return;
    startYRef.current = e.clientY;
    startHRef.current = height;
    isResizingRef.current = true;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
  }, [height, onDrag, endDrag]);

  const handleTabChange = (event, newValue) => {
    setActiveView(newValue);
  };

  return (
    <Box sx={{
      position: 'relative', flexShrink: 0,
      height: collapsed ? 30 : height,
      borderTop: '1px solid #3c3c3c',
      display: 'flex', flexDirection: 'column',
      bgcolor: '#1e1e1e', overflow: 'hidden',
    }}>
      {/* Panel Header Bar */}
      <Box
        onMouseDown={beginDrag}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          minHeight: 30, maxHeight: 30,
          bgcolor: '#252526', borderBottom: '1px solid #3c3c3c',
          cursor: 'row-resize', userSelect: 'none', px: 0.5,
        }}
      >
        {/* Panel tabs */}
        <Tabs
          value={activeView}
          onChange={handleTabChange}
          TabIndicatorProps={{ style: { display: 'none' } }}
          sx={{
            minHeight: 30,
            '& .MuiTabs-flexContainer': { height: 30 },
              '& .MuiTab-root': {
              minHeight: 30, py: 0, px: 1.5,
              fontSize: 12, color: '#858585', textTransform: 'none',
              '&.Mui-selected': { color: '#d4d4d4', borderTop: '1px solid #9c6fde' },
              '&:hover': { color: '#d4d4d4' },
            },
          }}
        >
          <Tab icon={<TerminalIcon sx={{ fontSize: 13 }} />} iconPosition="start" label="Console" />
          <Tab icon={<TableChartIcon sx={{ fontSize: 13 }} />} iconPosition="start" label="Results" />
        </Tabs>

        <Box sx={{ flex: 1 }} />

        {/* status */}
        {loading && <CircularProgress size={12} sx={{ color: '#9c6fde', mr: 0.5 }} />}
        {!loading && result === 'success' && <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#89d185', mr: 0.5 }} />}
        {!loading && result === 'error'   && <ErrorOutlineIcon       sx={{ fontSize: 14, color: '#f48771', mr: 0.5 }} />}

        {/* export buttons */}
        {!collapsed && activeView === 1 && queryResult && onExport && (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {['excel', 'json', 'xml'].map((fmt) => (
              <Button key={fmt} size="small" onClick={() => setExportDialog({ fmt })}
                sx={{ fontSize: 10, py: 0, px: 0.75, minWidth: 0, color: '#858585', textTransform: 'uppercase',
                  border: '1px solid #3c3c3c', borderRadius: 0.5,
                  '&:hover': { color: '#d4d4d4', borderColor: '#555' } }}>
                {fmt}
              </Button>
            ))}
          </Box>
        )}

        {/* Run button */}
        {!collapsed && (
          <Button size="small" onClick={onRunQuery} disabled={loading}
            startIcon={<PlayArrowIcon sx={{ fontSize: 13 }} />}
            sx={{ fontSize: 11, py: 0, px: 1, ml: 0.5, textTransform: 'none',
              bgcolor: '#2d5a27', color: '#89d185', borderRadius: 0.5,
              '&:hover': { bgcolor: '#3a7a33' },
              '&:disabled': { bgcolor: '#2a2a2a', color: '#555' },
            }}>
            Run
          </Button>
        )}

        {/* collapse toggle */}
        <IconButton size="small" onClick={() => setCollapsed(c => !c)}
          sx={{ color: '#858585', '&:hover': { color: '#cccccc' } }}>
          {collapsed ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ExpandLessIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      {/* Content */}
      {!collapsed && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {React.Children.map(children, (child, index) => (
            <Box sx={{ display: activeView === index ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              {child}
            </Box>
          ))}
        </Box>
      )}

      {/* Export confirmation dialog */}
      <Dialog open={Boolean(exportDialog)} onClose={() => setExportDialog(null)}
        PaperProps={{ sx: { bgcolor: '#2d2d2d', border: '1px solid #3c3c3c', minWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } }}>
        <DialogTitle sx={{ fontSize: 14, color: '#d4d4d4', pb: 0.5, borderBottom: '1px solid #3c3c3c' }}>
          Download as {exportDialog?.fmt?.toUpperCase()}
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <DialogContentText sx={{ fontSize: 13, color: '#9a9a9a' }}>
            You are about to download the <strong style={{ color: '#d4d4d4' }}>current query results</strong> as
            a <strong style={{ color: '#b48aee' }}>.{exportDialog?.fmt === 'excel' ? 'xlsx' : exportDialog?.fmt}</strong> file.
          </DialogContentText>
          <DialogContentText sx={{ fontSize: 11, color: '#6e6e6e', mt: 1 }}>
            Note: only the data currently loaded in the Results panel will be exported —
            not the full database table.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
          <Button size="small" onClick={() => setExportDialog(null)}
            sx={{ color: '#9a9a9a', fontSize: 12, '&:hover': { color: '#d4d4d4' } }}>
            Cancel
          </Button>
          <Button size="small" variant="contained"
            onClick={() => { onExport(exportDialog.fmt); setExportDialog(null); }}
            sx={{ fontSize: 12, bgcolor: '#9c6fde', color: '#fff',
              '&:hover': { bgcolor: '#b48aee' }, fontWeight: 600 }}>
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OutputPanel;
