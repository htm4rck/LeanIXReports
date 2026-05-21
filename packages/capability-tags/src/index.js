import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { CapabilityTagsReport } from './report.js';

lx.init().then(setup => {
  new CapabilityTagsReport(setup).loadData();
});
