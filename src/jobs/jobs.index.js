const cron = require('node-cron');

// // Schedule a job to run every minute
// cron.schedule('* * * * *', () => {
//     console.log('Cron job running every minute:', new Date().toISOString());
//     // Place your job logic here
//     // console.log('Initializing GAM reports...');
//     // initGamReports()
// });


// // run cron job everyday at 8 AM UTC
// cron.schedule('0 8 * * *', () => {
//     console.log('Cron job running at 8:00 AM UTC:', new Date().toISOString(), 'GAM reports...');
//     // Place your job logic here
//     initGamReports();
// });