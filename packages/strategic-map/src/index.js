import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { StrategicMapReport } from './report.js';

lx.init().then(setup => {
  new StrategicMapReport(setup).loadData();
});
