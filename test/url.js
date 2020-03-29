const chai = require('chai')

const should = chai.should()
const resolver = require('../')
const resolverErrors = require('../').errors

describe('Url Tests', () => {
  it('catch invalid urls', async () => {
    try {
      await resolver('s')
    } catch (err) {
      err.code.should.equal(resolverErrors.ERR_NOT_VALID_URL)
    }
  })

  it('catch empty urls', async () => {
    try {
      await resolver('')
    } catch (err) {
      err.code.should.equal(resolverErrors.ERR_MISSING_URL)
    }
  })

  it('catch not supported url', async () => {
    try {
      await resolver('http://www.soundcloud.com')
    } catch (err) {
      err.code.should.equal(resolverErrors.ERR_NOT_SUITABLE_URL)
    }
  })
})
