# Background Job Processing

This document explains the **background job processing system** implemented in the `/jobs` directory.  
It is powered by [BullMQ](https://docs.bullmq.io/) with **Redis** as the backend and provides a clean structure for scheduling, processing, and monitoring background tasks such as **emails, ETL jobs, reports, and maintenance tasks**.

---

## 📂 Folder Structure
### Implementation
/jobs
├── config/
│ └── redis.js # Redis connection helper
│
├── queues/
│ ├── emailQueue.js # Queue for email jobs
│ ├── etlQueue.js # Queue for ETL jobs
│ ├── reportQueue.js # Queue for report jobs
│ └── maintenanceQueue.js # Queue for maintenance jobs
│
├── workers/
│ ├── emailWorker.js # Processes email jobs
│ ├── etlWorker.js # Processes ETL jobs
│ ├── reportWorker.js # Processes report jobs
│ └── maintenanceWorker.js # Processes maintenance jobs
│
├── schedulers/
│ ├── emailScheduler.js # Schedules recurring email jobs
│ ├── etlScheduler.js # Schedules recurring ETL jobs
│ ├── reportScheduler.js # Schedules recurring report jobs
│ └── maintenanceScheduler.js # Schedules recurring maintenance jobs
│
├── monitoring.js # Bull Board & QueueEvents monitoring
└── index.js # Initializes all workers & schedulers

...
### Test
├── tests/
        jobs/
        ├── email.test.js # Tests email worker & scheduler
        ├── etl.test.js # Tests ETL worker & scheduler
        ├── report.test.js # Tests report worker & scheduler
        └── maintenance.test.js # Tests maintenance worker & scheduler



---

## ⚙️ How It Works

### 1. **Queues (`/queues`)**
Each job type (Email, ETL, Report, Maintenance) has its **own queue file**.

Example (`emailQueue.js`):
```js
const { Queue } = require("bullmq");
const { getRedisClient } = require("../config/redis");

const emailQueue = new Queue("emailQueue", { connection: getRedisClient });
module.exports = emailQueue;
```


## 🚀 Usage

### Start Redis:
    - docker run -p 6379:6379 redis

### Open monitoring dashboard:
    - http://localhost:3000/admin/queues