import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
} from "react";

const TerminalStateContext = createContext();
const TerminalDispatchContext = createContext();

const terminalReducer = (state, action) => {
  switch (action.type) {
    case "ADD_OUTPUT":
      return { ...state, output: state.output + action.payload };
    case "CLEAR_OUTPUT":
      return { ...state, output: "" };
    case "SET_RUNNING":
      return { ...state, isRunning: action.payload };
    case "SET_TESTING_CONNECTION":
      return { ...state, isTestingConnection: action.payload };
    case "SET_STATUS": //  ←  NEW
      return { ...state, status: action.payload };
    case "RESET_TIMER":
      return { ...state, startTime: Date.now(), elapsedTime: "0.00" };
    case "UPDATE_ELAPSED_TIME":
      return { ...state, elapsedTime: action.payload };
    case "SET_PROCESS_INFO":
      return {
        ...state,
        processInfo: {
          name: action.payload.name,
          actions: action.payload.actions,
          configName: action.payload.configName,
          startTime: new Date().toLocaleTimeString(),
        },
      };
    case "UPDATE_PROCESS_STATUS":
      return {
        ...state,
        processInfo: state.processInfo
          ? {
              ...state.processInfo,
              status: action.payload.status,
              endTime: action.payload.status
                ? new Date().toLocaleTimeString()
                : undefined,
              finalElapsedTime: action.payload.status
                ? state.elapsedTime
                : undefined,
            }
          : null,
      };
    case "CLEAR_PROCESS_INFO":
      return { ...state, processInfo: null };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
};

export const TerminalProvider = ({ children }) => {
  const [state, dispatch] = useReducer(terminalReducer, {
    output: "",
    isRunning: false,
    isTestingConnection: false,
    status: null,
    startTime: null,
    elapsedTime: "0.00",
    processInfo: null, // { name, actions, configName }
  });

  const intervalRef = useRef(null);

  // Handle elapsed time updates globally
  useEffect(() => {
    if ((state.isRunning || state.isTestingConnection) && state.startTime) {
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - state.startTime) / 1000;
        const formattedElapsed = elapsed.toFixed(2);
        dispatch({ type: "UPDATE_ELAPSED_TIME", payload: formattedElapsed });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, state.isTestingConnection, state.startTime]);

  return (
    <TerminalStateContext.Provider value={state}>
      <TerminalDispatchContext.Provider value={dispatch}>
        {children}
      </TerminalDispatchContext.Provider>
    </TerminalStateContext.Provider>
  );
};

export const useTerminalState = () => useContext(TerminalStateContext);
export const useTerminalDispatch = () => useContext(TerminalDispatchContext);
