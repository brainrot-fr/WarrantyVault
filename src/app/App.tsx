import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DesignShowcase } from '@/routes/DesignShowcase';
import { copy } from '@/lib/copy';

function Home() {
  return (
    <main className="page-shell">
      <h1>{copy.appName}</h1>
      <p>{copy.homecoming}</p>
      {import.meta.env.DEV && <a href="/design">{copy.designLink}</a>}
    </main>
  );
}

function NotFound() {
  return (
    <main className="page-shell">
      <h1>{copy.notFoundTitle}</h1>
      <p>{copy.notFoundBody}</p>
      <a href="/">{copy.returnHome}</a>
    </main>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        {import.meta.env.DEV && <Route path="/design" element={<DesignShowcase />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="bottom-center" />
    </>
  );
}
