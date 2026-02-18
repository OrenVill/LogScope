import './App.css'
import { FilterPanel } from './components/FilterPanel'
import { LogTable } from './components/LogTable'
import { RealTimeToggle } from './components/RealTimeToggle'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>LogScope</h1>
        <p>Structured log collection and query service</p>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <FilterPanel />
          <RealTimeToggle />
        </aside>

        <main className="main-content">
          <LogTable />
        </main>
      </div>
    </div>
  )
}

export default App
