import { MainLayout } from './layouts/MainLayout';

function App() {
  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Overview</h1>
          <p className="text-muted-foreground">Welcome to NOVA Workspace.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: 'Active Tasks', value: '—' },
            { label: 'Completed Tasks', value: '—' },
            { label: 'Success Rate', value: '—' },
            { label: 'Tool Executions', value: '—' }
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-muted-foreground">{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="border rounded-xl p-6 bg-card">
          <h2 className="text-xl font-semibold mb-4">What do you want NOVA to accomplish?</h2>
          <textarea
            className="w-full min-h-[120px] p-4 rounded-md border bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            placeholder="Find AI jobs in Dubai suitable for my profile..."
          />
          <div className="flex justify-end">
            <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
              Run Task
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default App;
