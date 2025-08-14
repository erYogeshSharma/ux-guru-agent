import CursorReplay, { type CursorEvent } from "./CursorReplay";
import { useEventSocket } from "./hook/useWebSocket";
import { useEffect } from "react";

const WS_URL = "ws://localhost:8080";

const App = () => {
  const { isOpen, events, sendEvent: _sendEvent } = useEventSocket(WS_URL);

  // when socket opens, send a dummy page_view event
  useEffect(() => {
    if (isOpen) {
      _sendEvent("page_view", { url: window.location.href, ts: Date.now() });
    }
  }, [isOpen, _sendEvent]);
  return (
    <div
      style={{
        backgroundColor: "#1d1d1f",
        padding: "10px",
      }}
    >
      <CursorReplay events={events as CursorEvent[]} />
      <div
        style={{
          background: "black",
          padding: "10px",
          maxHeight: "400px",
          overflowY: "auto",
          textOverflow: "ellipsis",
          fontWeight: 500,
        }}
      >
        {events.map((event, index) => (
          <div
            key={index}
            style={{
              fontSize: "0.5rem",
              padding: "5px",
            }}
          >
            <b style={{ color: "white" }}>{event.type}&nbsp; ::: </b>{" "}
            <span style={{ color: "red" }}>
              {" "}
              {JSON.stringify(event.payload).substring(0, 60)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
