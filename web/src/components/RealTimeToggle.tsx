import React, { useState } from "react";

interface RealTimeToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * RealTimeToggle component - switch between streaming and search modes
 */
export const RealTimeToggle: React.FC<RealTimeToggleProps> = ({ isEnabled, onToggle }) => {
  const [connecting, setConnecting] = useState(false);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setConnecting(true);
    try {
      onToggle(e.target.checked);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="realtime-toggle">
      <h3 className="mb-3">⚡ Real-Time Mode</h3>

      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          id="rtToggle"
          checked={isEnabled}
          onChange={handleToggle}
          disabled={connecting}
        />
        <label className="form-check-label" htmlFor="rtToggle">
          Stream logs in real-time
        </label>
      </div>

      <small className="text-muted d-block mt-2">
        {connecting && "🔄 Connecting..."}
        {!connecting && isEnabled && "✅ Connected - receiving live logs"}
        {!connecting && !isEnabled && "📚 Browse stored logs"}
      </small>

      <div className="mt-3 p-3 bg-light rounded border-start border-3" style={{borderColor: isEnabled ? "#198754" : "#6c757d"}}>
        <small className="text-muted">
          <strong>Mode:</strong>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span>
              {isEnabled ? "🟢 Live" : "⚪ Historical"}
            </span>
            <span className="badge" style={{backgroundColor: isEnabled ? "#198754" : "#6c757d"}}>
              {isEnabled ? "Real-time" : "Search"}
            </span>
          </div>
        </small>
      </div>

      <div className="mt-3">
        <small className="text-muted d-block mb-2">
          <strong>Settings:</strong>
        </small>
        <small className="text-muted">
          • Filters disabled in real-time mode
          <br />
          • Latest 100 logs kept in memory
          <br />
          • Auto-reconnect on disconnect
        </small>
      </div>
    </div>
  );
};
