import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Checkbox,
  IconButton,
  Button,
  Collapse,
  Box,
  Grid,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AttributesEditor from "./AttributeEditor";

const EditableTable = ({ formData, onChange, sourceType }) => {
  const [localData, setLocalData] = useState(formData || []);
  const [openRows, setOpenRows] = useState({});

  useEffect(() => {
    setLocalData(formData || []);
  }, [formData]);

  useEffect(() => {
    setOpenRows((prevOpenRows) => {
      const newOpenRows = {};
      localData.forEach((_, index) => {
        newOpenRows[index] = prevOpenRows[index] || false;
      });
      return newOpenRows;
    });
  }, [localData]);

  const handleInputChange = useCallback((index, field, value) => {
    setLocalData((prevData) => {
      const updatedData = [...prevData];
      updatedData[index] = {
        ...updatedData[index],
        [field]: field === "DataType" ? value.toUpperCase() : value,
      };
      return updatedData;
    });
  }, []);

  const handleAttributesChange = useCallback(
    (index, updatedAttributes) => {
      setLocalData((prevData) => {
        const updatedData = [...prevData];
        updatedData[index] = {
          ...updatedData[index],
          Attributes: updatedAttributes,
        };
        onChange(updatedData); // commit changes
        return updatedData;
      });
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    onChange(localData);
  }, [localData, onChange]);

  const handleAddColumn = useCallback(() => {
    const newColumn = {
      Name: "",
      OutputName: "",
      IsBusinessKey: false,
      IsKeptColumn: false,
      DataType: "",
      AllowNulls: false,
      FixedValue: "",
      XMLTag: sourceType === "XML" ? "" : undefined,
      RepeatingGroup: sourceType === "XML" ? "" : undefined,
      Attributes: sourceType === "XML" ? {} : undefined,
    };
    setLocalData((prevData) => {
      const updatedData = [...prevData, newColumn];
      onChange(updatedData);
      return updatedData;
    });
  }, [onChange, sourceType]);

  const handleRemoveColumn = useCallback(
    (index) => {
      setLocalData((prevData) => {
        const updatedData = prevData.filter((_, i) => i !== index);
        onChange(updatedData);
        return updatedData;
      });
    },
    [onChange],
  );

  const handleToggleRow = (index) => {
    setOpenRows((prevOpenRows) => ({
      ...prevOpenRows,
      [index]: !prevOpenRows[index],
    }));
  };

  return (
    <TableContainer component={Paper} elevation={2} sx={{ mt: 2 }}>
      <Table>
        <TableHead sx={{ backgroundColor: "#fafafa" }}>
          <TableRow>
            {sourceType === "XML" && <TableCell />}
            <TableCell>Name</TableCell>
            <TableCell>Output Name</TableCell>
            <TableCell>Is Business Key</TableCell>
            <TableCell>Is Kept Column</TableCell>
            <TableCell>Data Type</TableCell>
            <TableCell>Allow Nulls</TableCell>
            <TableCell>Fixed Value</TableCell>
            <TableCell sx={{ width: 60 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {localData.map((col, index) => (
            <React.Fragment key={index}>
              <TableRow
                hover
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                }}
              >
                {sourceType === "XML" && (
                  <TableCell>
                    <IconButton
                      aria-label="expand row"
                      size="small"
                      onClick={() => handleToggleRow(index)}
                    >
                      {openRows[index] ? (
                        <KeyboardArrowUpIcon />
                      ) : (
                        <KeyboardArrowDownIcon />
                      )}
                    </IconButton>
                  </TableCell>
                )}
                <TableCell>
                  <TextField
                    value={col.Name || ""}
                    onChange={(e) =>
                      handleInputChange(index, "Name", e.target.value)
                    }
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={col.OutputName || ""}
                    onChange={(e) =>
                      handleInputChange(index, "OutputName", e.target.value)
                    }
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={!!col.IsBusinessKey}
                    onChange={(e) =>
                      handleInputChange(
                        index,
                        "IsBusinessKey",
                        e.target.checked,
                      )
                    }
                    onBlur={handleBlur}
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={!!col.IsKeptColumn}
                    onChange={(e) =>
                      handleInputChange(index, "IsKeptColumn", e.target.checked)
                    }
                    onBlur={handleBlur}
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={col.DataType || ""}
                    onChange={(e) =>
                      handleInputChange(index, "DataType", e.target.value)
                    }
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={!!col.AllowNulls}
                    onChange={(e) =>
                      handleInputChange(index, "AllowNulls", e.target.checked)
                    }
                    onBlur={handleBlur}
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    value={col.FixedValue || ""}
                    onChange={(e) =>
                      handleInputChange(index, "FixedValue", e.target.value)
                    }
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleRemoveColumn(index)}
                    sx={{ color: "#333" }}
                  >
                    <DeleteForeverOutlinedIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
              {sourceType === "XML" && (
                <TableRow>
                  <TableCell
                    style={{ paddingBottom: 0, paddingTop: 0 }}
                    colSpan={9}
                  >
                    <Collapse in={openRows[index]} timeout="auto" unmountOnExit>
                      <Box margin={2}>
                        <Typography variant="subtitle1" gutterBottom>
                          XML Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="XML Tag"
                              value={col.XMLTag || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  index,
                                  "XMLTag",
                                  e.target.value,
                                )
                              }
                              onBlur={handleBlur}
                              fullWidth
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label="Repeating Group"
                              value={col.RepeatingGroup || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  index,
                                  "RepeatingGroup",
                                  e.target.value,
                                )
                              }
                              onBlur={handleBlur}
                              fullWidth
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <AttributesEditor
                              attributes={col.Attributes || {}}
                              onChange={(newAttributes) =>
                                handleAttributesChange(index, newAttributes)
                              }
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
          <TableRow>
            <TableCell colSpan={sourceType === "XML" ? 9 : 8} align="right">
              <Button
                variant="contained"
                onClick={handleAddColumn}
                startIcon={<AddIcon />}
                sx={{ mt: 1 }}
              >
                Add Column
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default EditableTable;
