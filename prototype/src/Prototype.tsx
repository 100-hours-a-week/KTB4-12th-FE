import { installErrorCollector } from './features/report-bug';
import { setSimulatedKeyboardEnabled } from './mobile';

setSimulatedKeyboardEnabled(false);
installErrorCollector();

export { GiftApp as default } from './app/index';
