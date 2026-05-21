import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/poster.css';
import { CapabilityPosterReport } from './report.js';

lx.init().then(setup => {
  new CapabilityPosterReport(setup).loadData();
});
