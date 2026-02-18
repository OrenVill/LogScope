import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable } from './components/LogTable'
import { RealTimeToggle } from './components/RealTimeToggle'

function App() {
  return (
    <div className="app d-flex flex-column h-100">
      <header className="app-header bg-dark text-white py-4 px-4 shadow-sm">
        <div className="container-fluid">
          <h1 className="mb-2 display-6">LogScope</h1>
          <p className="text-white-50 mb-0">Structured log collection and query service</p>
        </div>
      </header>

      <div className="app-container flex-grow-1 overflow-hidden d-flex gap-3 p-3">
        <aside className="sidebar bg-white rounded shadow-sm p-4 overflow-auto" style={{ width: '300px' }}>
          <FilterPanel />
          <hr className="my-4" />
          <RealTimeToggle />
        </aside>

        <main className="main-content bg-white rounded shadow-sm flex-grow-1 overflow-auto p-4">
          <LogTable />
        </main>
      </div>
    </div>
  )
}

export default App
