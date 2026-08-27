import { Link, useLocation } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background bg-grain flex items-center justify-center px-5">
      <div className="page-shell w-full max-w-md">
        <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 font-heading text-3xl font-normal">Nothing filed here</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No page answers to{' '}
          <span className="font-mono text-foreground/80 break-all">{location.pathname}</span>.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity"
        >
          Back to the ledger
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
