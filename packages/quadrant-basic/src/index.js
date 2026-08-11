import '@leanix/reporting';
import './assets/report.css';
import { QuadrantBasicReport } from './report.js';

lx.init().then(setup => new QuadrantBasicReport(setup).loadData());
