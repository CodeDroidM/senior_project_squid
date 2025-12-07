import React from "react";
import { FieldProps } from "@rjsf/core";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Button from "@mui/material/Button";

const CustomField = ({ formData, onChange }) => {
  const handleAdd = () => {
    const newHeader = { key: "", value: "" };
    onChange([...formData, newHeader]);
  };

  const handleRemove = (index) => {
    const newHeaders = formData.filter((_, i) => i !== index);
    onChange(newHeaders);
  };

  const handleChange = (index, key, value) => {
    const newHeaders = formData.map((header, i) =>
      i === index ? { ...header, [key]: value } : header,
    );
    onChange(newHeaders);
  };

  return (
    <div>
      <h3>Additional Header</h3>
      {formData.map((header, index) => (
        <div key={index}>
          <TextField
            label="Key"
            value={header.key}
            onChange={(e) => handleChange(index, "key", e.target.value)}
          />
          <TextField
            label="Value"
            value={header.value}
            onChange={(e) => handleChange(index, "value", e.target.value)}
          />
          <IconButton onClick={() => handleRemove(index)}>
            <RemoveIcon />
          </IconButton>
        </div>
      ))}
      <Button onClick={handleAdd} startIcon={<AddIcon />}>
        Add Header
      </Button>
    </div>
  );
};

export default CustomField;
