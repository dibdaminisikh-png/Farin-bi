import {demoData} from './demo-data.js';
// UI consumes this interface. A production adapter must call an authenticated
// backend with authorization, validation and an agreed data contract.
export const demoAdapter = {async load(){return demoData;}};
// No public URL or token configuration: private Power BI embedding belongs to
// an authenticated backend and the official embedding SDK, not Publish to web.
export const reportAdapter = {async getReport(){return {connected:false};}};
