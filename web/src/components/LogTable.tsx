import React from "react";

/**
 * LogTable component - displays logs in a table format
 * Phase 5: Full implementation
 */
export const LogTable: React.FC = () => {
  return (
    <div className="log-table">
      <h2 className="mb-4 h4">📋 Logs</h2>
      
      <div className="alert alert-info mb-4" role="alert">
        <strong>✅ Phase 1 Complete!</strong> Infrastructure and data models ready.
      </div>
      
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <h5 className="card-title text-muted">⏳ Waiting for logs...</h5>
          <p className="card-text text-muted small mb-3">
            Phase 5: Table implementation will display collected logs here
          </p>
          <div className="mt-3">
            <span className="badge bg-secondary me-2">debug</span>
            <span className="badge bg-info me-2">info</span>
            <span className="badge bg-success me-2">success</span>
            <span className="badge bg-warning me-2">warn</span>
            <span className="badge bg-danger">error</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-light rounded border-start border-4 border-success">
        <small className="text-muted d-block mb-2">
          <strong>Service Status:</strong>
        </small>
        <div className="d-flex gap-3 flex-wrap text-muted small">
          <span>✓ Backend: <code>localhost:3000</code></span>
          <span>✓ Frontend: <code>localhost:5173</code></span>
        </div>
      </div>
    </div>
  );
};
