import '@leanix/reporting';
import '@shared/styles/base.css';
import './assets/report.css';
import { SoftwareQuadrantReport } from './report.js';

lx.init().then(setup => new SoftwareQuadrantReport(setup).loadData());
