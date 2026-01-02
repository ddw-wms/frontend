// Ensure AG Grid modules are registered synchronously at import time
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule, InfiniteRowModelModule } from 'ag-grid-community';

try {
    ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule, InfiniteRowModelModule]);
    // Lightweight log to help debug timing issues during development
    // eslint-disable-next-line no-console
    console.info('[agGridRegister] AG Grid modules registered: AllCommunityModule, ClientSideRowModelModule, InfiniteRowModelModule');
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('[agGridRegister] AG Grid module registration failed:', err);
}
