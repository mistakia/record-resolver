const chai = require('chai')

const should = chai.should()
const resolver = require('../')
const resolverErrors = require('../').errors

describe('Url Tests', () => {
  it('catch invalid urls', (done) => {
    const url = 's'
    resolver(url, (err, info) => {
      if (!err) {
        return done('Did not throw invalid url error')
      }

      err.code.should.equal(resolverErrors.ERR_NOT_VALID_URL)
      done()
    })
  })

  it('catch empty urls', (done) => {
    const url = ''
    resolver(url, (err, info) => {
      if (!err) {
        return done('Did not throw empty url error')
      }

      err.code.should.equal(resolverErrors.ERR_MISSING_URL)
      done()
    })
  })
})
