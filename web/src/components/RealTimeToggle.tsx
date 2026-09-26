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
      <h3>Real-time mode</h3>

      <label className={`live-switch${isEnabled ? " is-on" : ""}`} htmlFor="rtToggle">
        <input
          className="form-check-input"
          type="checkbox"
          id="rtToggle"
          checked={isEnabled}
          onChange={handleToggle}
          disabled={connecting}
        />
        Stream logs in real-time
      </label>

      <p className="panel-kicker">
        {connecting && "Connecting..."}
        {!connecting && isEnabled && "Connected — receiving live logs"}
        {!connecting && !isEnabled && "Browse stored logs"}
      </p>

      <div className="filter-callout">
        <strong>{isEnabled ? "Live" : "Historical"}</strong>
        <div>{isEnabled ? "Real-time" : "Search"}</div>
      </div>
    </div>
  );
};
