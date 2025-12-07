import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../auth/AxiosInstance";
import {
  TextField,
  Select,
  MenuItem,
  Button,
  Typography,
  Box,
  Grid,
  Tabs,
  Tab,
  Paper,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import ReactJson from "react-json-view";
import { isElectronApp } from "../utils/environment";

const RequestTesterField = (props) => {
  const { formData, onChange, formContext } = props;

  // State Hooks
  const [url, setUrl] = useState(formData || "");
  const [method, setMethod] = useState("GET");
  const [params, setParams] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [body, setBody] = useState("");
  const [authMethod, setAuthMethod] = useState("None");
  const [authConfigs, setAuthConfigs] = useState({
    None: {},
    "Bearer Token": {},
    Auth0: {},
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [responseStatus, setResponseStatus] = useState(null);
  const [responseHeaders, setResponseHeaders] = useState(null);
  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedJsonPath, setSelectedJsonPath] = useState("");

  const { importFormData } = formContext || {};
  //eslint-disable-next-line
  const sourceInfo = importFormData?.SourceInfo || {};

  const isPrefilled = useRef(false);
  const CustomTheme = {
    base00: "#fff",
    base01: "#f0f0f0",
    base02: "#3e4451",
    base03: "#545862",
    base04: "#000000",
    base05: "#000000",
    base06: "#b6bdca",
    base07: "#000000",
    base08: "#ff080c",
    base09: "#5c5652",
    base0A: "#e5c07b",
    base0B: "#049902",
    base0C: "#E5B11D",
    base0D: "#E5B11D",
    base0E: "#E5B11D",
    base0F: "#be5046",
  };
  useEffect(() => {
    if (!isPrefilled.current && sourceInfo) {
      if (sourceInfo.AuthenticationMethod) {
        setAuthMethod(sourceInfo.AuthenticationMethod);
        setAuthConfigs((prev) => ({
          ...prev,
          [sourceInfo.AuthenticationMethod]:
            sourceInfo[sourceInfo.AuthenticationMethod] || {},
        }));
      }
      if (sourceInfo.Url) {
        setUrl(sourceInfo.Url);
      }
      if (Array.isArray(sourceInfo.AdditionalHeadder)) {
        const initialHeaders = sourceInfo.AdditionalHeadder.map(
          ({ key, value }) => ({
            key,
            value,
          }),
        );
        setHeaders(initialHeaders);
      }
      if (
        sourceInfo.RequestMessage &&
        sourceInfo.RequestMessage.RequestMethod
      ) {
        setMethod(sourceInfo.RequestMessage.RequestMethod.toUpperCase());
      }
      if (
        sourceInfo.RequestMessage &&
        sourceInfo.RequestMessage.ContentFromFile
      ) {
        setBody(sourceInfo.RequestMessage.ContentFromFile);
      }
      isPrefilled.current = true;
    }
  }, [sourceInfo]);

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    onChange(e.target.value);
  };

  const handleMethodChange = (e) => {
    setMethod(e.target.value);
  };

  // PARAMS
  const handleParamChange = (index, field, value) => {
    setParams((prevParams) => {
      const newParams = [...prevParams];
      newParams[index] = { ...newParams[index], [field]: value };
      return newParams;
    });
  };
  const handleAddParam = () => {
    setParams((prev) => [...prev, { key: "", value: "" }]);
  };
  const handleRemoveParam = (index) => {
    setParams((prev) => prev.filter((_, i) => i !== index));
  };

  // HEADERS
  const handleHeaderChange = (index, field, value) => {
    setHeaders((prevHeaders) => {
      const newHeaders = [...prevHeaders];
      newHeaders[index] = { ...newHeaders[index], [field]: value };
      return newHeaders;
    });
  };
  const handleAddHeader = () => {
    setHeaders((prev) => [...prev, { key: "", value: "" }]);
  };
  const handleRemoveHeader = (index) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  // BODY
  const handleBodyChange = (e) => {
    setBody(e.target.value);
  };

  // AUTH
  const handleAuthMethodChange = (e) => {
    setAuthMethod(e.target.value);
  };
  const handleAuthConfigChange = (field, value) => {
    setAuthConfigs((prev) => ({
      ...prev,
      [authMethod]: {
        ...prev[authMethod],
        [field]: value,
      },
    }));
  };

  // TABS
  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  // For non-Electron apps, send the request to your backend using axiosInstance.
  const sendRequest = async (requestOptions) => {
    if (isElectronApp && window.electron && window.electron.ipcRenderer) {
      return await window.electron.ipcRenderer.invoke(
        "fetch-data",
        requestOptions,
      );
    } else {
      try {
        const response = await axiosInstance.post(
          "/proxy-request",
          requestOptions,
          {
            withCredentials: false,
          },
        );
        return {
          success: true,
          response: {
            status: response.data.status,
            statusText: response.data.statusText,
            headers: response.data.headers,
            data: response.data.data,
          },
        };
      } catch (error) {
        console.error("Error during backend proxy request:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  };

  // In non-Electron mode, do not fetch the Auth0 token; send auth config to backend.
  const getAuth0Token = async (auth0Config) => {
    try {
      const response = await window.electron.ipcRenderer.invoke(
        "get-auth0-token",
        auth0Config,
      );
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.token;
    } catch (error) {
      console.error("Error fetching Auth0 token via Electron:", error);
      setResponseData({
        error: "Error fetching Auth0 token: " + error.message,
      });
      return null;
    }
  };

  // SUBMIT REQUEST
  const handleRequest = async () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseHeaders(null);
    setResponseData(null);
    setSelectedJsonPath("");

    let requestUrl = url;
    params.forEach(({ key, value }) => {
      if (key && value) {
        const placeholder = `{${key.toUpperCase()}}`;
        if (requestUrl.includes(placeholder)) {
          requestUrl = requestUrl.replace(new RegExp(placeholder, "g"), value);
        }
      }
    });
    const queryParams = params
      .filter(
        ({ key, value }) =>
          key && value && !requestUrl.includes(`{${key.toUpperCase()}}`),
      )
      .map(
        ({ key, value }) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    if (queryParams) {
      const separator = requestUrl.includes("?") ? "&" : "?";
      requestUrl += `${separator}${queryParams}`;
    }
    const requestHeaders = {};
    headers.forEach(({ key, value }) => {
      if (key && value) {
        requestHeaders[key] = value;
      }
    });
    const currentAuthConfig = authConfigs[authMethod];
    let extraPayload = {};
    if (authMethod === "Bearer Token") {
      const token = currentAuthConfig.Token;
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    } else if (authMethod === "Auth0") {
      if (isElectronApp && window.electron && window.electron.ipcRenderer) {
        const token = await getAuth0Token(currentAuthConfig);
        if (token) {
          requestHeaders["Authorization"] = `Bearer ${token}`;
        } else {
          setLoading(false);
          return;
        }
      } else {
        extraPayload = { authMethod, authConfig: currentAuthConfig };
      }
    }
    if (
      ["POST", "PUT", "PATCH"].includes(method) &&
      !requestHeaders["Content-Type"]
    ) {
      requestHeaders["Content-Type"] = "application/json";
    }
    try {
      let parsedBody = body;
      if (body && requestHeaders["Content-Type"] === "application/json") {
        parsedBody = JSON.parse(body);
      }
      const requestOptions = {
        method,
        url: requestUrl,
        headers: requestHeaders,
        data: ["POST", "PUT", "PATCH"].includes(method) ? parsedBody : null,
        ...extraPayload,
      };
      const response = await sendRequest(requestOptions);
      if (!response.success) {
        throw new Error(response.error);
      }
      const res = response.response;
      setResponseStatus(`${res.status} ${res.statusText}`);
      setResponseHeaders(res.headers);
      setResponseData(res.data);
    } catch (error) {
      console.error("Error during request:", error);
      setResponseStatus("Error");
      setResponseData({ error: error.message || "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mt: 1 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Request Tester
      </Typography>
      <Box sx={{ marginBottom: "20px" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Select value={method} onChange={handleMethodChange} size="small">
              <MenuItem value="GET">GET</MenuItem>
              <MenuItem value="POST">POST</MenuItem>
              <MenuItem value="PUT">PUT</MenuItem>
              <MenuItem value="PATCH">PATCH</MenuItem>
              <MenuItem value="DELETE">DELETE</MenuItem>
            </Select>
          </Grid>
          <Grid item xs>
            <TextField
              fullWidth
              placeholder="Request URL"
              value={url}
              onChange={handleUrlChange}
              size="small"
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              onClick={handleRequest}
              disabled={loading}
              sx={{ whiteSpace: "nowrap" }}
            >
              {loading ? "Sending..." : "Send"}
            </Button>
          </Grid>
        </Grid>

        {/* Tabs: Params, Headers, Body, Auth */}
        <Box sx={{ marginTop: "20px" }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            sx={{
              "& .MuiTabs-indicator": { backgroundColor: "black" },
              "& .MuiTab-root": {
                color: "black",
                "&.Mui-selected": { color: "black", fontWeight: "bold" },
              },
            }}
          >
            <Tab label="Params" />
            <Tab label="Headers" />
            <Tab label="Body" />
            <Tab label="Auth" />
          </Tabs>
          {tabIndex === 0 && (
            <Box sx={{ mt: 2 }}>
              {params.map((param, index) => (
                <Grid
                  container
                  spacing={2}
                  key={index}
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Key"
                      value={param.key}
                      onChange={(e) =>
                        handleParamChange(index, "key", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) =>
                        handleParamChange(index, "value", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveParam(index)}
                    >
                      <Remove />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button
                variant="outlined"
                onClick={handleAddParam}
                sx={{
                  mt: 1,
                  backgroundColor: "#fff",
                  color: "black",
                  border: "2px solid #000",
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor: "#f5f5f5",
                    color: "black",
                    border: "2px solid #000",
                  },
                }}
              >
                <Add />
                Add Param
              </Button>
            </Box>
          )}
          {tabIndex === 1 && (
            <Box sx={{ mt: 2 }}>
              {headers.map((header, index) => (
                <Grid
                  container
                  spacing={2}
                  key={index}
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Key"
                      value={header.key}
                      onChange={(e) =>
                        handleHeaderChange(index, "key", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Value"
                      value={header.value}
                      onChange={(e) =>
                        handleHeaderChange(index, "value", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveHeader(index)}
                    >
                      <Remove />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button
                variant="outlined"
                onClick={handleAddHeader}
                sx={{
                  mt: 1,
                  backgroundColor: "#fff",
                  color: "black",
                  border: "2px solid #000",
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor: "#f5f5f5",
                    color: "black",
                    border: "2px solid #000",
                  },
                }}
              >
                <Add />
                Add Header
              </Button>
            </Box>
          )}
          {tabIndex === 2 && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                value={body}
                onChange={handleBodyChange}
                placeholder="Request body"
              />
            </Box>
          )}
          {tabIndex === 3 && (
            <Box sx={{ mt: 2 }}>
              <Select
                fullWidth
                size="small"
                value={authMethod}
                onChange={handleAuthMethodChange}
              >
                <MenuItem value="None">None</MenuItem>
                <MenuItem value="Bearer Token">Bearer Token</MenuItem>
                <MenuItem value="Auth0">Auth0</MenuItem>
              </Select>
              {authMethod === "Bearer Token" && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    placeholder="Bearer Token"
                    value={authConfigs["Bearer Token"].Token || ""}
                    onChange={(e) =>
                      handleAuthConfigChange("Token", e.target.value)
                    }
                    size="small"
                  />
                </Box>
              )}
              {authMethod === "Auth0" && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    placeholder="Auth0 URI"
                    value={authConfigs["Auth0"].Uri || ""}
                    onChange={(e) =>
                      handleAuthConfigChange("Uri", e.target.value)
                    }
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    placeholder="Auth0 Audience"
                    value={authConfigs["Auth0"].Audience || ""}
                    onChange={(e) =>
                      handleAuthConfigChange("Audience", e.target.value)
                    }
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    placeholder="Auth0 App ID"
                    value={authConfigs["Auth0"].AppId || ""}
                    onChange={(e) =>
                      handleAuthConfigChange("AppId", e.target.value)
                    }
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    placeholder="Auth0 Password"
                    type="password"
                    value={authConfigs["Auth0"].Password || ""}
                    onChange={(e) =>
                      handleAuthConfigChange("Password", e.target.value)
                    }
                    size="small"
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Response Section */}
        <Box sx={{ marginTop: "20px" }}>
          <Typography variant="h6">Response</Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size="10rem" />
            </Box>
          ) : (
            <>
              {responseStatus && (
                <Typography sx={{ mt: 1 }}>
                  <strong>Status:</strong> {responseStatus}
                </Typography>
              )}
              {responseHeaders && (
                <Box sx={{ marginTop: "10px", p: 1, borderRadius: "4px" }}>
                  <Typography>
                    <strong>Headers:</strong>
                  </Typography>
                  <ReactJson
                    src={responseHeaders}
                    theme={CustomTheme}
                    iconStyle="triangle"
                    enableClipboard={false}
                    name={false}
                    collapsed={false}
                    displayDataTypes={true}
                    onEdit={false}
                    onAdd={false}
                    onDelete={false}
                  />
                </Box>
              )}
              {responseData && (
                <Box sx={{ marginTop: "10px", p: 1, borderRadius: "4px" }}>
                  <Typography>
                    <strong>Body:</strong>
                  </Typography>
                  <ReactJson
                    src={responseData}
                    theme={CustomTheme}
                    iconStyle="triangle"
                    enableClipboard={false}
                    name={false}
                    collapsed={1}
                    displayDataTypes={true}
                    onEdit={false}
                    onAdd={false}
                    onDelete={false}
                    onSelect={({ namespace, name }) => {
                      const path =
                        namespace && namespace.length
                          ? `${namespace.join(".")}.${name}`
                          : name;
                      setSelectedJsonPath(path);
                    }}
                  />
                  {selectedJsonPath && (
                    <Typography variant="body2" sx={{ marginTop: "10px" }}>
                      Selected JSONPath: {selectedJsonPath}
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default RequestTesterField;
