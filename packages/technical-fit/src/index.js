import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { TechnicalFitReport } from './report.js';

lx.init().then(setup => {
  new TechnicalFitReport(setup).loadData();
});
