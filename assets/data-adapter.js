import {demoData} from './demo-data.js';
// UI consumes this interface. A production adapter must call an authenticated
// backend with authorization, validation and an agreed data contract.
export const demoAdapter = {async load(){return demoData;}};
// No public URL or token configuration: private Power BI embedding belongs to
// an authenticated backend and the official embedding SDK, not Publish to web.
export const reportAdapter = {async getReport(){return {connected:false};}};

// Workflow topology and case transition history are separate from sales records.
// No authenticated browser session, CRM diagram or live case data is embedded here.
export const workflowAdapter = {
  async load() {
    const [{processDemoData},{validateProcessData}] = await Promise.all([
      import('./process-demo.js'),import('./process-model.js')
    ]);
    return validateProcessData(processDemoData);
  }
};
