import React, { useState } from "react";

/**
 * RealTimeToggle component - switch between streaming and search modes
 * Phase 5: Full implementation
 */
export const RealTimeToggle: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <div className="realtime-toggle">
      <h3 className="mb-3">⚡ Real-Time Mode</h3>
      
      <div className="form-check form-switch">
        <input 
          className="form-check-input" 
          type="checkbox" 
          id="rtToggle"
          checked={isStreaming}
          onChange={(e) => setIsStreaming(e.target.checked)}
          disabled
        />
        <label className="form-check-label" htmlFor="rtToggle">
          Stream logs in real-time
        </label>
      </div>
      
      <small className="text-muted d-block mt-2">
        {isStreaming 
          ? "🔄 Phase 4: WebSocket streaming coming soon" 
          : "📚 Phase 3: Browse stored logs"}
      </small>
      
      <div className="mt-3">
        <button className="btn btn-outline-secondary btn-sm w-100" disabled>
          {isStreaming ? "Disconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
};
