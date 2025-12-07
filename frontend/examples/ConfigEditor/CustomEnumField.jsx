import React from "react";
import {
  MenuItem,
  ListItemText,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";

const CustomEnumField = ({ schema, formData, onChange, label }) => {
  const handleChange = (event) => {
    onChange(event.target.value);
  };

  const title = schema.title || label || "Select an option";

  return (
    <FormControl
      fullWidth
      size="small"
      variant="outlined"
      sx={{ mt: 1, mb: 1 }}
    >
      <InputLabel>{title}</InputLabel>
      <Select
        label={title}
        value={formData || ""}
        onChange={handleChange}
        renderValue={(selected) => (selected ? selected : `Select ${title}`)}
      >
        {schema.enum.map((value) => (
          <MenuItem key={value} value={value}>
            <ListItemText primary={value} />
            {formData === value && <CheckOutlinedIcon />}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default CustomEnumField;
