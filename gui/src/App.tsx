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
        border: "1px solid",
        backgroundColor: "grey",
        padding: "20px",
        borderRadius: "5px",
      }}
    >
      <CursorReplay events={events as CursorEvent[]} />
      <div
        style={{
          margin: "10px",
          border: "2px solid #1d1d1f",
          padding: "10px",
          maxHeight: "100px",
          overflowY: "auto",
          textOverflow: "ellipsis",
        }}
      >
        {events.map((event, index) => (
          <div
            key={index}
            style={{
              borderBottom: "1px solid",
              fontSize: "12px",
              padding: "5px",
            }}
          >
            <b>{event.type}:</b>{" "}
            <span style={{ color: "green", fontWeight: 600 }}>
              {" "}
              {JSON.stringify(event.payload)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
