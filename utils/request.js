const promisify = require('promisify-es6')
const request = require('requestretry').defaults({
  jar: true,
  maxAttempts: 3,
  retryDelay: 3000,
  rejectUnauthorized: false
})

module.exports = promisify((opts, callback) => {
  request(opts, callback)
})
