// load workers (so they start consuming)
require('./workers/emailWorker');
require('./workers/etlWorker');
require('./workers/reportWorker');
require('./workers/maintenanceWorker');

// load schedulers (so they register)
require('./schedulers/emailScheduler');
require('./schedulers/etlScheduler');
require('./schedulers/reportScheduler');
require('./schedulers/maintenanceScheduler');

console.log('✅ Job system initialized');
