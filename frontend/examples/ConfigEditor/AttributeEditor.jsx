import React, { useState, useEffect } from "react";
import { Box, TextField, IconButton, Typography, Paper } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { v4 as uuidv4 } from "uuid";

const AttributesEditor = ({ attributes = {}, onChange }) => {
  // Local state for managing attributes
  const [localAttributes, setLocalAttributes] = useState(
    Object.entries(attributes).map(([key, value]) => ({
      id: uuidv4(),
      key,
      value,
    })),
  );

  // Sync with initial props
  useEffect(() => {
    setLocalAttributes(
      Object.entries(attributes).map(([key, value]) => ({
        id: uuidv4(),
        key,
        value,
      })),
    );
  }, [attributes]);

  // Function to update parent attributes from local state
  const updateParentAttributes = () => {
    const updatedAttributes = localAttributes.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
    onChange(updatedAttributes);
  };

  // Change handler for key and value fields
  const handleAttributeChange = (id, field, value) => {
    setLocalAttributes((prevAttributes) =>
      prevAttributes.map((attr) =>
        attr.id === id ? { ...attr, [field]: value } : attr,
      ),
    );
  };

  // Add a new attribute
  const handleAddAttribute = () => {
    setLocalAttributes([
      ...localAttributes,
      { id: uuidv4(), key: "newKey", value: "" },
    ]);
  };

  // Remove an attribute and update parent immediately
  const handleRemoveAttribute = (id) => {
    const updatedAttributes = localAttributes.filter((attr) => attr.id !== id);
    setLocalAttributes(updatedAttributes);
    // Update the parent after state changes
    onChange(
      updatedAttributes.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {}),
    );
  };

  return (
    <Box>
      {localAttributes.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No attributes added.
        </Typography>
      )}
      {localAttributes.map(({ id, key, value }) => (
        <Paper
          key={id}
          variant="outlined"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 1,
            marginBottom: 1,
          }}
        >
          <TextField
            label="Key"
            value={key}
            onChange={(e) => handleAttributeChange(id, "key", e.target.value)}
            onBlur={updateParentAttributes} // Update parent on blur
            variant="outlined"
            size="small"
            sx={{ marginRight: 1, flex: 1 }}
          />
          <TextField
            label="Value"
            value={value}
            onChange={(e) => handleAttributeChange(id, "value", e.target.value)}
            onBlur={updateParentAttributes} // Update parent on blur
            variant="outlined"
            size="small"
            sx={{ marginRight: 1, flex: 1 }}
          />
          <IconButton
            onClick={() => handleRemoveAttribute(id)}
            color="error"
            aria-label="remove attribute"
          >
            <RemoveCircleOutlineIcon />
          </IconButton>
        </Paper>
      ))}
      <Box textAlign="center">
        <IconButton
          onClick={handleAddAttribute}
          color="black"
          aria-label="add attribute"
        >
          <AddCircleOutlineIcon />
        </IconButton>
        <Typography variant="button" display="block">
          Add Attribute
        </Typography>
      </Box>
    </Box>
  );
};

export default AttributesEditor;
