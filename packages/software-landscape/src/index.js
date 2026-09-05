import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { SoftwareLandscapeReport } from './report.js';

lx.init().then(setup => new SoftwareLandscapeReport(setup).loadData());
