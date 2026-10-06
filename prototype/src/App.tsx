import { MobileRuntime } from './mobile';
import Prototype from './Prototype';
import { ErrorBoundary } from './shared/ui';

export default function App() {
  return (
    <ErrorBoundary>
      <MobileRuntime>
        <Prototype />
      </MobileRuntime>
    </ErrorBoundary>
  );
}
